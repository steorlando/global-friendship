"use client";

import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { useI18n } from "@/lib/i18n/provider";

export function ParticipantArrivalQr({ participantId }: { participantId: string }) {
  const { t } = useI18n();
  const [value, setValue] = useState<string | null>(null);
  const [arrivedAt, setArrivedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/partecipante/arrival-qr?participantId=${encodeURIComponent(participantId)}`,
          { cache: "no-store", signal: controller.signal }
        );
        const json = (await response.json().catch(() => null)) as
          | { value?: string; arrivedAt?: string | null; error?: string }
          | null;
        if (!response.ok || !json?.value) {
          throw new Error(json?.error || t("participant.arrivalQr.loadError"));
        }
        setValue(json.value);
        setArrivedAt(json.arrivedAt ?? null);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : t("participant.arrivalQr.loadError")
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [participantId, t]);

  useEffect(() => {
    if (!expanded) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [expanded]);

  return (
    <section className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 sm:p-5">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => value && setExpanded(true)}
          disabled={!value}
          className="shrink-0 rounded-xl border border-indigo-200 bg-white p-2 shadow-sm disabled:opacity-50"
          aria-label={t("participant.arrivalQr.expand")}
        >
          {value ? (
            <QRCode value={value} size={88} level="M" aria-hidden="true" />
          ) : (
            <span className="flex h-[88px] w-[88px] items-center justify-center text-xs text-slate-500">
              {loading ? t("participant.arrivalQr.loading") : "QR"}
            </span>
          )}
        </button>
        <div className="min-w-0">
          <h2 className="text-base font-bold text-slate-950">
            {t("participant.arrivalQr.title")}
          </h2>
          <p className="mt-1 text-sm leading-5 text-slate-600">
            {t("participant.arrivalQr.description")}
          </p>
          {arrivedAt ? (
            <p className="mt-2 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
              {t("participant.arrivalQr.arrived")}
            </p>
          ) : null}
          {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
        </div>
      </div>

      {expanded && value ? (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/95 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="participant-arrival-qr-title"
          onClick={() => setExpanded(false)}
        >
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="absolute right-4 top-4 min-h-12 min-w-12 rounded-full border border-white/50 bg-white/10 text-2xl text-white"
            aria-label={t("common.close")}
          >
            ×
          </button>
          <div
            className="w-full max-w-md rounded-3xl bg-white p-5 text-center shadow-2xl sm:p-8"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="participant-arrival-qr-title" className="text-xl font-bold text-slate-950">
              {t("participant.arrivalQr.fullscreenTitle")}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {t("participant.arrivalQr.fullscreenHint")}
            </p>
            <div className="mx-auto mt-6 flex aspect-square w-full items-center justify-center rounded-2xl bg-white p-2">
              <QRCode value={value} size={360} level="M" className="h-auto w-full" />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
