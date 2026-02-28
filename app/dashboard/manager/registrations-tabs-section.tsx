"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";

type EnrollmentBucket = "Higher students" | "University-Worker" | "Operator";
type RegistrationsTab = "country" | "group";

type PivotRow = {
  label: string;
  counts: Record<EnrollmentBucket, number>;
  total: number;
};

type RegistrationsTabsSectionProps = {
  buckets: EnrollmentBucket[];
  countryRows: PivotRow[];
  groupRows: PivotRow[];
};
const ENROLLMENT_BUCKET_LABEL_KEYS: Record<EnrollmentBucket, string> = {
  "Higher students": "enrollment.bucket.higherStudents",
  "University-Worker": "enrollment.bucket.universityWorker",
  Operator: "enrollment.bucket.operator",
};

export function RegistrationsTabsSection({
  buckets,
  countryRows,
  groupRows,
}: RegistrationsTabsSectionProps) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<RegistrationsTab>("country");
  const rows = activeTab === "country" ? countryRows : groupRows;

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
              rows.map((row) => (
                <tr key={row.label}>
                  <td className="px-4 py-3 text-slate-900">{row.label}</td>
                  {buckets.map((bucket) => (
                    <td key={`${row.label}-${bucket}`} className="px-4 py-3 text-slate-700">
                      {row.counts[bucket]}
                    </td>
                  ))}
                  <td className="px-4 py-3 font-medium text-slate-900">{row.total}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
