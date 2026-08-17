import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { ROLE_ROUTES, isAppRole, type AppRole } from "@/lib/auth/roles";

function pathMatches(path: string, basePath: string): boolean {
  return path === basePath || path.startsWith(`${basePath}/`);
}

function clearSupabaseCookies(req: NextRequest, res: NextResponse): void {
  const authCookies = req.cookies
    .getAll()
    .map((cookie) => cookie.name)
    .filter((name) => name.startsWith("sb-"));

  for (const name of authCookies) {
    res.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
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
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    if (req.nextUrl.pathname === `${ROLE_ROUTES.partecipante}/tours`) {
      loginUrl.searchParams.set("role", "partecipante");
      loginUrl.searchParams.set("next", req.nextUrl.pathname);
    } else {
      loginUrl.searchParams.set("redirectedFrom", req.nextUrl.pathname);
    }
    const redirect = NextResponse.redirect(loginUrl);
    clearSupabaseCookies(req, redirect);
    return redirect;
  }

  const path = req.nextUrl.pathname;
  const email = (user.email ?? "").trim().toLowerCase();
  if (!email) {
    return NextResponse.redirect(new URL("/login?error=role_lookup", req.url));
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let profileRows: Array<{ ruolo: string | null }> | null = null;
  let profileError: { message?: string } | null = null;
  if (serviceKey) {
    const service = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await service
      .from("profili")
      .select("ruolo")
      .ilike("email", email);
    profileRows = (data as Array<{ ruolo: string | null }> | null) ?? null;
    profileError = error;
  } else {
    const { data, error } = await supabase
      .from("profili")
      .select("ruolo")
      .ilike("email", email);
    profileRows = (data as Array<{ ruolo: string | null }> | null) ?? null;
    profileError = error;
  }

  if (profileError) {
    return NextResponse.redirect(new URL("/login?error=role_lookup", req.url));
  }
  const roleSet = new Set(
    (profileRows ?? [])
      .map((row) => String(row.ruolo ?? "").trim())
      .filter(Boolean)
  );
  const participantBase = ROLE_ROUTES.partecipante;
  const capogruppoBase = ROLE_ROUTES.capogruppo;
  const managerBase = ROLE_ROUTES.manager;
  const alloggiBase = ROLE_ROUTES.alloggi;
  const accoglienzaBase = ROLE_ROUTES.accoglienza;
  const tourManagerBase = ROLE_ROUTES.tour_manager;
  const adminBase = ROLE_ROUTES.admin;
  const requestedRoleRaw = req.cookies.get("gf_requested_role")?.value ?? null;
  const requestedRole = isAppRole(requestedRoleRaw) ? requestedRoleRaw : null;

  const isAllowed = (requiredRole: AppRole): boolean => {
    if (requiredRole === "partecipante") return true;
    if (requiredRole === "alloggi") {
      return roleSet.has("admin") || roleSet.has("alloggi") || roleSet.has("manager");
    }
    if (roleSet.has("admin")) return true;
    return roleSet.has(requiredRole);
  };

  if (path === "/dashboard") {
    if (requestedRole && isAllowed(requestedRole)) {
      return NextResponse.redirect(new URL(ROLE_ROUTES[requestedRole], req.url));
    }
    if (roleSet.has("admin")) return NextResponse.redirect(new URL(adminBase, req.url));
    if (roleSet.has("manager")) return NextResponse.redirect(new URL(managerBase, req.url));
    if (roleSet.has("accoglienza")) {
      return NextResponse.redirect(new URL(accoglienzaBase, req.url));
    }
    if (roleSet.has("tour_manager")) {
      return NextResponse.redirect(new URL(tourManagerBase, req.url));
    }
    if (roleSet.has("capogruppo")) return NextResponse.redirect(new URL(capogruppoBase, req.url));
    if (roleSet.has("alloggi")) return NextResponse.redirect(new URL(alloggiBase, req.url));
    return NextResponse.redirect(new URL(participantBase, req.url));
  }

  const receptionOnly = roleSet.size === 1 && roleSet.has("accoglienza");
  if (receptionOnly && !pathMatches(path, accoglienzaBase)) {
    return NextResponse.redirect(new URL(accoglienzaBase, req.url));
  }

  const tourManagerOnly = roleSet.size === 1 && roleSet.has("tour_manager");
  if (tourManagerOnly && !pathMatches(path, tourManagerBase)) {
    return NextResponse.redirect(new URL(tourManagerBase, req.url));
  }

  if (pathMatches(path, accoglienzaBase) && !isAllowed("accoglienza")) {
    return NextResponse.redirect(new URL(participantBase, req.url));
  }

  if (pathMatches(path, tourManagerBase) && !isAllowed("tour_manager")) {
    return NextResponse.redirect(new URL(participantBase, req.url));
  }

  if (pathMatches(path, adminBase) && !roleSet.has("admin")) {
    return NextResponse.redirect(new URL(participantBase, req.url));
  }

  if (pathMatches(path, managerBase) && !isAllowed("manager")) {
    return NextResponse.redirect(new URL(participantBase, req.url));
  }

  if (pathMatches(path, capogruppoBase) && !isAllowed("capogruppo")) {
    return NextResponse.redirect(new URL(participantBase, req.url));
  }

  if (pathMatches(path, alloggiBase) && !isAllowed("alloggi")) {
    return NextResponse.redirect(new URL(participantBase, req.url));
  }

  return res;
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
