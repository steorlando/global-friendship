import assert from "node:assert/strict";
import test from "node:test";
import { isAppRole, roleRequiresGroups, ROLE_ROUTES } from "../lib/auth/roles.ts";
import { safePostLoginPath } from "../lib/auth/post-login.ts";
import {
  parseTourInput,
  safeAttachmentFileName,
  tourApiErrorCode,
} from "../lib/tours/validation.ts";
import { toursArePublicFromApiPayload } from "../lib/tours/visibility.ts";

test("tour_manager is a first-class app role without participant group scope", () => {
  assert.equal(isAppRole("tour_manager"), true);
  assert.equal(ROLE_ROUTES.tour_manager, "/dashboard/tour-manager");
  assert.equal(roleRequiresGroups("tour_manager"), false);
  assert.equal(roleRequiresGroups("accoglienza"), false);
  assert.equal(roleRequiresGroups("capogruppo"), true);
});

test("post-login redirect accepts only the participant tours destination", () => {
  assert.equal(
    safePostLoginPath("/dashboard/partecipante/tours", "partecipante"),
    "/dashboard/partecipante/tours"
  );
  assert.equal(safePostLoginPath("https://example.com", "partecipante"), null);
  assert.equal(safePostLoginPath("/dashboard/admin", "partecipante"), null);
  assert.equal(safePostLoginPath("/dashboard/partecipante/tours", "admin"), null);
});

test("the login tour link is enabled only by the explicit public setting", () => {
  assert.equal(
    toursArePublicFromApiPayload({ settings: { publicEnabled: true } }),
    true
  );
  assert.equal(
    toursArePublicFromApiPayload({ settings: { publicEnabled: false } }),
    false
  );
  assert.equal(toursArePublicFromApiPayload({ settings: {} }), false);
  assert.equal(toursArePublicFromApiPayload(null), false);
});

test("tour input is normalized and capacity is bounded", () => {
  assert.deepEqual(
    parseTourInput({
      title: "  City centre  ",
      description: "  Guided walk  ",
      maxParticipants: "25",
      contactEmail: " guide@example.com ",
    }),
    {
      title: "City centre",
      description: "Guided walk",
      maxParticipants: 25,
      contactName: null,
      contactPhone: null,
      contactEmail: "guide@example.com",
      isActive: true,
    }
  );
  assert.throws(
    () => parseTourInput({ title: "Tour", description: "Text", maxParticipants: 0 }),
    /TOUR_CAPACITY_INVALID/
  );
});

test("attachment names and database errors are safe for API responses", () => {
  assert.equal(safeAttachmentFileName("Programma città (finale).pdf"), "Programma-citta-finale-.pdf");
  assert.equal(tourApiErrorCode(new Error("duplicate: TOUR_FULL")), "TOUR_FULL");
  assert.equal(
    tourApiErrorCode(new Error("TOUR_RESERVED_FOR_WAITLIST")),
    "TOUR_RESERVED_FOR_WAITLIST"
  );
  assert.equal(tourApiErrorCode(new Error("database unavailable")), "TOUR_OPERATION_FAILED");
});
