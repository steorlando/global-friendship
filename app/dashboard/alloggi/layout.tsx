"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";

export default function AlloggiLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { t } = useI18n();

  const tabs = [
    {
      href: "/dashboard/alloggi",
      label: t("dashboard.accommodation.tab.inventory"),
      isActive: pathname === "/dashboard/alloggi",
    },
    {
      href: "/dashboard/alloggi/group-allocations",
      label: t("dashboard.accommodation.tab.groupAllocations"),
      isActive: pathname.startsWith("/dashboard/alloggi/group-allocations"),
    },
    {
      href: "/dashboard/alloggi/hotel-overview",
      label: t("dashboard.accommodation.tab.hotelOverview"),
      isActive: pathname.startsWith("/dashboard/alloggi/hotel-overview"),
    },
    {
      href: "/dashboard/alloggi/hotel-rosters",
      label: t("dashboard.accommodation.tab.hotelRoster"),
      isActive: pathname.startsWith("/dashboard/alloggi/hotel-rosters"),
    },
    {
      href: "/dashboard/alloggi/room-rosters",
      label: t("dashboard.accommodation.tab.roomRoster"),
      isActive: pathname.startsWith("/dashboard/alloggi/room-rosters"),
    },
  ];

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <aside className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
          {t("dashboard.accommodation.sections")}
        </h2>
        <nav className="mt-4 flex flex-wrap gap-2 text-sm">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`rounded-full border px-4 py-2 font-medium transition-all duration-200 ${
                tab.isActive
                  ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
                  : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </aside>
      <section>{children}</section>
    </main>
  );
}
