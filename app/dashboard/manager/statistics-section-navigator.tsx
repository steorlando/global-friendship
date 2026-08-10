"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  STATISTICS_SECTION_GROUPS,
  type StatisticsSectionKey,
} from "@/lib/statistics/dashboard-sections";

type StatisticsSectionNavigatorProps = {
  activeSection: StatisticsSectionKey;
  basePath: string;
  labels: {
    title: string;
    mobileLabel: string;
    loading: string;
    groups: Record<(typeof STATISTICS_SECTION_GROUPS)[number]["key"], string>;
    sections: Record<StatisticsSectionKey, string>;
  };
};

function sectionHref(basePath: string, section: StatisticsSectionKey): string {
  return `${basePath}?section=${section}`;
}

export function StatisticsSectionNavigator({
  activeSection,
  basePath,
  labels,
}: StatisticsSectionNavigatorProps) {
  const router = useRouter();
  const [pendingSection, setPendingSection] =
    useState<StatisticsSectionKey | null>(null);
  const isPending =
    pendingSection !== null && pendingSection !== activeSection;

  const navigateToSection = (section: StatisticsSectionKey) => {
    if (section === activeSection) return;
    setPendingSection(section);
    router.push(sectionHref(basePath, section));
  };

  return (
    <aside className="h-max lg:sticky lg:top-6">
      {isPending ? (
        <div
          role="status"
          className="fixed left-1/2 top-4 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-800 shadow-lg"
        >
          <span
            aria-hidden="true"
            className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600"
          />
          {labels.loading}
        </div>
      ) : null}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:hidden">
        <label className="block text-sm font-semibold text-slate-800">
          {labels.mobileLabel}
          <select
            value={activeSection}
            onChange={(event) =>
              navigateToSection(event.target.value as StatisticsSectionKey)
            }
            aria-busy={isPending}
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          >
            {STATISTICS_SECTION_GROUPS.map((group) => (
              <optgroup key={group.key} label={labels.groups[group.key]}>
                {group.sections.map((section) => (
                  <option key={section} value={section}>
                    {labels.sections[section]}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      </div>

      <div className="hidden w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-sm lg:block">
        <p className="px-3 pb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          {labels.title}
        </p>
        <nav aria-label={labels.title} className="space-y-4">
          {STATISTICS_SECTION_GROUPS.map((group) => (
            <div key={group.key}>
              <p className="px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {labels.groups[group.key]}
              </p>
              <div className="mt-1 space-y-1">
                {group.sections.map((section) => {
                  const active = section === activeSection;
                  return (
                    <Link
                      key={section}
                      href={sectionHref(basePath, section)}
                      prefetch={false}
                      onClick={(event) => {
                        event.preventDefault();
                        navigateToSection(section);
                      }}
                      aria-current={active ? "page" : undefined}
                      className={`flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                        active
                          ? "border-indigo-200 bg-indigo-50 text-indigo-800 shadow-sm"
                          : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          active ? "bg-indigo-600" : "bg-slate-300"
                        }`}
                      />
                      <span>{labels.sections[section]}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}
