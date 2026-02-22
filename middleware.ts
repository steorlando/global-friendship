import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { ROLE_ROUTES } from "@/lib/auth/roles";

function pathMatches(path: string, basePath: string): boolean {
  return path === basePath || path.startsWith(`${basePath}/`);
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

  if (profileError) {
    return NextResponse.redirect(new URL("/login?error=role_lookup", req.url));
  }
  const role = profile?.ruolo ?? null;
  const participantBase = ROLE_ROUTES.partecipante;
  const capogruppoBase = ROLE_ROUTES.capogruppo;
  const managerBase = ROLE_ROUTES.manager;
  const alloggiBase = ROLE_ROUTES.alloggi;
  const adminBase = ROLE_ROUTES.admin;

  if (path === "/dashboard") {
    if (role === "admin") return NextResponse.redirect(new URL(adminBase, req.url));
    if (role === "manager") return NextResponse.redirect(new URL(managerBase, req.url));
    if (role === "capogruppo") {
      return NextResponse.redirect(new URL(capogruppoBase, req.url));
    }
    if (role === "alloggi") return NextResponse.redirect(new URL(alloggiBase, req.url));
    return NextResponse.redirect(new URL(participantBase, req.url));
  }

  if (pathMatches(path, adminBase) && role !== "admin") {
    return NextResponse.redirect(new URL(participantBase, req.url));
  }

  if (pathMatches(path, managerBase) && role !== "manager" && role !== "admin") {
    return NextResponse.redirect(new URL(participantBase, req.url));
  }

  if (pathMatches(path, capogruppoBase) && role !== "capogruppo" && role !== "admin") {
    return NextResponse.redirect(new URL(participantBase, req.url));
  }

  if (pathMatches(path, alloggiBase) && role !== "alloggi" && role !== "admin") {
    return NextResponse.redirect(new URL(participantBase, req.url));
  }

  return res;
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
