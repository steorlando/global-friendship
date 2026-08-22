import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildHostelCheckInGroupSummary,
  canManageParticipantHostelCheckIn,
  normalizeHostelCheckInInput,
  participantMayNeedHostelCheckIn,
  type HostelCheckInStatus,
} from "../lib/alloggi/check-in.ts";

test("allows participants, managers, admins, or assigned group leaders to manage hostel check-in", () => {
  assert.equal(
    canManageParticipantHostelCheckIn({
      accountEmail: "participant@example.org",
      participantEmail: " Participant@example.org ",
    }),
    true
  );
  assert.equal(
    canManageParticipantHostelCheckIn({
      accountEmail: "manager@example.org",
      participantEmail: "participant@example.org",
      hasStaffAccess: true,
    }),
    true
  );
  assert.equal(
    canManageParticipantHostelCheckIn({
      accountEmail: "admin@example.org",
      participantEmail: "participant@example.org",
      hasStaffAccess: true,
    }),
    true
  );
  assert.equal(
    canManageParticipantHostelCheckIn({
      accountEmail: "leader@example.org",
      participantEmail: "participant@example.org",
      groupLeaderGroups: ["Budapest", "Roma"],
      participantGroupId: "Roma",
    }),
    true
  );
  assert.equal(
    canManageParticipantHostelCheckIn({
      accountEmail: "leader@example.org",
      participantEmail: "participant@example.org",
      groupLeaderGroups: ["Budapest"],
      participantGroupLabel: "Roma",
    }),
    false
  );
});

test("exposes hostel check-in editing on manager and admin participant cards", () => {
  const managerPage = readFileSync(
    new URL("../app/dashboard/manager/participants/page.tsx", import.meta.url),
    "utf8"
  );
  const adminPage = readFileSync(
    new URL("../app/dashboard/admin/participants/page.tsx", import.meta.url),
    "utf8"
  );
  const statisticsModal = readFileSync(
    new URL(
      "../app/dashboard/manager/statistics-participant-edit-modal.tsx",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(managerPage, /allowHostelCheckInEditing/);
  assert.match(adminPage, /allowHostelCheckInEditing/);
  assert.match(
    statisticsModal,
    /pathname\.startsWith\("\/dashboard\/manager"\)/
  );
  assert.match(
    statisticsModal,
    /pathname\.startsWith\("\/dashboard\/admin"\)/
  );
});

test("normalizes a complete hostel check-in payload", () => {
  const result = normalizeHostelCheckInInput({
    identityDocumentType: "passport",
    identityDocumentNumber: "  YA123456  ",
    identityDocumentCountry: " Italy ",
    identityDocumentIssuingCity: " Rome ",
    identityDocumentIssueDate: "2024-01-15",
    identityDocumentExpirationDate: "2034-01-14",
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.value, {
    identityDocumentType: "passport",
    identityDocumentNumber: "YA123456",
    identityDocumentCountry: "Italy",
    identityDocumentIssuingCity: "Rome",
    identityDocumentIssueDate: "2024-01-15",
    identityDocumentExpirationDate: "2034-01-14",
  });
});

test("rejects invalid document types and reversed dates", () => {
  const invalidType = normalizeHostelCheckInInput({
    identityDocumentType: "library_card",
    identityDocumentNumber: "123",
    identityDocumentCountry: "Italy",
    identityDocumentIssuingCity: "Rome",
    identityDocumentIssueDate: "2024-01-15",
    identityDocumentExpirationDate: "2034-01-14",
  });
  assert.equal(invalidType.ok, false);

  const invalidDates = normalizeHostelCheckInInput({
    identityDocumentType: "national_id",
    identityDocumentNumber: "123",
    identityDocumentCountry: "Italy",
    identityDocumentIssuingCity: "Rome",
    identityDocumentIssueDate: "2034-01-15",
    identityDocumentExpirationDate: "2024-01-14",
  });
  assert.equal(invalidDates.ok, false);
});

test("builds group statistics only from assigned hostel participants", () => {
  const participants = [
    { id: "a", group: "Roma" },
    { id: "b", group: "Roma" },
    { id: "c", group: "Paris" },
    { id: "d", group: "Hotel operators" },
  ];
  const statuses = new Map<string, HostelCheckInStatus>([
    ["a", "completed"],
    ["b", "pending"],
    ["c", "pending"],
    ["d", "not_applicable"],
  ]);

  assert.deepEqual(buildHostelCheckInGroupSummary(participants, statuses), [
    { group: "Paris", completed: 0, pending: 1, total: 1 },
    { group: "Roma", completed: 1, pending: 1, total: 2 },
  ]);
});

test("excludes autonomous stays and hotel operators from hostel check-in", () => {
  assert.equal(
    participantMayNeedHostelCheckIn({
      alloggio_short: "Atonoumous",
      tipo_iscrizione: "Worker - lavoratore (18-25 years old)",
    }),
    false
  );
  assert.equal(
    participantMayNeedHostelCheckIn({
      alloggio_short: "Provided by organization",
      tipo_iscrizione: "Operator - Operatore",
      preferenza_alloggio_operatore: "Hotel",
    }),
    false
  );
  assert.equal(
    participantMayNeedHostelCheckIn({
      alloggio_short: "Provided by organization",
      tipo_iscrizione: "Operator - Operatore",
      preferenza_alloggio_operatore: "Hostel with group",
    }),
    true
  );
});
