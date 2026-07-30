"use client";

import { useI18n } from "@/lib/i18n/provider";

export function DashboardRouteLoading() {
  const { t } = useI18n();

  return (
    <div
      aria-live="polite"
      aria-busy="true"
      className="flex min-h-56 items-center justify-center rounded-xl border border-slate-200 bg-white p-8 shadow-sm"
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <span
          aria-hidden="true"
          className="size-10 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600 motion-reduce:animate-none"
        />
        <p className="text-sm font-medium text-slate-600">{t("common.loading")}</p>
      </div>
    </div>
  );
}
