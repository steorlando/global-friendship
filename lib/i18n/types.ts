export const SUPPORTED_LOCALES = ["en", "it", "fr", "de", "es", "nl-BE", "uk"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export type TranslationDictionary = Record<string, string>;

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_STORAGE_KEY = "gf_locale";
export const LOCALE_COOKIE_KEY = "gf_locale";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  it: "Italiano",
  fr: "Français",
  de: "Deutsch",
  es: "Español",
  "nl-BE": "Vlaams/Nederlands (Belgium)",
  uk: "Українська",
};
