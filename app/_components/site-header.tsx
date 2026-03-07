"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/app/_components/logout-button";
import { LanguageSelector } from "@/app/_components/language-selector";
import { isAppRole, type AppRole } from "@/lib/auth/roles";
import { useI18n } from "@/lib/i18n/provider";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type SiteHeaderProps = {
  userEmail?: string | null;
  requestedRole?: string | null;
};

export function SiteHeader({ userEmail, requestedRole }: SiteHeaderProps) {
  const { t } = useI18n();
  const pathname = usePathname();
  const initialRole = isAppRole(requestedRole) ? requestedRole : null;

  const [resolvedEmail, setResolvedEmail] = useState<string | null>(userEmail ?? null);
  const roleFromPath: AppRole | null = (() => {
    if (!pathname?.startsWith("/dashboard/")) return null;
    if (pathname.startsWith("/dashboard/admin")) return "admin";
    if (pathname.startsWith("/dashboard/manager")) return "manager";
    if (pathname.startsWith("/dashboard/capogruppo")) return "capogruppo";
    if (pathname.startsWith("/dashboard/partecipante")) return "partecipante";
    if (pathname.startsWith("/dashboard/alloggi")) return "alloggi";
    return null;
  })();
  const resolvedRole = resolvedEmail ? roleFromPath ?? initialRole : null;

  useEffect(() => {
    let active = true;
    try {
      const supabase = createSupabaseBrowserClient();
      supabase.auth.getUser().then(({ data }) => {
        if (!active) return;
        setResolvedEmail(data.user?.email ?? null);
      });
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!active) return;
        setResolvedEmail(session?.user?.email ?? null);
      });

      return () => {
        active = false;
        subscription.unsubscribe();
      };
    } catch {
      return () => {
        active = false;
      };
    }
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 sm:gap-6">
          <Image
            src="/logo_santegidio.png"
            alt={t("header.logo1Alt")}
            width={184}
            height={56}
            className="h-9 w-auto object-contain sm:h-10"
            priority
          />
          <Image
            src="/Logo_YFP.png"
            alt={t("header.logo2Alt")}
            width={152}
            height={56}
            className="h-9 w-auto object-contain sm:h-10"
            priority
          />
        </div>

        <h1 className="text-base font-semibold tracking-tight text-slate-900 sm:text-2xl">
          Global Friendship
        </h1>

        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Language</span>
            <LanguageSelector />
          </div>
          <LogoutButton />
          <div className="max-w-44 text-left text-[10px] italic leading-tight text-slate-400 sm:max-w-64 sm:text-xs">
            <div className="truncate" title={resolvedEmail ?? ""}>
              {resolvedEmail ?? "-"}
            </div>
            <div>{resolvedRole ? t(`roles.${resolvedRole}`) : "-"}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
