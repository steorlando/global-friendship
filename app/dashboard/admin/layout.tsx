"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

const sections = [
  { href: "/dashboard/admin", label: "Statistics" },
  { href: "/dashboard/admin/participants", label: "Participants" },
  { href: "/dashboard/admin/users-profiles", label: "Users & Profile" },
  { href: "/dashboard/admin/email-campaigns", label: "Email Campaigns" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <aside className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
          Sections
        </h2>
        <nav className="mt-4 flex flex-wrap gap-2 text-sm">
          {sections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className={`rounded-full border px-4 py-2 font-medium transition-all duration-200 ${
                pathname === section.href
                  ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
                  : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-100"
              }`}
            >
              {section.label}
            </Link>
          ))}
        </nav>
      </aside>
      <section>{children}</section>
    </main>
  );
}
