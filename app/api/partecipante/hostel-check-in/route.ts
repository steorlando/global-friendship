import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { loadEventRuntimeSettings } from "@/lib/event/settings";
import {
  isMissingHostelCheckInTable,
  normalizeHostelCheckInInput,
  participantMayNeedHostelCheckIn,
} from "@/lib/alloggi/check-in";

type ParticipantRow = {
  id: string;
  nome: string | null;
  cognome: string | null;
  tipo_iscrizione: string | null;
  preferenza_alloggio_operatore: string | null;
  alloggio: string | null;
  alloggio_short: string | null;
  data_arrivo: string | null;
  data_partenza: string | null;
};

type CheckInRow = {
  identity_document_type: "passport" | "driving_license" | "national_id";
  identity_document_number: string;
  identity_document_country: string;
  identity_document_issuing_city: string;
  identity_document_issue_date: string;
  identity_document_expiration_date: string;
  completed_at: string;
  updated_at: string;
};

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

async function requireParticipant(participantId: string) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  const email = user?.email?.trim().toLowerCase();
  if (userError || !email) {
    return {
      errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const service = createSupabaseServiceClient();
  const { data, error } = await service
    .from("partecipanti")
    .select(
      "id,nome,cognome,tipo_iscrizione,preferenza_alloggio_operatore,alloggio,alloggio_short,data_arrivo,data_partenza"
    )
    .eq("id", participantId)
    .ilike("email", email)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    return {
      errorResponse: NextResponse.json({ error: error.message }, { status: 500 }),
    };
  }
  if (!data) {
    return {
      errorResponse: NextResponse.json(
        { error: "Participant not found for this account" },
        { status: 404 }
      ),
    };
  }

  return { service, participant: data as ParticipantRow };
}

async function loadRoomAssignment(
  service: ReturnType<typeof createSupabaseServiceClient>,
  participantId: string
) {
  const { data, error } = await service
    .from("partecipanti_stanze")
    .select("stanza_id")
    .eq("partecipante_id", participantId)
    .limit(1);

  if (error) throw new Error(error.message);
  return normalizeText(data?.[0]?.stanza_id);
}

async function loadExistingCheckIn(
  service: ReturnType<typeof createSupabaseServiceClient>,
  participantId: string
): Promise<CheckInRow | null> {
  const { data, error } = await service
    .from("participant_hostel_check_ins")
    .select(
      "identity_document_type,identity_document_number,identity_document_country,identity_document_issuing_city,identity_document_issue_date,identity_document_expiration_date,completed_at,updated_at"
    )
    .eq("participant_id", participantId)
    .maybeSingle();

  if (error) {
    if (isMissingHostelCheckInTable(error)) return null;
    throw new Error(error.message);
  }
  return (data as CheckInRow | null) ?? null;
}

