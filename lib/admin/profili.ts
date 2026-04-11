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
  capogruppoHost?: boolean | null;
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
  capogruppo_host?: boolean | null;
  created_at: string;
};

type ProfiloPersisted = {
  id: string;
  email: string;
  nome: string | null;
  cognome: string | null;
  ruolo: string;
  telefono: string | null;
  italia: boolean | null;
  roma: boolean | null;
  capogruppo_host: boolean | null;
  created_at: string;
};

const GROUP_COLUMN_MISSING_CODES = new Set(["42703", "PGRST204", "PGRST116"]);

function isMissingCapogruppoHostColumn(error: { code?: string | null; message?: string | null }) {
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();
  return code === "42703" || message.includes("capogruppo_host");
}

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
  const primary = await supabase
    .from("profili")
    .select("id,email,nome,cognome,ruolo,telefono,italia,roma,capogruppo_host,created_at")
    .order("created_at", { ascending: false });

  let rows = primary.data as Record<string, unknown>[] | null;
  let error = primary.error;

  if (error) {
    if (!isMissingCapogruppoHostColumn(error)) {
      throw new Error(error.message);
    }

    const fallback = await supabase
      .from("profili")
      .select("id,email,nome,cognome,ruolo,telefono,italia,roma,created_at")
      .order("created_at", { ascending: false });

    rows = fallback.data as Record<string, unknown>[] | null;
    error = fallback.error;
  }

  if (error) throw new Error(error.message);

  const profili = (rows ?? []) as unknown as ProfiloRow[];
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
    capogruppo_host: Boolean(row.capogruppo_host),
    groups: [...new Set(groupsByProfileId.get(row.id) ?? [])].sort(),
  }));
}

function normalizeGroups(input: string[] | null | undefined): string[] {
  if (!input) return [];
  return [...new Set(input.map((group) => group.trim()).filter(Boolean))];
}

async function findGroupIdByColumn(
  supabase: SupabaseClient,
  column: string,
  value: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("gruppi")
    .select("id")
    .ilike(column, value)
    .limit(1)
    .maybeSingle();

  if (error) {
    if (GROUP_COLUMN_MISSING_CODES.has(error.code ?? "")) {
      return null;
    }
    throw new Error(error.message);
  }

  return (data?.id as string | null) ?? null;
}

async function resolveCanonicalGroupId(
  supabase: SupabaseClient,
  rawGroupId: string
): Promise<string> {
  const normalized = rawGroupId.trim();
  if (!normalized) return "";

  const { data: byId, error: byIdError } = await supabase
    .from("gruppi")
    .select("id")
    .eq("id", normalized)
    .maybeSingle();

  if (byIdError && !GROUP_COLUMN_MISSING_CODES.has(byIdError.code ?? "")) {
    throw new Error(byIdError.message);
  }
  if (byId?.id) return String(byId.id);

  const byNome = await findGroupIdByColumn(supabase, "nome", normalized);
  if (byNome) return byNome;

  const byName = await findGroupIdByColumn(supabase, "name", normalized);
  if (byName) return byName;

  const byLabel = await findGroupIdByColumn(supabase, "label", normalized);
  if (byLabel) return byLabel;

  const byGruppoLabel = await findGroupIdByColumn(supabase, "gruppo_label", normalized);
  if (byGruppoLabel) return byGruppoLabel;

  return normalized;
}

