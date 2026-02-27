import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

type BudgetRow = {
  id: string;
  name: string;
  event_label: string | null;
  is_active: boolean;
  default_currency: "EUR" | "HUF";
  huf_to_eur_rate: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type BudgetItemRow = {
  id: string;
  budget_id: string;
  category_name: string;
  macro_category: string;
  unit_cost_original: number;
  currency: "EUR" | "HUF";
  quantity: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type TransactionRow = {
  id: string;
  budget_id: string;
  transaction_type: "INCOME" | "EXPENSE";
  transaction_date: string;
  description: string;
  party: string | null;
  amount_original: number;
  currency: "EUR" | "HUF";
  payment_method: "bank transfer" | "card" | "cash" | "other";
  account: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type TransactionAllocationRow = {
  id: string;
  transaction_id: string;
  budget_item_id: string;
  amount_original: number;
  created_at: string;
};

type SponsorshipRow = {
  id: string;
  budget_id: string;
  sponsor_name: string;
  description: string | null;
  pledged_amount_original: number;
  paid_amount_original: number;
  currency: "EUR" | "HUF";
  status: "pledged" | "partially_paid" | "paid" | "cancelled";
  expected_date: string | null;
  received_date: string | null;
  payment_method: "bank transfer" | "card" | "cash" | "other";
  account: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type SponsorshipAllocationRow = {
  id: string;
  sponsorship_id: string;
  budget_item_id: string;
  amount_original: number;
  created_at: string;
};

type AllocationInput = {
  budget_item_id: string;
  amount_original: number;
};

type MutationPayload =
  | {
      entity: "budget";
      action: "create" | "update" | "delete";
      data?: Record<string, unknown>;
      id?: string;
    }
  | {
      entity: "budget_item";
      action: "create" | "update" | "delete";
      data?: Record<string, unknown>;
      id?: string;
    }
  | {
      entity: "transaction";
      action: "create" | "update" | "delete";
      data?: Record<string, unknown>;
      id?: string;
      allocations?: AllocationInput[];
    }
  | {
      entity: "sponsorship";
      action: "create" | "update" | "delete";
      data?: Record<string, unknown>;
      id?: string;
      allocations?: AllocationInput[];
    };

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeDate(value: unknown): string | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function normalizeCurrency(value: unknown): "EUR" | "HUF" {
  return value === "HUF" ? "HUF" : "EUR";
}

function normalizePaymentMethod(
  value: unknown
): "bank transfer" | "card" | "cash" | "other" {
  if (value === "bank transfer") return "bank transfer";
  if (value === "card") return "card";
  if (value === "cash") return "cash";
  return "other";
}

function normalizeTransactionType(value: unknown): "INCOME" | "EXPENSE" {
  return value === "INCOME" ? "INCOME" : "EXPENSE";
}

function normalizeSponsorshipStatus(
  value: unknown
): "pledged" | "partially_paid" | "paid" | "cancelled" {
  if (value === "partially_paid") return "partially_paid";
  if (value === "paid") return "paid";
  if (value === "cancelled") return "cancelled";
  return "pledged";
}

function normalizeNumber(value: unknown, fallback = 0): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Number(numeric.toFixed(2));
}

function parseAllocations(value: unknown): AllocationInput[] {
  if (!Array.isArray(value)) return [];
  const rows: AllocationInput[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const budgetItemId = normalizeText(row.budget_item_id);
    const amount = normalizeNumber(row.amount_original, Number.NaN);
    if (!budgetItemId || !Number.isFinite(amount) || amount <= 0) continue;
    rows.push({ budget_item_id: budgetItemId, amount_original: amount });
  }

  return rows;
}

function assertAllocationSumEqualsTotal(
  allocations: AllocationInput[],
  totalAmount: number
): string | null {
  const allocated = allocations.reduce((sum, row) => sum + row.amount_original, 0);
  if (Math.abs(allocated - totalAmount) > 0.01) {
    return `Allocations total (${allocated.toFixed(2)}) must match amount (${totalAmount.toFixed(2)})`;
  }
  return null;
}

async function requireManagerContext() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const service = createSupabaseServiceClient();
  const { data: profile, error: profileError } = await service
    .from("profili")
    .select("ruolo")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return {
      errorResponse: NextResponse.json({ error: profileError.message }, { status: 500 }),
    };
  }

  if (profile?.ruolo !== "manager") {
    return {
      errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { user, service };
}

async function loadFinanceDataset(service = createSupabaseServiceClient()) {
  const [budgetsRes, itemsRes, txRes, txAllocRes, sponsorshipRes, sponsorshipAllocRes] =
    await Promise.all([
      service.from("event_finance_budgets").select("*").order("created_at", { ascending: true }),
      service
        .from("event_finance_budget_items")
        .select("*")
        .order("category_name", { ascending: true }),
      service
        .from("event_finance_transactions")
        .select("*")
        .order("transaction_date", { ascending: false }),
      service
        .from("event_finance_transaction_allocations")
        .select("*")
        .order("created_at", { ascending: true }),
      service
        .from("event_finance_sponsorships")
        .select("*")
        .order("created_at", { ascending: false }),
      service
        .from("event_finance_sponsorship_allocations")
        .select("*")
        .order("created_at", { ascending: true }),
    ]);

  const possibleErrors = [
    budgetsRes.error,
    itemsRes.error,
    txRes.error,
    txAllocRes.error,
    sponsorshipRes.error,
    sponsorshipAllocRes.error,
  ].filter(Boolean);

  if (possibleErrors.length > 0) {
    throw new Error(possibleErrors[0]?.message ?? "Unable to load finance data");
  }

  return {
    budgets: (budgetsRes.data ?? []) as BudgetRow[],
    budgetItems: (itemsRes.data ?? []) as BudgetItemRow[],
    transactions: (txRes.data ?? []) as TransactionRow[],
    transactionAllocations: (txAllocRes.data ?? []) as TransactionAllocationRow[],
    sponsorships: (sponsorshipRes.data ?? []) as SponsorshipRow[],
    sponsorshipAllocations: (sponsorshipAllocRes.data ?? []) as SponsorshipAllocationRow[],
  };
}

async function mutateBudget(
  auth: { user: { id: string }; service: ReturnType<typeof createSupabaseServiceClient> },
  payload: Extract<MutationPayload, { entity: "budget" }>
) {
  const id = normalizeText(payload.id);
  const data = (payload.data ?? {}) as Record<string, unknown>;

  if (payload.action === "delete") {
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const { error } = await auth.service.from("event_finance_budgets").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const row = {
    name: normalizeText(data.name),
    event_label: normalizeText(data.event_label),
    is_active: Boolean(data.is_active),
    default_currency: normalizeCurrency(data.default_currency),
    huf_to_eur_rate: normalizeNumber(data.huf_to_eur_rate, 0.0025),
    notes: normalizeText(data.notes),
  };

  if (!row.name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  if (payload.action === "create") {
    const { data: created, error } = await auth.service
      .from("event_finance_budgets")
      .insert(row)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (row.is_active) {
      await auth.service
        .from("event_finance_budgets")
        .update({ is_active: false })
        .neq("id", (created as BudgetRow).id);
    }

    return NextResponse.json({ ok: true, budget: created as BudgetRow });
  }

  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { data: updated, error } = await auth.service
    .from("event_finance_budgets")
    .update(row)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!updated) return NextResponse.json({ error: "Budget not found" }, { status: 404 });

  if (row.is_active) {
    await auth.service
      .from("event_finance_budgets")
      .update({ is_active: false })
      .neq("id", id);
  }

  return NextResponse.json({ ok: true, budget: updated as BudgetRow });
}

async function mutateBudgetItem(
  auth: { user: { id: string }; service: ReturnType<typeof createSupabaseServiceClient> },
  payload: Extract<MutationPayload, { entity: "budget_item" }>
) {
  const id = normalizeText(payload.id);
  const data = (payload.data ?? {}) as Record<string, unknown>;

  if (payload.action === "delete") {
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const { error } = await auth.service
      .from("event_finance_budget_items")
      .delete()
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const row = {
    budget_id: normalizeText(data.budget_id),
    category_name: normalizeText(data.category_name),
    macro_category: normalizeText(data.macro_category),
    unit_cost_original: normalizeNumber(data.unit_cost_original, 0),
    currency: normalizeCurrency(data.currency),
    quantity: normalizeNumber(data.quantity, 1),
    notes: normalizeText(data.notes),
  };

  if (!row.budget_id || !row.category_name || !row.macro_category) {
    return NextResponse.json(
      { error: "budget_id, category_name and macro_category are required" },
      { status: 400 }
    );
  }

  if (payload.action === "create") {
    const { data: created, error } = await auth.service
      .from("event_finance_budget_items")
      .insert(row)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, budgetItem: created as BudgetItemRow });
  }

  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { data: updated, error } = await auth.service
    .from("event_finance_budget_items")
    .update(row)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!updated) return NextResponse.json({ error: "Budget item not found" }, { status: 404 });

  return NextResponse.json({ ok: true, budgetItem: updated as BudgetItemRow });
}

async function upsertTransactionAllocations(
  service: ReturnType<typeof createSupabaseServiceClient>,
  transactionId: string,
  allocations: AllocationInput[]
) {
  await service
    .from("event_finance_transaction_allocations")
    .delete()
    .eq("transaction_id", transactionId);

  if (allocations.length === 0) return;

  const rows = allocations.map((row) => ({
    transaction_id: transactionId,
    budget_item_id: row.budget_item_id,
    amount_original: row.amount_original,
  }));

  const { error } = await service.from("event_finance_transaction_allocations").insert(rows);
  if (error) {
    throw new Error(error.message);
  }
}

async function upsertSponsorshipAllocations(
  service: ReturnType<typeof createSupabaseServiceClient>,
  sponsorshipId: string,
  allocations: AllocationInput[]
) {
  await service
    .from("event_finance_sponsorship_allocations")
    .delete()
    .eq("sponsorship_id", sponsorshipId);

  if (allocations.length === 0) return;

  const rows = allocations.map((row) => ({
    sponsorship_id: sponsorshipId,
    budget_item_id: row.budget_item_id,
    amount_original: row.amount_original,
  }));

  const { error } = await service.from("event_finance_sponsorship_allocations").insert(rows);
  if (error) {
    throw new Error(error.message);
  }
}

async function mutateTransaction(
  auth: { user: { id: string }; service: ReturnType<typeof createSupabaseServiceClient> },
  payload: Extract<MutationPayload, { entity: "transaction" }>
) {
  const id = normalizeText(payload.id);
  const data = (payload.data ?? {}) as Record<string, unknown>;
  const allocations = parseAllocations(payload.allocations);

  if (payload.action === "delete") {
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const { error } = await auth.service
      .from("event_finance_transactions")
      .delete()
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const row = {
    budget_id: normalizeText(data.budget_id),
    transaction_type: normalizeTransactionType(data.transaction_type),
    transaction_date: normalizeDate(data.transaction_date),
    description: normalizeText(data.description),
    party: normalizeText(data.party),
    amount_original: normalizeNumber(data.amount_original, 0),
    currency: normalizeCurrency(data.currency),
    payment_method: normalizePaymentMethod(data.payment_method),
    account: normalizeText(data.account),
    notes: normalizeText(data.notes),
    updated_by: auth.user.id,
  };

  if (!row.budget_id || !row.transaction_date || !row.description) {
    return NextResponse.json(
      { error: "budget_id, transaction_date and description are required" },
      { status: 400 }
    );
  }

  const allocationError = assertAllocationSumEqualsTotal(allocations, row.amount_original);
  if (allocationError) {
    return NextResponse.json({ error: allocationError }, { status: 400 });
  }

  if (payload.action === "create") {
    const { data: created, error } = await auth.service
      .from("event_finance_transactions")
      .insert({ ...row, created_by: auth.user.id })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    try {
      await upsertTransactionAllocations(auth.service, (created as TransactionRow).id, allocations);
    } catch (upsertError) {
      const message =
        upsertError instanceof Error ? upsertError.message : "Unable to save transaction allocations";
      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, transaction: created as TransactionRow });
  }

  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { data: updated, error } = await auth.service
    .from("event_finance_transactions")
    .update(row)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!updated) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

  try {
    await upsertTransactionAllocations(auth.service, id, allocations);
  } catch (upsertError) {
    const message =
      upsertError instanceof Error ? upsertError.message : "Unable to save transaction allocations";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, transaction: updated as TransactionRow });
}

