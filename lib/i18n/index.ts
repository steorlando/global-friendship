import en from "./locales/en";
import it from "./locales/it";
import fr from "./locales/fr";
import de from "./locales/de";
import es from "./locales/es";
import nlBE from "./locales/nl-BE";
import uk from "./locales/uk";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_KEY,
  LOCALE_LABELS,
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
  type Locale,
  type TranslationDictionary,
} from "./types";

const LOCALE_MAP: Record<Locale, TranslationDictionary> = {
  en,
  it,
  fr,
  de,
  es,
  "nl-BE": nlBE,
  uk,
};

const SUPPORTED_SET = new Set<string>(SUPPORTED_LOCALES);

function normalizeLocale(input: string | null | undefined): Locale | null {
  if (!input) return null;
  const raw = input.trim();
  if (!raw) return null;

  if (SUPPORTED_SET.has(raw)) return raw as Locale;

  const lower = raw.toLowerCase();
  if (lower === "nl" || lower.startsWith("nl-")) return "nl-BE";

  const prefix = lower.split("-")[0];
  const matched = SUPPORTED_LOCALES.find((locale) => locale.toLowerCase() === prefix);
  return matched ?? null;
}

export function resolveLocale(input: string | null | undefined): Locale {
  return normalizeLocale(input) ?? DEFAULT_LOCALE;
}

export function detectBrowserLocale(): Locale {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;
  const preferred = [navigator.language, ...(navigator.languages ?? [])];
  for (const candidate of preferred) {
    const resolved = normalizeLocale(candidate);
    if (resolved) return resolved;
  }
  return DEFAULT_LOCALE;
}

export function detectInitialClientLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;

  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  const resolvedStored = normalizeLocale(stored);
  if (resolvedStored) return resolvedStored;

  return detectBrowserLocale();
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key];
    return value === undefined || value === null ? `{${key}}` : String(value);
  });
}

export function getMessage(locale: Locale, key: string, params?: Record<string, string | number>) {
  const dict = LOCALE_MAP[locale] ?? LOCALE_MAP[DEFAULT_LOCALE];
  const fallback = LOCALE_MAP[DEFAULT_LOCALE][key];
  const current = dict[key];

  if (current === undefined) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[i18n] Missing key \"${key}\" for locale \"${locale}\"`);
    }
    return interpolate(fallback ?? key, params);
  }

  return interpolate(current, params);
}

export function persistLocale(locale: Locale) {
  if (typeof document !== "undefined") {
    document.cookie = `${LOCALE_COOKIE_KEY}=${encodeURIComponent(locale)}; path=/; max-age=31536000; samesite=lax`;
  }

  if (typeof window !== "undefined") {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }
}

export function formatNumber(locale: Locale, value: number, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(locale, options).format(value);
}

export function formatDate(locale: Locale, value: Date | string, options?: Intl.DateTimeFormatOptions) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale, options).format(date);
}

export {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_KEY,
  LOCALE_LABELS,
  LOCALE_STORAGE_KEY,
  LOCALE_MAP,
  SUPPORTED_LOCALES,
};

export type { Locale };
