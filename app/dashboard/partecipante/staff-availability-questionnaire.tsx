"use client";

import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import {
  SOCIAL_MEDIA_TASKS,
  STAFF_AREAS,
  type BandRole,
  type ParticipantStaffAvailability,
  type ParticipantStaffAvailabilityInput,
  type SocialMediaTask,
  type StaffArea,
} from "@/lib/partecipante/staff-availability";
import { saveParticipantStaffAvailability } from "./staff-availability-actions";

const EMPTY_AVAILABILITY: ParticipantStaffAvailabilityInput = {
  areas: [],
  bandRole: null,
  bandInstrument: null,
  socialMediaTasks: [],
  socialMediaOther: null,
};

function areaTranslationKey(area: StaffArea) {
  return `participant.staff.area.${area}`;
}

function socialTaskTranslationKey(task: SocialMediaTask) {
  return `participant.staff.social.${task}`;
}

export function StaffAvailabilityQuestionnaire({
  participantId,
  initialAvailability,
}: {
  participantId: string;
  initialAvailability: ParticipantStaffAvailability | null;
}) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState<ParticipantStaffAvailabilityInput>(() =>
    initialAvailability
      ? {
          areas: initialAvailability.areas,
          bandRole: initialAvailability.bandRole,
          bandInstrument: initialAvailability.bandInstrument,
          socialMediaTasks: initialAvailability.socialMediaTasks,
          socialMediaOther: initialAvailability.socialMediaOther,
        }
      : EMPTY_AVAILABILITY
  );
  const [savedAvailability, setSavedAvailability] =
    useState<ParticipantStaffAvailability | null>(initialAvailability);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const includesBand = draft.areas.includes("band");
  const includesSocialMedia = draft.areas.includes("social_media");
  const includesSocialOther = draft.socialMediaTasks.includes("other");

  function toggleArea(area: StaffArea) {
    setDraft((current) => {
      const selected = current.areas.includes(area);
      const areas = selected
        ? current.areas.filter((item) => item !== area)
        : [...current.areas, area];

      return {
        ...current,
        areas,
        bandRole: area === "band" && selected ? null : current.bandRole,
        bandInstrument:
          area === "band" && selected ? null : current.bandInstrument,
        socialMediaTasks:
          area === "social_media" && selected ? [] : current.socialMediaTasks,
        socialMediaOther:
          area === "social_media" && selected ? null : current.socialMediaOther,
      };
    });
    setError(null);
    setSuccess(null);
  }

  function setBandRole(role: BandRole) {
    setDraft((current) => ({
      ...current,
      bandRole: role,
      bandInstrument: role === "vocals" ? null : current.bandInstrument,
    }));
    setError(null);
    setSuccess(null);
  }

  function toggleSocialTask(task: SocialMediaTask) {
    setDraft((current) => {
      const selected = current.socialMediaTasks.includes(task);
      return {
        ...current,
        socialMediaTasks: selected
          ? current.socialMediaTasks.filter((item) => item !== task)
          : [...current.socialMediaTasks, task],
        socialMediaOther:
          task === "other" && selected ? null : current.socialMediaOther,
      };
    });
    setError(null);
    setSuccess(null);
  }

  function saveAvailability() {
    setError(null);
    setSuccess(null);

    if (draft.areas.length === 0) {
      setError(t("participant.staff.validation.area"));
      return;
    }
    if (includesBand && !draft.bandRole) {
      setError(t("participant.staff.validation.bandRole"));
      return;
    }
    if (
      includesBand &&
      draft.bandRole === "instrument" &&
      !draft.bandInstrument?.trim()
    ) {
      setError(t("participant.staff.validation.instrument"));
      return;
    }
    if (includesSocialMedia && draft.socialMediaTasks.length === 0) {
      setError(t("participant.staff.validation.socialTask"));
      return;
    }
    if (
      includesSocialMedia &&
      includesSocialOther &&
      !draft.socialMediaOther?.trim()
    ) {
      setError(t("participant.staff.validation.socialOther"));
      return;
    }

    startTransition(async () => {
      const result = await saveParticipantStaffAvailability(participantId, draft);
      if (!result.ok) {
        setError(t("participant.staff.saveError"));
        return;
      }

      setSavedAvailability(result.availability);
      setDraft({
        areas: result.availability.areas,
        bandRole: result.availability.bandRole,
        bandInstrument: result.availability.bandInstrument,
        socialMediaTasks: result.availability.socialMediaTasks,
        socialMediaOther: result.availability.socialMediaOther,
      });
      setSuccess(t("participant.staff.saveSuccess"));
    });
  }

  return (
    <section
      className="overflow-hidden rounded-xl border-2 border-indigo-300 bg-gradient-to-br from-indigo-50 via-white to-amber-50 shadow-sm"
      aria-labelledby="staff-availability-title"
    >
      <div className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id="staff-availability-title"
                className="text-xl font-bold text-indigo-950"
              >
                {t("participant.staff.title")}
              </h2>
              {savedAvailability ? (
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                  {t("participant.staff.savedBadge")}
                </span>
              ) : null}
            </div>
            <p className="mt-2 max-w-2xl text-sm text-slate-700">
              {t("participant.staff.description")}
            </p>
          </div>

          <button
            type="button"
            aria-expanded={isOpen}
            aria-controls="staff-availability-questionnaire"
            onClick={() => {
              setIsOpen((current) => !current);
              setError(null);
              setSuccess(null);
            }}
            className="shrink-0 rounded-lg bg-indigo-700 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
          >
            {savedAvailability
              ? t("participant.staff.reviewButton")
              : t("participant.staff.openButton")}
          </button>
        </div>
      </div>

      {isOpen ? (
        <div
          id="staff-availability-questionnaire"
          className="border-t border-indigo-200 bg-white/90 p-5 sm:p-6"
        >
          <div className="space-y-6">
            <fieldset>
              <legend className="text-base font-semibold text-slate-900">
                {t("participant.staff.areasQuestion")}
              </legend>
              <p className="mt-1 text-sm text-slate-500">
                {t("participant.staff.multipleChoiceHint")}
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {STAFF_AREAS.map((area) => (
                  <label
                    key={area}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 text-sm transition-colors ${
                      draft.areas.includes(area)
                        ? "border-indigo-500 bg-indigo-50 text-indigo-950"
                        : "border-slate-200 bg-white text-slate-700 hover:border-indigo-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={draft.areas.includes(area)}
                      onChange={() => toggleArea(area)}
                      className="mt-0.5 h-4 w-4"
                    />
                    <span className="font-medium">{t(areaTranslationKey(area))}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {includesBand ? (
              <fieldset className="rounded-lg border border-amber-200 bg-amber-50/70 p-4">
                <legend className="px-1 text-base font-semibold text-slate-900">
                  {t("participant.staff.bandQuestion")}
                </legend>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:gap-6">
                  {(["vocals", "instrument"] as const).map((role) => (
                    <label key={role} className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name={`staff-band-role-${participantId}`}
                        checked={draft.bandRole === role}
                        onChange={() => setBandRole(role)}
                        className="h-4 w-4"
                      />
                      <span>{t(`participant.staff.band.${role}`)}</span>
                    </label>
                  ))}
                </div>

                {draft.bandRole === "instrument" ? (
                  <div className="mt-4">
                    <label
                      htmlFor={`staff-band-instrument-${participantId}`}
                      className="block text-sm font-medium text-slate-800"
                    >
                      {t("participant.staff.instrumentQuestion")}
                    </label>
                    <input
                      id={`staff-band-instrument-${participantId}`}
                      value={draft.bandInstrument ?? ""}
                      maxLength={120}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          bandInstrument: event.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                ) : null}
              </fieldset>
            ) : null}

            {includesSocialMedia ? (
              <fieldset className="rounded-lg border border-sky-200 bg-sky-50/70 p-4">
                <legend className="px-1 text-base font-semibold text-slate-900">
                  {t("participant.staff.socialQuestion")}
                </legend>
                <p className="mt-1 text-sm text-slate-500">
                  {t("participant.staff.multipleChoiceHint")}
                </p>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {SOCIAL_MEDIA_TASKS.map((task) => (
                    <label
                      key={task}
                      className="flex items-start gap-2 rounded border border-sky-200 bg-white px-3 py-2 text-sm text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={draft.socialMediaTasks.includes(task)}
                        onChange={() => toggleSocialTask(task)}
                        className="mt-0.5 h-4 w-4"
                      />
                      <span>{t(socialTaskTranslationKey(task))}</span>
                    </label>
                  ))}
                </div>

                {includesSocialOther ? (
                  <div className="mt-4">
                    <label
                      htmlFor={`staff-social-other-${participantId}`}
                      className="block text-sm font-medium text-slate-800"
                    >
                      {t("participant.staff.socialOtherQuestion")}
                    </label>
                    <textarea
                      id={`staff-social-other-${participantId}`}
                      rows={3}
                      maxLength={500}
                      value={draft.socialMediaOther ?? ""}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          socialMediaOther: event.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                ) : null}
              </fieldset>
            ) : null}

            {error ? (
              <div
                role="alert"
                className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            ) : null}

            {success ? (
              <div
                role="status"
                className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
              >
                {success}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={saveAvailability}
                disabled={isPending}
                className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending
                  ? t("participant.staff.saving")
                  : t("participant.staff.saveButton")}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={isPending}
                className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {t("participant.staff.closeButton")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
