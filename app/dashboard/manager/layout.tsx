import Link from "next/link";
import type { ReactNode } from "react";

const tabs = [
  { href: "/dashboard/manager", label: "Statistics" },
  { href: "/dashboard/manager/participants", label: "Participants" },
];

export default function ManagerLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Manager Dashboard</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Manage statistics and participant data.
      </p>

      <header className="mt-6 rounded border border-neutral-200 bg-neutral-50 p-4">
        <nav className="flex flex-wrap gap-2 text-sm">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-neutral-700 hover:bg-neutral-100"
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
