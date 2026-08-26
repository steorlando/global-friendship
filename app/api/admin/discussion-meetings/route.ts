import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin/auth";
import {
  isDiscussionMeetingNumber,
  type DiscussionMeetingNumber,
} from "@/lib/admin/discussion-meetings";
import {
  loadDiscussionMeetingDashboard,
  saveDiscussionMeetingAssignment,
} from "@/lib/admin/discussion-meetings-server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function parseMeetingNumber(value: unknown): {
  value: DiscussionMeetingNumber | null;
  valid: boolean;
} {
  if (value === null) return { value: null, valid: true };
  return isDiscussionMeetingNumber(value)
    ? { value, valid: true }
    : { value: null, valid: false };
}

export async function GET() {
  const auth = await requireAdminUser();
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const dashboard = await loadDiscussionMeetingDashboard(
      createSupabaseServiceClient({ noStore: true }),
    );
    return NextResponse.json(dashboard, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdminUser();
  if ("errorResponse" in auth) return auth.errorResponse;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Corpo JSON non valido." }, { status: 400 });
  }

  const groupId = normalizeText(body.groupId);
  const higher = parseMeetingNumber(body.higherMeetingNumber);
  const universityWorker = parseMeetingNumber(body.universityWorkerMeetingNumber);
  if (!groupId || !higher.valid || !universityWorker.valid) {
    return NextResponse.json(
      { error: "Gruppo o numero di riunione non valido." },
      { status: 400 },
    );
  }

  const service = createSupabaseServiceClient({ noStore: true });
  try {
    const currentDashboard = await loadDiscussionMeetingDashboard(service);
    const group = currentDashboard.groups.find((row) => row.id === groupId);
    if (!group) {
      return NextResponse.json({ error: "Gruppo non trovato." }, { status: 404 });
    }

    const clearing = higher.value === null && universityWorker.value === null;
    if (!clearing && group.total === 0) {
      return NextResponse.json(
        { error: "Il gruppo non ha partecipanti attivi da assegnare." },
        { status: 400 },
      );
    }

    const isWholeAssignment =
      higher.value !== null && higher.value === universityWorker.value;
    if (!clearing && !isWholeAssignment) {
      const higherComponentTotal =
        group.higherStudents + group.operatorDistribution.higher;
      const universityComponentTotal =
        group.universityWorkers + group.operatorDistribution.universityWorker;

      if (higher.value !== null && higherComponentTotal === 0) {
        return NextResponse.json(
          { error: "Questo gruppo non ha una componente Superiori da assegnare." },
          { status: 400 },
        );
      }
      if (universityWorker.value !== null && universityComponentTotal === 0) {
        return NextResponse.json(
          {
            error:
              "Questo gruppo non ha una componente Universitari/Lavoratori da assegnare.",
          },
          { status: 400 },
        );
      }
    }

    await saveDiscussionMeetingAssignment(
      service,
      {
        groupId,
        higherMeetingNumber: higher.value,
        universityWorkerMeetingNumber: universityWorker.value,
      },
      auth.user.id,
    );

    const dashboard = await loadDiscussionMeetingDashboard(service);
    return NextResponse.json(dashboard, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
}
