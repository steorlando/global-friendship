"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ALLOGGIO_OPTIONS,
  ARRIVAL_DATE_MAX,
  ARRIVAL_DATE_MIN,
  DEPARTURE_DATE_MAX,
  DEPARTURE_DATE_MIN,
  DIFFICOLTA_ACCESSIBILITA_OPTIONS,
  ESIGENZE_ALIMENTARI_OPTIONS,
} from "@/lib/partecipante/constants";

type Participant = {
  id: string;
  nome: string | null;
  cognome: string | null;
  nazione: string | null;
  email: string | null;
  telefono: string | null;
  data_nascita: string | null;
  data_arrivo: string | null;
  data_partenza: string | null;
  alloggio: string | null;
  allergie: string | null;
  esigenze_alimentari: string | null;
  disabilita_accessibilita: boolean | null;
  difficolta_accessibilita: string[];
  quota_totale: number | null;
  group: string;
};

type FormState = {
  nome: string;
  cognome: string;
  nazione: string;
  email: string;
  telefono: string;
  data_nascita: string;
  data_arrivo: string;
  data_partenza: string;
  alloggio: string;
  allergie: string;
  esigenze_alimentari: string;
  disabilita_accessibilita: boolean;
  difficolta_accessibilita: string[];
};

const EMPTY_FORM: FormState = {
  nome: "",
  cognome: "",
  nazione: "",
  email: "",
  telefono: "",
  data_nascita: "",
  data_arrivo: "",
  data_partenza: "",
  alloggio: "",
  allergie: "",
  esigenze_alimentari: "",
  disabilita_accessibilita: false,
  difficolta_accessibilita: [],
};

function toFormState(participant: Participant): FormState {
  return {
    nome: participant.nome ?? "",
    cognome: participant.cognome ?? "",
    nazione: participant.nazione ?? "",
    email: participant.email ?? "",
    telefono: participant.telefono ?? "",
    data_nascita: participant.data_nascita ?? "",
    data_arrivo: participant.data_arrivo ?? "",
    data_partenza: participant.data_partenza ?? "",
    alloggio: participant.alloggio ?? "",
    allergie: participant.allergie ?? "",
    esigenze_alimentari: participant.esigenze_alimentari ?? "",
    disabilita_accessibilita: Boolean(participant.disabilita_accessibilita),
    difficolta_accessibilita: participant.difficolta_accessibilita ?? [],
  };
}

function dateInRange(value: string | null, min: string, max: string) {
  if (!value) return false;
  return value >= min && value <= max;
}

function displayDate(value: string | null, min: string, max: string) {
  if (!value) return "-";
  return dateInRange(value, min, max) ? value : "-";
}

