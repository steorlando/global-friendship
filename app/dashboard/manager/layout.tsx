"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { DashboardNavLink } from "@/app/dashboard/_components/dashboard-nav-link";
import { useI18n } from "@/lib/i18n/provider";

export default function ManagerLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const tabs = [
    {
      href: "/dashboard/manager",
      label: t("dashboard.manager.tab.statistics"),
      activePrefix: "/dashboard/manager/staff-availability",
    },
    { href: "/dashboard/manager/participants", label: t("dashboard.manager.tab.participants") },
    { href: "/dashboard/alloggi", label: t("dashboard.manager.tab.accommodation") },
    { href: "/dashboard/manager/participation-fees", label: t("dashboard.manager.tab.fees") },
    { href: "/dashboard/manager/event-finance", label: t("dashboard.manager.tab.finance") },
    {
      href: "/dashboard/manager/email-campaigns",
      label: t("dashboard.manager.tab.email"),
      activePrefix: "/dashboard/manager/email-campaigns",
    },
  ];

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900">{t("dashboard.manager.title")}</h1>
      <p className="mt-2 text-sm text-slate-500">
        {t("dashboard.manager.subtitle")}
      </p>

      <header className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <nav className="flex flex-wrap gap-2 text-sm">
          {tabs.map((tab) => (
            <DashboardNavLink
              key={tab.href}
              href={tab.href}
              label={tab.label}
              loadingLabel={t("common.loading")}
              isActive={
                pathname === tab.href ||
                Boolean(tab.activePrefix && pathname.startsWith(tab.activePrefix))
              }
            />
          ))}
        </nav>
      </header>

      <section className="mt-6">{children}</section>
    </main>
  );
}