async function mutateSponsorship(
  auth: { user: { id: string }; service: ReturnType<typeof createSupabaseServiceClient> },
  payload: Extract<MutationPayload, { entity: "sponsorship" }>
) {
  const id = normalizeText(payload.id);
  const data = (payload.data ?? {}) as Record<string, unknown>;
  const allocations = parseAllocations(payload.allocations);

  if (payload.action === "delete") {
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const { error } = await auth.service
      .from("event_finance_sponsorships")
      .delete()
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const row = {
    budget_id: normalizeText(data.budget_id),
    sponsor_name: normalizeText(data.sponsor_name),
    description: normalizeText(data.description),
    pledged_amount_original: normalizeNumber(data.pledged_amount_original, 0),
    paid_amount_original: normalizeNumber(data.paid_amount_original, 0),
    currency: normalizeCurrency(data.currency),
    status: normalizeSponsorshipStatus(data.status),
    expected_date: normalizeDate(data.expected_date),
    received_date: normalizeDate(data.received_date),
    payment_method: normalizePaymentMethod(data.payment_method),
    account: normalizeText(data.account),
    notes: normalizeText(data.notes),
    updated_by: auth.user.id,
  };

  if (!row.budget_id || !row.sponsor_name) {
    return NextResponse.json(
      { error: "budget_id and sponsor_name are required" },
      { status: 400 }
    );
  }

  const allocationError = assertAllocationSumEqualsTotal(
    allocations,
    row.pledged_amount_original
  );
  if (allocationError) {
    return NextResponse.json({ error: allocationError }, { status: 400 });
  }

  if (payload.action === "create") {
    const { data: created, error } = await auth.service
      .from("event_finance_sponsorships")
      .insert({ ...row, created_by: auth.user.id })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    try {
      await upsertSponsorshipAllocations(auth.service, (created as SponsorshipRow).id, allocations);
    } catch (upsertError) {
      const message =
        upsertError instanceof Error ? upsertError.message : "Unable to save sponsorship allocations";
      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, sponsorship: created as SponsorshipRow });
  }

  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { data: updated, error } = await auth.service
    .from("event_finance_sponsorships")
    .update(row)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!updated) return NextResponse.json({ error: "Sponsorship not found" }, { status: 404 });

  try {
    await upsertSponsorshipAllocations(auth.service, id, allocations);
  } catch (upsertError) {
    const message =
      upsertError instanceof Error ? upsertError.message : "Unable to save sponsorship allocations";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sponsorship: updated as SponsorshipRow });
}

export async function GET() {
  const auth = await requireManagerContext();
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const dataset = await loadFinanceDataset(auth.service);
    return NextResponse.json(dataset);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load event finance data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireManagerContext();
  if ("errorResponse" in auth) return auth.errorResponse;

  let payload: MutationPayload | null = null;
  try {
    payload = (await req.json()) as MutationPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!payload || typeof payload !== "object" || !("entity" in payload)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (payload.entity === "budget") {
    return mutateBudget(auth, payload);
  }

  if (payload.entity === "budget_item") {
    return mutateBudgetItem(auth, payload);
  }

  if (payload.entity === "transaction") {
    return mutateTransaction(auth, payload);
  }

  if (payload.entity === "sponsorship") {
    return mutateSponsorship(auth, payload);
  }

  return NextResponse.json({ error: "Unsupported entity" }, { status: 400 });
}