export function CapogruppoParticipants() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [showGroupColumn, setShowGroupColumn] = useState(false);
  const [groups, setGroups] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const editingParticipant = useMemo(
    () => participants.find((participant) => participant.id === editingId) ?? null,
    [editingId, participants]
  );

  useEffect(() => {
    async function loadParticipants() {
      setLoading(true);
      setLoadError(null);

      try {
        const res = await fetch("/api/capogruppo/participants", { method: "GET" });
        const json = await res.json();

        if (!res.ok) {
          setLoadError(json.error ?? "Impossibile caricare i partecipanti.");
          return;
        }

        setParticipants(Array.isArray(json.participants) ? json.participants : []);
        setShowGroupColumn(Boolean(json.showGroupColumn));
        setGroups(Array.isArray(json.groups) ? json.groups : []);
      } catch {
        setLoadError("Impossibile caricare i partecipanti.");
      } finally {
        setLoading(false);
      }
    }

    loadParticipants();
  }, []);

  function openEditModal(participant: Participant) {
    setEditingId(participant.id);
    setForm(toFormState(participant));
    setError(null);
    setSuccess(null);
  }

  function closeEditModal() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
  }

  function toggleDifficolta(option: string) {
    setForm((prev) => {
      const exists = prev.difficolta_accessibilita.includes(option);
      return {
        ...prev,
        difficolta_accessibilita: exists
          ? prev.difficolta_accessibilita.filter((item) => item !== option)
          : [...prev.difficolta_accessibilita, option],
      };
    });
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/capogruppo/participants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          ...form,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Salvataggio non riuscito.");
        return;
      }

      const updated = json.participant as Participant;
      setParticipants((prev) =>
        prev.map((row) => (row.id === updated.id ? updated : row))
      );
      setSuccess("Partecipante aggiornato correttamente.");

      setTimeout(() => {
        closeEditModal();
      }, 500);
    } catch {
      setError("Salvataggio non riuscito.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded border border-neutral-200 bg-white px-4 py-6 text-sm text-neutral-600">
        Caricamento partecipanti...
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
    <>
      <div className="rounded border border-neutral-200 bg-white p-4">
        <p className="text-sm text-neutral-600">
          Gruppi associati: {groups.length > 0 ? groups.join(", ") : "Nessun gruppo"}
        </p>

        <div className="mt-4 overflow-x-auto rounded border border-neutral-200">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-neutral-50 text-neutral-700">
              <tr>
                {showGroupColumn && <th className="px-4 py-3">Gruppo</th>}
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Cognome</th>
                <th className="px-4 py-3">Data arrivo</th>
                <th className="px-4 py-3">Data partenza</th>
                <th className="px-4 py-3">Alloggio</th>
                <th className="px-4 py-3">Quota totale</th>
                <th className="px-4 py-3">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {participants.length === 0 ? (
                <tr>
                  <td
                    className="px-4 py-4 text-neutral-500"
                    colSpan={showGroupColumn ? 8 : 7}
                  >
                    Nessun partecipante per i gruppi associati.
                  </td>
                </tr>
              ) : (
                participants.map((participant) => (
                  <tr key={participant.id} className="border-t border-neutral-100">
                    {showGroupColumn && (
                      <td className="px-4 py-3">{participant.group || "-"}</td>
                    )}
                    <td className="px-4 py-3">{participant.nome || "-"}</td>
                    <td className="px-4 py-3">{participant.cognome || "-"}</td>
                    <td className="px-4 py-3">
                      {displayDate(
                        participant.data_arrivo,
                        ARRIVAL_DATE_MIN,
                        ARRIVAL_DATE_MAX
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {displayDate(
                        participant.data_partenza,
                        DEPARTURE_DATE_MIN,
                        DEPARTURE_DATE_MAX
                      )}
                    </td>
                    <td className="px-4 py-3">{participant.alloggio || "-"}</td>
                    <td className="px-4 py-3">
                      {participant.quota_totale === null
                        ? "-"
                        : `EUR ${participant.quota_totale}`}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openEditModal(participant)}
                        className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingParticipant && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8">
          <div className="w-full max-w-3xl rounded-lg border border-neutral-200 bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">Modifica partecipante</h2>
                <p className="text-sm text-neutral-600">
                  {editingParticipant.nome} {editingParticipant.cognome}
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                className="rounded border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
              >
                Chiudi
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-neutral-700">Nome</label>
                  <input
                    required
                    value={form.nome}
                    onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))}
                    className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700">Cognome</label>
                  <input
                    required
                    value={form.cognome}
                    onChange={(e) => setForm((prev) => ({ ...prev, cognome: e.target.value }))}
                    className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700">Nazione</label>
                  <input
                    value={form.nazione}
                    onChange={(e) => setForm((prev) => ({ ...prev, nazione: e.target.value }))}
                    className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700">Email</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                    className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700">Telefono</label>
                  <input
                    value={form.telefono}
                    onChange={(e) => setForm((prev) => ({ ...prev, telefono: e.target.value }))}
                    className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700">
                    Data nascita
                  </label>
                  <input
                    type="date"
                    value={form.data_nascita}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, data_nascita: e.target.value }))
                    }
                    className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700">Data arrivo</label>
                  <input
                    type="date"
                    min={ARRIVAL_DATE_MIN}
                    max={ARRIVAL_DATE_MAX}
                    value={form.data_arrivo}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, data_arrivo: e.target.value }))
                    }
                    className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700">
                    Data partenza
                  </label>
                  <input
                    type="date"
                    min={DEPARTURE_DATE_MIN}
                    max={DEPARTURE_DATE_MAX}
                    value={form.data_partenza}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, data_partenza: e.target.value }))
                    }
                    className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-neutral-700">Alloggio</label>
                  <select
                    value={form.alloggio}
                    onChange={(e) => setForm((prev) => ({ ...prev, alloggio: e.target.value }))}
                    className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm"
                  >
                    <option value="">Seleziona...</option>
                    {ALLOGGIO_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-neutral-700">Allergie</label>
                  <textarea
                    rows={2}
                    value={form.allergie}
                    onChange={(e) => setForm((prev) => ({ ...prev, allergie: e.target.value }))}
                    className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-neutral-700">
                    Esigenze alimentari
                  </label>
                  <select
                    value={form.esigenze_alimentari}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, esigenze_alimentari: e.target.value }))
                    }
                    className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm"
                  >
                    <option value="">Seleziona...</option>
                    {ESIGENZE_ALIMENTARI_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2 rounded border border-neutral-200 p-3">
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-neutral-700">
                    <input
                      type="checkbox"
                      checked={form.disabilita_accessibilita}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          disabilita_accessibilita: e.target.checked,
                          difficolta_accessibilita: e.target.checked
                            ? prev.difficolta_accessibilita
                            : [],
                        }))
                      }
                    />
                    Disabilita / accessibilita
                  </label>

                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {DIFFICOLTA_ACCESSIBILITA_OPTIONS.map((option) => (
                      <label
                        key={option}
                        className="flex items-start gap-2 rounded border border-neutral-200 px-2 py-1.5 text-xs"
                      >
                        <input
                          type="checkbox"
                          disabled={!form.disabilita_accessibilita}
                          checked={form.difficolta_accessibilita.includes(option)}
                          onChange={() => toggleDifficolta(option)}
                        />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {error && (
                <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              {success && (
                <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {success}
                </div>
              )}

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="rounded border border-neutral-300 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {saving ? "Salvataggio..." : "Salva"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
