"use client";

import { useMemo, useState } from "react";
import { ArrivalGroupSummaryTable } from "@/app/dashboard/_components/arrival-group-summary-table";
import {
  buildArrivalGroupSummary,
  type ArrivalAccommodationType,
  type ArrivalParticipant,
  type ReceptionGroupLeaderContact,
} from "@/lib/accoglienza/arrivals";
import { useI18n } from "@/lib/i18n/provider";
import { ArrivalQrScanner } from "./arrival-qr-scanner";
import { ReceptionGroupLeaderContacts } from "./reception-group-leader-contacts";
import { ReceptionLogisticsSection } from "./reception-logistics-section";

type ArrivalStatusFilter = "all" | "pending" | "arrived";
type ReceptionSection = "logistics" | "contacts" | "arrivals";

function normalized(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function ArrivalDashboard({
  initialParticipants,
  groupLeaders,
}: {
  initialParticipants: ArrivalParticipant[];
  groupLeaders: ReceptionGroupLeaderContact[];
}) {
  const { t, formatDate } = useI18n();
  const [participants, setParticipants] = useState(initialParticipants);
  const [activeSection, setActiveSection] = useState<ReceptionSection>("logistics");
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("all");
  const [country, setCountry] = useState("all");
  const [arrivalDate, setArrivalDate] = useState("all");
  const [accommodation, setAccommodation] = useState("all");
  const [status, setStatus] = useState<ArrivalStatusFilter>("pending");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const accommodationLabels: Record<ArrivalAccommodationType, string> = {
    Hotel: t("reception.accommodation.hotel"),
    Ostello: t("reception.accommodation.hostel"),
    Autonomo: t("reception.accommodation.autonomous"),
  };

  const groups = useMemo(
    () => [...new Set(participants.map((row) => row.group))].sort((a, b) => a.localeCompare(b)),
    [participants]
  );
  const countries = useMemo(
    () =>
      [...new Set(participants.map((row) => row.country))].sort((a, b) =>
        a.localeCompare(b)
      ),
    [participants]
  );
  const arrivalDates = useMemo(
    () =>
      [...new Set(participants.map((row) => row.arrivalDate).filter(Boolean))].sort() as string[],
    [participants]
  );
  const summaryRows = useMemo(() => buildArrivalGroupSummary(participants), [participants]);

  const filtered = useMemo(() => {
    const term = normalized(search);
    return participants.filter((participant) => {
      const haystack = normalized(
        [
          participant.personalCode,
          participant.firstName,
          participant.lastName,
          participant.country,
          participant.group,
          participant.groupLeaders.join(" "),
          participant.accommodationLocation ?? "",
        ].join(" ")
      );
      return (
        (!term || haystack.includes(term)) &&
        (group === "all" || participant.group === group) &&
        (country === "all" || participant.country === country) &&
        (arrivalDate === "all" || participant.arrivalDate === arrivalDate) &&
        (accommodation === "all" || participant.accommodationType === accommodation) &&
        (status === "all" ||
          (status === "arrived" ? Boolean(participant.arrivedAt) : !participant.arrivedAt))
      );
    });
  }, [accommodation, arrivalDate, country, group, participants, search, status]);

  const selectableFilteredIds = useMemo(
    () => filtered.filter((row) => !row.arrivedAt).map((row) => row.id),
    [filtered]
  );
  const allFilteredSelected =
    selectableFilteredIds.length > 0 &&
    selectableFilteredIds.every((participantId) => selected.has(participantId));
  const arrivedCount = participants.filter((row) => row.arrivedAt).length;
  const pendingCount = participants.length - arrivedCount;
  const sectionOptions: Array<{
    id: ReceptionSection;
    icon: string;
    title: string;
    description: string;
    count: number;
  }> = [
    {
      id: "logistics",
      icon: "⌂",
      title: t("reception.sections.logistics.title"),
      description: t("reception.sections.logistics.description"),
      count: groups.length,
    },
    {
      id: "contacts",
      icon: "☎",
      title: t("reception.sections.contacts.title"),
      description: t("reception.sections.contacts.description"),
      count: groupLeaders.filter((contact) => !contact.isRomeSubgroup).length,
    },
    {
      id: "arrivals",
      icon: "✓",
      title: t("reception.sections.arrivals.title"),
      description: t("reception.sections.arrivals.description"),
      count: pendingCount,
    },
  ];

  function toggleOne(participantId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(participantId)) next.delete(participantId);
      else next.add(participantId);
      return next;
    });
  }

  function toggleAllFiltered() {
    setSelected((current) => {
      const next = new Set(current);
      if (allFilteredSelected) {
        for (const id of selectableFilteredIds) next.delete(id);
      } else {
        for (const id of selectableFilteredIds) next.add(id);
      }
      return next;
    });
  }

  function selectPendingGroup(groupName: string) {
    setGroup(groupName);
    setStatus("pending");
    setSelected(
      new Set(
        participants
          .filter((row) => row.group === groupName && !row.arrivedAt)
          .map((row) => row.id)
      )
    );
    window.setTimeout(() => {
      document.getElementById("reception-participants")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  }

  async function markParticipantsArrived(ids: string[]) {
    if (ids.length === 0) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/accoglienza/participants", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ participantIds: ids }),
      });
      const json = (await response.json().catch(() => null)) as
        | {
            error?: string;
            updated?: Array<{ participantId: string; arrivedAt: string }>;
          }
        | null;
      if (!response.ok || !json?.updated) {
        throw new Error(json?.error || t("reception.mark.error"));
      }

      const updates = new Map(
        json.updated.map((row) => [row.participantId, row.arrivedAt] as const)
      );
      setParticipants((current) =>
        current.map((participant) =>
          updates.has(participant.id)
            ? { ...participant, arrivedAt: updates.get(participant.id) ?? participant.arrivedAt }
            : participant
        )
      );
      setSelected((current) => {
        const next = new Set(current);
        for (const id of ids) next.delete(id);
        return next;
      });
      setMessage(t("reception.mark.success", { count: ids.length }));
    } finally {
      setSaving(false);
    }
  }

  async function markFromScanner(participantId: string) {
    try {
      await markParticipantsArrived([participantId]);
    } catch (markError) {
      const message =
        markError instanceof Error ? markError.message : t("reception.mark.error");
      setError(message);
      throw markError;
    }
  }

  function resetFilters() {
    setSearch("");
    setGroup("all");
    setCountry("all");
    setArrivalDate("all");
    setAccommodation("all");
    setStatus("pending");
    setSelected(new Set());
  }

  return (
    <div className="space-y-6">
      <header className="rounded-2xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-cyan-600 p-5 text-white shadow-sm sm:p-7">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-indigo-100">
            {t("roles.accoglienza")}
          </p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
            {t("reception.title")}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-indigo-50 sm:text-base">
            {t("reception.subtitle")}
          </p>
        </div>
      </header>

      <nav
        className="grid gap-2 sm:grid-cols-3 sm:gap-3"
        aria-label={t("reception.sections.label")}
        role="tablist"
      >
        {sectionOptions.map((section) => {
          const selectedSection = activeSection === section.id;
          return (
            <button
              key={section.id}
              id={`reception-${section.id}-tab`}
              type="button"
              role="tab"
              aria-selected={selectedSection}
              aria-controls={`reception-${section.id}-panel`}
              onClick={() => setActiveSection(section.id)}
              className={`flex min-h-20 items-center gap-3 rounded-2xl border p-3 text-left shadow-sm transition sm:min-h-28 sm:items-start sm:p-4 ${
                selectedSection
                  ? "border-indigo-600 bg-indigo-600 text-white shadow-indigo-100"
                  : "border-slate-200 bg-white text-slate-900 hover:border-indigo-300 hover:bg-indigo-50/40"
              }`}
            >
              <span
                aria-hidden="true"
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl font-bold ${
                  selectedSection
                    ? "bg-white/15 text-white"
                    : "bg-indigo-50 text-indigo-700"
                }`}
              >
                {section.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-bold">{section.title}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      selectedSection
                        ? "bg-white/15 text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {section.count}
                  </span>
                </span>
                <span
                  className={`mt-1 hidden text-xs leading-5 sm:block ${
                    selectedSection ? "text-indigo-100" : "text-slate-500"
                  }`}
                >
                  {section.description}
                </span>
              </span>
            </button>
          );
        })}
      </nav>

      {activeSection === "logistics" ? (
        <div
          id="reception-logistics-panel"
          role="tabpanel"
          aria-labelledby="reception-logistics-tab"
        >
          <ReceptionLogisticsSection participants={participants} />
        </div>
      ) : null}

      {activeSection === "contacts" ? (
        <div
          id="reception-contacts-panel"
          role="tabpanel"
          aria-labelledby="reception-contacts-tab"
        >
          <ReceptionGroupLeaderContacts contacts={groupLeaders} />
        </div>
      ) : null}

      {activeSection === "arrivals" ? (
        <div
          id="reception-arrivals-panel"
          role="tabpanel"
          aria-labelledby="reception-arrivals-tab"
          className="space-y-6"
        >
          <section className="flex flex-col gap-4 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <h2 className="text-xl font-bold text-indigo-950">
                {t("reception.arrivalsWorkspace.title")}
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-indigo-700">
                {t("reception.arrivalsWorkspace.subtitle")}
              </p>
            </div>
            <ArrivalQrScanner
              participants={participants}
              onMarkArrived={markFromScanner}
            />
          </section>

          <section className="grid grid-cols-3 gap-2 sm:gap-4">
        <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
          <p className="text-[11px] font-bold uppercase text-slate-500 sm:text-xs">
            {t("reception.summary.total")}
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">
            {participants.length}
          </p>
        </article>
        <article className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 shadow-sm sm:p-5">
          <p className="text-[11px] font-bold uppercase text-emerald-700 sm:text-xs">
            {t("reception.summary.arrived")}
          </p>
          <p className="mt-1 text-2xl font-bold text-emerald-950 sm:text-3xl">
            {arrivedCount}
          </p>
        </article>
        <article className="rounded-xl border border-amber-200 bg-amber-50 p-3 shadow-sm sm:p-5">
          <p className="text-[11px] font-bold uppercase text-amber-700 sm:text-xs">
            {t("reception.summary.pending")}
          </p>
          <p className="mt-1 text-2xl font-bold text-amber-950 sm:text-3xl">
            {pendingCount}
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div>
          <h2 className="text-xl font-bold text-slate-950">{t("reception.groups.title")}</h2>
          <p className="mt-1 text-sm text-slate-500">{t("reception.groups.subtitle")}</p>
        </div>
        <div className="mt-4">
          <ArrivalGroupSummaryTable
            rows={summaryRows}
            onSelectPending={selectPendingGroup}
            labels={{
              group: t("reception.table.group"),
              arrived: t("reception.summary.arrived"),
              notArrived: t("reception.summary.pending"),
              total: t("reception.summary.total"),
              selectPending: t("reception.groups.selectPending"),
              empty: t("reception.groups.empty"),
            }}
          />
        </div>
      </section>

      <section
        id="reception-participants"
        className="scroll-mt-4 rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <div className="border-b border-slate-200 p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-950">
                {t("reception.participants.title")}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {t("reception.participants.showing", {
                  filtered: filtered.length,
                  total: participants.length,
                })}
              </p>
            </div>
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
            >
              {t("reception.filters.reset")}
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <label className="sm:col-span-2 xl:col-span-2">
              <span className="sr-only">{t("reception.filters.search")}</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("reception.filters.search")}
                className="min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <select
              value={group}
              onChange={(event) => setGroup(event.target.value)}
              className="min-h-11 rounded-xl border border-slate-300 px-3 py-2 text-sm"
              aria-label={t("reception.filters.group")}
            >
              <option value="all">{t("reception.filters.allGroups")}</option>
              {groups.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
            <select
              value={country}
              onChange={(event) => setCountry(event.target.value)}
              className="min-h-11 rounded-xl border border-slate-300 px-3 py-2 text-sm"
              aria-label={t("reception.filters.country")}
            >
              <option value="all">{t("reception.filters.allCountries")}</option>
              {countries.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
            <select
              value={arrivalDate}
              onChange={(event) => setArrivalDate(event.target.value)}
              className="min-h-11 rounded-xl border border-slate-300 px-3 py-2 text-sm"
              aria-label={t("reception.filters.arrivalDate")}
            >
              <option value="all">{t("reception.filters.allDates")}</option>
              {arrivalDates.map((value) => (
                <option key={value} value={value}>{formatDate(value)}</option>
              ))}
            </select>
            <select
              value={accommodation}
              onChange={(event) => setAccommodation(event.target.value)}
              className="min-h-11 rounded-xl border border-slate-300 px-3 py-2 text-sm"
              aria-label={t("reception.filters.accommodation")}
            >
              <option value="all">{t("reception.filters.allAccommodation")}</option>
              <option value="Hotel">{t("reception.accommodation.hotel")}</option>
              <option value="Ostello">{t("reception.accommodation.hostel")}</option>
              <option value="Autonomo">{t("reception.accommodation.autonomous")}</option>
            </select>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {(["pending", "all", "arrived"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatus(value)}
                className={`min-h-10 rounded-full border px-4 py-2 text-sm font-semibold ${
                  status === value
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-slate-300 bg-white text-slate-700"
                }`}
              >
                {t(`reception.filters.status.${value}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="sticky top-2 z-20 mx-3 mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:mx-6">
          <label className="inline-flex min-h-11 items-center gap-3 text-sm font-semibold text-slate-800">
            <input
              type="checkbox"
              checked={allFilteredSelected}
              onChange={toggleAllFiltered}
              disabled={selectableFilteredIds.length === 0}
              className="h-5 w-5 rounded border-slate-300 text-indigo-600"
            />
            {t("reception.selection.filtered", { count: selectableFilteredIds.length })}
          </label>
          <button
            type="button"
            onClick={() => void markParticipantsArrived([...selected]).catch((markError) => {
              setError(markError instanceof Error ? markError.message : t("reception.mark.error"));
            })}
            disabled={selected.size === 0 || saving}
            className="min-h-11 flex-1 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
          >
            {saving
              ? t("reception.mark.saving")
              : t("reception.mark.selected", { count: selected.size })}
          </button>
        </div>

        {message ? (
          <p className="mx-3 mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 sm:mx-6">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mx-3 mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 sm:mx-6">
            {error}
          </p>
        ) : null}

        <div className="p-3 sm:p-6">
          {filtered.length === 0 ? (
            <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              {t("reception.participants.empty")}
            </p>
          ) : null}

          <div className="space-y-3 lg:hidden">
            {filtered.map((participant) => (
              <article
                key={participant.id}
                className={`rounded-xl border p-4 [content-visibility:auto] ${
                  participant.arrivedAt
                    ? "border-emerald-300 bg-emerald-50"
                    : selected.has(participant.id)
                      ? "border-indigo-400 bg-indigo-50"
                      : "border-slate-200 bg-white"
                }`}
              >
                <label className="flex min-h-11 items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(participant.id)}
                    disabled={Boolean(participant.arrivedAt)}
                    onChange={() => toggleOne(participant.id)}
                    className="mt-1 h-6 w-6 shrink-0 rounded border-slate-300 text-indigo-600"
                    aria-label={`${participant.firstName} ${participant.lastName}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-base font-bold text-slate-950">
                        {participant.firstName} {participant.lastName}
                      </span>
                      <span className="rounded bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">
                        ID {participant.personalCode}
                      </span>
                    </span>
                    <span className="mt-1 block text-sm text-slate-600">
                      {participant.group} · {participant.country}
                    </span>
                  </span>
                </label>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-200 pt-3 text-sm">
                  <div>
                    <dt className="text-xs text-slate-500">{t("reception.table.arrivalDate")}</dt>
                    <dd className="font-semibold text-slate-900">
                      {participant.arrivalDate ? formatDate(participant.arrivalDate) : "-"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">{t("reception.table.accommodation")}</dt>
                    <dd className="font-semibold text-slate-900">
                      {accommodationLabels[participant.accommodationType]}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-xs text-slate-500">{t("reception.table.groupLeaders")}</dt>
                    <dd className="font-semibold text-slate-900">
                      {participant.groupLeaders.join(", ") || "-"}
                    </dd>
                  </div>
                  {participant.accommodationLocation ? (
                    <div className="col-span-2">
                      <dt className="text-xs text-slate-500">{t("reception.table.location")}</dt>
                      <dd className="font-semibold text-slate-900">
                        {participant.accommodationLocation}
                      </dd>
                    </div>
                  ) : null}
                </dl>
                {participant.arrivedAt ? (
                  <p className="mt-3 rounded-lg bg-emerald-100 px-3 py-2 text-center text-sm font-bold text-emerald-900">
                    {t("reception.status.arrived")}
                  </p>
                ) : null}
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 lg:block">
            <table className="min-w-[1380px] border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="w-12 px-3 py-3" aria-label={t("reception.selection.one")} />
                  <th className="px-3 py-3">ID</th>
                  <th className="px-3 py-3">{t("reception.table.firstName")}</th>
                  <th className="px-3 py-3">{t("reception.table.lastName")}</th>
                  <th className="px-3 py-3">{t("reception.table.country")}</th>
                  <th className="px-3 py-3">{t("reception.table.group")}</th>
                  <th className="px-3 py-3">{t("reception.table.groupLeaders")}</th>
                  <th className="px-3 py-3">{t("reception.table.arrivalDate")}</th>
                  <th className="px-3 py-3">{t("reception.table.accommodation")}</th>
                  <th className="px-3 py-3">{t("reception.table.location")}</th>
                  <th className="px-3 py-3">{t("reception.table.status")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((participant) => (
                  <tr
                    key={participant.id}
                    className={`border-t border-slate-100 [content-visibility:auto] ${
                      participant.arrivedAt
                        ? "bg-emerald-50"
                        : selected.has(participant.id)
                          ? "bg-indigo-50"
                          : "bg-white hover:bg-slate-50"
                    }`}
                  >
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(participant.id)}
                        disabled={Boolean(participant.arrivedAt)}
                        onChange={() => toggleOne(participant.id)}
                        className="h-5 w-5 rounded border-slate-300 text-indigo-600"
                        aria-label={`${participant.firstName} ${participant.lastName}`}
                      />
                    </td>
                    <td className="px-3 py-3 font-mono font-bold text-slate-700">
                      {participant.personalCode}
                    </td>
                    <td className="px-3 py-3 font-semibold text-slate-950">{participant.firstName}</td>
                    <td className="px-3 py-3 font-semibold text-slate-950">{participant.lastName}</td>
                    <td className="px-3 py-3 text-slate-700">{participant.country}</td>
                    <td className="px-3 py-3 text-slate-700">{participant.group}</td>
                    <td className="max-w-64 px-3 py-3 text-slate-700">
                      {participant.groupLeaders.join(", ") || "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                      {participant.arrivalDate ? formatDate(participant.arrivalDate) : "-"}
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      {accommodationLabels[participant.accommodationType]}
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      {participant.accommodationLocation || "-"}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                          participant.arrivedAt
                            ? "bg-emerald-200 text-emerald-900"
                            : "bg-amber-100 text-amber-900"
                        }`}
                      >
                        {participant.arrivedAt
                          ? t("reception.status.arrived")
                          : t("reception.status.pending")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
        </div>
      ) : null}
    </div>
  );
}
