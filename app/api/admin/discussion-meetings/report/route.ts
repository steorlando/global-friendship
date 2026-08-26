import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin/auth";
import { buildDiscussionMeetingsReport } from "@/lib/admin/discussion-meetings-report";
import { loadDiscussionMeetingDashboard } from "@/lib/admin/discussion-meetings-server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAdminUser();
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const dashboard = await loadDiscussionMeetingDashboard(
      createSupabaseServiceClient({ noStore: true }),
    );

    const generatedAt = new Date();
    const report = await buildDiscussionMeetingsReport(dashboard);
    const dateStamp = generatedAt.toISOString().slice(0, 10);
    return new NextResponse(new Uint8Array(report), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="riunioni-di-confronto-${dateStamp}.docx"`,
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
}
