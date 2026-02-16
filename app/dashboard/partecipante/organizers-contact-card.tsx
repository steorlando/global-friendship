"use client";

import { FormEvent, useState } from "react";

export function OrganizersContactCard() {
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
        body: JSON.stringify({ message }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Unable to send your message.");
        return;
      }

      setSuccess("Your message has been sent to the organizers.");
      setMessage("");
    } catch {
      setError("Unable to send your message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <aside className="rounded border border-neutral-200 bg-white p-4">
      <h2 className="text-lg font-semibold text-neutral-900">Contact Organizers</h2>
      <p className="mt-2 text-sm text-neutral-600">
        If you need support or have any updates, write your message in the box
        below. It will be sent directly to the organizers.
      </p>

      <form className="mt-4 space-y-3" onSubmit={onSubmit}>
        <textarea
          required
          minLength={3}
          maxLength={4000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={7}
          placeholder="Write your message for the organizers..."
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
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
          className="w-full rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {sending ? "Sending..." : "Send"}
        </button>
      </form>
    </aside>
  );
}
