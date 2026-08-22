"use client";

import { useMemo, useState } from "react";
import type { ReceptionGroupLeaderContact } from "@/lib/accoglienza/arrivals";
import { useI18n } from "@/lib/i18n/provider";

type ContactSortKey = "leader" | "group";
type SortDirection = "ascending" | "descending";

function normalized(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function displayName(contact: ReceptionGroupLeaderContact): string {
  return [contact.firstName, contact.lastName].filter(Boolean).join(" ") || contact.email || "-";
}

function displayedGroups(contact: ReceptionGroupLeaderContact): string[] {
  return contact.isRomeSubgroup && contact.romeSubgroups.length > 0
    ? contact.romeSubgroups
    : contact.groups;
}

function leaderSortValue(contact: ReceptionGroupLeaderContact): string {
  return [contact.lastName, contact.firstName, contact.email].filter(Boolean).join(" ");
}

export function ReceptionGroupLeaderContacts({
  contacts,
}: {
  contacts: ReceptionGroupLeaderContact[];
}) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [showRomeSubgroups, setShowRomeSubgroups] = useState(false);
  const [sortKey, setSortKey] = useState<ContactSortKey>("leader");
  const [sortDirection, setSortDirection] = useState<SortDirection>("ascending");
  const romeSubgroupCount = contacts.filter((contact) => contact.isRomeSubgroup).length;
  const defaultContactCount = contacts.length - romeSubgroupCount;

  const filteredContacts = useMemo(() => {
    const term = normalized(search);
    const visibleContacts = contacts.filter((contact) => {
      if (contact.isRomeSubgroup && !showRomeSubgroups) return false;
      if (!term) return true;
      return normalized(
        [
          displayName(contact),
          contact.email,
          contact.phone,
          ...contact.groups,
          ...contact.romeSubgroups,
        ].join(" ")
      ).includes(term);
    });

    const direction = sortDirection === "ascending" ? 1 : -1;
    return visibleContacts.sort((a, b) => {
      const aValue =
        sortKey === "leader" ? leaderSortValue(a) : displayedGroups(a).join(" ");
      const bValue =
        sortKey === "leader" ? leaderSortValue(b) : displayedGroups(b).join(" ");
      const primary = aValue.localeCompare(bValue, undefined, { sensitivity: "base" });
      return direction * (primary || leaderSortValue(a).localeCompare(leaderSortValue(b)));
    });
  }, [contacts, search, showRomeSubgroups, sortDirection, sortKey]);

  function toggleSort(nextKey: ContactSortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) =>
        current === "ascending" ? "descending" : "ascending"
      );
      return;
    }
    setSortKey(nextKey);
    setSortDirection("ascending");
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-600">
              {t("reception.contacts.eyebrow")}
            </p>
            <h2 className="mt-1 text-2xl font-bold text-slate-950">
              {t("reception.contacts.title")}
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              {t("reception.contacts.subtitle", {
                count: showRomeSubgroups ? contacts.length : defaultContactCount,
              })}
            </p>
          </div>
          <label className="block w-full lg:max-w-sm">
            <span className="sr-only">{t("reception.contacts.search")}</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("reception.contacts.search")}
              className="min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
            />
          </label>
        </div>

        {romeSubgroupCount > 0 ? (
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-violet-900">
              {t("reception.contacts.romeSubgroupsHidden", { count: romeSubgroupCount })}
            </p>
            <button
              type="button"
              aria-expanded={showRomeSubgroups}
              onClick={() => setShowRomeSubgroups((current) => !current)}
              className="min-h-10 shrink-0 rounded-lg border border-violet-300 bg-white px-4 py-2 text-sm font-bold text-violet-800 shadow-sm transition hover:border-violet-400 hover:bg-violet-100"
            >
              {showRomeSubgroups
                ? t("reception.contacts.hideRomeSubgroups")
                : t("reception.contacts.showRomeSubgroups", { count: romeSubgroupCount })}
            </button>
          </div>
        ) : null}
      </div>

      {filteredContacts.length === 0 ? (
        <p className="m-4 rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 sm:m-6">
          {t("reception.contacts.empty")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] border-collapse text-left text-sm">
            <caption className="sr-only">{t("reception.contacts.title")}</caption>
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th
                  className="px-4 py-3 font-bold sm:px-6"
                  aria-sort={sortKey === "leader" ? sortDirection : "none"}
                >
                  <button
                    type="button"
                    onClick={() => toggleSort("leader")}
                    aria-label={t("reception.contacts.sortByLeader")}
                    className="inline-flex items-center gap-1.5 rounded py-1 text-left transition hover:text-violet-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
                  >
                    <span>{t("reception.contacts.name")}</span>
                    <span aria-hidden="true" className="text-sm text-violet-600">
                      {sortKey === "leader"
                        ? sortDirection === "ascending"
                          ? "↑"
                          : "↓"
                        : "↕"}
                    </span>
                  </button>
                </th>
                <th className="px-4 py-3 font-bold">{t("reception.contacts.email")}</th>
                <th className="px-4 py-3 font-bold">{t("reception.contacts.phone")}</th>
                <th
                  className="px-4 py-3 font-bold sm:pr-6"
                  aria-sort={sortKey === "group" ? sortDirection : "none"}
                >
                  <button
                    type="button"
                    onClick={() => toggleSort("group")}
                    aria-label={t("reception.contacts.sortByGroup")}
                    className="inline-flex items-center gap-1.5 rounded py-1 text-left transition hover:text-violet-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
                  >
                    <span>{t("reception.contacts.groups")}</span>
                    <span aria-hidden="true" className="text-sm text-violet-600">
                      {sortKey === "group"
                        ? sortDirection === "ascending"
                          ? "↑"
                          : "↓"
                        : "↕"}
                    </span>
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredContacts.map((contact) => {
                const contactGroups = displayedGroups(contact);
                return (
                  <tr key={contact.id} className="align-top transition hover:bg-violet-50/40">
                    <td className="px-4 py-4 sm:px-6">
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden="true"
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700"
                        >
                          {(contact.firstName[0] ?? contact.email[0] ?? "?").toUpperCase()}
                          {(contact.lastName[0] ?? "").toUpperCase()}
                        </span>
                        <div>
                          <p className="font-bold text-slate-950">{displayName(contact)}</p>
                          {contact.isRomeSubgroup ? (
                            <p className="mt-0.5 text-xs font-semibold text-violet-600">
                              {t("reception.contacts.romeSubgroup")}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {contact.email ? (
                        <a
                          href={`mailto:${contact.email}`}
                          className="font-medium text-indigo-700 hover:underline"
                        >
                          {contact.email}
                        </a>
                      ) : (
                        <span className="text-slate-400">{t("reception.contacts.emailMissing")}</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {contact.phone ? (
                        <a
                          href={`tel:${contact.phone.replace(/\s+/g, "")}`}
                          className="font-medium text-indigo-700 hover:underline"
                        >
                          {contact.phone}
                        </a>
                      ) : (
                        <span className="text-slate-400">{t("reception.contacts.phoneMissing")}</span>
                      )}
                    </td>
                    <td className="px-4 py-4 sm:pr-6">
                      <div className="flex flex-wrap gap-1.5">
                        {contactGroups.map((group) => (
                          <span
                            key={group}
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              contact.isRomeSubgroup
                                ? "bg-violet-100 text-violet-800"
                                : "bg-indigo-50 text-indigo-800"
                            }`}
                          >
                            {group}
                          </span>
                        ))}
                        {contactGroups.length === 0 ? (
                          <span className="text-xs text-slate-400">
                            {t("reception.contacts.noGroups")}
                          </span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
