"use client";

import Link, { useLinkStatus } from "next/link";
import type { MouseEvent } from "react";

type DashboardNavLinkProps = {
  href: string;
  label: string;
  loadingLabel: string;
  isActive: boolean;
};

function DashboardNavLinkContent({
  label,
  loadingLabel,
  isActive,
}: Omit<DashboardNavLinkProps, "href">) {
  const { pending } = useLinkStatus();

  const preventRepeatedNavigation = (event: MouseEvent<HTMLSpanElement>) => {
    if (!pending) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <span
      aria-busy={pending}
      onClick={preventRepeatedNavigation}
      className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-4 py-2 font-medium transition-all duration-200 ${
        pending
          ? "cursor-wait border-indigo-300 bg-indigo-50 text-indigo-700 shadow-sm"
          : isActive
            ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
            : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-100"
      }`}
    >
      {pending ? (
        <span
          aria-hidden="true"
          className="size-4 shrink-0 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-700 motion-reduce:animate-none"
        />
      ) : null}
      <span>{label}</span>
      {pending ? <span className="sr-only"> — {loadingLabel}</span> : null}
    </span>
  );
}

export function DashboardNavLink({
  href,
  label,
  loadingLabel,
  isActive,
}: DashboardNavLinkProps) {
  return (
    <Link
      href={href}
      className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
    >
      <DashboardNavLinkContent
        label={label}
        loadingLabel={loadingLabel}
        isActive={isActive}
      />
    </Link>
  );
}