export async function upsertProfiloByEmail(
  supabase: SupabaseClient,
  input: ProfiloInput
): Promise<ProfiloPersisted> {
  const email = normalizeEmail(input.email);
  const ruolo = ensureRole(input.ruolo);
  const nome = normalizeText(input.nome);
  const cognome = normalizeText(input.cognome);
  const telefono = normalizeText(input.telefono ?? null);
  const italia = input.italia ?? null;
  const roma = input.roma ?? null;
  const capogruppoHost = ruolo === "capogruppo" ? Boolean(input.capogruppoHost) : false;
  const groups = normalizeGroups(input.groups);

  if (!email) throw new Error("Email is required");

  const { data: existing, error: existingError } = await supabase
    .from("profili")
    .select("id,email,ruolo")
    .ilike("email", email)
    .eq("ruolo", ruolo)
    .limit(1);

  if (existingError) throw new Error(existingError.message);

  const existingRow = (existing ?? [])[0];

  if (existingRow?.id) {
    let { data: updated, error: updateError } = await supabase
      .from("profili")
      .update({
        email,
        nome,
        cognome,
        ruolo,
        telefono,
        italia,
        roma,
        capogruppo_host: capogruppoHost,
      })
      .eq("id", existingRow.id)
      .select("id,email,nome,cognome,ruolo,telefono,italia,roma,capogruppo_host,created_at")
      .single();

    if (updateError && isMissingCapogruppoHostColumn(updateError)) {
      const fallback = await supabase
        .from("profili")
        .update({
          email,
          nome,
          cognome,
          ruolo,
          telefono,
          italia,
          roma,
        })
        .eq("id", existingRow.id)
        .select("id,email,nome,cognome,ruolo,telefono,italia,roma,created_at")
        .single();
      updated = fallback.data as typeof updated;
      updateError = fallback.error;
    }

    if (updateError) throw new Error(updateError.message);
    if (input.groups !== undefined) {
      await setProfiloGruppi(supabase, existingRow.id, groups);
    }
    return {
      ...(updated as Record<string, unknown>),
      capogruppo_host: Boolean((updated as { capogruppo_host?: boolean | null }).capogruppo_host),
    } as ProfiloPersisted;
  }

  const authUserId = await ensureAuthUserIdByEmail(supabase, email);
  const { data: idAlreadyInUse, error: idLookupError } = await supabase
    .from("profili")
    .select("id")
    .eq("id", authUserId)
    .maybeSingle();

  if (idLookupError) throw new Error(idLookupError.message);
  const profileId = idAlreadyInUse?.id ? crypto.randomUUID() : authUserId;

  let { data: inserted, error: insertError } = await supabase
    .from("profili")
    .insert({
      id: profileId,
      email,
      nome,
      cognome,
      ruolo,
      telefono,
      italia,
      roma,
      capogruppo_host: capogruppoHost,
    })
    .select("id,email,nome,cognome,ruolo,telefono,italia,roma,capogruppo_host,created_at")
    .single();

  if (insertError && isMissingCapogruppoHostColumn(insertError)) {
    const fallback = await supabase
      .from("profili")
      .insert({
        id: profileId,
        email,
        nome,
        cognome,
        ruolo,
        telefono,
        italia,
        roma,
      })
      .select("id,email,nome,cognome,ruolo,telefono,italia,roma,created_at")
      .single();
    inserted = fallback.data as typeof inserted;
    insertError = fallback.error;
  }

  if (insertError) throw new Error(insertError.message);
  if (!inserted) throw new Error("Unable to create profile");
  if (input.groups !== undefined) {
    await setProfiloGruppi(supabase, inserted.id, groups);
  }
  return {
    ...(inserted as Record<string, unknown>),
    capogruppo_host: Boolean(
      (inserted as { capogruppo_host?: boolean | null }).capogruppo_host
    ),
  } as ProfiloPersisted;
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
    capogruppoHost?: boolean | null;
    groups?: string[] | null;
  }
): Promise<ProfiloPersisted> {
  let existingRole: string | null = null;
  const wantsRoleChange = input.ruolo !== undefined && input.ruolo !== null;
  const needsCurrentRole = wantsRoleChange || input.capogruppoHost !== undefined;

  if (needsCurrentRole) {
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
  const effectiveRole = (patch.ruolo as string | undefined) ?? existingRole ?? null;
  if (input.capogruppoHost !== undefined || effectiveRole !== "capogruppo") {
    patch.capogruppo_host =
      effectiveRole === "capogruppo" ? Boolean(input.capogruppoHost) : false;
  }

  let { data, error } = await supabase
    .from("profili")
    .update(patch)
    .eq("id", id)
    .select("id,email,nome,cognome,ruolo,telefono,italia,roma,capogruppo_host,created_at")
    .single();

  if (error && isMissingCapogruppoHostColumn(error)) {
    const legacyPatch = { ...patch };
    delete legacyPatch.capogruppo_host;
    const fallback = await supabase
      .from("profili")
      .update(legacyPatch)
      .eq("id", id)
      .select("id,email,nome,cognome,ruolo,telefono,italia,roma,created_at")
      .single();
    data = fallback.data as typeof data;
    error = fallback.error;
  }

  if (error) throw new Error(error.message);

  if (input.groups !== undefined) {
    const groups = normalizeGroups(input.groups);
    await setProfiloGruppi(supabase, id, groups);
  }

  return {
    ...(data as Record<string, unknown>),
    capogruppo_host: Boolean((data as { capogruppo_host?: boolean | null }).capogruppo_host),
  } as ProfiloPersisted;
}

export async function linkProfiloToGruppo(
  supabase: SupabaseClient,
  profiloId: string,
  gruppoId: string
) {
  const normalizedGroup = gruppoId.trim();
  if (!normalizedGroup) return;
  const canonicalGroupId = await resolveCanonicalGroupId(supabase, normalizedGroup);
  if (!canonicalGroupId) return;

  const { error: groupError } = await supabase
    .from("gruppi")
    .upsert({ id: canonicalGroupId, nome: normalizedGroup }, { onConflict: "id" });

  if (groupError) throw new Error(groupError.message);

  const { error: linkError } = await supabase
    .from("profili_gruppi")
    .upsert(
      {
        profilo_id: profiloId,
        gruppo_id: canonicalGroupId,
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

  const resolvedPairs = await Promise.all(
    normalizedGroups.map(async (groupInput) => {
      const canonicalId = await resolveCanonicalGroupId(supabase, groupInput);
      return { canonicalId, displayName: groupInput };
    })
  );

  const uniquePairs = [
    ...new Map(
      resolvedPairs
        .filter((item) => item.canonicalId)
        .map((item) => [item.canonicalId, item.displayName])
    ).entries(),
  ].map(([canonicalId, displayName]) => ({ canonicalId, displayName }));

  if (uniquePairs.length === 0) return;

  const gruppoRows = uniquePairs.map((item) => ({
    id: item.canonicalId,
    nome: item.displayName,
  }));
  const { error: groupError } = await supabase
    .from("gruppi")
    .upsert(gruppoRows, { onConflict: "id" });

  if (groupError) throw new Error(groupError.message);

  const linkRows = uniquePairs.map((item) => ({
    profilo_id: profiloId,
    gruppo_id: item.canonicalId,
  }));
  const { error: linkError } = await supabase
    .from("profili_gruppi")
    .upsert(linkRows, { onConflict: "profilo_id,gruppo_id" });

  if (linkError) throw new Error(linkError.message);
}
