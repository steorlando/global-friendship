"use client";

import type { ArrivalGroupSummaryRow } from "@/lib/accoglienza/arrivals";

export function ArrivalGroupSummaryTable({
  rows,
  labels,
  onSelectPending,
}: {
  rows: ArrivalGroupSummaryRow[];
  labels: {
    group: string;
    arrived: string;
    notArrived: string;
    total: string;
    selectPending?: string;
    empty: string;
  };
  onSelectPending?: (group: string) => void;
}) {
  return (
    <>
      {onSelectPending ? (
        <div className="space-y-3 sm:hidden">
          {rows.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
              {labels.empty}
            </p>
          ) : (
            rows.map((row) => (
              <article
                key={`mobile-arrival-group-${row.group}`}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <h3 className="font-bold text-slate-950">{row.group}</h3>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-emerald-50 px-2 py-3">
                    <dt className="font-semibold text-emerald-700">{labels.arrived}</dt>
                    <dd className="mt-1 text-xl font-bold text-emerald-950">{row.arrived}</dd>
                  </div>
                  <div className="rounded-lg bg-amber-50 px-2 py-3">
                    <dt className="font-semibold text-amber-700">{labels.notArrived}</dt>
                    <dd className="mt-1 text-xl font-bold text-amber-950">{row.notArrived}</dd>
                  </div>
                  <div className="rounded-lg bg-slate-100 px-2 py-3">
                    <dt className="font-semibold text-slate-600">{labels.total}</dt>
                    <dd className="mt-1 text-xl font-bold text-slate-950">{row.total}</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  disabled={row.notArrived === 0}
                  onClick={() => onSelectPending(row.group)}
                  className="mt-3 min-h-11 w-full rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {labels.selectPending}
                </button>
              </article>
            ))
          )}
        </div>
      ) : null}

      <div
        className={`overflow-x-auto rounded-xl border border-slate-200 ${
          onSelectPending ? "hidden sm:block" : ""
        }`}
      >
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="px-4 py-3 font-semibold">{labels.group}</th>
              <th className="px-4 py-3 text-center font-semibold text-emerald-800">
                {labels.arrived}
              </th>
              <th className="px-4 py-3 text-center font-semibold text-amber-800">
                {labels.notArrived}
              </th>
              <th className="px-4 py-3 text-center font-semibold">{labels.total}</th>
              {onSelectPending ? (
                <th className="px-4 py-3" aria-label={labels.selectPending} />
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={onSelectPending ? 5 : 4}
                  className="px-4 py-5 text-center text-slate-500"
                >
                  {labels.empty}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.group} className="border-t border-slate-100 bg-white">
                  <td className="px-4 py-3 font-medium text-slate-900">{row.group}</td>
                  <td className="px-4 py-3 text-center font-semibold text-emerald-700">
                    {row.arrived}
                  </td>
                  <td className="px-4 py-3 text-center font-semibold text-amber-700">
                    {row.notArrived}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-700">{row.total}</td>
                  {onSelectPending ? (
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={row.notArrived === 0}
                        onClick={() => onSelectPending(row.group)}
                        className="whitespace-nowrap rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {labels.selectPending}
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
