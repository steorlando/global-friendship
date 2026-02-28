"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  ALLOGGIO_OPTIONS,
  ARRIVAL_DATE_MAX,
  ARRIVAL_DATE_MIN,
  DEPARTURE_DATE_MAX,
  DEPARTURE_DATE_MIN,
  DIFFICOLTA_ACCESSIBILITA_OPTIONS,
  ESIGENZE_ALIMENTARI_OPTIONS,
} from "@/lib/partecipante/constants";
import { useI18n } from "@/lib/i18n/provider";

type ParticipantFormData = {
  nome: string;
  cognome: string;
  nazione: string;
  data_nascita: string;
  data_arrivo: string;
  data_partenza: string;
  alloggio: string;
  allergie: string;
  esigenze_alimentari: string[];
  disabilita_accessibilita: boolean;
  difficolta_accessibilita: string[];
};

const INITIAL_DATA: ParticipantFormData = {
  nome: "",
  cognome: "",
  nazione: "",
  data_nascita: "",
  data_arrivo: "",
  data_partenza: "",
  alloggio: "",
  allergie: "",
  esigenze_alimentari: [],
  disabilita_accessibilita: false,
  difficolta_accessibilita: [],
};

type ApiParticipant = ParticipantFormData & {
  id: string;
  email: string | null;
};

type ParticipantCandidate = {
  id: string;
  nome: string | null;
  cognome: string | null;
  gruppo_id: string | null;
  gruppo_label: string | null;
  submitted_at_tally: string | null;
};

const PARTICIPANT_SELECTION_STORAGE_KEY = "gf_participant_id";

