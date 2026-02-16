import { type SupabaseClient } from "@supabase/supabase-js";
import { isAppRole } from "@/lib/auth/roles";

export type ProfiloInput = {
  email: string;
  nome: string | null;
  cognome: string | null;
  ruolo: string;
  telefono?: string | null;
  italia?: boolean | null;
  roma?: boolean | null;
  groups?: string[] | null;
};

type ProfiloRow = {
  id: string;
  email: string;
  nome: string | null;
  cognome: string | null;
  ruolo: string;
  telefono: string | null;
  italia: boolean | null;
  roma: boolean | null;
  created_at: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeText(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function ensureRole(ruolo: string): string {
  if (!isAppRole(ruolo)) {
    throw new Error(`Invalid role: ${ruolo}`);
  }
  return ruolo;
}

async function findAuthUserIdByEmail(
  supabase: SupabaseClient,
  email: string
): Promise<string | null> {
  const { data, error } = await supabase
    .schema("auth")
    .from("users")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  if (error) return null;
  return data?.id ?? null;
}

async function findAuthUserIdByEmailViaAdminApi(
  supabase: SupabaseClient,
  email: string
): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  let page = 1;
  const perPage = 200;

  while (page <= 20) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) return null;

    const users = data?.users ?? [];
    if (users.length === 0) return null;

    const found = users.find(
      (user) => (user.email ?? "").trim().toLowerCase() === normalized
    );
    if (found?.id) return found.id;

    if (users.length < perPage) return null;
    page += 1;
  }

  return null;
}

async function ensureAuthUserIdByEmail(
  supabase: SupabaseClient,
  email: string
): Promise<string> {
  const existingId = await findAuthUserIdByEmail(supabase, email);
  if (existingId) return existingId;

  const existingViaAdmin = await findAuthUserIdByEmailViaAdminApi(supabase, email);
  if (existingViaAdmin) return existingViaAdmin;

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
  });

  if (!createError && created.user?.id) return created.user.id;

  const retried = await findAuthUserIdByEmail(supabase, email);
  if (retried) return retried;

  const retriedViaAdmin = await findAuthUserIdByEmailViaAdminApi(supabase, email);
  if (retriedViaAdmin) return retriedViaAdmin;

  throw new Error(createError?.message ?? "Unable to create auth user");
}

export async function listProfili(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("profili")
    .select("id,email,nome,cognome,ruolo,telefono,italia,roma,created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const profili = (data ?? []) as ProfiloRow[];
  if (profili.length === 0) return [];

  const profileIds = profili.map((row) => row.id);
  const { data: links, error: linksError } = await supabase
    .from("profili_gruppi")
    .select("profilo_id,gruppo_id")
    .in("profilo_id", profileIds);

  if (linksError) throw new Error(linksError.message);

  const groupsByProfileId = new Map<string, string[]>();
  for (const link of links ?? []) {
    const profileId = link.profilo_id as string;
    const groupId = String(link.gruppo_id ?? "");
    if (!groupId) continue;
    const current = groupsByProfileId.get(profileId) ?? [];
    current.push(groupId);
    groupsByProfileId.set(profileId, current);
  }

  return profili.map((row) => ({
    ...row,
    groups: [...new Set(groupsByProfileId.get(row.id) ?? [])].sort(),
  }));
}

function normalizeGroups(input: string[] | null | undefined): string[] {
  if (!input) return [];
  return [...new Set(input.map((group) => group.trim()).filter(Boolean))];
}

export async function upsertProfiloByEmail(
  supabase: SupabaseClient,
  input: ProfiloInput
) {
  const email = normalizeEmail(input.email);
  const ruolo = ensureRole(input.ruolo);
  const nome = normalizeText(input.nome);
  const cognome = normalizeText(input.cognome);
  const telefono = normalizeText(input.telefono ?? null);
  const italia = input.italia ?? null;
  const roma = input.roma ?? null;
  const groups = normalizeGroups(input.groups);

  if (!email) throw new Error("Email is required");

  const { data: existing, error: existingError } = await supabase
    .from("profili")
    .select("id,email,ruolo")
    .ilike("email", email)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);

  if (existing?.id) {
    const finalRole =
      existing.ruolo === "admin" && ruolo !== "admin" ? "admin" : ruolo;

    const { data: updated, error: updateError } = await supabase
      .from("profili")
      .update({
        email,
        nome,
        cognome,
        ruolo: finalRole,
        telefono,
        italia,
        roma,
      })
      .eq("id", existing.id)
      .select("id,email,nome,cognome,ruolo,telefono,italia,roma,created_at")
      .single();

    if (updateError) throw new Error(updateError.message);
    if (input.groups !== undefined) {
      await setProfiloGruppi(supabase, existing.id, groups);
    }
    return updated;
  }

  const authUserId = await ensureAuthUserIdByEmail(supabase, email);

  const { data: inserted, error: insertError } = await supabase
    .from("profili")
    .upsert(
      {
        id: authUserId,
        email,
        nome,
        cognome,
        ruolo,
        telefono,
        italia,
        roma,
      },
      { onConflict: "id" }
    )
    .select("id,email,nome,cognome,ruolo,telefono,italia,roma,created_at")
    .single();

  if (insertError) throw new Error(insertError.message);
  if (input.groups !== undefined) {
    await setProfiloGruppi(supabase, inserted.id, groups);
  }
  return inserted;
}

