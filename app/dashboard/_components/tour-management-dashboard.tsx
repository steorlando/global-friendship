"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { TourOverview, TourParticipantSummary, TourSettings } from "@/lib/tours/types";

type TourDraft = {
  title: string;
  description: string;
  maxParticipants: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  isActive: boolean;
};

const EMPTY_DRAFT: TourDraft = {
  title: "",
  description: "",
  maxParticipants: "",
  contactName: "",
  contactPhone: "",
  contactEmail: "",
  isActive: true,
};

function toDraft(tour: TourOverview): TourDraft {
  return {
    title: tour.title,
    description: tour.description,
    maxParticipants: String(tour.maxParticipants),
    contactName: tour.contactName ?? "",
    contactPhone: tour.contactPhone ?? "",
    contactEmail: tour.contactEmail ?? "",
    isActive: tour.isActive,
  };
}

export function TourManagementDashboard({ participantsHref }: { participantsHref: string }) {
  const { t } = useI18n();
  const apiErrorMessage = useCallback((value: unknown, fallbackKey: string) => {
    const code = typeof value === "string" ? value : "";
    return /^TOUR_[A-Z_]+$/.test(code) ? t(`tours.error.${code}`) : t(fallbackKey);
  }, [t]);
  const [settings, setSettings] = useState<TourSettings | null>(null);
  const [tours, setTours] = useState<TourOverview[]>([]);
  const [drafts, setDrafts] = useState<Record<string, TourDraft>>({});
  const [newDraft, setNewDraft] = useState<TourDraft>(EMPTY_DRAFT);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [modalTourId, setModalTourId] = useState<string | null>(null);
  const [modalParticipants, setModalParticipants] = useState<TourParticipantSummary[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [moveTargets, setMoveTargets] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/tours/manage", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(apiErrorMessage(json.error, "tours.error.load"));
      const loadedTours = Array.isArray(json.tours) ? (json.tours as TourOverview[]) : [];
      setSettings(json.settings);
      setTours(loadedTours);
      setDrafts(Object.fromEntries(loadedTours.map((tour) => [tour.id, toDraft(tour)])));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("tours.error.load"));
    } finally {
      setLoading(false);
    }
  }, [apiErrorMessage, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeTours = useMemo(() => tours.filter((tour) => tour.isActive), [tours]);

  async function uploadAttachment(tourId: string, file: File) {
    const form = new FormData();
    form.set("file", file);
    const response = await fetch(`/api/tours/${encodeURIComponent(tourId)}/attachment`, {
      method: "POST",
      body: form,
    });
    const json = await response.json();
    if (!response.ok) throw new Error(apiErrorMessage(json.error, "tours.error.attachment"));
  }

  async function createTour(event: FormEvent) {
    event.preventDefault();
    setBusy("create");
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/tours/manage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...newDraft, maxParticipants: Number(newDraft.maxParticipants) }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(apiErrorMessage(json.error, "tours.error.operation"));
      if (newFile) await uploadAttachment(json.id, newFile);
      setNewDraft(EMPTY_DRAFT);
      setNewFile(null);
      setSuccess(t("tours.staff.created"));
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("tours.error.operation"));
    } finally {
      setBusy(null);
    }
  }

  async function saveSettings() {
    if (!settings) return;
    setBusy("settings");
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/tours/manage/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(settings),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(apiErrorMessage(json.error, "tours.error.operation"));
      setSuccess(t("tours.staff.settingsSaved"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("tours.error.operation"));
    } finally {
      setBusy(null);
    }
  }

  async function saveTour(tourId: string) {
    const draft = drafts[tourId];
    if (!draft) return;
    setBusy(`save:${tourId}`);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/tours/manage", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: tourId, ...draft, maxParticipants: Number(draft.maxParticipants) }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(apiErrorMessage(json.error, "tours.error.operation"));
      setSuccess(t("tours.staff.saved"));
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("tours.error.operation"));
    } finally {
      setBusy(null);
    }
  }

  async function replaceAttachment(tourId: string, file: File | null) {
    if (!file) return;
    setBusy(`attachment:${tourId}`);
    setError(null);
    try {
      await uploadAttachment(tourId, file);
      setSuccess(t("tours.staff.attachmentSaved"));
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("tours.error.attachment"));
    } finally {
      setBusy(null);
    }
  }

  async function removeAttachment(tourId: string) {
    if (!window.confirm(t("tours.staff.removeAttachmentConfirm"))) return;
    setBusy(`attachment:${tourId}`);
    try {
      const response = await fetch(`/api/tours/${encodeURIComponent(tourId)}/attachment`, { method: "DELETE" });
      const json = await response.json();
      if (!response.ok) throw new Error(apiErrorMessage(json.error, "tours.error.attachment"));
      setSuccess(t("tours.staff.attachmentRemoved"));
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("tours.error.attachment"));
    } finally {
      setBusy(null);
    }
  }

  async function openParticipants(tourId: string) {
    setModalTourId(tourId);
    setModalParticipants([]);
    setModalLoading(true);
    try {
      const response = await fetch(`/api/tours/${encodeURIComponent(tourId)}/bookings`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(apiErrorMessage(json.error, "tours.error.load"));
      setModalParticipants(Array.isArray(json.participants) ? json.participants : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("tours.error.load"));
    } finally {
      setModalLoading(false);
    }
  }

  async function changeParticipant(participantId: string, tourId: string | null) {
    setBusy(`participant:${participantId}`);
    setError(null);
    try {
      const response = await fetch("/api/tours/manage/participants", {
        method: tourId ? "POST" : "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ participantId, tourId }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(apiErrorMessage(json.error, "tours.error.operation"));
      if (modalTourId) await openParticipants(modalTourId);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("tours.error.operation"));
    } finally {
      setBusy(null);
    }
  }

  function field(tourId: string, key: keyof TourDraft, value: string | boolean) {
    setDrafts((current) => ({ ...current, [tourId]: { ...current[tourId], [key]: value } }));
  }

  if (loading) return <p className="text-sm text-slate-500">{t("common.loading")}</p>;

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("tours.staff.title")}</h1>
          <p className="mt-2 text-sm text-slate-500">{t("tours.staff.subtitle")}</p>
        </div>
        <Link href={participantsHref} className="rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-800 hover:bg-indigo-100">
          {t("tours.staff.assignParticipants")}
        </Link>
      </header>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {success ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div> : null}

      {settings ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">{t("tours.staff.launchSettings")}</h2>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4">
              <input type="checkbox" checked={settings.publicEnabled} onChange={(event) => setSettings({ ...settings, publicEnabled: event.target.checked })} className="mt-1 size-5" />
              <span><strong className="block text-sm text-slate-900">{t("tours.staff.publicEnabled")}</strong><span className="mt-1 block text-xs leading-5 text-slate-500">{t("tours.staff.publicEnabledHelp")}</span></span>
            </label>
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4">
              <input type="checkbox" checked={settings.participantChangesEnabled} onChange={(event) => setSettings({ ...settings, participantChangesEnabled: event.target.checked })} className="mt-1 size-5" />
              <span><strong className="block text-sm text-slate-900">{t("tours.staff.changesEnabled")}</strong><span className="mt-1 block text-xs leading-5 text-slate-500">{t("tours.staff.changesEnabledHelp")}</span></span>
            </label>
          </div>
          <button type="button" onClick={() => void saveSettings()} disabled={busy === "settings"} className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{t("common.save")}</button>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">{t("tours.staff.newTour")}</h2>
        <form onSubmit={createTour} className="mt-5 grid gap-4 md:grid-cols-2">
          <input required value={newDraft.title} onChange={(event) => setNewDraft({ ...newDraft, title: event.target.value })} placeholder={t("tours.field.title")} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
          <input required min={1} type="number" value={newDraft.maxParticipants} onChange={(event) => setNewDraft({ ...newDraft, maxParticipants: event.target.value })} placeholder={t("tours.field.capacity")} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
          <textarea required rows={4} value={newDraft.description} onChange={(event) => setNewDraft({ ...newDraft, description: event.target.value })} placeholder={t("tours.field.description")} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm md:col-span-2" />
          <input value={newDraft.contactName} onChange={(event) => setNewDraft({ ...newDraft, contactName: event.target.value })} placeholder={t("tours.field.contactName")} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
          <input value={newDraft.contactPhone} onChange={(event) => setNewDraft({ ...newDraft, contactPhone: event.target.value })} placeholder={t("tours.field.contactPhone")} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
          <input type="email" value={newDraft.contactEmail} onChange={(event) => setNewDraft({ ...newDraft, contactEmail: event.target.value })} placeholder={t("tours.field.contactEmail")} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
          <label className="rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-sm text-slate-600">{t("tours.field.attachment")}<input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" onChange={(event) => setNewFile(event.target.files?.[0] ?? null)} className="mt-2 block w-full text-xs" /></label>
          <button type="submit" disabled={busy === "create"} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 md:col-span-2">{busy === "create" ? t("common.loading") : t("tours.staff.create")}</button>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">{t("tours.staff.existingTours")}</h2>
        {tours.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">{t("tours.public.empty")}</p> : null}
        {tours.map((tour) => {
          const draft = drafts[tour.id] ?? toDraft(tour);
          return (
            <article key={tour.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><h3 className="text-xl font-semibold text-slate-900">{tour.title}</h3>{!tour.isActive ? <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-600">{t("tours.staff.inactive")}</span> : null}</div>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm">
                    <button type="button" onClick={() => void openParticipants(tour.id)} className="rounded-lg bg-indigo-50 px-3 py-2 font-semibold text-indigo-800 hover:bg-indigo-100">{t("tours.staff.bookedCount", { count: tour.bookedCount })}</button>
                    <span className="rounded-lg bg-slate-100 px-3 py-2 text-slate-700">{t("tours.staff.waitlistCount", { count: tour.waitlistCount })}</span>
                    <span className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800">{t("tours.availableCount", { count: tour.availableSpots })}</span>
                  </div>
                </div>
              </div>

              <details className="mt-5 rounded-xl border border-slate-200 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-slate-800">{t("common.edit")}</summary>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <input value={draft.title} onChange={(event) => field(tour.id, "title", event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  <input min={1} type="number" value={draft.maxParticipants} onChange={(event) => field(tour.id, "maxParticipants", event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  <textarea rows={5} value={draft.description} onChange={(event) => field(tour.id, "description", event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2" />
                  <input value={draft.contactName} onChange={(event) => field(tour.id, "contactName", event.target.value)} placeholder={t("tours.field.contactName")} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  <input value={draft.contactPhone} onChange={(event) => field(tour.id, "contactPhone", event.target.value)} placeholder={t("tours.field.contactPhone")} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  <input type="email" value={draft.contactEmail} onChange={(event) => field(tour.id, "contactEmail", event.target.value)} placeholder={t("tours.field.contactEmail")} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm"><input type="checkbox" checked={draft.isActive} onChange={(event) => field(tour.id, "isActive", event.target.checked)} />{t("tours.staff.active")}</label>
                  <button type="button" onClick={() => void saveTour(tour.id)} disabled={busy === `save:${tour.id}`} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 md:col-span-2">{t("common.save")}</button>
                </div>
              </details>

              <div className="mt-4 rounded-xl bg-slate-50 p-4">
                {tour.attachmentUrl ? <div className="flex flex-wrap items-center gap-3 text-sm"><a href={tour.attachmentUrl} target="_blank" rel="noreferrer" className="font-medium text-indigo-700">{tour.attachmentName}</a><button type="button" onClick={() => void removeAttachment(tour.id)} className="font-medium text-red-700">{t("common.delete")}</button></div> : <p className="text-sm text-slate-500">{t("tours.attachment.none")}</p>}
                <label className="mt-3 block text-xs font-medium text-slate-600">{tour.attachmentUrl ? t("tours.attachment.replace") : t("tours.attachment.add")}<input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" disabled={busy === `attachment:${tour.id}`} onChange={(event) => void replaceAttachment(tour.id, event.target.files?.[0] ?? null)} className="mt-2 block w-full" /></label>
              </div>
            </article>
          );
        })}
      </section>

      {modalTourId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true">
          <section className="max-h-[88vh] w-full max-w-5xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-4"><h2 className="text-xl font-semibold text-slate-900">{t("tours.staff.bookedParticipants")}</h2><button type="button" onClick={() => setModalTourId(null)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">{t("common.close")}</button></div>
            {modalLoading ? <p className="mt-5 text-sm text-slate-500">{t("common.loading")}</p> : (
              <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50"><tr><th className="px-3 py-2">{t("tours.participantName")}</th><th className="px-3 py-2">{t("tours.group")}</th><th className="px-3 py-2">Email</th><th className="px-3 py-2">{t("tours.phone")}</th><th className="px-3 py-2">{t("tours.staff.changeAssignment")}</th></tr></thead><tbody>{modalParticipants.map((participant) => <tr key={participant.id} className="border-t border-slate-100"><td className="px-3 py-3"><strong>{participant.firstName} {participant.lastName}</strong></td><td className="px-3 py-3">{participant.group}</td><td className="px-3 py-3"><a href={`mailto:${participant.email}`} className="text-indigo-700">{participant.email}</a></td><td className="px-3 py-3">{participant.phone}</td><td className="px-3 py-3"><div className="flex gap-2"><select value={moveTargets[participant.id] ?? ""} onChange={(event) => setMoveTargets({ ...moveTargets, [participant.id]: event.target.value })} className="rounded border border-slate-300 px-2 py-1"><option value="">{t("common.select")}</option>{activeTours.filter((tour) => tour.id !== modalTourId).map((tour) => <option key={tour.id} value={tour.id}>{tour.title}</option>)}</select><button type="button" disabled={!moveTargets[participant.id] || busy === `participant:${participant.id}`} onClick={() => void changeParticipant(participant.id, moveTargets[participant.id])} className="rounded bg-indigo-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-40">{t("tours.staff.move")}</button><button type="button" disabled={busy === `participant:${participant.id}`} onClick={() => window.confirm(t("tours.staff.removeBookingConfirm")) && void changeParticipant(participant.id, null)} className="rounded border border-red-300 px-3 py-1 text-xs font-semibold text-red-700">{t("common.delete")}</button></div></td></tr>)}{modalParticipants.length === 0 ? <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">{t("tours.staff.noBookings")}</td></tr> : null}</tbody></table></div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