export function PartecipanteForm() {
  const { t } = useI18n();
  const [formData, setFormData] = useState<ParticipantFormData>(INITIAL_DATA);
  const [email, setEmail] = useState<string>("");
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(
    null
  );
  const [participantCandidates, setParticipantCandidates] = useState<
    ParticipantCandidate[]
  >([]);
  const [requiresSelection, setRequiresSelection] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteEmailInput, setDeleteEmailInput] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function loadData(participantId?: string) {
      try {
        setLoading(true);
        setLoadError(null);
        const query = participantId
          ? `?participantId=${encodeURIComponent(participantId)}`
          : "";
        const res = await fetch(`/api/partecipante/me${query}`, { method: "GET" });
        const json = await res.json();

        if (res.status === 409 && json.code === "PARTICIPANT_SELECTION_REQUIRED") {
          setRequiresSelection(true);
          setParticipantCandidates(
            Array.isArray(json.participants) ? json.participants : []
          );
          setSelectedParticipantId(participantId ?? null);
          return;
        }

        if (!res.ok) {
          setLoadError(json.error ?? t("participant.form.loadError"));
          setRequiresSelection(false);
          return;
        }

        const participant = json.participant as ApiParticipant;
        const returnedSelectedId =
          typeof json.selectedParticipantId === "string"
            ? json.selectedParticipantId
            : participant.id;
        setSelectedParticipantId(returnedSelectedId);
        setParticipantCandidates(
          Array.isArray(json.participants) ? json.participants : []
        );
        setRequiresSelection(false);
        if (returnedSelectedId) {
          window.localStorage.setItem(
            PARTICIPANT_SELECTION_STORAGE_KEY,
            returnedSelectedId
          );
        }
        setEmail(participant.email ?? "");
        setFormData({
          nome: participant.nome ?? "",
          cognome: participant.cognome ?? "",
          nazione: participant.nazione ?? "",
          data_nascita: participant.data_nascita ?? "",
          data_arrivo: participant.data_arrivo ?? "",
          data_partenza: participant.data_partenza ?? "",
          alloggio: participant.alloggio ?? "",
          allergie: participant.allergie ?? "",
          esigenze_alimentari: Array.isArray(participant.esigenze_alimentari)
            ? participant.esigenze_alimentari
            : [],
          disabilita_accessibilita: Boolean(
            participant.disabilita_accessibilita
          ),
          difficolta_accessibilita: Array.isArray(
            participant.difficolta_accessibilita
          )
            ? participant.difficolta_accessibilita
            : [],
        });
      } catch {
        setLoadError(t("participant.form.loadError"));
      } finally {
        setLoading(false);
      }
    }

    const storedParticipantId = window.localStorage.getItem(
      PARTICIPANT_SELECTION_STORAGE_KEY
    );
    void loadData(storedParticipantId || undefined);
  }, [t]);

  async function handleSelectionChange(participantId: string) {
    setSelectedParticipantId(participantId);
    setLoadError(null);
    setSuccess(null);
    setError(null);
    setDeleteError(null);
    setDeleteSuccess(null);
    window.localStorage.setItem(PARTICIPANT_SELECTION_STORAGE_KEY, participantId);
    try {
      setLoading(true);
      const res = await fetch(
        `/api/partecipante/me?participantId=${encodeURIComponent(participantId)}`,
        { method: "GET" }
      );
      const json = await res.json();
      if (!res.ok) {
        setLoadError(json.error ?? t("participant.form.loadError"));
        return;
      }

      const participant = json.participant as ApiParticipant;
      setEmail(participant.email ?? "");
      setFormData({
        nome: participant.nome ?? "",
        cognome: participant.cognome ?? "",
        nazione: participant.nazione ?? "",
        data_nascita: participant.data_nascita ?? "",
        data_arrivo: participant.data_arrivo ?? "",
        data_partenza: participant.data_partenza ?? "",
        alloggio: participant.alloggio ?? "",
        allergie: participant.allergie ?? "",
        esigenze_alimentari: Array.isArray(participant.esigenze_alimentari)
          ? participant.esigenze_alimentari
          : [],
        disabilita_accessibilita: Boolean(participant.disabilita_accessibilita),
        difficolta_accessibilita: Array.isArray(participant.difficolta_accessibilita)
          ? participant.difficolta_accessibilita
          : [],
      });
      setRequiresSelection(false);
    } catch {
      setLoadError(t("participant.form.loadError"));
    } finally {
      setLoading(false);
    }
  }

  function toggleDifficolta(option: string) {
    setFormData((prev) => {
      const exists = prev.difficolta_accessibilita.includes(option);
      return {
        ...prev,
        difficolta_accessibilita: exists
          ? prev.difficolta_accessibilita.filter((item) => item !== option)
          : [...prev.difficolta_accessibilita, option],
      };
    });
  }

  function toggleEsigenza(option: string) {
    setFormData((prev) => {
      const exists = prev.esigenze_alimentari.includes(option);
      return {
        ...prev,
        esigenze_alimentari: exists
          ? prev.esigenze_alimentari.filter((item) => item !== option)
          : [...prev.esigenze_alimentari, option],
      };
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/partecipante/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          participant_id: selectedParticipantId,
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? t("participant.form.saveError"));
        return;
      }

      setSuccess(t("participant.form.saveSuccess"));
    } catch {
      setError(t("participant.form.saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteRegistration() {
    setDeleteError(null);
    setDeleteSuccess(null);
    setDeleting(true);

    try {
      const res = await fetch("/api/partecipante/me", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmation_email: deleteEmailInput,
          participant_id: selectedParticipantId,
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        setDeleteError(json.error ?? t("participant.form.deleteError"));
        return;
      }

      if (json.emailSent === false) {
        setDeleteSuccess(
          t("participant.form.deleteSuccessNoEmail")
        );
      } else {
        setDeleteSuccess(t("participant.form.deleteSuccess"));
      }

      setTimeout(() => {
        window.location.replace("/login?cancelled=1");
      }, 1400);
    } catch {
      setDeleteError(t("participant.form.deleteError"));
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
        {t("common.loadingParticipantData")}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {loadError}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {requiresSelection && participantCandidates.length > 0 ? (
        <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-medium">{t("participant.form.multipleFoundTitle")}</p>
          <p className="mt-1">
            {t("participant.form.multipleFoundBody")}
          </p>
        </div>
      ) : null}

      {participantCandidates.length > 1 ? (
        <div>
          <label className="block text-sm font-medium text-slate-700">
            {t("participant.form.profile")}
          </label>
          <select
            value={selectedParticipantId ?? ""}
            onChange={(e) => {
              const nextId = e.target.value;
              if (nextId) {
                void handleSelectionChange(nextId);
              }
            }}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="" disabled>
              {t("participant.form.selectParticipant")}
            </option>
            {participantCandidates.map((candidate) => {
              const fullName = [candidate.nome ?? "", candidate.cognome ?? ""]
                .join(" ")
                .trim();
              const groupLabel =
                (candidate.gruppo_label ?? candidate.gruppo_id ?? "").trim() || "-";
              return (
                <option key={candidate.id} value={candidate.id}>
                  {fullName || t("participant.form.unnamedParticipant")} - {t("participant.form.group")} {groupLabel}
                </option>
              );
            })}
          </select>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700">{t("participant.form.name")}</label>
          <input
            required
            value={formData.nome}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, nome: e.target.value }))
            }
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">
            {t("participant.form.surname")}
          </label>
          <input
            required
            value={formData.cognome}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, cognome: e.target.value }))
            }
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">
            {t("participant.form.nationality")}
          </label>
          <input
            value={formData.nazione}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, nazione: e.target.value }))
            }
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">
            {t("participant.form.dateOfBirth")}
          </label>
          <input
            type="date"
            value={formData.data_nascita}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, data_nascita: e.target.value }))
            }
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">
            {t("participant.form.arrivalDate")}
          </label>
          <input
            type="date"
            min={ARRIVAL_DATE_MIN}
            max={ARRIVAL_DATE_MAX}
            value={formData.data_arrivo}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, data_arrivo: e.target.value }))
            }
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-slate-500">
            {t("participant.form.allowedBetween", { min: ARRIVAL_DATE_MIN, max: ARRIVAL_DATE_MAX })}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">
            {t("participant.form.departureDate")}
          </label>
          <input
            type="date"
            min={DEPARTURE_DATE_MIN}
            max={DEPARTURE_DATE_MAX}
            value={formData.data_partenza}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, data_partenza: e.target.value }))
            }
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-slate-500">
            {t("participant.form.allowedBetween", {
              min: DEPARTURE_DATE_MIN,
              max: DEPARTURE_DATE_MAX,
            })}
          </p>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700">
            {t("participant.form.accommodation")}
          </label>
          <select
            value={formData.alloggio}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, alloggio: e.target.value }))
            }
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">{t("participant.form.select")}</option>
            {ALLOGGIO_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">
            {t("participant.form.dietaryRequirements")}
          </label>
          <div className="mt-2 grid gap-2 rounded border border-slate-200 p-3">
            {ESIGENZE_ALIMENTARI_OPTIONS.map((option) => (
              <label key={option} className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formData.esigenze_alimentari.includes(option)}
                  onChange={() => toggleEsigenza(option)}
                  className="h-4 w-4"
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">
            {t("participant.form.allergies")}
          </label>
          <input
            value={formData.allergie}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, allergie: e.target.value }))
            }
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-800">
          <input
            type="checkbox"
            checked={formData.disabilita_accessibilita}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                disabilita_accessibilita: e.target.checked,
                difficolta_accessibilita: e.target.checked
                  ? prev.difficolta_accessibilita
                  : [],
              }))
            }
            className="h-4 w-4"
          />
          {t("participant.form.accessibilityNeeds")}
        </label>

        <div className="mt-3 grid gap-2">
          {DIFFICOLTA_ACCESSIBILITA_OPTIONS.map((option) => (
            <label
              key={option}
              className={`inline-flex items-start gap-2 text-sm ${
                formData.disabilita_accessibilita
                  ? "text-slate-700"
                  : "text-slate-400"
              }`}
            >
              <input
                type="checkbox"
                disabled={!formData.disabilita_accessibilita}
                checked={formData.difficolta_accessibilita.includes(option)}
                onChange={() => toggleDifficolta(option)}
                className="mt-0.5 h-4 w-4"
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="rounded border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        {t("participant.form.associatedEmail", { email: email || "-" })}
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {saving ? t("participant.form.saving") : t("participant.form.saveChanges")}
      </button>

      <section className="rounded border border-red-200 bg-red-50 p-4">
        <h3 className="text-sm font-semibold text-red-900">{t("participant.form.deleteTitle")}</h3>
        <p className="mt-1 text-sm text-red-800">
          {t("participant.form.deleteDescription")}
        </p>

        {!showDeleteConfirm ? (
          <button
            type="button"
            onClick={() => {
              setShowDeleteConfirm(true);
              setDeleteError(null);
              setDeleteSuccess(null);
            }}
            className="mt-3 rounded bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800"
          >
            {t("participant.form.cancelRegistration")}
          </button>
        ) : (
          <div className="mt-3 space-y-3">
            <div>
              <label className="block text-sm font-medium text-red-900">
                {t("participant.form.confirmEmail")}
              </label>
              <input
                type="email"
                value={deleteEmailInput}
                onChange={(e) => setDeleteEmailInput(e.target.value)}
                placeholder={email || "your@email.com"}
                className="mt-1 w-full rounded border border-red-300 bg-white px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-red-700">{t("participant.form.insertExactly", { email: email || "-" })}</p>
            </div>

            {deleteError && (
              <div className="rounded border border-red-300 bg-white px-3 py-2 text-sm text-red-700">
                {deleteError}
              </div>
            )}

            {deleteSuccess && (
              <div className="rounded border border-emerald-300 bg-white px-3 py-2 text-sm text-emerald-700">
                {deleteSuccess}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleDeleteRegistration}
                disabled={
                  deleting ||
                  !email ||
                  deleteEmailInput.trim().toLowerCase() !== email.toLowerCase()
                }
                className="rounded bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting ? t("participant.form.cancelling") : t("participant.form.confirmCancellation")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteEmailInput("");
                  setDeleteError(null);
                  setDeleteSuccess(null);
                }}
                disabled={deleting}
                className="rounded border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-800 disabled:opacity-60"
              >
                {t("participant.form.keepRegistration")}
              </button>
            </div>
          </div>
        )}
      </section>
    </form>
  );
}
