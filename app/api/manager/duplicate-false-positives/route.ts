import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeUuid(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return UUID_RE.test(trimmed) ? trimmed.toLowerCase() : null;
}

function pairOrder(a: string, b: string): { low: string; high: string } {
  return a < b ? { low: a, high: b } : { low: b, high: a };
}

async function requireManagerOrAdmin() {
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

  const service = createSupabaseServiceClient();
  const email = (user.email ?? "").trim().toLowerCase();
  const { data: profile, error: profileError } = await service
    .from("profili")
    .select("id")
    .ilike("email", email)
    .in("ruolo", ["manager", "admin"])
    .limit(1);

  if (profileError || !profile || profile.length === 0) {
    return {
      errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { user, service };
}

export async function POST(req: Request) {
  const auth = await requireManagerOrAdmin();
  if ("errorResponse" in auth) return auth.errorResponse;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const firstId = normalizeUuid(formData.get("participant_a_id"));
  const secondId = normalizeUuid(formData.get("participant_b_id"));

  if (!firstId || !secondId || firstId === secondId) {
    return NextResponse.json(
      { error: "participant_a_id and participant_b_id are required" },
      { status: 400 }
    );
  }

  const { low, high } = pairOrder(firstId, secondId);
  const { error } = await auth.service
    .from("duplicate_false_positives")
    .upsert(
      {
        participant_a_id: low,
        participant_b_id: high,
        created_by: auth.user.id,
      },
      { onConflict: "participant_a_id,participant_b_id", ignoreDuplicates: true }
    );

  if (error && error.code !== "42P01") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const referer = req.headers.get("referer");
  if (referer) {
    try {
      const url = new URL(referer);
      url.hash = "duplicates-non-associated";
      return NextResponse.redirect(url, { status: 303 });
    } catch {
      // ignore invalid referer and use fallback
    }
  }

  return NextResponse.redirect(new URL("/dashboard/manager#duplicates-non-associated", req.url), {
    status: 303,
  });
}
