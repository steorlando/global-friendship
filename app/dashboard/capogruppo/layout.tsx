"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";

export default function CapogruppoLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const isDesktopRoomAssignment = pathname.startsWith(
    "/dashboard/capogruppo/room-assignment"
  );

  const tabs = [
    {
      href: "/dashboard/capogruppo",
      label: t("dashboard.groupLeader.tab.participants"),
      isActive: pathname === "/dashboard/capogruppo",
    },
    {
      href: "/dashboard/capogruppo/room-assignment",
      label: t("dashboard.groupLeader.tab.roomAssignment"),
      isActive: pathname.startsWith("/dashboard/capogruppo/room-assignment"),
    },
  ];

  return (
    <main
      className={`mx-auto px-4 py-6 sm:px-6 sm:py-10 ${
        isDesktopRoomAssignment ? "max-w-[1800px]" : "max-w-7xl"
      }`}
    >
      <aside className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
          {t("dashboard.groupLeader.sections")}
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
