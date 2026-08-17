"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { DashboardNavLink } from "@/app/dashboard/_components/dashboard-nav-link";
import { useI18n } from "@/lib/i18n/provider";

export default function TourManagerLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { t } = useI18n();
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900">{t("tours.manager.title")}</h1>
      <p className="mt-2 text-sm text-slate-500">{t("tours.manager.subtitle")}</p>
      <nav className="mt-6 flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <DashboardNavLink href="/dashboard/tour-manager" label={t("tours.staff.toursTab")} loadingLabel={t("common.loading")} isActive={pathname === "/dashboard/tour-manager"} />
        <DashboardNavLink href="/dashboard/tour-manager/participants" label={t("tours.staff.participantsTab")} loadingLabel={t("common.loading")} isActive={pathname.startsWith("/dashboard/tour-manager/participants")} />
      </nav>
      <section className="mt-6">{children}</section>
    </main>
  );
}
