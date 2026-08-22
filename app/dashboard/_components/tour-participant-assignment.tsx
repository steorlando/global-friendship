"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { TourOverview } from "@/lib/tours/types";

type ParticipantRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  group: string;
  tourId: string | null;
};

export function TourParticipantAssignment({ backHref }: { backHref: string }) {
  const { t } = useI18n();
  const apiErrorMessage = useCallback((value: unknown, fallbackKey: string) => {
    const code = typeof value === "string" ? value : "";
    return /^TOUR_[A-Z_]+$/.test(code) ? t(`tours.error.${code}`) : t(fallbackKey);
  }, [t]);
  const [tours, setTours] = useState<TourOverview[]>([]);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"unbooked" | "all">("unbooked");
  const [selectedTour, setSelectedTour] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadParticipants = useCallback(async (nextSearch: string, nextStatus: "unbooked" | "all") => {
    setHasSearched(true);
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ search: nextSearch, status: nextStatus });
      const response = await fetch(`/api/tours/manage/participants?${params}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(apiErrorMessage(json.error, "tours.error.load"));
      setParticipants(Array.isArray(json.participants) ? json.participants : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("tours.error.load"));
    } finally {
      setLoading(false);
    }
  }, [apiErrorMessage, t]);

  useEffect(() => {
    fetch("/api/tours/manage", { cache: "no-store" })
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok) throw new Error(apiErrorMessage(json.error, "tours.error.load"));
        setTours((Array.isArray(json.tours) ? json.tours : []).filter((tour: TourOverview) => tour.isActive));
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : t("tours.error.load")));
  }, [apiErrorMessage, loadParticipants, t]);

  async function submitSearch(event: FormEvent) {
    event.preventDefault();
    await loadParticipants(search, status);
  }

  async function assign(participant: ParticipantRow, tourId: string | null) {
    setBusyId(participant.id);
    setError(null);
    try {
      const response = await fetch("/api/tours/manage/participants", {
        method: tourId ? "POST" : "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ participantId: participant.id, tourId }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(apiErrorMessage(json.error, "tours.error.operation"));
      await loadParticipants(search, status);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("tours.error.operation"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-slate-900">{t("tours.staff.assignTitle")}</h1><p className="mt-2 text-sm text-slate-500">{t("tours.staff.assignSubtitle")}</p></div>
        <Link href={backHref} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">{t("tours.staff.backToTours")}</Link>
      </header>
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      <form onSubmit={submitSearch} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[minmax(0,1fr)_180px_auto]">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("tours.staff.searchParticipants")} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
        <select value={status} onChange={(event) => setStatus(event.target.value as "unbooked" | "all")} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm"><option value="unbooked">{t("tours.staff.unbookedOnly")}</option><option value="all">{t("common.all")}</option></select>
        <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">{t("tours.staff.search")}</button>
      </form>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {!hasSearched ? <p className="p-6 text-sm text-slate-500">{t("tours.staff.searchPrompt")}</p> : loading ? <p className="p-6 text-sm text-slate-500">{t("common.loading")}</p> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50"><tr><th className="px-4 py-3">{t("tours.participantName")}</th><th className="px-4 py-3">{t("tours.group")}</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">{t("tours.phone")}</th><th className="px-4 py-3">{t("tours.staff.currentTour")}</th><th className="px-4 py-3">{t("tours.staff.changeAssignment")}</th></tr></thead><tbody>
            {participants.map((participant) => {
              const current = tours.find((tour) => tour.id === participant.tourId);
              return <tr key={participant.id} className="border-t border-slate-100"><td className="px-4 py-3 font-medium text-slate-900">{participant.firstName} {participant.lastName}</td><td className="px-4 py-3">{participant.group}</td><td className="px-4 py-3"><a href={`mailto:${participant.email}`} className="text-indigo-700">{participant.email}</a></td><td className="px-4 py-3">{participant.phone}</td><td className="px-4 py-3">{current ? `${t("tours.number", { number: current.tourNumber })} · ${current.title}` : t("tours.participant.none")}</td><td className="px-4 py-3"><div className="flex gap-2"><select value={selectedTour[participant.id] ?? ""} onChange={(event) => setSelectedTour({ ...selectedTour, [participant.id]: event.target.value })} className="min-w-48 rounded border border-slate-300 px-2 py-1.5"><option value="">{t("common.select")}</option>{tours.filter((tour) => tour.id !== participant.tourId).map((tour) => <option key={tour.id} value={tour.id}>{t("tours.number", { number: tour.tourNumber })} · {tour.title} ({tour.availableSpots})</option>)}</select><button type="button" disabled={!selectedTour[participant.id] || busyId === participant.id} onClick={() => void assign(participant, selectedTour[participant.id])} className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">{participant.tourId ? t("tours.staff.move") : t("tours.staff.assign")}</button>{participant.tourId ? <button type="button" disabled={busyId === participant.id} onClick={() => window.confirm(t("tours.staff.removeBookingConfirm")) && void assign(participant, null)} className="rounded border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700">{t("common.delete")}</button> : null}</div></td></tr>;
            })}
            {participants.length === 0 ? <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">{t("tours.staff.noParticipants")}</td></tr> : null}
          </tbody></table></div>
        )}
      </section>
    </div>
  );
}
