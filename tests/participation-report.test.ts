import assert from "node:assert/strict";
import test from "node:test";
import {
  buildParticipationReportModel,
  buildPreviousParticipationSnapshotFromRows,
  type ParticipationParticipant,
  type PreviousParticipationSnapshot,
} from "../lib/statistics/participation-report.ts";
import { canGenerateParticipationReport } from "../lib/statistics/participation-report-access.ts";

function participant(
  id: string,
  registrationType: string,
  country: string,
  city: string,
  group: string,
): ParticipationParticipant {
  return {
    id,
    nome: `Nome ${id}`,
    cognome: `Cognome ${id}`,
    tipo_iscrizione: registrationType,
    paese_residenza: country,
    nazione: null,
    citta: city,
    gruppo_label: group,
    gruppo_id: group,
  };
}

test("only an admin profile may generate the participation report", () => {
  assert.equal(canGenerateParticipationReport([{ ruolo: "admin" }]), true);
  assert.equal(canGenerateParticipationReport([{ ruolo: "manager" }]), false);
  assert.equal(canGenerateParticipationReport([{ ruolo: null }]), false);
  assert.equal(
    canGenerateParticipationReport([
      { ruolo: "manager" },
      { ruolo: "admin" },
    ]),
    true,
  );
});

test("the report model uses app enrollment buckets and excludes drivers", () => {
  const previous: PreviousParticipationSnapshot = {
    year: 2025,
    source: { file: "last_db.xlsx", sheet: "Sheet1", rows: 7 },
    categoryCounts: {},
    youngByCountry: {
      Italy: 5,
      Spain: 1,
      Argentina: 1,
      France: 1,
      Colombia: 1,
      Guatemala: 1,
      Honduras: 1,
      Mexico: 1,
      Peru: 1,
    },
    youngByItalianCity: { Roma: 5 },
    youngByRomeGroup: {
      "Liceali Nomentano": 2,
      Nomentano: 3,
      Acilia: 1,
    },
  };
  const participants = [
    participant("1", "Higher student - liceale (14-18 years old)", "Italy", "Roma", "Nomentano"),
    participant("2", "Undergraduate - universitario(18-25 years old)", "Italy", "Roma", "Nomentano"),
    participant("3", "Operator - Operatore", "Italy", "Roma", "Nomentano"),
    participant("4", "Driver - Autista", "Italy", "Roma", "Nomentano"),
    participant("5", "Worker - lavoratore (18-25 years old)", "Spain", "Madrid", "Spain"),
    participant("6", "Operator - Operatore", "Italy", "Roma", "Marconi"),
  ];
  participants[2].nome = "Zoe";
  participants[2].cognome = "Alpha";
  participants[5].nome = "Aaron";
  participants[5].cognome = "Zulu";

  const model = buildParticipationReportModel({ participants, previous });
  assert.deepEqual(model.summary, {
    active: 6,
    activeWithoutDrivers: 5,
    higherStudents: 1,
    universityWorker: 2,
    young: 3,
    operators: 2,
    drivers: 1,
    reported: 5,
  });
  assert.equal(model.operators.length, 2);
  assert.equal(model.operators[0]?.fullName, "Aaron Zulu");
  assert.equal(model.operators[1]?.fullName, "Zoe Alpha");
  assert.equal(
    model.current.romeGroupRows.some((row) => row.label === "Marconi"),
    false,
  );

  const rome = model.current.romeGroupRows.find((row) => row.label === "Nomentano");
  assert.deepEqual(rome, {
    key: "nomentano",
    label: "Nomentano",
    higherStudents: 1,
    universityWorker: 1,
    operator: 1,
    total: 3,
  });

  const comparison = model.comparison.romeGroupRows.find(
    (row) => row.label === "Nomentano",
  );
  assert.equal(comparison?.previous, 5);
  assert.equal(comparison?.current, 2);
  assert.equal(comparison?.absoluteChange, -3);
  assert.equal(comparison?.percentageChange, -0.6);

  const oldOnly = model.comparison.countryRows.find(
    (row) => row.label === "Francia",
  );
  assert.equal(oldOnly?.previous, 1);
  assert.equal(oldOnly?.current, null);
  assert.equal(oldOnly?.absoluteChange, null);
  assert.equal(oldOnly?.percentageChange, null);
  assert.equal(
    model.comparison.countryRows.some((row) => row.label === "Argentina"),
    false,
  );
  assert.equal(
    model.comparison.countryRows.some((row) => row.label === "Colombia"),
    false,
  );
  assert.equal(
    model.comparison.countryRows.some((row) => row.label === "Guatemala"),
    false,
  );
  assert.equal(
    model.comparison.countryRows.some((row) => row.label === "Honduras"),
    false,
  );
  assert.equal(
    model.comparison.countryRows.some((row) => row.label === "Messico"),
    false,
  );
  assert.equal(
    model.comparison.countryRows.some((row) => row.label === "Perù"),
    false,
  );
});

test("the previous-year workbook extractor aggregates only young participants", () => {
  const snapshot = buildPreviousParticipationSnapshotFromRows({
    year: 2025,
    sourceFile: "last_db.xlsx",
    sheetName: "Sheet1",
    rows: [
      {
        type: "Higher student - liceale (14-18 years old)",
        country: "Italy",
        city: "Roma",
        gruppo_roma: "Superiori Primavalle",
      },
      {
        type: "Operator - Operatore",
        country: "Italy",
        city: "Roma",
        gruppo_roma: "Superiori Primavalle",
      },
      {
        type: "Worker - lavoratore (18-25 years old)",
        country: "Spain",
        city: "Madrid",
        gruppo_roma: null,
      },
    ],
  });

  assert.equal(snapshot.categoryCounts.higherStudents, 1);
  assert.equal(snapshot.categoryCounts.operator, 1);
  assert.equal(snapshot.categoryCounts.universityWorker, 1);
  assert.deepEqual(snapshot.youngByCountry, { Italy: 1, Spain: 1 });
  assert.deepEqual(snapshot.youngByItalianCity, { Roma: 1 });
  assert.deepEqual(snapshot.youngByRomeGroup, { "Superiori Primavalle": 1 });
});