export async function GET(req: Request) {
  const participantId = normalizeText(
    new URL(req.url).searchParams.get("participantId")
  );
  if (!participantId) {
    return NextResponse.json({ error: "participantId is required" }, { status: 400 });
  }

  const auth = await requireParticipant(participantId);
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const eventSettings = await loadEventRuntimeSettings(auth.service);
    if (!eventSettings.hostelCheckInEnabled) {
      return NextResponse.json({ enabled: false });
    }

    if (!participantMayNeedHostelCheckIn(auth.participant)) {
      return NextResponse.json({
        enabled: true,
        applicable: false,
        awaitingAssignment: false,
      });
    }

    const roomId = await loadRoomAssignment(auth.service, participantId);
    if (!roomId) {
      return NextResponse.json({
        enabled: true,
        applicable: false,
        awaitingAssignment: true,
      });
    }

    const { data: room, error: roomError } = await auth.service
      .from("stanze")
      .select("id,nome,codice_interno,numero_reale,albergo_id")
      .eq("id", roomId)
      .single();
    if (roomError) throw new Error(roomError.message);

    const [hotelResult, roommateAssignmentResult, existingCheckIn] = await Promise.all([
      auth.service
        .from("alberghi")
        .select("id,nome,indirizzo,google_maps_url")
        .eq("id", room.albergo_id)
        .single(),
      auth.service
        .from("partecipanti_stanze")
        .select("partecipante_id")
        .eq("stanza_id", roomId),
      loadExistingCheckIn(auth.service, participantId),
    ]);

    if (hotelResult.error) throw new Error(hotelResult.error.message);
    if (roommateAssignmentResult.error) {
      throw new Error(roommateAssignmentResult.error.message);
    }

    const roommateIds = (roommateAssignmentResult.data ?? [])
      .map((row) => normalizeText(row.partecipante_id))
      .filter((value): value is string => Boolean(value && value !== participantId));
    let roommates: Array<{ id: string; name: string }> = [];
    if (roommateIds.length > 0) {
      const { data: roommateRows, error: roommateError } = await auth.service
        .from("partecipanti")
        .select("id,nome,cognome")
        .in("id", roommateIds)
        .is("deleted_at", null);
      if (roommateError) throw new Error(roommateError.message);

      roommates = (roommateRows ?? [])
        .map((row) => ({
          id: row.id,
          name:
            [normalizeText(row.nome), normalizeText(row.cognome)]
              .filter(Boolean)
              .join(" ") || "-",
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    return NextResponse.json({
      enabled: true,
      applicable: true,
      awaitingAssignment: false,
      completed: Boolean(existingCheckIn?.completed_at),
      completedAt: existingCheckIn?.completed_at ?? null,
      accommodation: {
        hotelName: hotelResult.data.nome,
        hotelAddress: hotelResult.data.indirizzo,
        googleMapsUrl: hotelResult.data.google_maps_url,
        roomNumber: normalizeText(room.numero_reale),
        internalRoomCode:
          normalizeText(room.codice_interno) ?? normalizeText(room.nome) ?? "-",
        roomLabel:
          normalizeText(room.numero_reale) ??
          normalizeText(room.nome) ??
          normalizeText(room.codice_interno) ??
          "-",
        roommates,
      },
      stay: {
        arrivalDate: auth.participant.data_arrivo,
        departureDate: auth.participant.data_partenza,
      },
      checkIn: existingCheckIn
        ? {
            identityDocumentType: existingCheckIn.identity_document_type,
            identityDocumentNumber: existingCheckIn.identity_document_number,
            identityDocumentCountry: existingCheckIn.identity_document_country,
            identityDocumentIssuingCity:
              existingCheckIn.identity_document_issuing_city,
            identityDocumentIssueDate: existingCheckIn.identity_document_issue_date,
            identityDocumentExpirationDate:
              existingCheckIn.identity_document_expiration_date,
          }
        : null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load hostel check-in data",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const participantId = normalizeText(body.participantId);
  if (!participantId) {
    return NextResponse.json({ error: "participantId is required" }, { status: 400 });
  }

  const input = normalizeHostelCheckInInput(body);
  if (!input.ok) {
    return NextResponse.json({ error: input.error }, { status: 400 });
  }

  const auth = await requireParticipant(participantId);
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const eventSettings = await loadEventRuntimeSettings(auth.service);
    if (!eventSettings.hostelCheckInEnabled) {
      return NextResponse.json(
        { error: "Hostel check-in is not enabled" },
        { status: 403 }
      );
    }

    if (!participantMayNeedHostelCheckIn(auth.participant)) {
      return NextResponse.json(
        { error: "Hostel check-in is not applicable to this participant" },
        { status: 409 }
      );
    }

    const roomId = await loadRoomAssignment(auth.service, participantId);
    if (!roomId) {
      return NextResponse.json(
        { error: "A hostel room assignment is required" },
        { status: 409 }
      );
    }

    const completedAt = new Date().toISOString();
    const { data, error } = await auth.service
      .from("participant_hostel_check_ins")
      .upsert(
        {
          participant_id: participantId,
          identity_document_type: input.value.identityDocumentType,
          identity_document_number: input.value.identityDocumentNumber,
          identity_document_country: input.value.identityDocumentCountry,
          identity_document_issuing_city:
            input.value.identityDocumentIssuingCity,
          identity_document_issue_date: input.value.identityDocumentIssueDate,
          identity_document_expiration_date:
            input.value.identityDocumentExpirationDate,
          completed_at: completedAt,
        },
        { onConflict: "participant_id" }
      )
      .select("completed_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, completed: true, completedAt: data.completed_at });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to save hostel check-in",
      },
      { status: 500 }
    );
  }
}
