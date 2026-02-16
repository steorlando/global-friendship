"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ALLOGGIO_SHORT_OPTIONS,
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
  esigenze_alimentari: string[];
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
  esigenze_alimentari: string[];
  disabilita_accessibilita: boolean;
  difficolta_accessibilita: string[];
};

type SortKey =
  | "group"
  | "nome"
  | "cognome"
  | "data_arrivo"
  | "data_partenza"
  | "alloggio"
  | "quota_totale";

type SortDirection = "asc" | "desc";

type ParticipantsTableProps = {
  apiBasePath: string;
  groupSummaryLabel: string;
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
  esigenze_alimentari: [],
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
    esigenze_alimentari: Array.isArray(participant.esigenze_alimentari)
      ? participant.esigenze_alimentari
      : [],
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

export function ParticipantsTable({
  apiBasePath,
  groupSummaryLabel,
}: ParticipantsTableProps) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [showGroupColumn, setShowGroupColumn] = useState(false);
  const [groups, setGroups] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("cognome");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [groupFilter, setGroupFilter] = useState("");
  const [nomeFilter, setNomeFilter] = useState("");
  const [cognomeFilter, setCognomeFilter] = useState("");
  const [arrivoFilter, setArrivoFilter] = useState("");
  const [partenzaFilter, setPartenzaFilter] = useState("");
  const [alloggioFilter, setAlloggioFilter] = useState("");
  const [quotaMinFilter, setQuotaMinFilter] = useState("");
  const [quotaMaxFilter, setQuotaMaxFilter] = useState("");

  const editingParticipant = useMemo(
    () => participants.find((participant) => participant.id === editingId) ?? null,
    [editingId, participants]
  );

  const filteredSortedParticipants = useMemo(() => {
    const filtered = participants.filter((participant) => {
      if (
        showGroupColumn &&
        groupFilter &&
        !(participant.group ?? "").toLowerCase().includes(groupFilter.toLowerCase())
      ) {
        return false;
      }
      if (
        nomeFilter &&
        !(participant.nome ?? "").toLowerCase().includes(nomeFilter.toLowerCase())
      ) {
        return false;
      }
      if (
        cognomeFilter &&
        !(participant.cognome ?? "").toLowerCase().includes(cognomeFilter.toLowerCase())
      ) {
        return false;
      }
      if (arrivoFilter && (participant.data_arrivo ?? "") !== arrivoFilter) {
        return false;
      }
      if (partenzaFilter && (participant.data_partenza ?? "") !== partenzaFilter) {
        return false;
      }
      if (alloggioFilter && (participant.alloggio ?? "") !== alloggioFilter) {
        return false;
      }
      if (quotaMinFilter) {
        const min = Number(quotaMinFilter);
        if (!Number.isNaN(min) && (participant.quota_totale ?? -Infinity) < min) {
          return false;
        }
      }
      if (quotaMaxFilter) {
        const max = Number(quotaMaxFilter);
        if (!Number.isNaN(max) && (participant.quota_totale ?? Infinity) > max) {
          return false;
        }
      }
      return true;
    });

    filtered.sort((a, b) => {
      const direction = sortDirection === "asc" ? 1 : -1;
      const aValue =
        sortKey === "quota_totale"
          ? a.quota_totale ?? -Infinity
          : (a[sortKey] ?? "").toString().toLowerCase();
      const bValue =
        sortKey === "quota_totale"
          ? b.quota_totale ?? -Infinity
          : (b[sortKey] ?? "").toString().toLowerCase();

      if (aValue < bValue) return -1 * direction;
      if (aValue > bValue) return 1 * direction;
      return 0;
    });

    return filtered;
  }, [
    alloggioFilter,
    arrivoFilter,
    cognomeFilter,
    groupFilter,
    nomeFilter,
    participants,
    partenzaFilter,
    quotaMaxFilter,
    quotaMinFilter,
    showGroupColumn,
    sortDirection,
    sortKey,
  ]);

  useEffect(() => {
    async function loadParticipants() {
      setLoading(true);
      setLoadError(null);

      try {
        const res = await fetch(apiBasePath, { method: "GET" });
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
  }, [apiBasePath]);

  function openEditModal(participant: Participant) {
    setEditingId(participant.id);
    setForm(toFormState(participant));
    setError(null);
    setSuccess(null);
  }

  function closeEditModal() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDeleting(false);
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

  function toggleEsigenza(option: string) {
    setForm((prev) => {
      const exists = prev.esigenze_alimentari.includes(option);
      return {
        ...prev,
        esigenze_alimentari: exists
          ? prev.esigenze_alimentari.filter((item) => item !== option)
          : [...prev.esigenze_alimentari, option],
      };
    });
  }

  function toggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection("asc");
  }

  function sortLabel(key: SortKey) {
    if (sortKey !== key) return " ";
    return sortDirection === "asc" ? "↑" : "↓";
  }

  function resetFilters() {
    setGroupFilter("");
    setNomeFilter("");
    setCognomeFilter("");
    setArrivoFilter("");
    setPartenzaFilter("");
    setAlloggioFilter("");
    setQuotaMinFilter("");
    setQuotaMaxFilter("");
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(apiBasePath, {
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

  async function handleDelete() {
    if (!editingId || deleting || saving) return;
    const confirmed = window.confirm(
      "Are you sure you want to delete this participant? This action cannot be undone."
    );
    if (!confirmed) return;

    setDeleting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(apiBasePath, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Delete failed.");
        return;
      }

      setParticipants((prev) => prev.filter((row) => row.id !== editingId));
      closeEditModal();
    } catch {
      setError("Delete failed.");
    } finally {
      setDeleting(false);
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
          {groupSummaryLabel}: {groups.length > 0 ? groups.join(", ") : "Nessun gruppo"}
        </p>

        <div className="mt-4 overflow-x-auto rounded border border-neutral-200">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-neutral-50 text-neutral-700">
              <tr>
                {showGroupColumn && (
                  <th className="px-4 py-3">
                    <button type="button" onClick={() => toggleSort("group")}>
                      Group {sortLabel("group")}
                    </button>
                  </th>
                )}
                <th className="px-4 py-3">
                  <button type="button" onClick={() => toggleSort("nome")}>
                    First name {sortLabel("nome")}
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button type="button" onClick={() => toggleSort("cognome")}>
                    Last name {sortLabel("cognome")}
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button type="button" onClick={() => toggleSort("data_arrivo")}>
                    Arrival date {sortLabel("data_arrivo")}
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button type="button" onClick={() => toggleSort("data_partenza")}>
                    Departure date {sortLabel("data_partenza")}
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button type="button" onClick={() => toggleSort("alloggio")}>
                    Accommodation {sortLabel("alloggio")}
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button type="button" onClick={() => toggleSort("quota_totale")}>
                    Total fee {sortLabel("quota_totale")}
                  </button>
                </th>
                <th className="px-4 py-3">Actions</th>
              </tr>
              <tr>
                {showGroupColumn && (
                  <th className="px-2 pb-3">
                    <input
                      value={groupFilter}
                      onChange={(e) => setGroupFilter(e.target.value)}
                      placeholder="Filter group"
                      className="w-full rounded border border-neutral-300 px-2 py-1 text-xs"
                    />
                  </th>
                )}
                <th className="px-2 pb-3">
                  <input
                    value={nomeFilter}
                    onChange={(e) => setNomeFilter(e.target.value)}
                    placeholder="Filter first name"
                    className="w-full rounded border border-neutral-300 px-2 py-1 text-xs"
                  />
                </th>
                <th className="px-2 pb-3">
                  <input
                    value={cognomeFilter}
                    onChange={(e) => setCognomeFilter(e.target.value)}
                    placeholder="Filter last name"
                    className="w-full rounded border border-neutral-300 px-2 py-1 text-xs"
                  />
                </th>
                <th className="px-2 pb-3">
                  <input
                    type="date"
                    value={arrivoFilter}
                    onChange={(e) => setArrivoFilter(e.target.value)}
                    className="w-full rounded border border-neutral-300 px-2 py-1 text-xs"
                  />
                </th>
                <th className="px-2 pb-3">
                  <input
                    type="date"
                    value={partenzaFilter}
                    onChange={(e) => setPartenzaFilter(e.target.value)}
                    className="w-full rounded border border-neutral-300 px-2 py-1 text-xs"
                  />
                </th>
                <th className="px-2 pb-3">
                  <select
                    value={alloggioFilter}
                    onChange={(e) => setAlloggioFilter(e.target.value)}
                    className="w-full rounded border border-neutral-300 px-2 py-1 text-xs"
                  >
                    <option value="">All</option>
                    {ALLOGGIO_SHORT_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </th>
                <th className="px-2 pb-3">
                  <div className="grid grid-cols-2 gap-1">
                    <input
                      type="number"
                      placeholder="Min"
                      value={quotaMinFilter}
                      onChange={(e) => setQuotaMinFilter(e.target.value)}
                      className="w-full rounded border border-neutral-300 px-2 py-1 text-xs"
                    />
                    <input
                      type="number"
                      placeholder="Max"
                      value={quotaMaxFilter}
                      onChange={(e) => setQuotaMaxFilter(e.target.value)}
                      className="w-full rounded border border-neutral-300 px-2 py-1 text-xs"
                    />
                  </div>
                </th>
                <th className="px-2 pb-3">
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-100"
                  >
                    Reset
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredSortedParticipants.length === 0 ? (
                <tr>
                  <td
                    className="px-4 py-4 text-neutral-500"
                    colSpan={showGroupColumn ? 8 : 7}
                  >
                    No participants found with the current filters.
                  </td>
                </tr>
              ) : (
                filteredSortedParticipants.map((participant) => (
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
                    {ALLOGGIO_SHORT_OPTIONS.map((option) => (
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
                  <div className="mt-2 grid gap-2 rounded border border-neutral-200 p-3 md:grid-cols-2">
                    {ESIGENZE_ALIMENTARI_OPTIONS.map((option) => (
                      <label key={option} className="inline-flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={form.esigenze_alimentari.includes(option)}
                          onChange={() => toggleEsigenza(option)}
                        />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
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
                  onClick={handleDelete}
                  disabled={saving || deleting}
                  className="mr-auto rounded border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
                <button
                  type="button"
                  onClick={closeEditModal}
                  disabled={saving || deleting}
                  className="rounded border border-neutral-300 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={saving || deleting}
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
