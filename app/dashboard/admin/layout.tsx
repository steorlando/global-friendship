"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { DashboardNavLink } from "@/app/dashboard/_components/dashboard-nav-link";
import { useI18n } from "@/lib/i18n/provider";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const sections = [
    {
      href: "/dashboard/admin",
      label: t("dashboard.admin.tab.statistics"),
      isActive: pathname === "/dashboard/admin",
    },
    {
      href: "/dashboard/admin/participants",
      label: t("dashboard.admin.tab.participants"),
      isActive: pathname === "/dashboard/admin/participants",
    },
    {
      href: "/dashboard/admin/deleted-participants",
      label: t("dashboard.admin.tab.deletedParticipants"),
      isActive: pathname === "/dashboard/admin/deleted-participants",
    },
    {
      href: "/dashboard/admin/participation-fees",
      label: t("dashboard.manager.tab.fees"),
      isActive: pathname === "/dashboard/admin/participation-fees",
    },
    {
      href: "/dashboard/admin/event-finance",
      label: t("dashboard.manager.tab.finance"),
      isActive: pathname === "/dashboard/admin/event-finance",
    },
    {
      href: "/dashboard/alloggi",
      label: t("roles.alloggi"),
      isActive: pathname.startsWith("/dashboard/alloggi"),
    },
    {
      href: "/dashboard/admin/users-profiles",
      label: t("dashboard.admin.tab.usersProfiles"),
      isActive: pathname === "/dashboard/admin/users-profiles",
    },
    {
      href: "/dashboard/admin/email-campaigns",
      label: t("dashboard.admin.tab.email"),
      isActive: pathname.startsWith("/dashboard/admin/email-campaigns"),
    },
    {
      href: "/dashboard/admin/settings/event",
      label: "Settings",
      isActive: pathname.startsWith("/dashboard/admin/settings"),
    },
  ];

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <aside className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
          {t("dashboard.admin.sections")}
        </h2>
        <nav className="mt-4 flex flex-wrap gap-2 text-sm">
          {sections.map((section) => (
            <DashboardNavLink
              key={section.href}
              href={section.href}
              label={section.label}
              loadingLabel={t("common.loading")}
              isActive={section.isActive}
            />
          ))}
        </nav>
      </aside>
      <section>{children}</section>
    </main>
  );
}
