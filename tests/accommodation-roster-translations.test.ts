import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildAccommodationHotelRosterXlsxColumns } from "../lib/alloggi/operations-presentation.ts";
import en from "../lib/i18n/locales/en.ts";

const itSource = readFileSync(
  new URL("../lib/i18n/locales/it.ts", import.meta.url),
  "utf8",
);

test("room rosters distinguish physical room number from internal ID number", () => {
  assert.equal(en["accommodation.rosters.common.realRoom"], "Room number");
  assert.equal(en["accommodation.rosters.common.room"], "Internal ID Number");
  assert.match(
    itSource,
    /"accommodation\.rosters\.common\.realRoom": "Stanza numero"/,
  );
  assert.match(
    itSource,
    /"accommodation\.rosters\.common\.room": "Numero ID interno"/,
  );
});

test("room inventory uses the same physical and internal room terminology", () => {
  assert.equal(en["accommodation.inventory.table.realRoomNumber"], "Room number");
  assert.equal(en["accommodation.inventory.table.internalCode"], "Internal ID Number");
  assert.match(
    itSource,
    /"accommodation\.inventory\.table\.realRoomNumber": "Stanza numero"/,
  );
  assert.match(
    itSource,
    /"accommodation\.inventory\.table\.internalCode": "Numero ID interno"/,
  );
});

test("hotel roster XLSX exposes both physical room number and internal ID number", () => {
  const columns = buildAccommodationHotelRosterXlsxColumns({
    hotel: en["accommodation.rosters.common.hotel"],
    room: en["accommodation.rosters.common.room"],
    availableFrom: en["accommodation.rosters.common.availableFrom"],
    availableTo: en["accommodation.rosters.common.availableTo"],
    realRoom: en["accommodation.rosters.common.realRoom"],
    group: en["accommodation.rosters.common.group"],
    participant: en["accommodation.rosters.common.participant"],
    sex: en["accommodation.rosters.common.sex"],
    age: en["accommodation.rosters.common.age"],
    arrival: en["accommodation.rosters.common.arrival"],
    departure: en["accommodation.rosters.common.departure"],
    email: en["accommodation.rosters.common.email"],
  });

  assert.deepEqual(
    columns.filter((column) => column.key === "room" || column.key === "realRoom"),
    [
      { key: "room", label: "Internal ID Number" },
      { key: "realRoom", label: "Room number" },
    ],
  );
});
