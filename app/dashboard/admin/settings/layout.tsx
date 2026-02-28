"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminSettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const tabs = [
    {
      href: "/dashboard/admin/settings/email",
      label: "Email",
      isActive: pathname === "/dashboard/admin/settings/email",
    },
  ];

  return (
    <section className="space-y-6 lg:space-y-0 lg:flex lg:items-start lg:gap-6">
      <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-6 lg:w-64 lg:shrink-0">
        <h2 className="text-lg font-semibold text-slate-900">Settings</h2>
        <p className="mt-1 text-sm text-slate-600">
          Manage platform configuration used by operational features.
        </p>

        <nav className="mt-4 flex flex-wrap gap-2 text-sm lg:flex-col">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`rounded-full border px-4 py-2 font-medium transition-all duration-200 lg:w-full lg:rounded-lg ${
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

      <div className="min-w-0 lg:flex-1">{children}</div>
    </section>
  );
}
