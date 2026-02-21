"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { AVAILABLE_ROLES, ROLE_LABELS, type AppRole } from "@/lib/auth/roles";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("partecipante");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">(
    "idle"
  );
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("loading");
    setMessage(null);

    try {
      window.localStorage.setItem("gf_requested_role", role);
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?role=${encodeURIComponent(
            role
          )}`,
        },
      });

      if (error) {
        setStatus("error");
        setMessage(error.message);
        return;
      }

      setStatus("sent");
      setMessage("Check your email for the magic link.");
    } catch {
      setStatus("error");
      setMessage("Error while sending the magic link.");
    }
  };

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <h1 className="text-2xl font-semibold">Login</h1>
      <div className="mt-3 space-y-2 text-sm text-neutral-700">
        <p className="leading-relaxed">
          Manage Global Friendship registrations from this page. Enter your
          password and choose your role (Participant, Group Leader, etc.) to
          continue.
        </p>
        <p className="leading-relaxed">
          We will send a secure magic link to your email. On your first login
          attempt, the message may land in your Spam/Junk folder, so check there
          if you do not see it in your inbox.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700">
            Role
          </label>
          <select
            required
            value={role}
            onChange={(e) => setRole(e.target.value as AppRole)}
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm"
          >
            {AVAILABLE_ROLES.map((item) => (
              <option key={item} value={item}>
                {ROLE_LABELS[item]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700">
            Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm"
            placeholder="name@email.com"
          />
        </div>

        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {status === "loading" ? "Invio in corso..." : "Invia Magic Link"}
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
    </main>
  );
}
