import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const receptionComponents = [
  "app/dashboard/accoglienza/arrival-dashboard.tsx",
  "app/dashboard/accoglienza/arrival-qr-scanner.tsx",
  "app/dashboard/accoglienza/reception-group-leader-contacts.tsx",
  "app/dashboard/accoglienza/reception-logistics-section.tsx",
];

const enSource = readFileSync("lib/i18n/locales/en.ts", "utf8");
const itSource = readFileSync("lib/i18n/locales/it.ts", "utf8");

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
}

function translation(source: string, key: string): string | null {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`"${escapedKey}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`));
  return match ? JSON.parse(`"${match[1]}"`) as string : null;
}

test("reception UI keys are explicitly translated in English and Italian", () => {
  const usedKeys = new Set<string>([
    "reception.filters.status.all",
    "reception.filters.status.arrived",
    "reception.filters.status.pending",
  ]);

  for (const component of receptionComponents) {
    const source = readFileSync(component, "utf8");
    for (const match of source.matchAll(/t\("(reception\.[^"]+)"/g)) {
      usedKeys.add(match[1]);
    }
  }

  assert.ok(usedKeys.size > 70, "expected broad reception translation coverage");

  for (const key of usedKeys) {
    assert.ok(enSource.includes(`"${key}":`), `English translation missing for ${key}`);
    assert.ok(itSource.includes(`"${key}":`), `Italian translation missing for ${key}`);
    const english = translation(enSource, key);
    const italian = translation(itSource, key);
    assert.equal(typeof english, "string", `English value missing for ${key}`);
    assert.equal(typeof italian, "string", `Italian value missing for ${key}`);
    assert.deepEqual(
      placeholders(italian ?? ""),
      placeholders(english ?? ""),
      `Placeholder mismatch for ${key}`
    );
  }
});

test("reception accommodation labels never expose stored Italian values in English", () => {
  assert.equal(translation(enSource, "reception.accommodation.hotel"), "Hotel");
  assert.equal(translation(enSource, "reception.accommodation.hostel"), "Hostel");
  assert.equal(translation(enSource, "reception.accommodation.autonomous"), "Independently arranged");
  assert.equal(translation(itSource, "reception.accommodation.hotel"), "Hotel");
  assert.equal(translation(itSource, "reception.accommodation.hostel"), "Ostello");
  assert.equal(translation(itSource, "reception.accommodation.autonomous"), "Alloggio autonomo");
});
