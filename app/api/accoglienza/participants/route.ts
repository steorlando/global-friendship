import { NextResponse } from "next/server";
import { requireReceptionContext } from "@/lib/accoglienza/auth";
import { loadArrivalDashboardData } from "@/lib/accoglienza/arrival-data";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BULK_ARRIVALS = 1000;
const BATCH_SIZE = 100;

function batches<T>(values: T[]): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += BATCH_SIZE) {
    result.push(values.slice(index, index + BATCH_SIZE));
  }
  return result;
}

export async function GET() {
  const auth = await requireReceptionContext();
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const data = await loadArrivalDashboardData(auth.service);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load arrivals" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireReceptionContext();
  if ("errorResponse" in auth) return auth.errorResponse;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const ids = [
    ...new Set(
      (Array.isArray(body.participantIds) ? body.participantIds : [])
        .map((value) => String(value).trim().toLowerCase())
        .filter(Boolean)
    ),
  ];

  if (ids.length === 0) {
    return NextResponse.json(
      { error: "At least one participant is required" },
      { status: 400 }
    );
  }
  if (ids.length > MAX_BULK_ARRIVALS) {
    return NextResponse.json(
      { error: `A maximum of ${MAX_BULK_ARRIVALS} participants can be updated at once` },
      { status: 400 }
    );
  }
  if (ids.some((id) => !UUID_PATTERN.test(id))) {
    return NextResponse.json({ error: "Invalid participant id" }, { status: 400 });
  }

  try {
    const activeIds = new Set<string>();
    for (const batch of batches(ids)) {
      const { data, error } = await auth.service
        .from("partecipanti")
        .select("id")
        .in("id", batch)
        .is("deleted_at", null);
      if (error) throw new Error(error.message);
      for (const row of data ?? []) activeIds.add(String(row.id));
    }

    if (activeIds.size !== ids.length) {
      return NextResponse.json(
        { error: "One or more participants are not active" },
        { status: 400 }
      );
    }

    const arrivedAt = new Date().toISOString();
    for (const batch of batches(ids)) {
      const { error } = await auth.service
        .from("participant_event_arrivals")
        .update({
          arrived_at: arrivedAt,
          marked_by: auth.user.id,
          marked_by_email: auth.profile.email,
        })
        .in("participant_id", batch)
        .is("arrived_at", null);
      if (error) throw new Error(error.message);
    }

    const statusById = new Map<string, string | null>();
    for (const batch of batches(ids)) {
      const { data, error } = await auth.service
        .from("participant_event_arrivals")
        .select("participant_id,arrived_at")
        .in("participant_id", batch);
      if (error) throw new Error(error.message);
      for (const row of data ?? []) {
        statusById.set(String(row.participant_id), row.arrived_at as string | null);
      }
    }

    const missingIds = ids.filter((id) => !statusById.get(id));
    if (missingIds.length > 0) {
      const { error } = await auth.service.from("participant_event_arrivals").upsert(
        missingIds.map((participantId) => ({
          participant_id: participantId,
          arrived_at: arrivedAt,
          marked_by: auth.user.id,
          marked_by_email: auth.profile.email,
        })),
        { onConflict: "participant_id", ignoreDuplicates: true }
      );
      if (error) throw new Error(error.message);
    }

    const verifyRows: Array<{ participant_id: string; arrived_at: string | null }> = [];
    for (const batch of batches(ids)) {
      const { data, error } = await auth.service
        .from("participant_event_arrivals")
        .select("participant_id,arrived_at")
        .in("participant_id", batch);
      if (error) throw new Error(error.message);
      verifyRows.push(...((data ?? []) as typeof verifyRows));
    }

    const verified = new Map(
      verifyRows.map((row) => [row.participant_id, row.arrived_at] as const)
    );
    if (ids.some((id) => !verified.get(id))) {
      throw new Error("Arrival update postcondition failed");
    }

    return NextResponse.json({
      ok: true,
      updated: ids.map((participantId) => ({
        participantId,
        arrivedAt: verified.get(participantId),
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to mark arrivals" },
      { status: 500 }
    );
  }
}
