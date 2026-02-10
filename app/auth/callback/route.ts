import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ROLE_ROUTES: Record<string, string> = {
  admin: "/dashboard/admin",
  capogruppo: "/dashboard/capogruppo",
  partecipante: "/dashboard/partecipante",
};

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");

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

      const route = profile?.ruolo ? ROLE_ROUTES[profile.ruolo] : undefined;
      return NextResponse.redirect(`${origin}${route ?? "/dashboard"}`);
    }
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
