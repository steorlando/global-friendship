"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { LOCALE_LABELS, SUPPORTED_LOCALES, type Locale } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/provider";

const LOCALE_FLAGS: Record<Locale, string> = {
  en: "🇬🇧",
  it: "🇮🇹",
  fr: "🇫🇷",
  de: "🇩🇪",
  es: "🇪🇸",
  "nl-BE": "🇧🇪",
  uk: "🇺🇦",
};

export function LanguageSelector() {
  const router = useRouter();
  const { locale, setLocale, t } = useI18n();
  const detailsRef = useRef<HTMLDetailsElement>(null);

  return (
    <details ref={detailsRef} className="relative">
      <summary
        className="inline-flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full border border-slate-300 bg-white text-sm hover:bg-slate-100"
        aria-label={`${t("language.selector")}: ${LOCALE_LABELS[locale]}`}
        title={LOCALE_LABELS[locale]}
      >
        <span aria-hidden>{LOCALE_FLAGS[locale]}</span>
      </summary>
      <div className="absolute right-0 z-50 mt-2 w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
        {SUPPORTED_LOCALES.map((item) => (
          <button
            key={item}
            type="button"
            aria-label={`${t("language.selector")}: ${LOCALE_LABELS[item]}`}
            onClick={() => {
              if (item !== locale) {
                setLocale(item);
                router.refresh();
              }
              if (detailsRef.current) detailsRef.current.open = false;
            }}
            className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${
              item === locale ? "bg-slate-100 text-slate-900" : "text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span aria-hidden>{LOCALE_FLAGS[item]}</span>
            <span>{LOCALE_LABELS[item]}</span>
          </button>
        ))}
      </div>
    </details>
  );
}
