import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";

import {
  buildFoodNeedsSummary,
  detectedFoodTextCategories,
  describeDietaryRequirements,
  dietaryOtherDetails,
  hasFoodNeedsDeclaration,
  hasMeaningfulAllergyText,
  matchesFoodNeedsFilter,
  parseDietarySelections,
  parseFoodNeedsFilter,
} from "../lib/statistics/food-needs.ts";
import { buildFoodNeedsWorkbook } from "../lib/statistics/food-needs-export.ts";
import { buildAssignedHostelNameByParticipant } from "../lib/statistics/food-needs-hostels.ts";

const rows = [
  {
    esigenze_alimentari: "Vegetarian, Gluten free, Other",
    allergie: "No",
  },
  {
    esigenze_alimentari: "Vegan, I don't eat pork",
    allergie: "Nuts",
  },
  {
    esigenze_alimentari: "false",
    allergie: null,
  },
  {
    esigenze_alimentari: "Celiach's, Other",
    allergie: "Nessuna/ nothing",
  },
  {
    esigenze_alimentari: null,
    allergie: "Intollerante al lattosio e alle proteine del latte",
  },
  {
    esigenze_alimentari: null,
    allergie: "Ja, ik eet geen garnaal.",
  },
];

test("counts every food-needs category once per participant", () => {
  assert.deepEqual(buildFoodNeedsSummary(rows), {
    vegetarian: 1,
    vegan: 1,
    no_pork: 1,
    other: 2,
    allergies: 3,
    gluten_celiac: 2,
    lactose_dairy: 1,
    nuts_peanuts: 1,
    fish_shellfish: 1,
  });
});

test("parses supported filters and matches individual metrics", () => {
  assert.equal(parseFoodNeedsFilter("no_pork"), "no_pork");
  assert.equal(parseFoodNeedsFilter("unknown"), null);
  assert.equal(matchesFoodNeedsFilter(rows[0], "vegetarian"), true);
  assert.equal(matchesFoodNeedsFilter(rows[0], "vegan"), false);
  assert.equal(matchesFoodNeedsFilter(rows[1], "allergies"), true);
  assert.equal(matchesFoodNeedsFilter(rows[0], "allergies"), false);
  assert.equal(matchesFoodNeedsFilter(rows[3], "gluten_celiac"), true);
  assert.equal(matchesFoodNeedsFilter(rows[4], "lactose_dairy"), true);
  assert.equal(matchesFoodNeedsFilter(rows[5], "fish_shellfish"), true);
});

test("keeps custom other details and ignores the technical false value", () => {
  assert.deepEqual(parseDietarySelections(rows[0].esigenze_alimentari), [
    "Vegetarian",
    "Other",
  ]);
  assert.equal(dietaryOtherDetails(rows[0].esigenze_alimentari), "Gluten free");
  assert.equal(
    describeDietaryRequirements(rows[0]),
    "Vegetarian; Other; Gluten free",
  );
  assert.equal(hasFoodNeedsDeclaration(rows[0]), true);
  assert.equal(hasFoodNeedsDeclaration(rows[2]), false);
});

test("excludes negative allergy answers in multiple languages", () => {
  const negativeAnswers = [
    "No",
    "None",
    "Nothing",
    "Nessuna",
    "Nulla",
    "Niente",
    "Nessuna/ nothing",
    "Non ho allergie",
    "No, non ho nessuna allergie e intolleranze",
    "I dont have allergie.",
    "Nein",
    "Keine Allergien",
    "Nee",
    "Geen allergieën",
    "Aucune allergie",
    "Ninguna",
    "Nenhuma alergia",
    "Нет",
    "/",
  ];
  for (const answer of negativeAnswers) {
    assert.equal(hasMeaningfulAllergyText(answer), false, answer);
  }
  assert.equal(hasMeaningfulAllergyText("NO LACTOSE"), true);
});

test("detects recurring disorders across spelling and language variants", () => {
  assert.deepEqual(
    detectedFoodTextCategories({
      esigenze_alimentari: "Dieta senza glutine, Other",
      allergie: "Lactose intolerantie; frutta secca; shrimps",
    }),
    ["gluten_celiac", "lactose_dairy", "nuts_peanuts", "fish_shellfish"],
  );
  assert.deepEqual(
    detectedFoodTextCategories({
      esigenze_alimentari: "Celiach's, Other",
      allergie: "No",
    }),
    ["gluten_celiac"],
  );
});

test("resolves the assigned hostel through the participant room assignment", () => {
  const assignedHostels = buildAssignedHostelNameByParticipant(
    [
      { partecipante_id: "participant-one", stanza_id: "room-one" },
      { partecipante_id: "participant-without-room", stanza_id: null },
    ],
    [{ id: "room-one", albergo_id: "hostel-one" }],
    [{ id: "hostel-one", nome: "  Ostello San Marco  " }],
  );

  assert.equal(assignedHostels.get("participant-one"), "Ostello San Marco");
  assert.equal(assignedHostels.has("participant-without-room"), false);
});

test("creates a complete Excel list with contacts, details and allergies", () => {
  const file = buildFoodNeedsWorkbook([
    {
      id: "participant-one",
      personal_code: "16",
      email: "maria@example.org",
      telefono: "+39 333 1234567",
      nome: "Maria",
      cognome: "Rossi",
      gruppo_label: "Roma",
      gruppo_id: null,
      deleted_at: null,
      esigenze_alimentari: rows[0].esigenze_alimentari,
      allergie: rows[0].allergie,
      assigned_hostel_name: "Ostello San Marco",
    },
  ]);
  const workbook = XLSX.read(file, { type: "buffer" });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json<string[]>(worksheet, {
    header: 1,
    raw: false,
  });

  assert.equal(worksheet["!autofilter"]?.ref, "A1:K2");
  assert.deepEqual(matrix[0], [
    "ID",
    "Email",
    "Telefono",
    "Nome",
    "Cognome",
    "Gruppo",
    "Ostello assegnato",
    "Esigenze alimentari",
    "Altro / Dettaglio",
    "Allergie / Intolleranze",
    "Categorie rilevate nel testo",
  ]);
  assert.deepEqual(matrix[1], [
    "0016",
    "maria@example.org",
    "+39 333 1234567",
    "Maria",
    "Rossi",
    "Roma",
    "Ostello San Marco",
    "Vegetarian; Other; Gluten free",
    "Gluten free",
    "",
    "Celiachia / senza glutine",
  ]);
});
