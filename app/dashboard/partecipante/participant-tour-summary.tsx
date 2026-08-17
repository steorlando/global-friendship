"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";

export function ParticipantTourSummary() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState<string | null>(null);

  useEffect(() => {
    const selected = window.localStorage.getItem("gf_participant_id");
    const query = selected ? `?participantId=${encodeURIComponent(selected)}` : "";
    fetch(`/api/partecipante/tours${query}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json();
      })
      .then((json) => {
        if (!json?.settings?.publicEnabled) return;
        setVisible(true);
        const current = Array.isArray(json.tours)
          ? json.tours.find((tour: { id?: string }) => tour.id === json.booking?.tourId)
          : null;
        setTitle(current?.title ?? null);
      })
      .catch(() => undefined);
  }, []);

  if (!visible) return null;
  return (
    <section className="mb-6 rounded-xl border border-indigo-200 bg-indigo-50 p-5">
      <div className="text-xs font-semibold uppercase tracking-wide text-indigo-700">{t("tours.participant.current")}</div>
      <h2 className="mt-2 text-lg font-semibold text-slate-900">{title ?? t("tours.participant.none")}</h2>
      <Link href="/dashboard/partecipante/tours" className="mt-3 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
        {t("tours.participant.manage")}
      </Link>
    </section>
  );
}
