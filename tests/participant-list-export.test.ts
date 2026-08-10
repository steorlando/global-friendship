import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";

import {
  buildParticipantAssignmentExportDetails,
  buildParticipantListWorkbook,
  participantAccommodationType,
  participantRegistrationTypeLabel,
  type ParticipantListExportRow,
} from "../lib/participants/participants-export.ts";

const baseRow: ParticipantListExportRow = {
  id: "participant-one",
  nome: "Maria",
  cognome: "Rossi",
  gruppo_label: "Roma",
  gruppo_id: null,
  tipo_iscrizione: "Higher student - liceale (14-18 years old)",
  eta: 17,
  sesso: "Female",
  data_arrivo: "2026-08-27",
  data_partenza: "2026-08-31",
  alloggio: null,
  alloggio_short: "Provided by organization",
  preferenza_alloggio_operatore: null,
  assigned_hostel_name: null,
  assigned_room_name: null,
  has_room_assignment: false,
};

test("normalizes the four requested registration types", () => {
  assert.equal(participantRegistrationTypeLabel(baseRow.tipo_iscrizione), "Higher student");
  assert.equal(
    participantRegistrationTypeLabel("Undergraduate - universitario(18-25 years old)"),
    "University",
  );
  assert.equal(
    participantRegistrationTypeLabel("Worker - lavoratore (18-25 years old)"),
    "University",
  );
  assert.equal(participantRegistrationTypeLabel("Operator - Operatore"), "Operator");
  assert.equal(participantRegistrationTypeLabel("Driver - Autista"), "Driver");
});

test("marks only hostel participants without a room as to be assigned", () => {
  assert.equal(participantAccommodationType(baseRow), "Ostello");
  assert.equal(
    participantAccommodationType({
      ...baseRow,
      alloggio_short: "Atonoumous",
    }),
    "Propria",
  );
  assert.equal(
    participantAccommodationType({
      ...baseRow,
      tipo_iscrizione: "Operator - Operatore",
      preferenza_alloggio_operatore: "Hotel",
    }),
    "Hotel",
  );
});

test("resolves the assigned hostel and the real room number", () => {
  const details = buildParticipantAssignmentExportDetails(
    [{ partecipante_id: "participant-one", stanza_id: "room-one" }],
    [
      {
        id: "room-one",
        albergo_id: "hostel-one",
        numero_reale: "203",
        nome: "Legacy room",
        codice_interno: "OS-04-A",
      },
    ],
    [{ id: "hostel-one", nome: "Ostello San Marco" }],
  );

  assert.deepEqual(details.get("participant-one"), {
    hostelName: "Ostello San Marco",
    roomName: "203",
    hasRoomAssignment: true,
  });
});

test("creates the complete participant Excel export with boolean assignment status", () => {
  const file = buildParticipantListWorkbook([
    baseRow,
    {
      ...baseRow,
      id: "participant-two",
      nome: "Luca",
      cognome: "Bianchi",
      tipo_iscrizione: "Driver - Autista",
      assigned_hostel_name: "Maverick Hostel",
      assigned_room_name: "203",
      has_room_assignment: true,
    },
    {
      ...baseRow,
      id: "participant-three",
      nome: "Anna",
      cognome: "Verdi",
      tipo_iscrizione: "Operator - Operatore",
      preferenza_alloggio_operatore: "Hotel",
    },
    {
      ...baseRow,
      id: "participant-four",
      nome: "Paolo",
      cognome: "Neri",
      alloggio_short: "Atonoumous",
    },
  ]);
  const workbook = XLSX.read(file, { type: "buffer", cellDates: true });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json<Array<string | number | boolean | Date>>(
    worksheet,
    { header: 1, raw: true },
  );

  assert.equal(worksheet["!autofilter"]?.ref, "A1:L5");
  assert.deepEqual(matrix[0], [
    "Nome",
    "Cognome",
    "Gruppo di appartenenza",
    "Tipo iscrizione",
    "Età",
    "Sesso",
    "Data di arrivo",
    "Data di partenza",
    "Tipo sistemazione",
    "Ostello assegnato",
    "Stanza assegnata",
    "Da assegnare",
  ]);
  assert.equal(matrix[1][8], "Ostello");
  assert.equal(matrix[1][11], true);
  assert.equal(matrix[2][3], "Driver");
  assert.equal(matrix[2][9], "Maverick Hostel");
  assert.equal(matrix[2][10], "203");
  assert.equal(matrix[2][11], false);
  assert.equal(matrix[3][8], "Hotel");
  assert.equal(matrix[3][11], false);
  assert.equal(matrix[4][8], "Propria");
  assert.equal(matrix[4][11], false);
  assert.ok(matrix[1][6] instanceof Date);
  assert.ok(matrix[1][7] instanceof Date);
});
