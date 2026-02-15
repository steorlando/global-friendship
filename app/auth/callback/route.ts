import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ROLE_ROUTES, isAppRole } from "@/lib/auth/roles";

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const requestedRole = searchParams.get("role");

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=auth`);
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("profili")
        .select("ruolo")
        .eq("id", user.id)
        .single();

      const roleFromProfile = profile?.ruolo ?? null;
      const route = isAppRole(requestedRole)
        ? ROLE_ROUTES[requestedRole]
        : isAppRole(roleFromProfile)
          ? ROLE_ROUTES[roleFromProfile]
          : undefined;

      return NextResponse.redirect(`${origin}${route ?? "/dashboard"}`);
    }
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
