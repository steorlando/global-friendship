"use client";

import { FormEvent, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";

export function OrganizersContactCard() {
  const { t } = useI18n();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/partecipante/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          participant_id: window.localStorage.getItem("gf_participant_id"),
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? t("participant.contact.error"));
        return;
      }

      setSuccess(t("participant.contact.success"));
      setMessage("");
    } catch {
      setError(t("participant.contact.error"));
    } finally {
      setSending(false);
    }
  }

  return (
    <aside className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">{t("participant.contact.title")}</h2>
      <p className="mt-2 text-sm text-slate-500">{t("participant.contact.description")}</p>

      <form className="mt-4 space-y-3" onSubmit={onSubmit}>
        <textarea
          required
          minLength={3}
          maxLength={4000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={7}
          placeholder={t("participant.contact.placeholder")}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />

        {error && (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {success}
          </div>
        )}

        <button
          type="submit"
          disabled={sending}
          className="w-full rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {sending ? t("common.sending") : t("common.send")}
        </button>
      </form>
    </aside>
  );
}
