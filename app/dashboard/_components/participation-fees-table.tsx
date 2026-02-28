"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ALLOGGIO_SHORT_OPTIONS,
  ARRIVAL_DATE_MAX,
  ARRIVAL_DATE_MIN,
  DEPARTURE_DATE_MAX,
  DEPARTURE_DATE_MIN,
} from "@/lib/partecipante/constants";
import { useI18n } from "@/lib/i18n/provider";

type Participant = {
  id: string;
  nome: string | null;
  cognome: string | null;
  data_arrivo: string | null;
  data_partenza: string | null;
  alloggio: string | null;
  quota_totale: number | null;
  fee_paid: number | null;
  group: string;
};

type SortKey =
  | "group"
  | "nome"
  | "cognome"
  | "data_arrivo"
  | "data_partenza"
  | "alloggio"
  | "quota_totale"
  | "fee_paid";

type SortDirection = "asc" | "desc";

type DraftFees = Record<string, string>;
type GroupSummaryRow = {
  group: string;
  participantsCount: number;
  totalExpectedFee: number;
  totalPaidFee: number;
  outstandingFee: number;
};

function dateInRange(value: string | null, min: string, max: string) {
  if (!value) return false;
  return value >= min && value <= max;
}

function displayDate(value: string | null, min: string, max: string) {
  if (!value) return "-";
  return dateInRange(value, min, max) ? value : "-";
}

function normalizeFeeInput(value: string): number | null | "invalid" {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return "invalid";
  return Number(parsed.toFixed(2));
}

function formatFee(value: number | null) {
  if (value === null) return "";
  return value.toFixed(2);
}

function formatCurrency(value: number) {
  return `EUR ${value.toFixed(2)}`;
}

