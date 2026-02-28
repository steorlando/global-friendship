"use client";

import { useRouter } from "next/navigation";
import { LOCALE_LABELS, SUPPORTED_LOCALES, type Locale } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/provider";

export function LanguageSelector() {
  const router = useRouter();
  const { locale, setLocale, t } = useI18n();

  return (
    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
      <span className="font-medium">{t("language.selector")}</span>
      <select
        aria-label={t("language.selector")}
        value={locale}
        onChange={(event) => {
          const next = event.target.value as Locale;
          setLocale(next);
          router.refresh();
        }}
        className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900"
      >
        {SUPPORTED_LOCALES.map((item) => (
          <option key={item} value={item}>
            {LOCALE_LABELS[item]}
          </option>
        ))}
      </select>
    </label>
  );
}
