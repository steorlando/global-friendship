"use client";

import { FormEvent, useEffect, useState } from "react";

type LoadResponse = {
  senderEmail: string;
  passwordIsSet: boolean;
  updatedAt: string | null;
};

type SaveResponse = {
  senderEmail: string;
  passwordIsSet: boolean;
  updatedAt: string | null;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_SETTINGS_FROZEN = true;

function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value.trim());
}

export function AdminEmailSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [senderEmail, setSenderEmail] = useState("");
  const [googleAppPassword, setGoogleAppPassword] = useState("");
  const [passwordIsSet, setPasswordIsSet] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const [testRecipient, setTestRecipient] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadSettings() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings/email", { cache: "no-store" });
      const json = (await res.json()) as LoadResponse & { error?: string };
      if (!res.ok) throw new Error(json.error || "Unable to load settings");
      setSenderEmail(json.senderEmail || "");
      setPasswordIsSet(Boolean(json.passwordIsSet));
      setUpdatedAt(json.updatedAt ?? null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (EMAIL_SETTINGS_FROZEN) return;
    setError(null);
    setSuccess(null);

    if (!isValidEmail(senderEmail)) {
      setError("Please enter a valid sender email.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings/email", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderEmail: senderEmail.trim(),
          googleAppPassword: googleAppPassword,
        }),
      });

      const json = (await res.json()) as SaveResponse & { error?: string };
      if (!res.ok) throw new Error(json.error || "Unable to save settings");

      setSenderEmail(json.senderEmail || senderEmail.trim());
      setPasswordIsSet(Boolean(json.passwordIsSet));
      setUpdatedAt(json.updatedAt ?? null);
      setGoogleAppPassword("");
      setSuccess("Email settings saved.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleTestEmail() {
    if (EMAIL_SETTINGS_FROZEN) return;
    setError(null);
    setSuccess(null);

    if (!isValidEmail(testRecipient)) {
      setError("Please enter a valid test recipient email.");
      return;
    }

    setTesting(true);
    try {
      const res = await fetch("/api/admin/settings/email/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientEmail: testRecipient.trim() }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error || "Unable to send test email");
      setSuccess("Test email sent successfully.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setTesting(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Email Sending Settings</h3>
        <p className="mt-1 text-sm text-slate-600">
          Used by Email Campaigns for sender identity and SMTP authentication.
        </p>
        {EMAIL_SETTINGS_FROZEN ? (
          <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Email sender settings are temporarily locked.
          </p>
        ) : null}

        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Loading settings...</p>
        ) : (
          <form className="mt-5 space-y-4" onSubmit={handleSave}>
            <label className="block text-sm font-medium text-slate-700">
              Sender email address
              <input
                type="email"
                value={senderEmail}
                onChange={(event) => setSenderEmail(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                autoComplete="email"
                required
                disabled={EMAIL_SETTINGS_FROZEN}
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Google App Password
              <input
                type="password"
                value={googleAppPassword}
                onChange={(event) => setGoogleAppPassword(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                autoComplete="new-password"
                placeholder={passwordIsSet ? "Password is set (leave blank to keep)" : ""}
                disabled={EMAIL_SETTINGS_FROZEN}
              />
            </label>

            <p className="text-xs text-slate-500">
              {passwordIsSet
                ? "Password is set. Leave it empty to keep the current one."
                : "No password set yet."}
            </p>
            <p className="text-xs text-slate-500">
              If you change the sender email, enter the Google App Password of that mailbox.
            </p>

            {updatedAt ? (
              <p className="text-xs text-slate-500">
                Last updated: {new Date(updatedAt).toLocaleString()}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={saving || EMAIL_SETTINGS_FROZEN}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {EMAIL_SETTINGS_FROZEN ? "Locked" : saving ? "Saving..." : "Save"}
            </button>
          </form>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Send test email</h3>
        <p className="mt-1 text-sm text-slate-600">
          Verify the sender configuration by delivering a test message.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="email"
            value={testRecipient}
            onChange={(event) => setTestRecipient(event.target.value)}
            placeholder="recipient@example.com"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            disabled={EMAIL_SETTINGS_FROZEN}
          />
          <button
            type="button"
            disabled={testing || EMAIL_SETTINGS_FROZEN}
            onClick={handleTestEmail}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
          >
            {EMAIL_SETTINGS_FROZEN ? "Locked" : testing ? "Sending..." : "Test email"}
          </button>
        </div>
      </div>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </p>
      ) : null}
    </section>
  );
}
