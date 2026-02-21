import Link from "next/link";
import type { ReactNode } from "react";

const sections = [
  { href: "/dashboard/admin", label: "Statistics" },
  { href: "/dashboard/admin/participants", label: "Participants" },
  { href: "/dashboard/admin/users-profiles", label: "Users & Profile" },
  { href: "/dashboard/admin/email-campaigns", label: "Email Campaigns" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <aside className="mb-6 rounded border border-neutral-200 bg-neutral-50 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">
          Sections
        </h2>
        <nav className="mt-4 flex flex-wrap gap-2 text-sm">
          {sections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900"
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
