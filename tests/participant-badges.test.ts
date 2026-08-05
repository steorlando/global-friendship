import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildParticipantBadgesPdf,
  sortParticipantBadges,
  toParticipantBadgeContent,
  type ParticipantBadgeRow,
} from "../lib/statistics/participant-badges.ts";

const participants: ParticipantBadgeRow[] = [
  {
    id: "2",
    nome: "  Helena Maria ",
    cognome: "Dąbrowa-Kostka",
    paese_residenza: "Denmark",
    nazione: null,
    citta: "Copenaghen",
  },
  {
    id: "1",
    nome: "Dorottya",
    cognome: "Bánás",
    paese_residenza: "Hungary",
    nazione: null,
    citta: "Budapest",
  },
  {
    id: "3",
    nome: "Maritza Guadalupe",
    cognome: "Cicarelli Vasquez Bastidas",
    paese_residenza: null,
    nazione: "Italy",
    citta: "Roma",
  },
  {
    id: "4",
    nome: "Aaron",
    cognome: "Zulu",
    paese_residenza: "Denmark",
    nazione: null,
    citta: "Copenaghen",
  },
  {
    id: "5",
    nome: "Zoe",
    cognome: "Alpha",
    paese_residenza: "Denmark",
    nazione: null,
    citta: "Copenaghen",
  },
];

test("formats badge name and community without changing diacritics", () => {
  assert.deepEqual(toParticipantBadgeContent(participants[0]), {
    id: "2",
    fullName: "Helena Maria Dąbrowa-Kostka",
    community: "Denmark, Copenaghen",
  });
});

test("sorts badges by country, city, first name, and surname", () => {
  assert.deepEqual(
    sortParticipantBadges(participants).map((participant) => participant.id),
    ["4", "2", "5", "1", "3"],
  );
});

test("builds one compact PDF page per participant", async () => {
  const [backgroundJpeg, fontTtf] = await Promise.all([
    readFile("data/badges/badge-v2-background.jpg"),
    readFile("node_modules/dejavu-fonts-ttf/ttf/DejaVuSansCondensed-Bold.ttf"),
  ]);
  const pdf = buildParticipantBadgesPdf({
    participants,
    backgroundJpeg,
    fontTtf,
  });
  const text = Buffer.from(pdf).toString("latin1");

  assert.equal(Buffer.from(pdf.subarray(0, 4)).toString("ascii"), "%PDF");
  assert.equal((text.match(/\/Type \/Page\b/g) ?? []).length, participants.length);
  assert.match(text, /\/MediaBox \[0 0 283\.4646 425\.1969\]/);
  assert.ok(pdf.byteLength < 1_500_000);
});