export async function updateProfiloById(
  supabase: SupabaseClient,
  id: string,
  input: {
    nome?: string | null;
    cognome?: string | null;
    ruolo?: string | null;
    telefono?: string | null;
    italia?: boolean | null;
    roma?: boolean | null;
    groups?: string[] | null;
  }
) {
  let existingRole: string | null = null;
  const wantsRoleChange = input.ruolo !== undefined && input.ruolo !== null;

  if (wantsRoleChange) {
    const { data: existing, error: existingError } = await supabase
      .from("profili")
      .select("ruolo")
      .eq("id", id)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    existingRole = existing?.ruolo ?? null;
  }

  const patch: Record<string, string | boolean | null> = {};
  if (input.nome !== undefined) patch.nome = normalizeText(input.nome);
  if (input.cognome !== undefined) patch.cognome = normalizeText(input.cognome);
  if (input.ruolo !== undefined && input.ruolo !== null) {
    const requestedRole = ensureRole(input.ruolo);
    patch.ruolo =
      existingRole === "admin" && requestedRole !== "admin"
        ? "admin"
        : requestedRole;
  }
  if (input.telefono !== undefined) patch.telefono = normalizeText(input.telefono);
  if (input.italia !== undefined) patch.italia = input.italia;
  if (input.roma !== undefined) patch.roma = input.roma;

  const { data, error } = await supabase
    .from("profili")
    .update(patch)
    .eq("id", id)
    .select("id,email,nome,cognome,ruolo,telefono,italia,roma,created_at")
    .single();

  if (error) throw new Error(error.message);

  if (input.groups !== undefined) {
    const groups = normalizeGroups(input.groups);
    await setProfiloGruppi(supabase, id, groups);
  }

  return data;
}

export async function linkProfiloToGruppo(
  supabase: SupabaseClient,
  profiloId: string,
  gruppoId: string
) {
  const normalizedGroup = gruppoId.trim();
  if (!normalizedGroup) return;

  const { error: groupError } = await supabase
    .from("gruppi")
    .upsert({ id: normalizedGroup, nome: normalizedGroup }, { onConflict: "id" });

  if (groupError) throw new Error(groupError.message);

  const { error: linkError } = await supabase
    .from("profili_gruppi")
    .upsert(
      {
        profilo_id: profiloId,
        gruppo_id: normalizedGroup,
      },
      { onConflict: "profilo_id,gruppo_id" }
    );

  if (linkError) throw new Error(linkError.message);
}

export async function setProfiloGruppi(
  supabase: SupabaseClient,
  profiloId: string,
  groups: string[]
) {
  const normalizedGroups = normalizeGroups(groups);

  const { error: deleteError } = await supabase
    .from("profili_gruppi")
    .delete()
    .eq("profilo_id", profiloId);

  if (deleteError) throw new Error(deleteError.message);
  if (normalizedGroups.length === 0) return;

  const gruppoRows = normalizedGroups.map((groupId) => ({ id: groupId, nome: groupId }));
  const { error: groupError } = await supabase
    .from("gruppi")
    .upsert(gruppoRows, { onConflict: "id" });

  if (groupError) throw new Error(groupError.message);

  const linkRows = normalizedGroups.map((groupId) => ({
    profilo_id: profiloId,
    gruppo_id: groupId,
  }));
  const { error: linkError } = await supabase
    .from("profili_gruppi")
    .upsert(linkRows, { onConflict: "profilo_id,gruppo_id" });

  if (linkError) throw new Error(linkError.message);
}
