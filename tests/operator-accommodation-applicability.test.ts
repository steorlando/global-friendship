import { strict as assert } from "node:assert";
import test from "node:test";
import { isAutonomousAccommodation } from "../lib/partecipante/constants.ts";

test("operator accommodation preference is not applicable to autonomous accommodation", () => {
  assert.equal(isAutonomousAccommodation("Atonoumous"), true);
  assert.equal(isAutonomousAccommodation("Autonomous"), true);
  assert.equal(
    isAutonomousAccommodation(
      "I arranged my own accommodation / Ho trovato un alloggio autonomamente"
    ),
    true
  );
  assert.equal(isAutonomousAccommodation("Provided by organization"), false);
  assert.equal(isAutonomousAccommodation(null), false);
});
