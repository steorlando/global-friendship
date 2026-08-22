"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { TourOverview, TourSettings } from "@/lib/tours/types";

type ParticipantCandidate = {
  id: string;
  nome: string | null;
  cognome: string | null;
  gruppo_id: string | null;
  gruppo_label: string | null;
};

type Booking = { id: string; tourId: string; bookedAt: string; updatedAt: string } | null;
type Waitlist = {
  id: string;
  tourId: string;
  status: string;
  joinedAt: string;
  offeredAt: string | null;
  offerExpiresAt: string | null;
  position: number | null;
} | null;

const STORAGE_KEY = "gf_participant_id";

export function ParticipantTourBooking() {
  const { t, formatDate } = useI18n();
  const [settings, setSettings] = useState<TourSettings | null>(null);
  const [tours, setTours] = useState<TourOverview[]>([]);
  const [booking, setBooking] = useState<Booking>(null);
  const [waitlist, setWaitlist] = useState<Waitlist>(null);
  const [candidates, setCandidates] = useState<ParticipantCandidate[]>([]);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(
    async (selectedId?: string | null) => {
      setLoading(true);
      setError(null);
      const query = selectedId ? `?participantId=${encodeURIComponent(selectedId)}` : "";
      try {
        const response = await fetch(`/api/partecipante/tours${query}`, { cache: "no-store" });
        const json = await response.json();
        if (response.status === 409 && json.code === "PARTICIPANT_SELECTION_REQUIRED") {
          const items = Array.isArray(json.participants) ? json.participants : [];
          setCandidates(items);
          const stored = window.localStorage.getItem(STORAGE_KEY);
          if (stored && items.some((item: ParticipantCandidate) => item.id === stored)) {
            await load(stored);
            return;
          }
          setParticipantId(null);
          return;
        }
        if (!response.ok) throw new Error(json.error || t("tours.error.load"));
        setSettings(json.settings);
        setTours(Array.isArray(json.tours) ? json.tours : []);
        setBooking(json.booking ?? null);
        setWaitlist(json.waitlist ?? null);
        setCandidates(Array.isArray(json.participants) ? json.participants : []);
        setParticipantId(json.selectedParticipantId ?? null);
        if (json.selectedParticipantId) {
          window.localStorage.setItem(STORAGE_KEY, json.selectedParticipantId);
        }
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : t("tours.error.load"));
      } finally {
        setLoading(false);
      }
    },
    [t]
  );

  useEffect(() => {
    void load(null);
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const currentTour = tours.find((tour) => tour.id === booking?.tourId) ?? null;
  const waitlistTour = tours.find((tour) => tour.id === waitlist?.tourId) ?? null;
  const offerRemainingSeconds = useMemo(() => {
    if (waitlist?.status !== "offered" || !waitlist.offerExpiresAt) return null;
    return Math.max(0, Math.ceil((new Date(waitlist.offerExpiresAt).getTime() - now) / 1000));
  }, [now, waitlist]);

  async function act(action: string, tourId?: string) {
    if (!participantId) return;
    setBusyAction(`${action}:${tourId ?? ""}`);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/partecipante/tours", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, tourId, participantId }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(t(`tours.error.${json.error || "TOUR_OPERATION_FAILED"}`));
      setSuccess(t("tours.participant.saved"));
      await load(participantId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("tours.error.operation"));
    } finally {
      setBusyAction(null);
    }
  }

  if (loading) return <p className="text-sm text-slate-500">{t("common.loading")}</p>;

  if (!participantId && candidates.length > 1) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">{t("tours.participant.selectProfile")}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {candidates.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              onClick={() => void load(candidate.id)}
              className="rounded-xl border border-slate-300 p-4 text-left text-sm transition hover:border-indigo-400 hover:bg-indigo-50"
            >
              <span className="font-semibold text-slate-900">{candidate.nome} {candidate.cognome}</span>
              <span className="mt-1 block text-slate-500">{candidate.gruppo_label ?? candidate.gruppo_id ?? ""}</span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  if (!settings?.publicEnabled) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        <h2 className="font-semibold">{t("tours.public.standbyTitle")}</h2>
        <p className="mt-2">{t("tours.public.standbyDescription")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {success ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div> : null}

      <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-indigo-700">{t("tours.participant.current")}</div>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">{currentTour ? `${t("tours.number", { number: currentTour.tourNumber })} · ${currentTour.title}` : t("tours.participant.none")}</h2>
            {currentTour ? <p className="mt-2 text-sm text-slate-600">{currentTour.description}</p> : null}
          </div>
          {booking && settings.participantChangesEnabled ? (
            <button
              type="button"
              disabled={Boolean(busyAction)}
              onClick={() => void act("cancel_booking")}
              className="rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              {t("tours.participant.cancelBooking")}
            </button>
          ) : null}
        </div>
        {!settings.participantChangesEnabled ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-amber-800">{t("tours.participant.closed")}</p>
        ) : null}
      </section>

      {waitlist?.status === "offered" && waitlistTour && offerRemainingSeconds !== null ? (
        <section className="rounded-2xl border-2 border-emerald-400 bg-emerald-50 p-6 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{t("tours.participant.offerAvailable")}</div>
          <h2 className="mt-2 text-xl font-bold text-slate-900">{t("tours.number", { number: waitlistTour.tourNumber })} · {waitlistTour.title}</h2>
          <p className="mt-2 text-sm text-slate-700">
            {t("tours.participant.offerCountdown", {
              minutes: Math.floor(offerRemainingSeconds / 60),
              seconds: String(offerRemainingSeconds % 60).padStart(2, "0"),
            })}
          </p>
          <button
            type="button"
            disabled={!settings.participantChangesEnabled || offerRemainingSeconds <= 0 || Boolean(busyAction)}
            onClick={() => void act("accept_offer", waitlistTour.id)}
            className="mt-4 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {t("tours.participant.acceptOffer")}
          </button>
        </section>
      ) : waitlist && waitlistTour ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">{t("tours.participant.waitlist")}</div>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">{t("tours.number", { number: waitlistTour.tourNumber })} · {waitlistTour.title}</h2>
          <p className="mt-1 text-sm text-slate-600">
            {waitlist.position ? t("tours.participant.waitlistPosition", { position: waitlist.position }) : t("tours.participant.waiting")}
          </p>
          {settings.participantChangesEnabled ? (
            <button type="button" disabled={Boolean(busyAction)} onClick={() => void act("leave_waitlist")} className="mt-3 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-800 disabled:opacity-50">
              {t("tours.participant.leaveWaitlist")}
            </button>
          ) : null}
        </section>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        {tours.filter((tour) => tour.isActive).map((tour) => {
          const isCurrent = booking?.tourId === tour.id;
          const isWaitlisted = waitlist?.tourId === tour.id;
          return (
            <article key={tour.id} className={`rounded-2xl border bg-white p-6 shadow-sm ${isCurrent ? "border-indigo-400 ring-2 ring-indigo-100" : "border-slate-200"}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-1 inline-flex rounded-md bg-indigo-100 px-2 py-1 text-xs font-bold text-indigo-800">{t("tours.number", { number: tour.tourNumber })}</div>
                  <h2 className="text-xl font-semibold text-slate-900">{tour.title}</h2>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${tour.availableSpots > 0 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                  {t("tours.availableCount", { count: tour.availableSpots })}
                </span>
              </div>
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">{tour.description}</p>
              {tour.contactName || tour.contactPhone || tour.contactEmail ? (
                <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                  <strong>{t("tours.contact")}</strong>: {[tour.contactName, tour.contactPhone, tour.contactEmail].filter(Boolean).join(" · ")}
                </div>
              ) : null}
              {tour.attachmentUrl ? <a href={tour.attachmentUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex text-sm font-medium text-indigo-700">{t("tours.attachment.open")} · {tour.attachmentName}</a> : null}
              <div className="mt-5">
                {isCurrent ? (
                  <span className="inline-flex rounded-lg bg-indigo-100 px-3 py-2 text-sm font-semibold text-indigo-800">{t("tours.participant.booked")}</span>
                ) : tour.availableSpots > 0 ? (
                  <button type="button" disabled={!settings.participantChangesEnabled || Boolean(busyAction)} onClick={() => void act("book", tour.id)} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
                    {booking ? t("tours.participant.changeTo") : t("tours.participant.book")}
                  </button>
                ) : isWaitlisted ? (
                  <span className="inline-flex rounded-lg bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-800">{t("tours.participant.onWaitlist")}</span>
                ) : (
                  <button type="button" disabled={!settings.participantChangesEnabled || Boolean(busyAction)} onClick={() => void act("join_waitlist", tour.id)} className="rounded-xl border border-amber-400 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50">
                    {t("tours.participant.joinWaitlist")}
                  </button>
                )}
              </div>
              {booking?.updatedAt && isCurrent ? <p className="mt-3 text-xs text-slate-400">{formatDate(booking.updatedAt, { dateStyle: "medium", timeStyle: "short" })}</p> : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
