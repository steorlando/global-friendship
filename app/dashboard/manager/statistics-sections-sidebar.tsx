"use client";

import { useState } from "react";

type StatisticsSectionsSidebarProps = {
  labels: {
    title: string;
    counters: string;
    registrations: string;
    trend: string;
    dailyPresence: string;
    duplicates: string;
    open: string;
    close: string;
  };
  includeDuplicates: boolean;
};

export function StatisticsSectionsSidebar({
  labels,
  includeDuplicates,
}: StatisticsSectionsSidebarProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <aside
      className={`h-max rounded-xl border border-slate-200 bg-white p-3 shadow-sm lg:sticky lg:top-6 lg:transition-[width] lg:duration-200 ${
        expanded ? "lg:w-[220px]" : "lg:w-14"
      }`}
    >
      <div className={`flex items-center gap-2 ${expanded ? "justify-between" : "justify-center"}`}>
        <p
          className={`text-xs font-semibold uppercase tracking-wide text-slate-500 ${
            expanded ? "block" : "hidden"
          }`}
        >
          {labels.title}
        </p>
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
          aria-expanded={expanded}
          aria-label={expanded ? labels.close : labels.open}
          title={expanded ? labels.close : labels.open}
        >
          {expanded ? "<<" : ">>"}
        </button>
      </div>

      {expanded && (
        <nav className="mt-3 flex flex-col gap-2 text-sm">
          <a href="#top-counters" className="rounded border border-slate-200 px-4 py-3 hover:bg-slate-50">
            {labels.counters}
          </a>
          <a href="#registrations" className="rounded border border-slate-200 px-4 py-3 hover:bg-slate-50">
            {labels.registrations}
          </a>
          <a href="#trend" className="rounded border border-slate-200 px-4 py-3 hover:bg-slate-50">
            {labels.trend}
          </a>
          <a href="#daily-presence" className="rounded border border-slate-200 px-4 py-3 hover:bg-slate-50">
            {labels.dailyPresence}
          </a>
          {includeDuplicates && (
            <a
              href="#duplicates-non-associated"
              className="rounded border border-slate-200 px-4 py-3 hover:bg-slate-50"
            >
              {labels.duplicates}
            </a>
          )}
        </nav>
      )}
    </aside>
  );
}
