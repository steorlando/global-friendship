"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { TourOverview, TourSettings } from "@/lib/tours/types";

export function PublicTours() {
  const { t } = useI18n();
  const [settings, setSettings] = useState<TourSettings | null>(null);
  const [tours, setTours] = useState<TourOverview[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/tours/public", { cache: "no-store" })
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || t("tours.error.load"));
        setSettings(json.settings);
        setTours(Array.isArray(json.tours) ? json.tours : []);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : t("tours.error.load")));
  }, [t]);

  if (error) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>;
  }
  if (!settings) {
    return <p className="text-sm text-slate-500">{t("common.loading")}</p>;
  }
  if (!settings.publicEnabled) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900 shadow-sm">
        <h2 className="text-lg font-semibold">{t("tours.public.standbyTitle")}</h2>
        <p className="mt-2 text-sm leading-6">{t("tours.public.standbyDescription")}</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {tours.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          {t("tours.public.empty")}
        </p>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {tours.map((tour) => {
            const isExpanded = expanded.has(tour.id);
            const isLong = tour.description.length > 260;
            return (
              <article key={tour.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-slate-900">{tour.title}</h2>
                <p className={`mt-3 whitespace-pre-line text-sm leading-6 text-slate-600 ${!isExpanded && isLong ? "line-clamp-4" : ""}`}>
                  {tour.description}
                </p>
                {isLong ? (
                  <button
                    type="button"
                    onClick={() =>
                      setExpanded((current) => {
                        const next = new Set(current);
                        if (next.has(tour.id)) next.delete(tour.id);
                        else next.add(tour.id);
                        return next;
                      })
                    }
                    className="mt-2 self-start text-sm font-medium text-indigo-700 hover:text-indigo-600"
                  >
                    {isExpanded ? t("tours.public.less") : t("tours.public.more")}
                  </button>
                ) : null}

                <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-sm">
                  <div>
                    <div className="text-slate-500">{t("tours.totalSpots")}</div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">{tour.maxParticipants}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">{t("tours.availableSpots")}</div>
                    <div className={`mt-1 text-lg font-semibold ${tour.availableSpots > 0 ? "text-emerald-700" : "text-amber-700"}`}>
                      {tour.availableSpots}
                    </div>
                  </div>
                </div>

                {tour.attachmentUrl ? (
                  <a href={tour.attachmentUrl} target="_blank" rel="noreferrer" className="mt-4 text-sm font-medium text-indigo-700 hover:text-indigo-600">
                    {t("tours.attachment.open")} · {tour.attachmentName}
                  </a>
                ) : null}

                <Link
                  href="/dashboard/partecipante/tours"
                  className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
                >
                  {tour.availableSpots > 0 ? t("tours.public.book") : t("tours.public.waitlist")}
                </Link>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
