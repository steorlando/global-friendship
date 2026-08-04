import assert from "node:assert/strict";
import test from "node:test";
import { type SupabaseClient } from "@supabase/supabase-js";
import {
  deleteGroupLeaderProfiloById,
  ProfiloDeletionError,
} from "../lib/admin/profile-deletion.ts";

type ProfileRow = {
  id: string;
  email: string;
  ruolo: string;
};

function createSupabaseMock(existing: ProfileRow | null) {
  let deleting = false;
  const deleteFilters: Array<[string, unknown]> = [];

  const query = {
    select() {
      return query;
    },
    delete() {
      deleting = true;
      return query;
    },
    eq(column: string, value: unknown) {
      if (deleting) deleteFilters.push([column, value]);
      return query;
    },
    async maybeSingle() {
      if (!deleting) return { data: existing, error: null };

      const matchesRole = deleteFilters.some(
        ([column, value]) => column === "ruolo" && value === "capogruppo"
      );
      return {
        data:
          existing?.ruolo === "capogruppo" && matchesRole
            ? { id: existing.id, email: existing.email }
            : null,
        error: null,
      };
    },
  };

  return {
    client: {
      from(table: string) {
        assert.equal(table, "profili");
        return query;
      },
    } as unknown as SupabaseClient,
    deleteFilters,
  };
}

test("deletes a group leader profile with both id and role guards", async () => {
  const mock = createSupabaseMock({
    id: "profile-1",
    email: "leader@example.com",
    ruolo: "capogruppo",
  });

  const deleted = await deleteGroupLeaderProfiloById(mock.client, " profile-1 ");

  assert.deepEqual(deleted, {
    id: "profile-1",
    email: "leader@example.com",
  });
  assert.deepEqual(mock.deleteFilters, [
    ["id", "profile-1"],
    ["ruolo", "capogruppo"],
  ]);
});

test("refuses to delete profiles with another role", async () => {
  const mock = createSupabaseMock({
    id: "profile-2",
    email: "manager@example.com",
    ruolo: "manager",
  });

  await assert.rejects(
    deleteGroupLeaderProfiloById(mock.client, "profile-2"),
    (error: unknown) =>
      error instanceof ProfiloDeletionError &&
      error.status === 400 &&
      error.message === "Only group leader profiles can be deleted from this page"
  );
  assert.deepEqual(mock.deleteFilters, []);
});

test("returns not found when the profile does not exist", async () => {
  const mock = createSupabaseMock(null);

  await assert.rejects(
    deleteGroupLeaderProfiloById(mock.client, "missing-profile"),
    (error: unknown) =>
      error instanceof ProfiloDeletionError && error.status === 404
  );
});
