"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ArrivalAccommodationType,
  ArrivalParticipant,
} from "@/lib/accoglienza/arrivals";
import { useI18n } from "@/lib/i18n/provider";

type ScannerControls = {
  stop: () => void;
  switchTorch?: (on: boolean) => Promise<void>;
};

export function ArrivalQrScanner({
  participants,
  onMarkArrived,
}: {
  participants: ArrivalParticipant[];
  onMarkArrived: (participantId: string) => Promise<void>;
}) {
  const { t, formatDate } = useI18n();
  const [open, setOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [marking, setMarking] = useState(false);
  const [found, setFound] = useState<ArrivalParticipant | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualValue, setManualValue] = useState("");
  const [torchOn, setTorchOn] = useState(false);
  const accommodationLabels: Record<ArrivalAccommodationType, string> = {
    Hotel: t("reception.accommodation.hotel"),
    Ostello: t("reception.accommodation.hostel"),
    Autonomo: t("reception.accommodation.autonomous"),
  };
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<ScannerControls | null>(null);
  const scanLockedRef = useRef(false);

  const stopCamera = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    scanLockedRef.current = false;
    setScanning(false);
    setStarting(false);
    setTorchOn(false);
  }, []);

  const resolveCode = useCallback(
    async (value: string) => {
      if (scanLockedRef.current) return;
      scanLockedRef.current = true;
      setResolving(true);
      setError(null);
      controlsRef.current?.stop();
      controlsRef.current = null;
      setScanning(false);

      try {
        const response = await fetch("/api/accoglienza/scan", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ value }),
        });
        const json = (await response.json().catch(() => null)) as
          | { participantId?: string; error?: string }
          | null;
        if (!response.ok || !json?.participantId) {
          throw new Error(json?.error || t("reception.scanner.notRecognized"));
        }

        const participant = participants.find((row) => row.id === json.participantId);
        if (!participant) throw new Error(t("reception.scanner.participantMissing"));
        setFound(participant);
      } catch (scanError) {
        setError(
          scanError instanceof Error
            ? scanError.message
            : t("reception.scanner.notRecognized")
        );
        scanLockedRef.current = false;
      } finally {
        setResolving(false);
      }
    },
    [participants, t]
  );

  const startCamera = useCallback(async () => {
    if (!videoRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(t("reception.scanner.unsupported"));
      return;
    }

    stopCamera();
    setFound(null);
    setError(null);
    setStarting(true);
    scanLockedRef.current = false;

    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const reader = new BrowserQRCodeReader(undefined, {
        delayBetweenScanAttempts: 150,
        delayBetweenScanSuccess: 500,
      });
      const controls = await reader.decodeFromConstraints(
        {
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        videoRef.current,
        (result, _error, activeControls) => {
          if (result) {
            activeControls.stop();
            void resolveCode(result.getText());
          }
        }
      );
      if (scanLockedRef.current) {
        controls.stop();
      } else {
        controlsRef.current = controls;
        setScanning(true);
      }
    } catch (cameraError) {
      const message = cameraError instanceof Error ? cameraError.message : "";
      setError(
        /permission|denied|notallowed/i.test(message)
          ? t("reception.scanner.permissionDenied")
          : t("reception.scanner.cameraError")
      );
    } finally {
      setStarting(false);
    }
  }, [resolveCode, stopCamera, t]);

  const close = useCallback(() => {
    stopCamera();
    setOpen(false);
    setFound(null);
    setError(null);
    setManualValue("");
  }, [stopCamera]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  useEffect(() => {
    if (!open || found) return;
    const timeoutId = window.setTimeout(() => void startCamera(), 50);
    return () => window.clearTimeout(timeoutId);
  }, [found, open, startCamera]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [close, open]);

  async function markFoundParticipant() {
    if (!found || found.arrivedAt) return;
    setMarking(true);
    setError(null);
    try {
      await onMarkArrived(found.id);
      setFound({ ...found, arrivedAt: new Date().toISOString() });
    } catch (markError) {
      setError(
        markError instanceof Error ? markError.message : t("reception.mark.error")
      );
    } finally {
      setMarking(false);
    }
  }

  async function toggleTorch() {
    if (!controlsRef.current?.switchTorch) return;
    try {
      await controlsRef.current.switchTorch(!torchOn);
      setTorchOn((current) => !current);
    } catch {
      setError(t("reception.scanner.torchError"));
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
      >
        <span aria-hidden="true">▣</span>
        {t("reception.scanner.open")}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex bg-slate-950/80 sm:items-center sm:justify-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="arrival-scanner-title"
        >
          <div className="flex h-full w-full flex-col overflow-y-auto bg-white sm:h-auto sm:max-h-[94vh] sm:max-w-lg sm:rounded-2xl">
            <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <h2 id="arrival-scanner-title" className="text-lg font-bold text-slate-950">
                  {t("reception.scanner.title")}
                </h2>
                <p className="text-xs text-slate-500">{t("reception.scanner.hint")}</p>
              </div>
              <button
                type="button"
                onClick={close}
                className="min-h-11 min-w-11 rounded-full border border-slate-300 text-xl text-slate-700"
                aria-label={t("common.close")}
              >
                ×
              </button>
            </header>

            <div className="flex-1 space-y-4 p-4">
              {!found ? (
                <div className="relative aspect-[3/4] max-h-[58vh] overflow-hidden rounded-2xl bg-slate-950 sm:aspect-video">
                  <video
                    ref={videoRef}
                    className="h-full w-full object-cover"
                    muted
                    playsInline
                    autoPlay
                  />
                  <div className="pointer-events-none absolute inset-[15%] rounded-3xl border-4 border-white/90 shadow-[0_0_0_999px_rgba(15,23,42,0.35)]" />
                  {!scanning ? (
                    <div className="absolute inset-0 flex items-center justify-center p-6">
                      <button
                        type="button"
                        onClick={() => void startCamera()}
                        disabled={starting || resolving}
                        className="min-h-14 rounded-xl bg-white px-6 py-3 text-base font-bold text-slate-950 shadow-lg disabled:opacity-60"
                      >
                        {starting
                          ? t("reception.scanner.starting")
                          : resolving
                            ? t("reception.scanner.reading")
                            : t("reception.scanner.start")}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <article
                  className={`rounded-2xl border p-5 ${
                    found.arrivedAt
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-indigo-300 bg-indigo-50"
                  }`}
                >
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    ID {found.personalCode}
                  </p>
                  <h3 className="mt-1 text-2xl font-bold text-slate-950">
                    {found.firstName} {found.lastName}
                  </h3>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-slate-500">{t("reception.table.group")}</dt>
                      <dd className="font-semibold text-slate-900">{found.group}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">{t("reception.table.arrivalDate")}</dt>
                      <dd className="font-semibold text-slate-900">
                        {found.arrivalDate ? formatDate(found.arrivalDate) : "-"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">{t("reception.table.accommodation")}</dt>
                      <dd className="font-semibold text-slate-900">
                        {accommodationLabels[found.accommodationType]}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">{t("reception.table.country")}</dt>
                      <dd className="font-semibold text-slate-900">{found.country}</dd>
                    </div>
                  </dl>
                  {found.arrivedAt ? (
                    <p className="mt-5 rounded-xl bg-emerald-100 px-4 py-3 text-center font-bold text-emerald-900">
                      {t("reception.status.arrived")}
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void markFoundParticipant()}
                      disabled={marking}
                      className="mt-5 min-h-14 w-full rounded-xl bg-emerald-600 px-5 py-3 text-lg font-bold text-white shadow-sm disabled:opacity-60"
                    >
                      {marking ? t("reception.mark.saving") : t("reception.mark.one")}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setFound(null);
                      scanLockedRef.current = false;
                    }}
                    className="mt-3 min-h-12 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
                  >
                    {t("reception.scanner.scanAnother")}
                  </button>
                </article>
              )}

              {scanning && controlsRef.current?.switchTorch ? (
                <button
                  type="button"
                  onClick={() => void toggleTorch()}
                  className="min-h-11 w-full rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  {torchOn ? t("reception.scanner.torchOff") : t("reception.scanner.torchOn")}
                </button>
              ) : null}

              {error ? (
                <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {error}
                </p>
              ) : null}

              {!found ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (manualValue.trim()) void resolveCode(manualValue);
                  }}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                >
                  <label className="text-xs font-semibold text-slate-600">
                    {t("reception.scanner.manualLabel")}
                  </label>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={manualValue}
                      onChange={(event) => setManualValue(event.target.value)}
                      className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      placeholder={t("reception.scanner.manualPlaceholder")}
                    />
                    <button
                      type="submit"
                      disabled={!manualValue.trim() || resolving}
                      className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {t("reception.scanner.lookup")}
                    </button>
                  </div>
                </form>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
