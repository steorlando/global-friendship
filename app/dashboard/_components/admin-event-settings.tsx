"use client";

import { FormEvent, useEffect, useState } from "react";

type LoadResponse = {
  eventStartDate: string;
  eventEndDate: string;
  hostCity: string;
  hostelCheckInEnabled: boolean;
  updatedAt: string | null;
};

type SaveResponse = LoadResponse & {
  ok?: boolean;
};

export function AdminEventSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [eventStartDate, setEventStartDate] = useState("");
  const [eventEndDate, setEventEndDate] = useState("");
  const [hostCity, setHostCity] = useState("");
  const [hostelCheckInEnabled, setHostelCheckInEnabled] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadSettings() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings/event", { cache: "no-store" });
      const json = (await res.json()) as LoadResponse & { error?: string };
      if (!res.ok) throw new Error(json.error || "Unable to load settings");
      setEventStartDate(json.eventStartDate || "");
      setEventEndDate(json.eventEndDate || "");
      setHostCity(json.hostCity || "");
      setHostelCheckInEnabled(json.hostelCheckInEnabled === true);
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
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/admin/settings/event", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventStartDate,
          eventEndDate,
          hostCity,
          hostelCheckInEnabled,
        }),
      });

      const json = (await res.json()) as SaveResponse & { error?: string };
      if (!res.ok) throw new Error(json.error || "Unable to save settings");

      setEventStartDate(json.eventStartDate || eventStartDate);
      setEventEndDate(json.eventEndDate || eventEndDate);
      setHostCity(json.hostCity || hostCity);
      setHostelCheckInEnabled(json.hostelCheckInEnabled === true);
      setUpdatedAt(json.updatedAt ?? null);
      setSuccess("Event settings saved.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Event informations</h3>
        <p className="mt-1 text-sm text-slate-600">
          Manage core event details reused by dashboard features and future workflows.
        </p>

        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Loading settings...</p>
        ) : (
          <form className="mt-5 space-y-4" onSubmit={handleSave}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                Event start date
                <input
                  type="date"
                  value={eventStartDate}
                  onChange={(event) => setEventStartDate(event.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  required
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Event end date
                <input
                  type="date"
                  value={eventEndDate}
                  onChange={(event) => setEventEndDate(event.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  required
                />
              </label>
            </div>

            <label className="block text-sm font-medium text-slate-700">
              Host city
              <input
                type="text"
                value={hostCity}
                onChange={(event) => setHostCity(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Budapest"
                required
              />
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
              <input
                type="checkbox"
                checked={hostelCheckInEnabled}
                onChange={(event) => setHostelCheckInEnabled(event.target.checked)}
                className="mt-0.5 h-5 w-5 rounded border-indigo-300 text-indigo-600"
              />
              <span>
                <span className="block text-sm font-semibold text-indigo-950">
                  Enable participant hostel information and check-in
                </span>
                <span className="mt-1 block text-xs leading-5 text-indigo-800">
                  Keep this disabled until room assignments are complete. While disabled,
                  participants see only the “available soon” placeholder.
                </span>
              </span>
            </label>

            {updatedAt ? (
              <p className="text-xs text-slate-500">
                Last updated: {new Date(updatedAt).toLocaleString()}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </form>
        )}
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
