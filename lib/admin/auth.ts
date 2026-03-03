import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireAdminUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const email = (user.email ?? "").trim().toLowerCase();
  if (!email) {
    return { errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const { data: profile, error } = await supabase
    .from("profili")
    .select("ruolo")
    .ilike("email", email)
    .eq("ruolo", "admin")
    .maybeSingle();

  if (error || !profile) {
    return { errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { user };
}
