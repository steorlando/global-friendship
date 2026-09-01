"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";

type EnrollmentBucket = "Higher students" | "University-Worker" | "Operator";
type RegistrationsTab = "country" | "group";

type PivotRow = {
  label: string;
  counts: Record<EnrollmentBucket, number>;
  total: number;
};

type CountryPivotRow = PivotRow & {
  cityRows: PivotRow[];
};

type RegistrationsTabsSectionProps = {
  buckets: EnrollmentBucket[];
  countryRows: CountryPivotRow[];
  groupRows: PivotRow[];
};
const ENROLLMENT_BUCKET_LABEL_KEYS: Record<EnrollmentBucket, string> = {
  "Higher students": "enrollment.bucket.higherStudents",
  "University-Worker": "enrollment.bucket.universityWorker",
  Operator: "enrollment.bucket.operator",
};

function participantsHref(
  filters: Record<string, string | null | undefined>
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    const normalized = (value ?? "").trim();
    if (normalized) params.set(key, normalized);
  }
  return `/dashboard/manager/participants?${params.toString()}`;
}

function CountLink({
  href,
  count,
}: {
  href: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      className="font-semibold text-indigo-700 underline-offset-2 hover:underline"
    >
      {count}
    </Link>
  );
}

export function RegistrationsTabsSection({
  buckets,
  countryRows,
  groupRows,
}: RegistrationsTabsSectionProps) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<RegistrationsTab>("country");
  const [expandedCountries, setExpandedCountries] = useState<Set<string>>(
    () => new Set()
  );
  const rows = activeTab === "country" ? countryRows : groupRows;

  const toggleCountry = (country: string) => {
    setExpandedCountries((current) => {
      const next = new Set(current);
      if (next.has(country)) next.delete(country);
      else next.add(country);
      return next;
    });
  };

  return (
    <section id="registrations" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-900">{t("manager.statistics.registrations")}</h3>
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("country")}
            className={`rounded-md px-3 py-1.5 text-sm ${
              activeTab === "country"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {t("manager.registrations.byCountry")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("group")}
            className={`rounded-md px-3 py-1.5 text-sm ${
              activeTab === "group"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {t("manager.registrations.byGroup")}
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-auto">
        {activeTab === "country" && (
          <p className="mb-3 text-sm text-slate-500">
            {t("manager.registrations.countryCitiesHint")}
          </p>
        )}
        <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50/50 text-left text-slate-700">
              <tr>
                <th className="px-4 py-3 font-semibold">
                  {activeTab === "country"
                    ? t("manager.registrations.country")
                    : t("manager.registrations.group")}
                </th>
                {buckets.map((bucket) => (
                  <th key={bucket} className="px-4 py-3 font-semibold">
                    {t(ENROLLMENT_BUCKET_LABEL_KEYS[bucket])}
                  </th>
                ))}
                <th className="px-4 py-3 font-semibold">{t("manager.registrations.total")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={buckets.length + 2} className="px-3 py-3 text-slate-500">
                    {t("common.noData")}
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const countryRow =
                    activeTab === "country" ? (row as CountryPivotRow) : null;
                  const isExpanded = countryRow
                    ? expandedCountries.has(countryRow.label)
                    : false;

                  return (
                    <Fragment key={row.label}>
                      <tr className={isExpanded ? "bg-indigo-50/40" : undefined}>
                        <td className="px-4 py-3 text-slate-900">
                          {countryRow ? (
                            <button
                              type="button"
                              onClick={() => toggleCountry(countryRow.label)}
                              aria-expanded={isExpanded}
                              aria-label={t(
                                isExpanded
                                  ? "manager.registrations.hideCountryCities"
                                  : "manager.registrations.showCountryCities",
                                { country: countryRow.label }
                              )}
                              className="group inline-flex items-center gap-2 rounded text-left font-medium hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                            >
                              <span
                                className={`h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:text-indigo-600 ${
                                  isExpanded ? "rotate-90" : ""
                                }`}
                              >
                                <svg
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                  aria-hidden="true"
                                  className="h-full w-full"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M7.21 14.77a.75.75 0 0 1 .02-1.06L10.94 10 7.23 6.29a.75.75 0 1 1 1.06-1.06l4.24 4.24a.75.75 0 0 1 0 1.06l-4.24 4.24a.75.75 0 0 1-1.08 0Z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </span>
                              <span>{countryRow.label}</span>
                            </button>
                          ) : (
                            row.label
                          )}
                        </td>
                        {buckets.map((bucket) => (
                          <td key={`${row.label}-${bucket}`} className="px-4 py-3 text-slate-700">
                            <CountLink
                              count={row.counts[bucket]}
                              href={participantsHref({
                                [activeTab === "country" ? "statCountry" : "statGroup"]: row.label,
                                enrollmentBucket: bucket,
                              })}
                            />
                          </td>
                        ))}
                        <td className="px-4 py-3 font-medium text-slate-900">
                          <CountLink
                            count={row.total}
                            href={participantsHref({
                              [activeTab === "country" ? "statCountry" : "statGroup"]: row.label,
                            })}
                          />
                        </td>
                      </tr>

                      {countryRow && isExpanded &&
                        countryRow.cityRows.map((cityRow) => {
                          const cityIsMissing = cityRow.label === "-";
                          return (
                            <tr
                              key={`${countryRow.label}-${cityRow.label}`}
                              className="bg-slate-50/80"
                            >
                              <td className="py-2.5 pl-10 pr-4 text-slate-700">
                                <span className="border-l-2 border-indigo-200 pl-3">
                                  {cityIsMissing
                                    ? t("manager.registrations.cityNotSpecified")
                                    : cityRow.label}
                                </span>
                              </td>
                              {buckets.map((bucket) => (
                                <td
                                  key={`${countryRow.label}-${cityRow.label}-${bucket}`}
                                  className="px-4 py-2.5 text-slate-600"
                                >
                                  {cityIsMissing ? (
                                    cityRow.counts[bucket]
                                  ) : (
                                    <CountLink
                                      count={cityRow.counts[bucket]}
                                      href={participantsHref({
                                        statCountry: countryRow.label,
                                        statCity: cityRow.label,
                                        enrollmentBucket: bucket,
                                      })}
                                    />
                                  )}
                                </td>
                              ))}
                              <td className="px-4 py-2.5 font-medium text-slate-700">
                                {cityIsMissing ? (
                                  cityRow.total
                                ) : (
                                  <CountLink
                                    count={cityRow.total}
                                    href={participantsHref({
                                      statCountry: countryRow.label,
                                      statCity: cityRow.label,
                                    })}
                                  />
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </Fragment>
                  );
                })
              )}
            </tbody>
        </table>
      </div>
    </section>
  );
}
