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
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalTourId, setEditModalTourId] = useState<string | null>(null);
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

  const closeCreateModal = useCallback(() => {
    if (busy === "create") return;
    setCreateModalOpen(false);
    setNewDraft(EMPTY_DRAFT);
    setNewFile(null);
  }, [busy]);

  const closeEditModal = useCallback(() => {
    if (busy) return;
    if (editModalTourId) {
      const tour = tours.find((item) => item.id === editModalTourId);
      if (tour) {
        setDrafts((current) => ({ ...current, [tour.id]: toDraft(tour) }));
      }
    }
    setEditModalTourId(null);
  }, [busy, editModalTourId, tours]);

  useEffect(() => {
    if (!createModalOpen && !editModalTourId) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (createModalOpen) closeCreateModal();
      else closeEditModal();
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [closeCreateModal, closeEditModal, createModalOpen, editModalTourId]);

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
      setCreateModalOpen(false);
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
      setEditModalTourId(null);
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

  function openCreateModal() {
    setNewDraft(EMPTY_DRAFT);
    setNewFile(null);
    setCreateModalOpen(true);
  }

  function openEditModal(tourId: string) {
    const tour = tours.find((item) => item.id === tourId);
    if (!tour) return;
    setDrafts((current) => ({ ...current, [tourId]: toDraft(tour) }));
    setError(null);
    setSuccess(null);
    setEditModalTourId(tourId);
  }

  const editingTour = editModalTourId
    ? tours.find((tour) => tour.id === editModalTourId) ?? null
    : null;
  const editingDraft = editingTour
    ? drafts[editingTour.id] ?? toDraft(editingTour)
    : null;

  if (loading) return <p className="text-sm text-slate-500">{t("common.loading")}</p>;

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("tours.staff.title")}</h1>
          <p className="mt-2 text-sm text-slate-500">{t("tours.staff.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/tours?preview=1"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
          >
            {t("tours.staff.previewParticipantPage")}
            <span aria-hidden="true">↗</span>
          </Link>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
          >
            <span aria-hidden="true" className="text-lg leading-none">+</span>
            {t("tours.staff.newTour")}
          </button>
          <Link href={participantsHref} className="rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-800 hover:bg-indigo-100">
            {t("tours.staff.assignParticipants")}
          </Link>
        </div>
      </header>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {success ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div> : null}

      {settings ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[13rem_minmax(0,1fr)_minmax(0,1fr)] lg:items-stretch">
            <div className="flex items-start justify-between gap-3 lg:block">
              <h2 className="text-base font-semibold leading-5 text-slate-900">{t("tours.staff.launchSettings")}</h2>
              <button type="button" onClick={() => void saveSettings()} disabled={busy === "settings"} className="shrink-0 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 lg:mt-3">{t("common.save")}</button>
            </div>
            <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 px-3 py-2.5">
              <input
                type="checkbox"
                checked={settings.publicEnabled}
                onChange={(event) => setSettings({ ...settings, publicEnabled: event.target.checked, participantChangesEnabled: event.target.checked })}
                className="mt-0.5 size-4 shrink-0"
              />
              <span><strong className="block text-sm text-slate-900">{t("tours.staff.openRegistrations")}</strong><span className="mt-0.5 block text-[11px] leading-4 text-slate-500">{t("tours.staff.openRegistrationsHelp")}</span></span>
            </label>
            <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 px-3 py-2.5">
              <input
                type="checkbox"
                checked={!settings.participantChangesEnabled}
                onChange={(event) => setSettings({ ...settings, participantChangesEnabled: !event.target.checked })}
                className="mt-0.5 size-4 shrink-0"
              />
              <span><strong className="block text-sm text-slate-900">{t("tours.staff.blockRegistrations")}</strong><span className="mt-0.5 block text-[11px] leading-4 text-slate-500">{t("tours.staff.blockRegistrationsHelp")}</span></span>
            </label>
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">{t("tours.staff.existingTours")}</h2>
        {tours.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">{t("tours.public.empty")}</p> : null}
        {tours.length > 0 ? (
          <div className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {tours.map((tour) => (
              <article key={tour.id} className="flex flex-col gap-3 px-4 py-3.5 md:flex-row md:items-center">
                <div className="min-w-0 md:w-0 md:flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-indigo-100 px-2 py-1 text-xs font-bold text-indigo-800">{t("tours.number", { number: tour.tourNumber })}</span>
                    <h3 className="font-semibold text-slate-900 md:truncate">{tour.title}</h3>
                    {!tour.isActive ? <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">{t("tours.staff.inactive")}</span> : null}
                  </div>
                  <p className="mt-1.5 text-xs leading-5 text-slate-500">{tour.description}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs md:justify-end">
                  <button type="button" onClick={() => void openParticipants(tour.id)} className="rounded-lg bg-indigo-50 px-2.5 py-1.5 font-semibold text-indigo-800 hover:bg-indigo-100">{t("tours.staff.bookedCount", { count: tour.bookedCount })}</button>
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-slate-700">{t("tours.staff.waitlistCount", { count: tour.waitlistCount })}</span>
                  <span className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-emerald-800">{t("tours.availableCount", { count: tour.availableSpots })}</span>
                  <button type="button" onClick={() => openEditModal(tour.id)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-800">{t("common.edit")}</button>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      {createModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 px-4 py-8 sm:items-center"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeCreateModal();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-tour-dialog-title"
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="create-tour-dialog-title" className="text-xl font-semibold text-slate-900">{t("tours.staff.newTour")}</h2>
                <p className="mt-1 text-sm text-slate-500">{t("tours.staff.subtitle")}</p>
              </div>
              <button
                type="button"
                onClick={closeCreateModal}
                disabled={busy === "create"}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {t("common.close")}
              </button>
            </div>

            <form onSubmit={createTour} className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                <span className="mb-1.5 block">{t("tours.field.title")}</span>
                <input autoFocus required value={newDraft.title} onChange={(event) => setNewDraft({ ...newDraft, title: event.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                <span className="mb-1.5 block">{t("tours.field.capacity")}</span>
                <input required min={1} type="number" value={newDraft.maxParticipants} onChange={(event) => setNewDraft({ ...newDraft, maxParticipants: event.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
              </label>
              <label className="block text-sm font-medium text-slate-700 md:col-span-2">
                <span className="mb-1.5 block">{t("tours.field.description")}</span>
                <textarea required rows={4} value={newDraft.description} onChange={(event) => setNewDraft({ ...newDraft, description: event.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                <span className="mb-1.5 block">{t("tours.field.contactName")}</span>
                <input value={newDraft.contactName} onChange={(event) => setNewDraft({ ...newDraft, contactName: event.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                <span className="mb-1.5 block">{t("tours.field.contactPhone")}</span>
                <input value={newDraft.contactPhone} onChange={(event) => setNewDraft({ ...newDraft, contactPhone: event.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                <span className="mb-1.5 block">{t("tours.field.contactEmail")}</span>
                <input type="email" value={newDraft.contactEmail} onChange={(event) => setNewDraft({ ...newDraft, contactEmail: event.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
              </label>
              <label className="rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-700">
                {t("tours.field.attachment")}
                <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" onChange={(event) => setNewFile(event.target.files?.[0] ?? null)} className="mt-2 block w-full text-xs font-normal" />
              </label>
              <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-5 md:col-span-2">
                <button type="button" onClick={closeCreateModal} disabled={busy === "create"} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{t("common.cancel")}</button>
                <button type="submit" disabled={busy === "create"} className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">{busy === "create" ? t("common.loading") : t("tours.staff.create")}</button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {editingTour && editingDraft ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 px-4 py-8 sm:items-center"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeEditModal();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-tour-dialog-title"
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">{t("common.edit")} · {t("tours.number", { number: editingTour.tourNumber })}</p>
                <h2 id="edit-tour-dialog-title" className="mt-1 text-xl font-semibold text-slate-900">{editingTour.title}</h2>
              </div>
              <button type="button" onClick={closeEditModal} disabled={Boolean(busy)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">{t("common.close")}</button>
            </div>

            <form onSubmit={(event) => { event.preventDefault(); void saveTour(editingTour.id); }} className="mt-6 grid gap-4 md:grid-cols-2">
              {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 md:col-span-2">{error}</div> : null}
              <label className="block text-sm font-medium text-slate-700">
                <span className="mb-1.5 block">{t("tours.field.title")}</span>
                <input autoFocus required value={editingDraft.title} onChange={(event) => field(editingTour.id, "title", event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                <span className="mb-1.5 block">{t("tours.field.capacity")}</span>
                <input required min={1} type="number" value={editingDraft.maxParticipants} onChange={(event) => field(editingTour.id, "maxParticipants", event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
              </label>
              <label className="block text-sm font-medium text-slate-700 md:col-span-2">
                <span className="mb-1.5 block">{t("tours.field.description")}</span>
                <textarea required rows={5} value={editingDraft.description} onChange={(event) => field(editingTour.id, "description", event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                <span className="mb-1.5 block">{t("tours.field.contactName")}</span>
                <input value={editingDraft.contactName} onChange={(event) => field(editingTour.id, "contactName", event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                <span className="mb-1.5 block">{t("tours.field.contactPhone")}</span>
                <input value={editingDraft.contactPhone} onChange={(event) => field(editingTour.id, "contactPhone", event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                <span className="mb-1.5 block">{t("tours.field.contactEmail")}</span>
                <input type="email" value={editingDraft.contactEmail} onChange={(event) => field(editingTour.id, "contactEmail", event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
              </label>
              <label className="flex items-center gap-3 rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={editingDraft.isActive} onChange={(event) => field(editingTour.id, "isActive", event.target.checked)} className="size-4" />
                {t("tours.staff.active")}
              </label>

              <section className="rounded-xl bg-slate-50 p-4 md:col-span-2">
                {editingTour.attachmentUrl ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                    <a href={editingTour.attachmentUrl} target="_blank" rel="noreferrer" className="font-medium text-indigo-700">{editingTour.attachmentName}</a>
                    <button type="button" onClick={() => void removeAttachment(editingTour.id)} disabled={busy === `attachment:${editingTour.id}`} className="font-medium text-red-700 disabled:opacity-50">{t("common.delete")}</button>
                  </div>
                ) : <p className="text-sm text-slate-500">{t("tours.attachment.none")}</p>}
                <label className="mt-3 block text-xs font-medium text-slate-600">
                  {editingTour.attachmentUrl ? t("tours.attachment.replace") : t("tours.attachment.add")}
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" disabled={busy === `attachment:${editingTour.id}`} onChange={(event) => void replaceAttachment(editingTour.id, event.target.files?.[0] ?? null)} className="mt-2 block w-full" />
                </label>
              </section>

              <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-5 md:col-span-2">
                <button type="button" onClick={closeEditModal} disabled={Boolean(busy)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{t("common.cancel")}</button>
                <button type="submit" disabled={busy === `save:${editingTour.id}`} className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">{busy === `save:${editingTour.id}` ? t("common.loading") : t("common.save")}</button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {modalTourId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true">
          <section className="max-h-[88vh] w-full max-w-5xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-4"><h2 className="text-xl font-semibold text-slate-900">{t("tours.staff.bookedParticipants")}</h2><button type="button" onClick={() => setModalTourId(null)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">{t("common.close")}</button></div>
            {modalLoading ? <p className="mt-5 text-sm text-slate-500">{t("common.loading")}</p> : (
              <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50"><tr><th className="px-3 py-2">{t("tours.participantName")}</th><th className="px-3 py-2">{t("tours.group")}</th><th className="px-3 py-2">Email</th><th className="px-3 py-2">{t("tours.phone")}</th><th className="px-3 py-2">{t("tours.staff.changeAssignment")}</th></tr></thead><tbody>{modalParticipants.map((participant) => <tr key={participant.id} className="border-t border-slate-100"><td className="px-3 py-3"><strong>{participant.firstName} {participant.lastName}</strong></td><td className="px-3 py-3">{participant.group}</td><td className="px-3 py-3"><a href={`mailto:${participant.email}`} className="text-indigo-700">{participant.email}</a></td><td className="px-3 py-3">{participant.phone}</td><td className="px-3 py-3"><div className="flex gap-2"><select value={moveTargets[participant.id] ?? ""} onChange={(event) => setMoveTargets({ ...moveTargets, [participant.id]: event.target.value })} className="rounded border border-slate-300 px-2 py-1"><option value="">{t("common.select")}</option>{activeTours.filter((tour) => tour.id !== modalTourId).map((tour) => <option key={tour.id} value={tour.id}>{t("tours.number", { number: tour.tourNumber })} · {tour.title}</option>)}</select><button type="button" disabled={!moveTargets[participant.id] || busy === `participant:${participant.id}`} onClick={() => void changeParticipant(participant.id, moveTargets[participant.id])} className="rounded bg-indigo-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-40">{t("tours.staff.move")}</button><button type="button" disabled={busy === `participant:${participant.id}`} onClick={() => window.confirm(t("tours.staff.removeBookingConfirm")) && void changeParticipant(participant.id, null)} className="rounded border border-red-300 px-3 py-1 text-xs font-semibold text-red-700">{t("common.delete")}</button></div></td></tr>)}{modalParticipants.length === 0 ? <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">{t("tours.staff.noBookings")}</td></tr> : null}</tbody></table></div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
