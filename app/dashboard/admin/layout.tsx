import Link from "next/link";
import type { ReactNode } from "react";

const sections = [
  { href: "/dashboard/admin/users-profiles", label: "Users & Profiles" },
  { href: "/dashboard/admin", label: "Overview" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="grid gap-6 md:grid-cols-[1fr_280px]">
        <section>{children}</section>
        <aside className="rounded border border-neutral-200 bg-neutral-50 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">
            Sections
          </h2>
          <nav className="mt-4 flex flex-col gap-2 text-sm">
            {sections.map((section) => (
              <Link
                key={section.href}
                href={section.href}
                className="rounded px-2 py-1 text-neutral-700 hover:bg-neutral-200 hover:text-neutral-900"
              >
                {section.label}
              </Link>
            ))}
          </nav>
        </aside>
      </div>
    </main>
  );
}
