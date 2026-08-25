"use client";

import { Suspense, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import {
  clearSupabaseBrowserSessionStorage,
  createSupabaseBrowserClient,
} from "@/lib/supabase/client";
import { ROLE_ROUTES, isAppRole } from "@/lib/auth/roles";
import { safePostLoginPath } from "@/lib/auth/post-login";
import { useI18n } from "@/lib/i18n/provider";

const OTP_TYPES: readonly EmailOtpType[] = [
  "signup",
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
  const { t } = useI18n();
  const signInStartedRef = useRef(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  async function handleSignIn() {
    if (signInStartedRef.current) return;
    signInStartedRef.current = true;
    setIsSigningIn(true);

    const code = searchParams.get("code");
    const tokenHash = searchParams.get("token_hash");
    const token = searchParams.get("token");
    const otpType = searchParams.get("type");
    const requestedRoleFromQuery = searchParams.get("role");
    const requestedNextFromQuery = searchParams.get("next");
    const requestedRoleFromStorage =
      window.localStorage.getItem("gf_requested_role");

    // Delay token consumption until this explicit user action so email link
    // scanners cannot use a one-time magic link by merely opening the page.
    if (code || tokenHash || token) {
      clearSupabaseBrowserSessionStorage();
    }

    const supabase = createSupabaseBrowserClient();

    try {
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.warn("Code exchange failed, trying session fallback", error);
        }
      } else if ((tokenHash || token) && isOtpType(otpType)) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash ?? token ?? "",
          type: otpType,
        });
        if (error) {
          console.warn("Token verification failed, trying session fallback", error);
        }
      }
    } catch (error) {
      console.warn("Auth callback exchange failed", error);
    }

    let session: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"] =
      null;
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error?.message?.toLowerCase().includes("refresh token")) {
        await supabase.auth.signOut({ scope: "local" });
        router.replace("/login");
        return;
      }
      session = data.session;
    } catch {
      router.replace("/login");
      return;
    }

    const user = session?.user ?? null;
    if (!user) {
      router.replace("/login?error=auth");
      return;
    }

    const normalizedEmail = (user.email ?? "").trim().toLowerCase();
    const { data: profileRows } = await supabase
      .from("profili")
      .select("ruolo")
      .ilike("email", normalizedEmail);

    const availableRoles = new Set(
      (profileRows ?? [])
        .map((row) => String(row.ruolo ?? "").trim())
        .filter(Boolean)
    );
    const roleFromProfile = availableRoles.has("admin")
      ? "admin"
      : availableRoles.has("manager")
        ? "manager"
        : availableRoles.has("capogruppo")
          ? "capogruppo"
          : availableRoles.has("alloggi")
            ? "alloggi"
            : availableRoles.has("accoglienza")
              ? "accoglienza"
              : availableRoles.has("tour_manager")
                ? "tour_manager"
                : null;
    const requestedRole = isAppRole(requestedRoleFromQuery)
      ? requestedRoleFromQuery
      : isAppRole(requestedRoleFromStorage)
        ? requestedRoleFromStorage
        : null;

    if (requestedRoleFromStorage) {
      window.localStorage.removeItem("gf_requested_role");
    }
    if (requestedRole) {
      document.cookie = `gf_requested_role=${encodeURIComponent(requestedRole)}; path=/; max-age=604800; samesite=lax`;
    }

    const safeNext = safePostLoginPath(requestedNextFromQuery, requestedRole);
    const target = safeNext
      ? safeNext
      : requestedRole
        ? ROLE_ROUTES[requestedRole]
        : isAppRole(roleFromProfile)
          ? ROLE_ROUTES[roleFromProfile]
          : ROLE_ROUTES.partecipante;

    router.replace(target);
  }

  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">{t("auth.callback.title")}</h1>
      <p className="mt-2 text-sm text-slate-500">
        {isSigningIn
          ? t("auth.callback.message")
          : t("auth.callback.confirmMessage")}
      </p>
      <button
        type="button"
        onClick={handleSignIn}
        disabled={isSigningIn}
        className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSigningIn
          ? t("auth.callback.message")
          : t("auth.callback.continue")}
      </button>
    </>
  );
}

export default function AuthCallbackPage() {
  const { t } = useI18n();

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <Suspense
          fallback={
            <>
              <h1 className="text-2xl font-bold text-slate-900">{t("auth.callback.title")}</h1>
              <p className="mt-2 text-sm text-slate-500">{t("auth.callback.message")}</p>
            </>
          }
        >
          <AuthCallbackContent />
        </Suspense>
      </section>
    </main>
  );
}
