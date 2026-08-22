"use client";

import { FormEvent, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import {
  HOSTEL_IDENTITY_DOCUMENT_TYPES,
  type HostelCheckInInput,
} from "@/lib/alloggi/check-in";

type HostelCheckInResponse = {
  enabled: boolean;
  applicable?: boolean;
  awaitingAssignment?: boolean;
  completed?: boolean;
  completedAt?: string | null;
  accommodation?: {
    hotelName: string;
    hotelAddress: string | null;
    googleMapsUrl: string | null;
    roomNumber: string | null;
    internalRoomCode: string;
    roommates: Array<{ id: string; name: string }>;
  };
  stay?: {
    arrivalDate: string | null;
    departureDate: string | null;
  };
  checkIn?: HostelCheckInInput | null;
};

const EMPTY_CHECK_IN: HostelCheckInInput = {
  identityDocumentType: "passport",
  identityDocumentNumber: "",
  identityDocumentCountry: "",
  identityDocumentIssuingCity: "",
  identityDocumentIssueDate: "",
  identityDocumentExpirationDate: "",
};

function documentTypeLabel(
  documentType: HostelCheckInInput["identityDocumentType"],
  t: (key: string) => string
) {
  return t(`participant.hostelCheckIn.documentType.${documentType}`);
}

type HostelCheckInSectionProps = {
  participantId: string;
  context?: "participant" | "staff";
  onCompleted?: () => void;
};

export function HostelCheckInSection({
  participantId,
  context = "participant",
  onCompleted,
}: HostelCheckInSectionProps) {
  const { t, formatDate } = useI18n();
  const isStaffContext = context === "staff";
  const [data, setData] = useState<HostelCheckInResponse | null>(null);
  const [form, setForm] = useState<HostelCheckInInput>(EMPTY_CHECK_IN);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadCheckIn() {
      setLoading(true);
      setLoadError(null);
      setIsOpen(false);
      setSaveError(null);
      setSuccess(null);

      try {
        const res = await fetch(
          `/api/partecipante/hostel-check-in?participantId=${encodeURIComponent(
            participantId
          )}`,
          { cache: "no-store" }
        );
        const json = (await res.json()) as HostelCheckInResponse & { error?: string };
        if (!res.ok) throw new Error(json.error || t("participant.hostelCheckIn.loadError"));
        if (!active) return;

        setData(json);
        setForm(json.checkIn ?? EMPTY_CHECK_IN);
      } catch (error) {
        if (!active) return;
        setLoadError(
          error instanceof Error
            ? error.message
            : t("participant.hostelCheckIn.loadError")
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadCheckIn();
    return () => {
      active = false;
    };
  }, [participantId, t]);

  function updateForm<Key extends keyof HostelCheckInInput>(
    key: Key,
    value: HostelCheckInInput[Key]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
    setSaveError(null);
    setSuccess(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/partecipante/hostel-check-in", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId, ...form }),
      });
      const json = (await res.json()) as {
        completed?: boolean;
        completedAt?: string | null;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error || t("participant.hostelCheckIn.saveError"));
      }

      setData((current) =>
        current
          ? {
              ...current,
              completed: true,
              completedAt: json.completedAt ?? new Date().toISOString(),
              checkIn: form,
            }
          : current
      );
      setSuccess(
        t(
          isStaffContext
            ? "participants.table.modal.hostelCheckIn.saveSuccess"
            : "participant.hostelCheckIn.saveSuccess"
        )
      );
      onCompleted?.();
      setIsOpen(false);
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : t("participant.hostelCheckIn.saveError")
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="animate-pulse rounded-xl border border-slate-200 bg-slate-50 p-5">
        <div className="h-5 w-52 rounded bg-slate-200" />
        <div className="mt-3 h-4 w-full max-w-md rounded bg-slate-200" />
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
        {loadError}
      </section>
    );
  }

  if (!data?.enabled) {
    if (isStaffContext) return null;
    return (
      <section
        className="rounded-xl border border-slate-200 bg-slate-100/80 px-5 py-5 text-slate-600"
        aria-labelledby={`hostel-check-in-placeholder-${participantId}`}
      >
        <h2
          id={`hostel-check-in-placeholder-${participantId}`}
          className="text-base font-semibold text-slate-700"
        >
          {t("participant.hostelCheckIn.placeholderTitle")}
        </h2>
        <p className="mt-1 text-sm">
          {t("participant.hostelCheckIn.placeholderDescription")}
        </p>
      </section>
    );
  }

  if (!data.applicable && !data.awaitingAssignment) return null;

  if (!data.applicable && data.awaitingAssignment) {
    return (
      <section className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-5 text-slate-700">
        <h2 className="text-base font-semibold text-slate-900">
          {t(
            isStaffContext
              ? "participants.table.modal.hostelCheckIn.title"
              : "participant.hostelCheckIn.title"
          )}
        </h2>
        <p className="mt-1 text-sm">
          {t(
            isStaffContext
              ? "participants.table.modal.hostelCheckIn.awaitingAssignment"
              : "participant.hostelCheckIn.awaitingAssignment"
          )}
        </p>
      </section>
    );
  }

  const accommodation = data.accommodation;
  const stay = data.stay;
  if (!accommodation || !stay) return null;

  const completed = Boolean(data.completed);
  const dateOptions: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "long",
    year: "numeric",
  };

  return (
    <section
      className={`overflow-hidden rounded-xl border-2 bg-white shadow-sm ${
        completed ? "border-emerald-300" : "border-rose-300"
      }`}
      aria-labelledby={`hostel-check-in-title-${participantId}`}
    >
      <div className="p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id={`hostel-check-in-title-${participantId}`}
                className="text-xl font-bold text-slate-950"
              >
                {t(
                  isStaffContext
                    ? "participants.table.modal.hostelCheckIn.title"
                    : "participant.hostelCheckIn.title"
                )}
              </h2>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  completed
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-rose-100 text-rose-800"
                }`}
              >
                {completed
                  ? t("participant.hostelCheckIn.completedBadge")
                  : t("participant.hostelCheckIn.pendingBadge")}
              </span>
            </div>

            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t("participant.hostelCheckIn.hostel")}
                </dt>
                <dd className="mt-1 font-semibold text-slate-900">
                  {accommodation.hotelName}
                </dd>
              </div>
              <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t("participant.hostelCheckIn.room")}
                </dt>
                <dd className="mt-1">
                  {accommodation.roomNumber ? (
                    <span className="block text-3xl font-black tracking-tight text-indigo-950">
                      {accommodation.roomNumber}
                    </span>
                  ) : (
                    <>
                      <span
                        className="block text-3xl font-black leading-none text-amber-700"
                        aria-label={t("participant.hostelCheckIn.roomNumberMissing")}
                      >
                        —
                      </span>
                      <span className="mt-1 block text-xs font-medium text-amber-800">
                        {t("participant.hostelCheckIn.roomNumberMissing")}
                      </span>
                    </>
                  )}
                  <span className="mt-1.5 block text-xs font-medium text-slate-500">
                    {t("participant.hostelCheckIn.internalRoomCode", {
                      code: accommodation.internalRoomCode,
                    })}
                  </span>
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t("participant.hostelCheckIn.address")}
                </dt>
                <dd className="mt-1 text-sm text-slate-800">
                  {accommodation.googleMapsUrl && accommodation.hotelAddress ? (
                    <a
                      href={accommodation.googleMapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-indigo-700 underline decoration-indigo-300 underline-offset-2"
                    >
                      {accommodation.hotelAddress}
                    </a>
                  ) : (
                    accommodation.hotelAddress || "-"
                  )}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t("participant.hostelCheckIn.roommates")}
                </dt>
                <dd className="mt-1 text-sm text-slate-800">
                  {accommodation.roommates.length > 0
                    ? accommodation.roommates.map((roommate) => roommate.name).join(", ")
                    : t("participant.hostelCheckIn.noRoommates")}
                </dd>
              </div>
            </dl>
          </div>

          <button
            type="button"
            aria-expanded={isOpen}
            aria-controls={`hostel-check-in-form-${participantId}`}
            onClick={() => {
              setIsOpen((current) => !current);
              setSaveError(null);
              setSuccess(null);
            }}
            className={`min-h-12 w-full shrink-0 rounded-xl px-5 py-3 text-sm font-bold text-white shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 lg:w-auto ${
              completed
                ? "bg-emerald-600 hover:bg-emerald-700 focus-visible:outline-emerald-700"
                : "bg-rose-600 hover:bg-rose-700 focus-visible:outline-rose-700"
            }`}
          >
            {completed
              ? t(
                  isStaffContext
                    ? "participants.table.modal.hostelCheckIn.reviewButton"
                    : "participant.hostelCheckIn.reviewButton"
                )
              : t(
                  isStaffContext
                    ? "participants.table.modal.hostelCheckIn.openButton"
                    : "participant.hostelCheckIn.openButton"
                )}
          </button>
        </div>
      </div>

      {success ? (
        <p
          className="border-t border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-medium text-emerald-800"
          role="status"
        >
          {success}
        </p>
      ) : null}

      {isOpen ? (
        <form
          id={`hostel-check-in-form-${participantId}`}
          onSubmit={handleSubmit}
          className="border-t border-slate-200 bg-slate-50 p-5 sm:p-6"
          autoComplete="off"
        >
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
            <h3 className="font-semibold text-indigo-950">
              {t("participant.hostelCheckIn.formTitle")}
            </h3>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs font-semibold uppercase text-indigo-700">
                  {t("participant.hostelCheckIn.hostel")}
                </dt>
                <dd className="mt-1 text-indigo-950">{accommodation.hotelName}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-indigo-700">
                  {t("participant.hostelCheckIn.arrivalDate")}
                </dt>
                <dd className="mt-1 text-indigo-950">
                  {stay.arrivalDate
                    ? formatDate(`${stay.arrivalDate}T12:00:00`, dateOptions)
                    : "-"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-indigo-700">
                  {t("participant.hostelCheckIn.departureDate")}
                </dt>
                <dd className="mt-1 text-indigo-950">
                  {stay.departureDate
                    ? formatDate(`${stay.departureDate}T12:00:00`, dateOptions)
                    : "-"}
                </dd>
              </div>
            </dl>
          </div>

          <p className="mt-4 text-sm text-slate-600">
            {t("participant.hostelCheckIn.privacyHint")}
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-800">
              {t("participant.hostelCheckIn.identityDocumentType")}
              <select
                required
                value={form.identityDocumentType}
                onChange={(event) =>
                  updateForm(
                    "identityDocumentType",
                    event.target.value as HostelCheckInInput["identityDocumentType"]
                  )
                }
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base sm:text-sm"
              >
                {HOSTEL_IDENTITY_DOCUMENT_TYPES.map((documentType) => (
                  <option key={documentType} value={documentType}>
                    {documentTypeLabel(documentType, t)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-slate-800">
              {t("participant.hostelCheckIn.identityDocumentNumber")}
              <input
                required
                maxLength={80}
                value={form.identityDocumentNumber}
                onChange={(event) =>
                  updateForm("identityDocumentNumber", event.target.value)
                }
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base sm:text-sm"
              />
            </label>

            <label className="block text-sm font-medium text-slate-800">
              {t("participant.hostelCheckIn.identityDocumentCountry")}
              <input
                required
                maxLength={100}
                autoComplete="country-name"
                value={form.identityDocumentCountry}
                onChange={(event) =>
                  updateForm("identityDocumentCountry", event.target.value)
                }
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base sm:text-sm"
              />
            </label>

            <label className="block text-sm font-medium text-slate-800">
              {t("participant.hostelCheckIn.identityDocumentIssuingCity")}
              <input
                required
                maxLength={100}
                value={form.identityDocumentIssuingCity}
                onChange={(event) =>
                  updateForm("identityDocumentIssuingCity", event.target.value)
                }
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base sm:text-sm"
              />
            </label>

            <label className="block text-sm font-medium text-slate-800">
              {t("participant.hostelCheckIn.identityDocumentIssueDate")}
              <input
                required
                type="date"
                max={form.identityDocumentExpirationDate || undefined}
                value={form.identityDocumentIssueDate}
                onChange={(event) =>
                  updateForm("identityDocumentIssueDate", event.target.value)
                }
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base sm:text-sm"
              />
            </label>

            <label className="block text-sm font-medium text-slate-800">
              {t("participant.hostelCheckIn.identityDocumentExpirationDate")}
              <input
                required
                type="date"
                min={form.identityDocumentIssueDate || undefined}
                value={form.identityDocumentExpirationDate}
                onChange={(event) =>
                  updateForm("identityDocumentExpirationDate", event.target.value)
                }
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base sm:text-sm"
              />
            </label>
          </div>

          {saveError ? (
            <p
              className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              role="alert"
            >
              {saveError}
            </p>
          ) : null}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="min-h-12 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-12 rounded-lg bg-indigo-700 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving
                ? t("participant.hostelCheckIn.saving")
                : t("participant.hostelCheckIn.saveButton")}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
