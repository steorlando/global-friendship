import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isAppRole, ROLE_ROUTES, type AppRole } from "@/lib/auth/roles";

function roleCanAccessPath(role: AppRole, path: string): boolean {
  if (role === "admin") return true;
  const roleBase = ROLE_ROUTES[role];
  return path === roleBase || path.startsWith(`${roleBase}/`);
}

export async function middleware(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return NextResponse.next();
  }

  const res = NextResponse.next();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          res.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirectedFrom", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  const path = req.nextUrl.pathname;
  const { data: profile, error: profileError } = await supabase
    .from("profili")
    .select("ruolo")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.ruolo;
  if (profileError) {
    return NextResponse.redirect(new URL("/login?error=role_lookup", req.url));
  }

  if (isAppRole(role)) {
    if (path === "/dashboard") {
      return NextResponse.redirect(new URL(ROLE_ROUTES[role], req.url));
    }

    if (!roleCanAccessPath(role, path)) {
      return NextResponse.redirect(new URL(ROLE_ROUTES[role], req.url));
    }
    return res;
  }

  const participantBase = ROLE_ROUTES.partecipante;
  if (path === "/dashboard") {
    return NextResponse.redirect(new URL(participantBase, req.url));
  }
  if (!(path === participantBase || path.startsWith(`${participantBase}/`))) {
    return NextResponse.redirect(new URL(participantBase, req.url));
  }

  return res;
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