export function ParticipationFeesTable() {
  const { t } = useI18n();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [arrivoFilter, setArrivoFilter] = useState("");
  const [partenzaFilter, setPartenzaFilter] = useState("");
  const [alloggioFilter, setAlloggioFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("cognome");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [feeDrafts, setFeeDrafts] = useState<DraftFees>({});
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function loadParticipants() {
      setLoading(true);
      setLoadError(null);

      try {
        const res = await fetch("/api/manager/participation-fees", { method: "GET" });
        const json = await res.json();

        if (!res.ok) {
          setLoadError(json.error ?? t("fees.loadError"));
          return;
        }

        setParticipants(Array.isArray(json.participants) ? json.participants : []);
        setGroups(Array.isArray(json.groups) ? json.groups : []);
      } catch {
        setLoadError(t("fees.loadError"));
      } finally {
        setLoading(false);
      }
    }

    loadParticipants();
  }, [t]);

  const visibleParticipants = useMemo(() => {
    const term = search.trim().toLowerCase();

    const filtered = participants.filter((participant) => {
      if (term) {
        const haystack = [participant.nome, participant.cognome, participant.group]
          .map((value) => (value ?? "").toLowerCase())
          .join(" ");
        if (!haystack.includes(term)) return false;
      }

      if (
        groupFilter &&
        !(participant.group ?? "").toLowerCase().includes(groupFilter.toLowerCase())
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

      return true;
    });

    filtered.sort((a, b) => {
      const direction = sortDirection === "asc" ? 1 : -1;
      const aValue =
        sortKey === "quota_totale" || sortKey === "fee_paid"
          ? a[sortKey] ?? -Infinity
          : (a[sortKey] ?? "").toString().toLowerCase();
      const bValue =
        sortKey === "quota_totale" || sortKey === "fee_paid"
          ? b[sortKey] ?? -Infinity
          : (b[sortKey] ?? "").toString().toLowerCase();

      if (aValue < bValue) return -1 * direction;
      if (aValue > bValue) return 1 * direction;
      return 0;
    });

    return filtered;
  }, [alloggioFilter, arrivoFilter, groupFilter, participants, partenzaFilter, search, sortDirection, sortKey]);

  const visibleIds = useMemo(
    () => visibleParticipants.map((participant) => participant.id),
    [visibleParticipants]
  );
  const groupSummaryRows = useMemo<GroupSummaryRow[]>(() => {
    const byGroup = new Map<string, GroupSummaryRow>();

    for (const participant of visibleParticipants) {
      const rawGroup = (participant.group ?? "").trim();
      const group = rawGroup && rawGroup !== "-" ? rawGroup : t("participants.table.noGroup");
      const totalExpectedFee = participant.quota_totale ?? 0;
      const totalPaidFee = participant.fee_paid ?? 0;

      const current = byGroup.get(group);
      if (!current) {
        byGroup.set(group, {
          group,
          participantsCount: 1,
          totalExpectedFee,
          totalPaidFee,
          outstandingFee: totalExpectedFee - totalPaidFee,
        });
        continue;
      }

      current.participantsCount += 1;
      current.totalExpectedFee += totalExpectedFee;
      current.totalPaidFee += totalPaidFee;
      current.outstandingFee += totalExpectedFee - totalPaidFee;
    }

    return [...byGroup.values()].sort((a, b) => a.group.localeCompare(b.group));
  }, [t, visibleParticipants]);

  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

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
    setSearch("");
    setGroupFilter("");
    setArrivoFilter("");
    setPartenzaFilter("");
    setAlloggioFilter("");
  }

  function setDraft(participant: Participant, value: string) {
    setFeeDrafts((prev) => ({ ...prev, [participant.id]: value }));
    setActionError(null);
  }

  function draftValue(participant: Participant) {
    const fromDraft = feeDrafts[participant.id];
    if (fromDraft !== undefined) return fromDraft;
    return formatFee(participant.fee_paid);
  }

  async function saveManualFee(participant: Participant) {
    const nextValue = draftValue(participant);
    const normalized = normalizeFeeInput(nextValue);

    if (normalized === "invalid") {
      setActionError(t("fees.invalidValue"));
      return;
    }

    if (normalized === participant.fee_paid) {
      return;
    }

    setSavingIds((prev) => new Set(prev).add(participant.id));
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch("/api/manager/participation-fees", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: participant.id, fee_paid: normalized }),
      });
      const json = await res.json();

      if (!res.ok) {
        setActionError(json.error ?? t("fees.saveError"));
        return;
      }

      const updated = json.participant as Participant;
      setParticipants((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      setFeeDrafts((prev) => {
        const next = { ...prev };
        delete next[participant.id];
        return next;
      });
      setActionSuccess(t("fees.saveSuccess"));
    } catch {
      setActionError(t("fees.saveError"));
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(participant.id);
        return next;
      });
    }
  }

  function toggleParticipantSelection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAllVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const id of visibleIds) {
          next.delete(id);
        }
      } else {
        for (const id of visibleIds) {
          next.add(id);
        }
      }
      return next;
    });
  }

  async function markAsFullyPaid() {
    if (selectedIds.size === 0 || bulkSaving) return;

    setBulkSaving(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch("/api/manager/participation-fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantIds: [...selectedIds] }),
      });
      const json = await res.json();

      if (!res.ok) {
        setActionError(json.error ?? t("fees.bulkError"));
        return;
      }

      const updatedRows = Array.isArray(json.participants)
        ? (json.participants as Participant[])
        : [];
      const updatedById = new Map(updatedRows.map((row) => [row.id, row]));

      setParticipants((prev) => prev.map((row) => updatedById.get(row.id) ?? row));
      setSelectedIds(new Set());
      setFeeDrafts((prev) => {
        if (updatedRows.length === 0) return prev;
        const next = { ...prev };
        for (const row of updatedRows) {
          delete next[row.id];
        }
        return next;
      });

      setActionSuccess(t("fees.bulkSuccess"));
    } catch {
      setActionError(t("fees.bulkError"));
    } finally {
      setBulkSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
        {t("common.loading")}
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
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-900">{t("fees.groupSummary")}</h3>
          <p className="text-xs text-slate-500">{t("fees.groupSummaryHint")}</p>
        </div>

        <div className="mt-4 overflow-x-auto rounded border border-slate-200">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-3">{t("fees.groupName")}</th>
                <th className="px-4 py-3">{t("fees.participantsCount")}</th>
                <th className="px-4 py-3">{t("fees.totalExpected")}</th>
                <th className="px-4 py-3">{t("fees.totalPaid")}</th>
                <th className="px-4 py-3">{t("fees.outstanding")}</th>
              </tr>
            </thead>
            <tbody>
              {groupSummaryRows.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-slate-500" colSpan={5}>
                    {t("fees.noGroups")}
                  </td>
                </tr>
              ) : (
                groupSummaryRows.map((row) => (
                  <tr key={row.group} className="border-t border-slate-100">
                    <td className="px-4 py-3">{row.group}</td>
                    <td className="px-4 py-3">{row.participantsCount}</td>
                    <td className="px-4 py-3">{formatCurrency(row.totalExpectedFee)}</td>
                    <td className="px-4 py-3">{formatCurrency(row.totalPaidFee)}</td>
                    <td className="px-4 py-3">{formatCurrency(row.outstandingFee)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{t("fees.title")}</h2>
          <p className="text-sm text-slate-500">
            {t("fees.groupFilterHint", { count: groups.length })}
          </p>
        </div>
        <button
          type="button"
          onClick={markAsFullyPaid}
          disabled={bulkSaving || selectedIds.size === 0}
          className="rounded border border-indigo-600 bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {bulkSaving ? t("participant.form.saving") : t("fees.markFullyPaid")}
        </button>
      </div>

      {actionError && (
        <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </p>
      )}
      {actionSuccess && (
        <p className="mt-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {actionSuccess}
        </p>
      )}

      <div className="mt-4 overflow-x-auto rounded border border-slate-200">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleSelectAllVisible}
                  aria-label={t("fees.selectAll")}
                />
              </th>
              <th className="px-4 py-3">
                <button type="button" onClick={() => toggleSort("group")}>
                  {t("participants.table.header.group")} {sortLabel("group")}
                </button>
              </th>
              <th className="px-4 py-3">
                <button type="button" onClick={() => toggleSort("nome")}>
                  {t("participants.table.header.firstName")} {sortLabel("nome")}
                </button>
              </th>
              <th className="px-4 py-3">
                <button type="button" onClick={() => toggleSort("cognome")}>
                  {t("participants.table.header.lastName")} {sortLabel("cognome")}
                </button>
              </th>
              <th className="px-4 py-3">
                <button type="button" onClick={() => toggleSort("data_arrivo")}>
                  {t("participants.table.header.arrivalDate")} {sortLabel("data_arrivo")}
                </button>
              </th>
              <th className="px-4 py-3">
                <button type="button" onClick={() => toggleSort("data_partenza")}>
                  {t("participants.table.header.departureDate")} {sortLabel("data_partenza")}
                </button>
              </th>
              <th className="px-4 py-3">
                <button type="button" onClick={() => toggleSort("alloggio")}>
                  {t("participants.table.header.accommodation")} {sortLabel("alloggio")}
                </button>
              </th>
              <th className="px-4 py-3">
                <button type="button" onClick={() => toggleSort("quota_totale")}>
                  {t("fees.calculatedFee")} {sortLabel("quota_totale")}
                </button>
              </th>
              <th className="px-4 py-3">
                <button type="button" onClick={() => toggleSort("fee_paid")}>
                  {t("fees.feePaid")} {sortLabel("fee_paid")}
                </button>
              </th>
            </tr>
            <tr>
              <th className="px-2 pb-3">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                >
                  {t("common.reset")}
                </button>
              </th>
              <th className="px-2 pb-3">
                <input
                  value={groupFilter}
                  onChange={(e) => setGroupFilter(e.target.value)}
                  placeholder={t("participants.table.filter.group")}
                  className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                />
              </th>
              <th className="px-2 pb-3" colSpan={2}>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("fees.searchNameGroup")}
                  className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                />
              </th>
              <th className="px-2 pb-3">
                <input
                  type="date"
                  value={arrivoFilter}
                  onChange={(e) => setArrivoFilter(e.target.value)}
                  className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                />
              </th>
              <th className="px-2 pb-3">
                <input
                  type="date"
                  value={partenzaFilter}
                  onChange={(e) => setPartenzaFilter(e.target.value)}
                  className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                />
              </th>
              <th className="px-2 pb-3">
                <select
                  value={alloggioFilter}
                  onChange={(e) => setAlloggioFilter(e.target.value)}
                  className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                >
                  <option value="">{t("common.all")}</option>
                  {ALLOGGIO_SHORT_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </th>
              <th className="px-2 pb-3" />
              <th className="px-2 pb-3" />
            </tr>
          </thead>
          <tbody>
            {visibleParticipants.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-slate-500" colSpan={9}>
                  {t("participants.table.noResults")}
                </td>
              </tr>
            ) : (
              visibleParticipants.map((participant) => {
                const isSaving = savingIds.has(participant.id);
                return (
                  <tr key={participant.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(participant.id)}
                        onChange={() => toggleParticipantSelection(participant.id)}
                        aria-label={`${t("common.select")} ${participant.nome ?? t("roles.partecipante")} ${participant.cognome ?? ""}`}
                      />
                    </td>
                    <td className="px-4 py-3">{participant.group || "-"}</td>
                    <td className="px-4 py-3">{participant.nome || "-"}</td>
                    <td className="px-4 py-3">{participant.cognome || "-"}</td>
                    <td className="px-4 py-3">
                      {displayDate(participant.data_arrivo, ARRIVAL_DATE_MIN, ARRIVAL_DATE_MAX)}
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
                        : formatCurrency(participant.quota_totale)}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={draftValue(participant)}
                        onChange={(e) => setDraft(participant, e.target.value)}
                        onBlur={() => void saveManualFee(participant)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void saveManualFee(participant);
                          }
                        }}
                        disabled={isSaving}
                        placeholder={t("fees.amountPlaceholder")}
                        className="w-28 rounded border border-slate-300 px-2 py-1 text-xs"
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );
}
