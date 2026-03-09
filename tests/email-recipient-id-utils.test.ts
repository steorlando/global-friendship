import { strict as assert } from "node:assert";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  buildRecipientIdsClipboardText,
  excludeRecipientsById,
  parseRecipientIdsFromText,
} from "../lib/email/recipient-id-utils.ts";
import {
  buildParticipantRegistrationConfirmationSubject,
  buildParticipantRegistrationConfirmationText,
} from "../lib/email/participant-registration-confirmation-template.ts";

const ID_1 = "6f40f01e-8d63-4fcb-95f6-7b0f6bf4960d";
const ID_2 = "f2e81b7f-e26f-47cc-a1f2-3692305bca18";
const ID_3 = "4bc7fbb2-68f2-4a5f-91de-f2bb0f9c8acc";

test("parseRecipientIdsFromText parses comma-separated IDs", () => {
  const parsed = parseRecipientIdsFromText(`${ID_1},${ID_2},`);
  assert.deepEqual(parsed, [ID_1, ID_2]);
});

test("parseRecipientIdsFromText parses newline-separated IDs", () => {
  const parsed = parseRecipientIdsFromText(`${ID_1}\n${ID_2}\n\n${ID_3}`);
  assert.deepEqual(parsed, [ID_1, ID_2, ID_3]);
});

test("parseRecipientIdsFromText parses mixed separators and removes duplicates", () => {
  const parsed = parseRecipientIdsFromText(
    `already_contacted: ${ID_1}, ${ID_2}\n${ID_2}   ${ID_3};`
  );
  assert.deepEqual(parsed, [ID_1, ID_2, ID_3]);
});

test("parseRecipientIdsFromText ignores invalid and blank tokens", () => {
  const parsed = parseRecipientIdsFromText(`, , \n invalid-id\n ${ID_1}\nnot-a-uuid`);
  assert.deepEqual(parsed, [ID_1]);
});

test("buildRecipientIdsClipboardText returns newline-separated unique IDs", () => {
  const payload = buildRecipientIdsClipboardText([ID_1.toUpperCase(), ID_2, ID_1]);
  assert.equal(payload, `${ID_1}\n${ID_2}`);
});

test("excludeRecipientsById removes only excluded IDs", () => {
  const recipients = [{ id: ID_1 }, { id: ID_2 }, { id: ID_3 }];
  const excluded = new Set([ID_2]);
  const filtered = excludeRecipientsById(recipients, excluded);

  assert.deepEqual(
    filtered.map((item) => item.id),
    [ID_1, ID_3]
  );
});

test("send log detail exposes a copy action label", () => {
  const filePath = path.resolve(
    "app/dashboard/_components/email-send-log-recipient-list.tsx"
  );
  const source = fs.readFileSync(filePath, "utf8");

  assert.ok(
    source.includes("Copy recipient IDs"),
    "Expected copy action label to be present in send log detail recipient section."
  );
});

test("participant registration confirmation email includes key summary and edit instructions", () => {
  const subject = buildParticipantRegistrationConfirmationSubject({
    nome: "Luca",
    cognome: "Rossi",
    email: "luca.rossi@example.com",
    emailSecondaria: null,
    telefono: "+39 333 1111111",
    nazione: "Italy",
    paeseResidenza: "Italy",
    citta: "Rome",
    tipoIscrizione: "Higher students",
    sesso: "Male",
    dataNascita: "2001-02-03",
    dataArrivo: "2026-10-25",
    dataPartenza: "2026-10-28",
    alloggio: "Provided by organization",
    esigenzeAlimentari: "Vegetarian",
    allergie: "Peanuts",
    disabilitaAccessibilita: true,
    difficoltaAccessibilita: "I need assistance during the event",
    partecipaInteroEvento: true,
    presenzaDettaglio: { Friday: true, Saturday: true, Sunday: true },
    gruppoId: "rome-centre",
    gruppoLabel: "Rome Centre",
    note: "Will arrive in the morning",
  });

  const text = buildParticipantRegistrationConfirmationText({
    nome: "Luca",
    cognome: "Rossi",
    email: "luca.rossi@example.com",
    emailSecondaria: null,
    telefono: "+39 333 1111111",
    nazione: "Italy",
    paeseResidenza: "Italy",
    citta: "Rome",
    tipoIscrizione: "Higher students",
    sesso: "Male",
    dataNascita: "2001-02-03",
    dataArrivo: "2026-10-25",
    dataPartenza: "2026-10-28",
    alloggio: "Provided by organization",
    esigenzeAlimentari: "Vegetarian",
    allergie: "Peanuts",
    disabilitaAccessibilita: true,
    difficoltaAccessibilita: "I need assistance during the event",
    partecipaInteroEvento: true,
    presenzaDettaglio: { Friday: true, Saturday: true, Sunday: true },
    gruppoId: "rome-centre",
    gruppoLabel: "Rome Centre",
    note: "Will arrive in the morning",
  });

  assert.equal(subject, "Registration received: Luca Rossi");
  assert.ok(text.includes("We have received your registration successfully."));
  assert.ok(text.includes("- First name: Luca"));
  assert.ok(text.includes("- Last name: Rossi"));
  assert.ok(text.includes("- Group: Rome Centre"));
  assert.ok(text.includes("https://portal.globalfriendship.eu"));
  assert.ok(
    text.includes(
      "use the same email address you registered with: luca.rossi@example.com"
    )
  );
});

test("participant registration confirmation email omits secondary email and cleans malformed accessibility details", () => {
  const text = buildParticipantRegistrationConfirmationText({
    nome: "Anna",
    cognome: "Bianchi",
    email: "anna@example.com",
    emailSecondaria: "anna.secondary@example.com",
    telefono: "",
    nazione: "",
    paeseResidenza: "",
    citta: "",
    tipoIscrizione: "",
    sesso: "",
    dataNascita: "",
    dataArrivo: "",
    dataPartenza: "",
    alloggio: "",
    esigenzeAlimentari: "",
    allergie: "",
    disabilitaAccessibilita: null,
    difficoltaAccessibilita:
      "Difficulty seeing, even when wearing glasses, Select all that apply) (Difficulty seeing, even when wearing glasses",
    partecipaInteroEvento: null,
    presenzaDettaglio: null,
    gruppoId: "",
    gruppoLabel: "",
    note: "",
  });

  assert.ok(!text.includes("Secondary email:"));
  assert.ok(!text.includes("Phone:"));
  assert.ok(!text.includes("Group:"));
  assert.ok(
    text.includes(
      "- Accessibility details: Difficulty seeing, even when wearing glasses"
    )
  );
  assert.ok(!text.includes("Select all that apply"));
});
