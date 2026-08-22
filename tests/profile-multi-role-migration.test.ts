import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/profili_multi_role_migration.sql", import.meta.url),
  "utf8"
);

test("multi-role profile migration separates Auth identity from profile id", () => {
  assert.match(migration, /add column if not exists auth_user_id uuid/i);
  assert.match(migration, /drop constraint if exists profili_id_fkey/i);
  assert.match(migration, /foreign key \(auth_user_id\)[\s\S]*references auth\.users\(id\)/i);
});

test("multi-role profile migration permits one profile per normalized email and role", () => {
  assert.match(migration, /drop constraint if exists profili_email_key/i);
  assert.match(
    migration,
    /create unique index if not exists profili_email_ruolo_key[\s\S]*lower\(btrim\(email\)\), ruolo/i
  );
});

test("multi-role profile migration exposes every owned profile through RLS", () => {
  assert.match(migration, /using \(auth\.uid\(\) = auth_user_id\)/i);
  assert.match(migration, /where p\.auth_user_id = auth\.uid\(\)/i);
  assert.match(migration, /create trigger profili_set_auth_user_id/i);
});
