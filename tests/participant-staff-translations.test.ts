import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import en from "../lib/i18n/locales/en.ts";

const staffTranslationKeys = Object.keys(en).filter((key) =>
  key.startsWith("participant.staff."),
);

const supportedLocales = ["de", "en", "es", "fr", "it", "nl-BE", "uk"];

test("every supported locale defines the complete staff questionnaire", () => {
  assert.equal(staffTranslationKeys.length, 31);

  for (const locale of supportedLocales) {
    const source = readFileSync(
      new URL(`../lib/i18n/locales/${locale}.ts`, import.meta.url),
      "utf8",
    );

    for (const key of staffTranslationKeys) {
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      assert.match(
        source,
        new RegExp(`^[\\t ]*["']${escapedKey}["']\\s*:`, "m"),
        `${locale} must define ${key} instead of using the English fallback`,
      );
    }
  }
});
