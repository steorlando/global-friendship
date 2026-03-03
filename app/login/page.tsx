"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/provider";
import {
  AVAILABLE_ROLES,
  ROLE_ROUTES,
  isAppRole,
  type AppRole,
} from "@/lib/auth/roles";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("partecipante");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">(
    "idle"
  );
  const [message, setMessage] = useState<string | null>(null);
  const appBaseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "") ||
    (typeof window !== "undefined" ? window.location.origin : "");

  const preflightErrorMessageByCode = (code: string): string => {
    switch (code) {
      case "PARTICIPANT_NOT_FOUND":
        return t("auth.login.participantNotFound");
      case "PROFILE_NOT_FOUND":
        return t("auth.login.profileNotFound");
      case "ROLE_MISMATCH":
        return t("auth.login.roleMismatch");
      default:
        return t("auth.login.error");
    }
  };

  useEffect(() => {
    async function redirectIfAuthenticated() {
      const supabase = createSupabaseBrowserClient();
      let session: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"] =
        null;
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error?.message?.toLowerCase().includes("refresh token")) {
          await supabase.auth.signOut({ scope: "local" });
          return;
        }
        session = data.session;
      } catch {
        return;
      }

      const user = session?.user ?? null;
      if (!user) return;

      const requestedRoleRaw = window.localStorage.getItem("gf_requested_role");
      const requestedRole = isAppRole(requestedRoleRaw) ? requestedRoleRaw : null;
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
              : null;
      const destination = requestedRole
        ? ROLE_ROUTES[requestedRole]
        : isAppRole(roleFromProfile)
          ? ROLE_ROUTES[roleFromProfile]
          : ROLE_ROUTES.partecipante;
      if (requestedRoleRaw) {
        window.localStorage.removeItem("gf_requested_role");
      }

      router.replace(destination);
    }

    redirectIfAuthenticated();
  }, [router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("loading");
    setMessage(null);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail) {
        setStatus("error");
        setMessage(t("auth.login.error"));
        return;
      }

      const preflightResponse = await fetch("/api/auth/login/preflight", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email: normalizedEmail,
          role,
        }),
      });

      if (!preflightResponse.ok) {
        const json = (await preflightResponse.json().catch(() => null)) as
          | { code?: string }
          | null;
        setStatus("error");
        setMessage(preflightErrorMessageByCode(json?.code ?? ""));
        return;
      }

      window.localStorage.setItem("gf_requested_role", role);
      document.cookie = `gf_requested_role=${encodeURIComponent(role)}; path=/; max-age=604800; samesite=lax`;
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          emailRedirectTo: `${appBaseUrl}/auth/callback`,
        },
      });

      if (error) {
        setStatus("error");
        setMessage(error.message);
        return;
      }

      setStatus("sent");
      setMessage(t("auth.login.sent"));
    } catch {
      setStatus("error");
      setMessage(t("auth.login.error"));
    }
  };

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">{t("auth.login.title")}</h1>
      </div>
      <div className="mt-3 space-y-2 text-sm text-slate-500">
        <p className="leading-relaxed">{t("auth.login.description1")}</p>
        <p className="leading-relaxed">{t("auth.login.description2")}</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">
            {t("auth.login.role")}
          </label>
          <select
            required
            value={role}
            onChange={(e) => setRole(e.target.value as AppRole)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {AVAILABLE_ROLES.map((item) => (
              <option key={item} value={item}>
                {t(`roles.${item}`)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">
            {t("auth.login.email")}
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            placeholder={t("auth.login.emailPlaceholder")}
          />
        </div>

        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-60"
        >
          {status === "loading" ? t("auth.login.submitting") : t("auth.login.submit")}
        </button>

        {message && (
          <div
            className={`rounded border px-3 py-2 text-sm ${
              status === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {message}
          </div>
        )}
      </form>
      </section>
    </main>
  );
}
