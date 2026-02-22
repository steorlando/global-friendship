"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ROLE_ROUTES, isAppRole } from "@/lib/auth/roles";

const OTP_TYPES: readonly EmailOtpType[] = [
  "magiclink",
  "recovery",
  "invite",
  "email",
  "email_change",
];

function isOtpType(value: string | null): value is EmailOtpType {
  return Boolean(value && OTP_TYPES.includes(value as EmailOtpType));
}

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const message = "Completing sign in...";

  useEffect(() => {
    async function run() {
      const code = searchParams.get("code");
      const tokenHash = searchParams.get("token_hash");
      const otpType = searchParams.get("type");
      const requestedRoleFromQuery = searchParams.get("role");
      const requestedRoleFromStorage =
        window.localStorage.getItem("gf_requested_role");
      const supabase = createSupabaseBrowserClient();

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.warn("Code exchange failed, trying session fallback", error);
        }
      } else if (tokenHash && isOtpType(otpType)) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: otpType,
        });
        if (error) {
          console.warn("Token verification failed, trying session fallback", error);
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const user = session?.user ?? null;
      if (!user) {
        router.replace("/login?error=auth");
        return;
      }

      const { data: profile } = await supabase
        .from("profili")
        .select("ruolo")
        .eq("id", user.id)
        .maybeSingle();

      const roleFromProfile = profile?.ruolo ?? null;
      const requestedRole = isAppRole(requestedRoleFromQuery)
        ? requestedRoleFromQuery
        : isAppRole(requestedRoleFromStorage)
          ? requestedRoleFromStorage
          : null;

      if (requestedRoleFromStorage) {
        window.localStorage.removeItem("gf_requested_role");
      }

      const target = requestedRole
        ? ROLE_ROUTES[requestedRole]
        : isAppRole(roleFromProfile)
          ? ROLE_ROUTES[roleFromProfile]
          : ROLE_ROUTES.partecipante;

      router.replace(target);
    }

    run();
  }, [router, searchParams]);

  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">Signing In</h1>
      <p className="mt-2 text-sm text-slate-500">{message}</p>
    </>
  );
}

export default function AuthCallbackPage() {
  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <Suspense
          fallback={
            <>
              <h1 className="text-2xl font-bold text-slate-900">Signing In</h1>
              <p className="mt-2 text-sm text-slate-500">Completing sign in...</p>
            </>
          }
        >
          <AuthCallbackContent />
        </Suspense>
      </section>
    </main>
  );
}
