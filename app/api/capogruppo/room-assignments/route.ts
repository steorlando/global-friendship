import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  syncLegacyParticipantRoomFields,
  loadGroupLeaderRoomAssignmentData,
  normalizeParticipantSexCategory,
  validateGroupLeaderRoomAssignment,
} from "@/lib/capogruppo/room-assignments";
import { isOrganizationProvidedAccommodation } from "@/lib/alloggi/inventory";

type ParticipantScopeRow = {
  id: string;
  nome: string | null;
  cognome: string | null;
  gruppo_id: string | null;
  gruppo_label: string | null;
  alloggio: string | null;
  alloggio_short: string | null;
  data_arrivo: string | null;
  data_partenza: string | null;
  sesso: string | null;
};

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function requireCapogruppoContext() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const email = (user.email ?? "").trim().toLowerCase();
  if (!email) {
    return {
      errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  const service = createSupabaseServiceClient();
  const { data: profile, error: profileError } = await service
    .from("profili")
    .select("id")
    .ilike("email", email)
    .eq("ruolo", "capogruppo")
    .order("created_at", { ascending: false })
    .maybeSingle();

  if (profileError) {
    return {
      errorResponse: NextResponse.json({ error: profileError.message }, { status: 500 }),
    };
  }

  if (!profile?.id) {
    return {
      errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  const { data: links, error: linksError } = await service
    .from("profili_gruppi")
    .select("gruppo_id")
    .eq("profilo_id", profile.id);

  if (linksError) {
    return {
      errorResponse: NextResponse.json({ error: linksError.message }, { status: 500 }),
    };
  }

  const groups = [...new Set((links ?? []).map((row) => String(row.gruppo_id ?? "").trim()))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  return { user, service, groups };
}

function resolveAuthorizedGroupId(
  allowedGroupIds: string[],
  participant: { gruppo_id: string | null; gruppo_label: string | null }
): string | null {
  const candidateGroupId = normalizeText(participant.gruppo_id);
  const candidateGroupLabel = normalizeText(participant.gruppo_label);
  if (candidateGroupId && allowedGroupIds.includes(candidateGroupId)) {
    return candidateGroupId;
  }
  if (candidateGroupLabel && allowedGroupIds.includes(candidateGroupLabel)) {
    return candidateGroupLabel;
  }
  return null;
}

export async function GET(req: Request) {
  const auth = await requireCapogruppoContext();
  if ("errorResponse" in auth) return auth.errorResponse;

  const url = new URL(req.url);
  const groupId = normalizeText(url.searchParams.get("groupId"));
  if (groupId && !auth.groups.includes(groupId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const data = await loadGroupLeaderRoomAssignmentData(auth.service, auth.groups, {
      groupId,
    });

    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load room assignments";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const auth = await requireCapogruppoContext();
  if ("errorResponse" in auth) return auth.errorResponse;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const participantId = normalizeText(body.participantId);
  const roomId = normalizeText(body.roomId);

  if (!participantId) {
    return NextResponse.json({ error: "participantId is required" }, { status: 400 });
  }

  const { data: participant, error: participantError } = await auth.service
    .from("partecipanti")
    .select(
      "id,nome,cognome,gruppo_id,gruppo_label,alloggio,alloggio_short,data_arrivo,data_partenza,sesso"
    )
    .eq("id", participantId)
    .maybeSingle();

  if (participantError) {
    return NextResponse.json({ error: participantError.message }, { status: 500 });
  }
  if (!participant) {
    return NextResponse.json({ error: "Participant not found" }, { status: 404 });
  }

  const participantRow = participant as ParticipantScopeRow;
  const resolvedGroupId = resolveAuthorizedGroupId(auth.groups, participantRow);
  if (!resolvedGroupId) {
    return NextResponse.json(
      { error: "Participant is outside the authorized groups" },
      { status: 403 }
    );
  }

  if (
    !isOrganizationProvidedAccommodation(
      participantRow.alloggio_short ?? participantRow.alloggio
    )
  ) {
    return NextResponse.json(
      { error: "Participant is not eligible for organization-provided accommodation" },
      { status: 400 }
    );
  }

  const { data: currentAssignment, error: currentAssignmentError } = await auth.service
    .from("partecipanti_stanze")
    .select("id,stanza_id")
    .eq("partecipante_id", participantId)
    .maybeSingle();

  if (currentAssignmentError) {
    return NextResponse.json({ error: currentAssignmentError.message }, { status: 500 });
  }

  if (!roomId) {
    if (!currentAssignment?.id) {
      return NextResponse.json({ ok: true, assignment: null, warnings: [] });
    }

    const { error: deleteError } = await auth.service
      .from("partecipanti_stanze")
      .delete()
      .eq("id", currentAssignment.id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    await syncLegacyParticipantRoomFields(auth.service, {
      participantId,
      roomId: null,
      hotelId: null,
    });

    return NextResponse.json({ ok: true, assignment: null, warnings: [] });
  }

  const [roomData, roomScopeRes, sameRoomAssignmentsRes] = await Promise.all([
    loadGroupLeaderRoomAssignmentData(auth.service, auth.groups, { groupId: resolvedGroupId }),
    auth.service
      .from("stanze_gruppi")
      .select("gruppo_id")
      .eq("stanza_id", roomId),
    auth.service.from("partecipanti_stanze").select("partecipante_id").eq("stanza_id", roomId),
  ]);

  const room = roomData.rooms.find((item) => item.id === roomId);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  if (roomScopeRes.error) {
    return NextResponse.json({ error: roomScopeRes.error.message }, { status: 500 });
  }
  if (sameRoomAssignmentsRes.error) {
    return NextResponse.json(
      { error: sameRoomAssignmentsRes.error.message },
      { status: 500 }
    );
  }

  const occupantIds = [...new Set((sameRoomAssignmentsRes.data ?? [])
    .map((row) => String(row.partecipante_id ?? "").trim())
    .filter((value) => value && value !== participantId))];

  const occupantsRes =
    occupantIds.length > 0
      ? await auth.service
          .from("partecipanti")
          .select("id,data_arrivo,data_partenza,sesso")
          .in("id", occupantIds)
      : { data: [], error: null };

  if (occupantsRes.error) {
    return NextResponse.json({ error: occupantsRes.error.message }, { status: 500 });
  }

  try {
    const validation = validateGroupLeaderRoomAssignment({
      allowedGroupIds: auth.groups,
      participant: {
        id: participantRow.id,
        groupId: participantRow.gruppo_id,
        groupLabel: participantRow.gruppo_label,
        accommodation: participantRow.alloggio,
        accommodationShort: participantRow.alloggio_short,
        arrivalDate: participantRow.data_arrivo,
        departureDate: participantRow.data_partenza,
        sex: participantRow.sesso,
      },
      room: {
        id: room.id,
        capacity: room.capacity,
        genderPolicy: room.genderPolicy,
        availableFrom: room.availableFrom,
        availableTo: room.availableTo,
      },
      roomScopeGroupIds: (roomScopeRes.data ?? [])
        .map((row) => String(row.gruppo_id ?? "").trim())
        .filter(Boolean),
      existingOccupants: ((occupantsRes.data ?? []) as Array<{
        id: string;
        data_arrivo: string | null;
        data_partenza: string | null;
        sesso: string | null;
      }>).map((row) => ({
        participantId: row.id,
        arrivalDate: row.data_arrivo,
        departureDate: row.data_partenza,
        sex: row.sesso,
      })),
    });

    if (currentAssignment?.id) {
      const { error: updateError } = await auth.service
        .from("partecipanti_stanze")
        .update({
          stanza_id: roomId,
          gruppo_id: validation.resolvedGroupId,
          updated_by: auth.user.id,
        })
        .eq("id", currentAssignment.id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    } else {
      const { error: insertError } = await auth.service.from("partecipanti_stanze").insert({
        partecipante_id: participantId,
        stanza_id: roomId,
        gruppo_id: validation.resolvedGroupId,
        created_by: auth.user.id,
        updated_by: auth.user.id,
      });

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    await syncLegacyParticipantRoomFields(auth.service, {
      participantId,
      roomId: room.id,
      hotelId: room.hotelId,
    });

    const { data: savedAssignment, error: savedAssignmentError } = await auth.service
      .from("partecipanti_stanze")
      .select("id,partecipante_id,stanza_id,gruppo_id,created_at,updated_at,created_by,updated_by")
      .eq("partecipante_id", participantId)
      .maybeSingle();

    if (savedAssignmentError) {
      return NextResponse.json({ error: savedAssignmentError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      assignment: savedAssignment
        ? {
            id: savedAssignment.id,
            participantId: String(savedAssignment.partecipante_id ?? ""),
            roomId: String(savedAssignment.stanza_id ?? ""),
            groupId: String(savedAssignment.gruppo_id ?? ""),
            createdAt: savedAssignment.created_at,
            updatedAt: savedAssignment.updated_at,
            createdBy: savedAssignment.created_by,
            updatedBy: savedAssignment.updated_by,
          }
        : null,
      warnings: validation.warnings,
      participantSexCategory: normalizeParticipantSexCategory(participantRow.sesso),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to save room assignment";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
