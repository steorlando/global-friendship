"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/dashboard/manager", label: "Statistics" },
  { href: "/dashboard/manager/participants", label: "Participants" },
  { href: "/dashboard/manager/participation-fees", label: "Participation Fees" },
  { href: "/dashboard/manager/email-campaigns", label: "Email Campaigns" },
];

export default function ManagerLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Manager Dashboard</h1>
      <p className="mt-2 text-sm text-slate-500">
        Manage statistics and participant data.
      </p>

      <header className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <nav className="flex flex-wrap gap-2 text-sm">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`rounded-full border px-4 py-2 font-medium transition-all duration-200 ${
                pathname === tab.href
                  ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
                  : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </header>

      <section className="mt-6">{children}</section>
    </main>
  );
}
