import { cookies, headers } from "next/headers";
import { getMessage, resolveLocale, LOCALE_COOKIE_KEY, type Locale } from "./index";

export async function getServerLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(LOCALE_COOKIE_KEY)?.value;
  if (raw) {
    return resolveLocale(raw);
  }

  const headerStore = await headers();
  const acceptLanguage = headerStore.get("accept-language");
  if (!acceptLanguage) {
    return resolveLocale(raw);
  }

  const candidates = acceptLanguage
    .split(",")
    .map((entry) => entry.trim().split(";")[0])
    .filter(Boolean);

  for (const candidate of candidates) {
    const resolved = resolveLocale(candidate);
    if (resolved !== "en" || candidate.toLowerCase().startsWith("en")) {
      return resolved;
    }
  }

  return resolveLocale(raw);
}

export async function getServerTranslator() {
  const locale = await getServerLocale();
  return {
    locale,
    t: (key: string, params?: Record<string, string | number>) =>
      getMessage(locale, key, params),
  };
}
