"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Currency = "EUR" | "HUF";
type TransactionType = "INCOME" | "EXPENSE";
type PaymentMethod = "bank transfer" | "card" | "cash" | "other";
type SponsorshipStatus = "pledged" | "partially_paid" | "paid" | "cancelled";
type FinanceTab = "overview" | "budgets" | "budget-items" | "transactions" | "sponsorships";

type Budget = {
  id: string;
  name: string;
  event_label: string | null;
  is_active: boolean;
  default_currency: Currency;
  huf_to_eur_rate: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type BudgetItem = {
  id: string;
  budget_id: string;
  category_name: string;
  macro_category: string;
  unit_cost_original: number;
  currency: Currency;
  quantity: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type FinanceTransaction = {
  id: string;
  budget_id: string;
  transaction_type: TransactionType;
  transaction_date: string;
  description: string;
  party: string | null;
  amount_original: number;
  currency: Currency;
  payment_method: PaymentMethod;
  account: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type TransactionAllocation = {
  id: string;
  transaction_id: string;
  budget_item_id: string;
  amount_original: number;
  created_at: string;
};

type Sponsorship = {
  id: string;
  budget_id: string;
  sponsor_name: string;
  description: string | null;
  pledged_amount_original: number;
  paid_amount_original: number;
  currency: Currency;
  status: SponsorshipStatus;
  expected_date: string | null;
  received_date: string | null;
  payment_method: PaymentMethod;
  account: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type SponsorshipAllocation = {
  id: string;
  sponsorship_id: string;
  budget_item_id: string;
  amount_original: number;
  created_at: string;
};

type FinanceDataset = {
  budgets: Budget[];
  budgetItems: BudgetItem[];
  transactions: FinanceTransaction[];
  transactionAllocations: TransactionAllocation[];
  sponsorships: Sponsorship[];
  sponsorshipAllocations: SponsorshipAllocation[];
};

type AllocationDraft = {
  budget_item_id: string;
  amount_original: number;
};

type BudgetForm = {
  id: string | null;
  name: string;
  event_label: string;
  is_active: boolean;
  default_currency: Currency;
  huf_to_eur_rate: string;
  notes: string;
};

type BudgetItemForm = {
  id: string | null;
  budget_id: string;
  category_name: string;
  macro_category: string;
  unit_cost_original: string;
  currency: Currency;
  quantity: string;
  notes: string;
};

type TransactionForm = {
  id: string | null;
  budget_id: string;
  transaction_type: TransactionType;
  transaction_date: string;
  description: string;
  party: string;
  amount_original: string;
  currency: Currency;
  payment_method: PaymentMethod;
  account: string;
  notes: string;
};

type SponsorshipForm = {
  id: string | null;
  budget_id: string;
  sponsor_name: string;
  description: string;
  pledged_amount_original: string;
  paid_amount_original: string;
  currency: Currency;
  status: SponsorshipStatus;
  expected_date: string;
  received_date: string;
  payment_method: PaymentMethod;
  account: string;
  notes: string;
};

const TABS: Array<{ id: FinanceTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "budgets", label: "Budgets" },
  { id: "budget-items", label: "Budget Items" },
  { id: "transactions", label: "Transactions" },
  { id: "sponsorships", label: "Sponsorships" },
];

const PAYMENT_METHOD_OPTIONS: PaymentMethod[] = ["bank transfer", "card", "cash", "other"];
const SPONSORSHIP_STATUS_OPTIONS: SponsorshipStatus[] = [
  "pledged",
  "partially_paid",
  "paid",
  "cancelled",
];

function formatCurrency(value: number, currency: Currency = "EUR") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: currency === "HUF" ? 0 : 2,
    maximumFractionDigits: currency === "HUF" ? 0 : 2,
  }).format(value);
}

function toNumber(value: string, fallback = 0): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Number(parsed.toFixed(2));
}

function toEur(value: number, currency: Currency, hufToEurRate: number) {
  if (currency === "EUR") return value;
  return value * hufToEurRate;
}

function emptyBudgetForm(): BudgetForm {
  return {
    id: null,
    name: "",
    event_label: "",
    is_active: false,
    default_currency: "EUR",
    huf_to_eur_rate: "0.0025",
    notes: "",
  };
}

function emptyBudgetItemForm(budgetId: string): BudgetItemForm {
  return {
    id: null,
    budget_id: budgetId,
    category_name: "",
    macro_category: "General Costs",
    unit_cost_original: "0",
    currency: "EUR",
    quantity: "1",
    notes: "",
  };
}

function emptyTransactionForm(budgetId: string): TransactionForm {
  return {
    id: null,
    budget_id: budgetId,
    transaction_type: "EXPENSE",
    transaction_date: new Date().toISOString().slice(0, 10),
    description: "",
    party: "",
    amount_original: "0",
    currency: "EUR",
    payment_method: "bank transfer",
    account: "",
    notes: "",
  };
}

function emptySponsorshipForm(budgetId: string): SponsorshipForm {
  return {
    id: null,
    budget_id: budgetId,
    sponsor_name: "",
    description: "",
    pledged_amount_original: "0",
    paid_amount_original: "0",
    currency: "EUR",
    status: "pledged",
    expected_date: "",
    received_date: "",
    payment_method: "other",
    account: "",
    notes: "",
  };
}

export function EventFinanceManager() {
  const [dataset, setDataset] = useState<FinanceDataset>({
    budgets: [],
    budgetItems: [],
    transactions: [],
    transactionAllocations: [],
    sponsorships: [],
    sponsorshipAllocations: [],
  });
  const [activeTab, setActiveTab] = useState<FinanceTab>("overview");
  const [activeBudgetId, setActiveBudgetId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [budgetSearch, setBudgetSearch] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [itemMacroFilter, setItemMacroFilter] = useState("");
  const [txSearch, setTxSearch] = useState("");
  const [txTypeFilter, setTxTypeFilter] = useState<"all" | TransactionType>("all");
  const [sponsorSearch, setSponsorSearch] = useState("");
  const [sponsorStatusFilter, setSponsorStatusFilter] = useState<"all" | SponsorshipStatus>(
    "all"
  );

  const [budgetForm, setBudgetForm] = useState<BudgetForm>(emptyBudgetForm());
  const [itemForm, setItemForm] = useState<BudgetItemForm>(emptyBudgetItemForm(""));
  const [transactionForm, setTransactionForm] = useState<TransactionForm>(emptyTransactionForm(""));
  const [sponsorshipForm, setSponsorshipForm] = useState<SponsorshipForm>(emptySponsorshipForm(""));

  const [transactionAllocationsDraft, setTransactionAllocationsDraft] = useState<AllocationDraft[]>([]);
  const [sponsorshipAllocationsDraft, setSponsorshipAllocationsDraft] = useState<AllocationDraft[]>([]);

  const budgets = dataset.budgets;
  const budgetItems = dataset.budgetItems;
  const transactions = dataset.transactions;
  const transactionAllocations = dataset.transactionAllocations;
  const sponsorships = dataset.sponsorships;
  const sponsorshipAllocations = dataset.sponsorshipAllocations;

  const currentBudget = useMemo(
    () => budgets.find((budget) => budget.id === activeBudgetId) ?? null,
    [activeBudgetId, budgets]
  );

  const budgetOptions = useMemo(
    () => budgets.map((budget) => ({ id: budget.id, name: budget.name })),
    [budgets]
  );

  const activeBudgetItems = useMemo(
    () => budgetItems.filter((item) => item.budget_id === activeBudgetId),
    [activeBudgetId, budgetItems]
  );

  const activeBudgetTransactions = useMemo(
    () => transactions.filter((tx) => tx.budget_id === activeBudgetId),
    [activeBudgetId, transactions]
  );

  const activeBudgetSponsorships = useMemo(
    () => sponsorships.filter((sp) => sp.budget_id === activeBudgetId),
    [activeBudgetId, sponsorships]
  );

  const macroCategoryOptions = useMemo(
    () => [...new Set(activeBudgetItems.map((item) => item.macro_category))].sort(),
    [activeBudgetItems]
  );

  const overview = useMemo(() => {
    if (!currentBudget) {
      return {
        plannedEur: 0,
        actualIncomeEur: 0,
        actualExpenseEur: 0,
        sponsoredEur: 0,
        pledgedEur: 0,
        balanceEur: 0,
      };
    }

    const rate = currentBudget.huf_to_eur_rate;

    const plannedEur = activeBudgetItems.reduce((sum, item) => {
      const lineTotal = item.unit_cost_original * item.quantity;
      return sum + toEur(lineTotal, item.currency, rate);
    }, 0);

    const transactionById = new Map(activeBudgetTransactions.map((tx) => [tx.id, tx]));

    const actualIncomeEur = transactionAllocations.reduce((sum, alloc) => {
      const tx = transactionById.get(alloc.transaction_id);
      if (!tx || tx.transaction_type !== "INCOME") return sum;
      return sum + toEur(alloc.amount_original, tx.currency, rate);
    }, 0);

    const actualExpenseEur = transactionAllocations.reduce((sum, alloc) => {
      const tx = transactionById.get(alloc.transaction_id);
      if (!tx || tx.transaction_type !== "EXPENSE") return sum;
      return sum + toEur(alloc.amount_original, tx.currency, rate);
    }, 0);

    const sponsorshipById = new Map(activeBudgetSponsorships.map((sp) => [sp.id, sp]));

    const sponsoredEur = sponsorshipAllocations.reduce((sum, alloc) => {
      const sp = sponsorshipById.get(alloc.sponsorship_id);
      if (!sp || sp.status === "cancelled") return sum;
      return sum + toEur(alloc.amount_original, sp.currency, rate);
    }, 0);

    const pledgedEur = activeBudgetSponsorships.reduce((sum, sp) => {
      if (sp.status === "cancelled") return sum;
      return sum + toEur(sp.pledged_amount_original, sp.currency, rate);
    }, 0);

    const balanceEur = actualIncomeEur + sponsoredEur - actualExpenseEur;

    return {
      plannedEur,
      actualIncomeEur,
      actualExpenseEur,
      sponsoredEur,
      pledgedEur,
      balanceEur,
    };
  }, [
    activeBudgetItems,
    activeBudgetSponsorships,
    activeBudgetTransactions,
    currentBudget,
    sponsorshipAllocations,
    transactionAllocations,
  ]);

  const groupedBudgetOverview = useMemo(() => {
    if (!currentBudget) return [] as Array<{
      macroCategory: string;
      plannedEur: number;
      incomeEur: number;
      expensesEur: number;
      sponsorshipsEur: number;
      balanceEur: number;
    }>;

    const byMacro = new Map<
      string,
      {
        macroCategory: string;
        plannedEur: number;
        incomeEur: number;
        expensesEur: number;
        sponsorshipsEur: number;
      }
    >();

    const rate = currentBudget.huf_to_eur_rate;
    const itemById = new Map(activeBudgetItems.map((item) => [item.id, item]));
    const txById = new Map(activeBudgetTransactions.map((tx) => [tx.id, tx]));
    const spById = new Map(activeBudgetSponsorships.map((sp) => [sp.id, sp]));

    const ensureMacro = (macroCategory: string) => {
      const existing = byMacro.get(macroCategory);
      if (existing) return existing;
      const row = {
        macroCategory,
        plannedEur: 0,
        incomeEur: 0,
        expensesEur: 0,
        sponsorshipsEur: 0,
      };
      byMacro.set(macroCategory, row);
      return row;
    };

    for (const item of activeBudgetItems) {
      const bucket = ensureMacro(item.macro_category);
      bucket.plannedEur += toEur(item.unit_cost_original * item.quantity, item.currency, rate);
    }

    for (const alloc of transactionAllocations) {
      const tx = txById.get(alloc.transaction_id);
      const item = itemById.get(alloc.budget_item_id);
      if (!tx || !item) continue;
      const bucket = ensureMacro(item.macro_category);
      if (tx.transaction_type === "INCOME") {
        bucket.incomeEur += toEur(alloc.amount_original, tx.currency, rate);
      } else {
        bucket.expensesEur += toEur(alloc.amount_original, tx.currency, rate);
      }
    }

    for (const alloc of sponsorshipAllocations) {
      const sp = spById.get(alloc.sponsorship_id);
      const item = itemById.get(alloc.budget_item_id);
      if (!sp || !item || sp.status === "cancelled") continue;
      const bucket = ensureMacro(item.macro_category);
      bucket.sponsorshipsEur += toEur(alloc.amount_original, sp.currency, rate);
    }

    return [...byMacro.values()]
      .map((row) => ({
        ...row,
        balanceEur: row.incomeEur + row.sponsorshipsEur - row.expensesEur,
      }))
      .sort((a, b) => a.macroCategory.localeCompare(b.macroCategory));
  }, [
    activeBudgetItems,
    activeBudgetSponsorships,
    activeBudgetTransactions,
    currentBudget,
    sponsorshipAllocations,
    transactionAllocations,
  ]);

  const visibleBudgets = useMemo(() => {
    const term = budgetSearch.trim().toLowerCase();
    if (!term) return budgets;
    return budgets.filter(
      (budget) =>
        budget.name.toLowerCase().includes(term) ||
        (budget.event_label ?? "").toLowerCase().includes(term)
    );
  }, [budgetSearch, budgets]);

  const visibleBudgetItems = useMemo(() => {
    const term = itemSearch.trim().toLowerCase();
    return activeBudgetItems.filter((item) => {
      if (itemMacroFilter && item.macro_category !== itemMacroFilter) return false;
      if (!term) return true;
      return (
        item.category_name.toLowerCase().includes(term) ||
        item.macro_category.toLowerCase().includes(term) ||
        (item.notes ?? "").toLowerCase().includes(term)
      );
    });
  }, [activeBudgetItems, itemMacroFilter, itemSearch]);

  const visibleTransactions = useMemo(() => {
    const term = txSearch.trim().toLowerCase();
    return activeBudgetTransactions.filter((tx) => {
      if (txTypeFilter !== "all" && tx.transaction_type !== txTypeFilter) return false;
      if (!term) return true;
      return (
        tx.description.toLowerCase().includes(term) ||
        (tx.party ?? "").toLowerCase().includes(term) ||
        (tx.account ?? "").toLowerCase().includes(term)
      );
    });
  }, [activeBudgetTransactions, txSearch, txTypeFilter]);

  const visibleSponsorships = useMemo(() => {
    const term = sponsorSearch.trim().toLowerCase();
    return activeBudgetSponsorships.filter((sp) => {
      if (sponsorStatusFilter !== "all" && sp.status !== sponsorStatusFilter) return false;
      if (!term) return true;
      return (
        sp.sponsor_name.toLowerCase().includes(term) ||
        (sp.description ?? "").toLowerCase().includes(term)
      );
    });
  }, [activeBudgetSponsorships, sponsorSearch, sponsorStatusFilter]);

  const transactionAllocationsByTx = useMemo(() => {
    const grouped = new Map<string, TransactionAllocation[]>();
    for (const alloc of transactionAllocations) {
      const row = grouped.get(alloc.transaction_id);
      if (row) {
        row.push(alloc);
      } else {
        grouped.set(alloc.transaction_id, [alloc]);
      }
    }
    return grouped;
  }, [transactionAllocations]);

  const sponsorshipAllocationsBySponsorship = useMemo(() => {
    const grouped = new Map<string, SponsorshipAllocation[]>();
    for (const alloc of sponsorshipAllocations) {
      const row = grouped.get(alloc.sponsorship_id);
      if (row) {
        row.push(alloc);
      } else {
        grouped.set(alloc.sponsorship_id, [alloc]);
      }
    }
    return grouped;
  }, [sponsorshipAllocations]);

  useEffect(() => {
    void reloadData();
  }, []);

  useEffect(() => {
    if (budgets.length === 0) {
      setActiveBudgetId("");
      return;
    }

    const stillExists = budgets.some((budget) => budget.id === activeBudgetId);
    if (stillExists) return;

    const preferred = budgets.find((budget) => budget.is_active) ?? budgets[0];
    setActiveBudgetId(preferred.id);
  }, [activeBudgetId, budgets]);

  useEffect(() => {
    if (!activeBudgetId) return;

    setItemForm((prev) => {
      if (prev.budget_id) return prev;
      return { ...prev, budget_id: activeBudgetId };
    });

    setTransactionForm((prev) => {
      if (prev.budget_id) return prev;
      return { ...prev, budget_id: activeBudgetId };
    });

    setSponsorshipForm((prev) => {
      if (prev.budget_id) return prev;
      return { ...prev, budget_id: activeBudgetId };
    });
  }, [activeBudgetId]);

  async function reloadData() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/manager/event-finance", { method: "GET" });
      const json = (await res.json()) as FinanceDataset & { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Unable to load event finance data.");
        return;
      }
      setDataset({
        budgets: Array.isArray(json.budgets) ? json.budgets : [],
        budgetItems: Array.isArray(json.budgetItems) ? json.budgetItems : [],
        transactions: Array.isArray(json.transactions) ? json.transactions : [],
        transactionAllocations: Array.isArray(json.transactionAllocations)
          ? json.transactionAllocations
          : [],
        sponsorships: Array.isArray(json.sponsorships) ? json.sponsorships : [],
        sponsorshipAllocations: Array.isArray(json.sponsorshipAllocations)
          ? json.sponsorshipAllocations
          : [],
      });
    } catch {
      setError("Unable to load event finance data.");
    } finally {
      setLoading(false);
    }
  }

  async function runMutation(payload: Record<string, unknown>, successMessage: string) {
    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/manager/event-finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { error?: string };

      if (!res.ok) {
        setError(json.error ?? "Unable to save changes.");
        return false;
      }

      setSuccess(successMessage);
      await reloadData();
      return true;
    } catch {
      setError("Unable to save changes.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function resetBudgetForm() {
    setBudgetForm(emptyBudgetForm());
  }

  function resetItemForm() {
    setItemForm(emptyBudgetItemForm(activeBudgetId));
  }

  function resetTransactionForm() {
    setTransactionForm(emptyTransactionForm(activeBudgetId));
    setTransactionAllocationsDraft([]);
  }

  function resetSponsorshipForm() {
    setSponsorshipForm(emptySponsorshipForm(activeBudgetId));
    setSponsorshipAllocationsDraft([]);
  }

  async function handleSaveBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!budgetForm.name.trim()) return;

    const payload = {
      entity: "budget",
      action: budgetForm.id ? "update" : "create",
      id: budgetForm.id ?? undefined,
      data: {
        name: budgetForm.name,
        event_label: budgetForm.event_label,
        is_active: budgetForm.is_active,
        default_currency: budgetForm.default_currency,
        huf_to_eur_rate: toNumber(budgetForm.huf_to_eur_rate, 0.0025),
        notes: budgetForm.notes,
      },
    };

    const ok = await runMutation(payload, budgetForm.id ? "Budget updated." : "Budget created.");
    if (ok) resetBudgetForm();
  }

  async function handleDeleteBudget(id: string) {
    const ok = window.confirm("Delete this budget and all linked finance records?");
    if (!ok) return;
    await runMutation({ entity: "budget", action: "delete", id }, "Budget deleted.");
  }

  async function handleSaveBudgetItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!itemForm.budget_id || !itemForm.category_name.trim()) return;

    const payload = {
      entity: "budget_item",
      action: itemForm.id ? "update" : "create",
      id: itemForm.id ?? undefined,
      data: {
        budget_id: itemForm.budget_id,
        category_name: itemForm.category_name,
        macro_category: itemForm.macro_category,
        unit_cost_original: toNumber(itemForm.unit_cost_original),
        currency: itemForm.currency,
        quantity: toNumber(itemForm.quantity, 1),
        notes: itemForm.notes,
      },
    };

    const ok = await runMutation(
      payload,
      itemForm.id ? "Budget item updated." : "Budget item created."
    );
    if (ok) resetItemForm();
  }

  async function handleDeleteBudgetItem(id: string) {
    const ok = window.confirm("Delete this budget item and related allocations?");
    if (!ok) return;
    await runMutation(
      { entity: "budget_item", action: "delete", id },
      "Budget item deleted."
    );
  }

  async function handleSaveTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!transactionForm.budget_id || !transactionForm.description.trim()) return;

    const amount = toNumber(transactionForm.amount_original, 0);

    const payload = {
      entity: "transaction",
      action: transactionForm.id ? "update" : "create",
      id: transactionForm.id ?? undefined,
      data: {
        budget_id: transactionForm.budget_id,
        transaction_type: transactionForm.transaction_type,
        transaction_date: transactionForm.transaction_date,
        description: transactionForm.description,
        party: transactionForm.party,
        amount_original: amount,
        currency: transactionForm.currency,
        payment_method: transactionForm.payment_method,
        account: transactionForm.account,
        notes: transactionForm.notes,
      },
      allocations: transactionAllocationsDraft,
    };

    const ok = await runMutation(
      payload,
      transactionForm.id ? "Transaction updated." : "Transaction created."
    );
    if (ok) resetTransactionForm();
  }

  async function handleDeleteTransaction(id: string) {
    const ok = window.confirm("Delete this transaction and its allocations?");
    if (!ok) return;
    await runMutation({ entity: "transaction", action: "delete", id }, "Transaction deleted.");
  }

  async function handleSaveSponsorship(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sponsorshipForm.budget_id || !sponsorshipForm.sponsor_name.trim()) return;

    const payload = {
      entity: "sponsorship",
      action: sponsorshipForm.id ? "update" : "create",
      id: sponsorshipForm.id ?? undefined,
      data: {
        budget_id: sponsorshipForm.budget_id,
        sponsor_name: sponsorshipForm.sponsor_name,
        description: sponsorshipForm.description,
        pledged_amount_original: toNumber(sponsorshipForm.pledged_amount_original),
        paid_amount_original: toNumber(sponsorshipForm.paid_amount_original),
        currency: sponsorshipForm.currency,
        status: sponsorshipForm.status,
        expected_date: sponsorshipForm.expected_date,
        received_date: sponsorshipForm.received_date,
        payment_method: sponsorshipForm.payment_method,
        account: sponsorshipForm.account,
        notes: sponsorshipForm.notes,
      },
      allocations: sponsorshipAllocationsDraft,
    };

    const ok = await runMutation(
      payload,
      sponsorshipForm.id ? "Sponsorship updated." : "Sponsorship created."
    );
    if (ok) resetSponsorshipForm();
  }

  async function handleDeleteSponsorship(id: string) {
    const ok = window.confirm("Delete this sponsorship and its allocations?");
    if (!ok) return;
    await runMutation({ entity: "sponsorship", action: "delete", id }, "Sponsorship deleted.");
  }

  function setBudgetForEditing(budget: Budget) {
    setBudgetForm({
      id: budget.id,
      name: budget.name,
      event_label: budget.event_label ?? "",
      is_active: budget.is_active,
      default_currency: budget.default_currency,
      huf_to_eur_rate: budget.huf_to_eur_rate.toString(),
      notes: budget.notes ?? "",
    });
  }

  function setItemForEditing(item: BudgetItem) {
    setItemForm({
      id: item.id,
      budget_id: item.budget_id,
      category_name: item.category_name,
      macro_category: item.macro_category,
      unit_cost_original: item.unit_cost_original.toString(),
      currency: item.currency,
      quantity: item.quantity.toString(),
      notes: item.notes ?? "",
    });
  }

  function setTransactionForEditing(tx: FinanceTransaction) {
    setTransactionForm({
      id: tx.id,
      budget_id: tx.budget_id,
      transaction_type: tx.transaction_type,
      transaction_date: tx.transaction_date,
      description: tx.description,
      party: tx.party ?? "",
      amount_original: tx.amount_original.toString(),
      currency: tx.currency,
      payment_method: tx.payment_method,
      account: tx.account ?? "",
      notes: tx.notes ?? "",
    });

    const allocations = (transactionAllocationsByTx.get(tx.id) ?? []).map((row) => ({
      budget_item_id: row.budget_item_id,
      amount_original: row.amount_original,
    }));
    setTransactionAllocationsDraft(allocations);
  }

  function setSponsorshipForEditing(sp: Sponsorship) {
    setSponsorshipForm({
      id: sp.id,
      budget_id: sp.budget_id,
      sponsor_name: sp.sponsor_name,
      description: sp.description ?? "",
      pledged_amount_original: sp.pledged_amount_original.toString(),
      paid_amount_original: sp.paid_amount_original.toString(),
      currency: sp.currency,
      status: sp.status,
      expected_date: sp.expected_date ?? "",
      received_date: sp.received_date ?? "",
      payment_method: sp.payment_method,
      account: sp.account ?? "",
      notes: sp.notes ?? "",
    });

    const allocations = (sponsorshipAllocationsBySponsorship.get(sp.id) ?? []).map((row) => ({
      budget_item_id: row.budget_item_id,
      amount_original: row.amount_original,
    }));
    setSponsorshipAllocationsDraft(allocations);
  }

  function renderBudgetSelector() {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="block text-sm font-medium text-slate-700">Active budget</label>
        <select
          value={activeBudgetId}
          onChange={(e) => setActiveBudgetId(e.target.value)}
          className="mt-2 w-full rounded border border-slate-300 px-3 py-2 text-sm"
        >
          {budgetOptions.length === 0 ? (
            <option value="">No budgets yet</option>
          ) : (
            budgetOptions.map((budget) => (
              <option key={budget.id} value={budget.id}>
                {budget.name}
              </option>
            ))
          )}
        </select>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
        Loading Event Finance module...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Event Finance</h2>
        <p className="mt-1 text-sm text-slate-500">
          Budget planning, income, expenses, sponsorships and allocations in one module.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full border px-4 py-2 font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      )}

      {activeTab === "overview" && (
        <section className="space-y-4">
          {renderBudgetSelector()}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Planned</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {formatCurrency(overview.plannedEur, "EUR")}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Income</p>
              <p className="mt-2 text-lg font-semibold text-emerald-700">
                {formatCurrency(overview.actualIncomeEur, "EUR")}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Expenses</p>
              <p className="mt-2 text-lg font-semibold text-rose-700">
                {formatCurrency(overview.actualExpenseEur, "EUR")}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Sponsored</p>
              <p className="mt-2 text-lg font-semibold text-indigo-700">
                {formatCurrency(overview.sponsoredEur, "EUR")}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Pledged</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {formatCurrency(overview.pledgedEur, "EUR")}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Balance</p>
              <p
                className={`mt-2 text-lg font-semibold ${
                  overview.balanceEur >= 0 ? "text-emerald-700" : "text-rose-700"
                }`}
              >
                {formatCurrency(overview.balanceEur, "EUR")}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Macro Category Summary</h3>
            <div className="mt-3 overflow-x-auto rounded border border-slate-200">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="px-4 py-3">Macro category</th>
                    <th className="px-4 py-3">Planned</th>
                    <th className="px-4 py-3">Income</th>
                    <th className="px-4 py-3">Expenses</th>
                    <th className="px-4 py-3">Sponsorships</th>
                    <th className="px-4 py-3">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedBudgetOverview.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-4 text-slate-500">
                        No data for the selected budget.
                      </td>
                    </tr>
                  ) : (
                    groupedBudgetOverview.map((row) => (
                      <tr key={row.macroCategory} className="border-t border-slate-100">
                        <td className="px-4 py-3">{row.macroCategory}</td>
                        <td className="px-4 py-3">{formatCurrency(row.plannedEur, "EUR")}</td>
                        <td className="px-4 py-3">{formatCurrency(row.incomeEur, "EUR")}</td>
                        <td className="px-4 py-3">{formatCurrency(row.expensesEur, "EUR")}</td>
                        <td className="px-4 py-3">{formatCurrency(row.sponsorshipsEur, "EUR")}</td>
                        <td className="px-4 py-3">{formatCurrency(row.balanceEur, "EUR")}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {activeTab === "budgets" && (
        <section className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-900">Budgets</h3>
              <input
                value={budgetSearch}
                onChange={(e) => setBudgetSearch(e.target.value)}
                placeholder="Search by budget name"
                className="w-full max-w-sm rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <form onSubmit={handleSaveBudget} className="mt-4 grid gap-3 md:grid-cols-3">
              <input
                required
                value={budgetForm.name}
                onChange={(e) => setBudgetForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Budget name"
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={budgetForm.event_label}
                onChange={(e) =>
                  setBudgetForm((prev) => ({ ...prev, event_label: e.target.value }))
                }
                placeholder="Event label"
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="number"
                step="0.000001"
                min="0.000001"
                value={budgetForm.huf_to_eur_rate}
                onChange={(e) =>
                  setBudgetForm((prev) => ({ ...prev, huf_to_eur_rate: e.target.value }))
                }
                placeholder="HUF to EUR rate"
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              />
              <select
                value={budgetForm.default_currency}
                onChange={(e) =>
                  setBudgetForm((prev) => ({ ...prev, default_currency: e.target.value as Currency }))
                }
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="EUR">EUR</option>
                <option value="HUF">HUF</option>
              </select>
              <label className="inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={budgetForm.is_active}
                  onChange={(e) =>
                    setBudgetForm((prev) => ({ ...prev, is_active: e.target.checked }))
                  }
                />
                Active budget
              </label>
              <input
                value={budgetForm.notes}
                onChange={(e) => setBudgetForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Notes"
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              />

              <div className="md:col-span-3 flex gap-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {budgetForm.id ? "Update budget" : "Create budget"}
                </button>
                {budgetForm.id && (
                  <button
                    type="button"
                    onClick={resetBudgetForm}
                    className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Cancel edit
                  </button>
                )}
              </div>
            </form>

            <div className="mt-4 overflow-x-auto rounded border border-slate-200">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Event label</th>
                    <th className="px-4 py-3">Currency</th>
                    <th className="px-4 py-3">HUF-&gt;EUR</th>
                    <th className="px-4 py-3">Active</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleBudgets.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-4 text-slate-500">
                        No budgets found.
                      </td>
                    </tr>
                  ) : (
                    visibleBudgets.map((budget) => (
                      <tr key={budget.id} className="border-t border-slate-100">
                        <td className="px-4 py-3">{budget.name}</td>
                        <td className="px-4 py-3">{budget.event_label ?? "-"}</td>
                        <td className="px-4 py-3">{budget.default_currency}</td>
                        <td className="px-4 py-3">{budget.huf_to_eur_rate}</td>
                        <td className="px-4 py-3">{budget.is_active ? "Yes" : "No"}</td>
                        <td className="px-4 py-3 space-x-2">
                          <button
                            type="button"
                            onClick={() => setBudgetForEditing(budget)}
                            className="rounded border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteBudget(budget.id)}
                            className="rounded border border-rose-300 px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {activeTab === "budget-items" && (
        <section className="space-y-4">
          {renderBudgetSelector()}

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                placeholder="Search category or notes"
                className="w-full max-w-sm rounded border border-slate-300 px-3 py-2 text-sm"
              />
              <select
                value={itemMacroFilter}
                onChange={(e) => setItemMacroFilter(e.target.value)}
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">All macro categories</option>
                {macroCategoryOptions.map((macro) => (
                  <option key={macro} value={macro}>
                    {macro}
                  </option>
                ))}
              </select>
            </div>

            <form onSubmit={handleSaveBudgetItem} className="mt-4 grid gap-3 md:grid-cols-3">
              <select
                required
                value={itemForm.budget_id}
                onChange={(e) => setItemForm((prev) => ({ ...prev, budget_id: e.target.value }))}
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Select budget</option>
                {budgetOptions.map((budget) => (
                  <option key={budget.id} value={budget.id}>
                    {budget.name}
                  </option>
                ))}
              </select>
              <input
                required
                value={itemForm.category_name}
                onChange={(e) =>
                  setItemForm((prev) => ({ ...prev, category_name: e.target.value }))
                }
                placeholder="Category name"
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                required
                value={itemForm.macro_category}
                onChange={(e) =>
                  setItemForm((prev) => ({ ...prev, macro_category: e.target.value }))
                }
                placeholder="Macro category"
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="number"
                step="0.01"
                min="0"
                value={itemForm.unit_cost_original}
                onChange={(e) =>
                  setItemForm((prev) => ({ ...prev, unit_cost_original: e.target.value }))
                }
                placeholder="Unit cost"
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              />
              <select
                value={itemForm.currency}
                onChange={(e) =>
                  setItemForm((prev) => ({ ...prev, currency: e.target.value as Currency }))
                }
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="EUR">EUR</option>
                <option value="HUF">HUF</option>
              </select>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={itemForm.quantity}
                onChange={(e) => setItemForm((prev) => ({ ...prev, quantity: e.target.value }))}
                placeholder="Quantity"
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={itemForm.notes}
                onChange={(e) => setItemForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Notes"
                className="md:col-span-3 rounded border border-slate-300 px-3 py-2 text-sm"
              />

              <div className="md:col-span-3 flex gap-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {itemForm.id ? "Update item" : "Create item"}
                </button>
                {itemForm.id && (
                  <button
                    type="button"
                    onClick={resetItemForm}
                    className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Cancel edit
                  </button>
                )}
              </div>
            </form>

            <div className="mt-4 overflow-x-auto rounded border border-slate-200">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Macro</th>
                    <th className="px-4 py-3">Unit cost</th>
                    <th className="px-4 py-3">Quantity</th>
                    <th className="px-4 py-3">Planned total</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleBudgetItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-4 text-slate-500">
                        No budget items found.
                      </td>
                    </tr>
                  ) : (
                    visibleBudgetItems.map((item) => (
                      <tr key={item.id} className="border-t border-slate-100">
                        <td className="px-4 py-3">{item.category_name}</td>
                        <td className="px-4 py-3">{item.macro_category}</td>
                        <td className="px-4 py-3">
                          {formatCurrency(item.unit_cost_original, item.currency)}
                        </td>
                        <td className="px-4 py-3">{item.quantity}</td>
                        <td className="px-4 py-3">
                          {formatCurrency(item.unit_cost_original * item.quantity, item.currency)}
                        </td>
                        <td className="px-4 py-3 space-x-2">
                          <button
                            type="button"
                            onClick={() => setItemForEditing(item)}
                            className="rounded border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteBudgetItem(item.id)}
                            className="rounded border border-rose-300 px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {activeTab === "transactions" && (
        <section className="space-y-4">
          {renderBudgetSelector()}

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
                placeholder="Search description, party, account"
                className="w-full max-w-sm rounded border border-slate-300 px-3 py-2 text-sm"
              />
              <select
                value={txTypeFilter}
                onChange={(e) =>
                  setTxTypeFilter(e.target.value as "all" | TransactionType)
                }
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="all">All types</option>
                <option value="INCOME">Income</option>
                <option value="EXPENSE">Expense</option>
              </select>
            </div>

            <form onSubmit={handleSaveTransaction} className="mt-4 grid gap-3 md:grid-cols-3">
              <select
                required
                value={transactionForm.budget_id}
                onChange={(e) =>
                  setTransactionForm((prev) => ({ ...prev, budget_id: e.target.value }))
                }
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Select budget</option>
                {budgetOptions.map((budget) => (
                  <option key={budget.id} value={budget.id}>
                    {budget.name}
                  </option>
                ))}
              </select>
              <select
                value={transactionForm.transaction_type}
                onChange={(e) =>
                  setTransactionForm((prev) => ({
                    ...prev,
                    transaction_type: e.target.value as TransactionType,
                  }))
                }
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="EXPENSE">Expense</option>
                <option value="INCOME">Income</option>
              </select>
              <input
                type="date"
                required
                value={transactionForm.transaction_date}
                onChange={(e) =>
                  setTransactionForm((prev) => ({ ...prev, transaction_date: e.target.value }))
                }
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                required
                value={transactionForm.description}
                onChange={(e) =>
                  setTransactionForm((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Description"
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={transactionForm.party}
                onChange={(e) =>
                  setTransactionForm((prev) => ({ ...prev, party: e.target.value }))
                }
                placeholder="Party"
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={transactionForm.amount_original}
                onChange={(e) =>
                  setTransactionForm((prev) => ({ ...prev, amount_original: e.target.value }))
                }
                placeholder="Amount"
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              />
              <select
                value={transactionForm.currency}
                onChange={(e) =>
                  setTransactionForm((prev) => ({ ...prev, currency: e.target.value as Currency }))
                }
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="EUR">EUR</option>
                <option value="HUF">HUF</option>
              </select>
              <select
                value={transactionForm.payment_method}
                onChange={(e) =>
                  setTransactionForm((prev) => ({
                    ...prev,
                    payment_method: e.target.value as PaymentMethod,
                  }))
                }
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              >
                {PAYMENT_METHOD_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <input
                value={transactionForm.account}
                onChange={(e) =>
                  setTransactionForm((prev) => ({ ...prev, account: e.target.value }))
                }
                placeholder="Account"
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={transactionForm.notes}
                onChange={(e) =>
                  setTransactionForm((prev) => ({ ...prev, notes: e.target.value }))
                }
                placeholder="Notes"
                className="md:col-span-3 rounded border border-slate-300 px-3 py-2 text-sm"
              />

              <div className="md:col-span-3 rounded border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-700">Allocations</p>
                  <button
                    type="button"
                    onClick={() =>
                      setTransactionAllocationsDraft((prev) => [
                        ...prev,
                        {
                          budget_item_id: activeBudgetItems[0]?.id ?? "",
                          amount_original: 0,
                        },
                      ])
                    }
                    className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                  >
                    Add split
                  </button>
                </div>

                <div className="mt-2 space-y-2">
                  {transactionAllocationsDraft.length === 0 ? (
                    <p className="text-xs text-slate-500">No splits yet. Add at least one allocation.</p>
                  ) : (
                    transactionAllocationsDraft.map((row, index) => (
                      <div key={`tx-split-${index}`} className="grid gap-2 md:grid-cols-[1fr,180px,80px]">
                        <select
                          value={row.budget_item_id}
                          onChange={(e) =>
                            setTransactionAllocationsDraft((prev) =>
                              prev.map((item, i) =>
                                i === index ? { ...item, budget_item_id: e.target.value } : item
                              )
                            )
                          }
                          className="rounded border border-slate-300 px-3 py-2 text-sm"
                        >
                          <option value="">Select budget item</option>
                          {activeBudgetItems.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.category_name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={row.amount_original}
                          onChange={(e) =>
                            setTransactionAllocationsDraft((prev) =>
                              prev.map((item, i) =>
                                i === index
                                  ? { ...item, amount_original: toNumber(e.target.value) }
                                  : item
                              )
                            )
                          }
                          className="rounded border border-slate-300 px-3 py-2 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setTransactionAllocationsDraft((prev) =>
                              prev.filter((_, i) => i !== index)
                            )
                          }
                          className="rounded border border-rose-300 px-3 py-2 text-xs text-rose-700 hover:bg-rose-50"
                        >
                          Remove
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="md:col-span-3 flex gap-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {transactionForm.id ? "Update transaction" : "Create transaction"}
                </button>
                {transactionForm.id && (
                  <button
                    type="button"
                    onClick={resetTransactionForm}
                    className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Cancel edit
                  </button>
                )}
              </div>
            </form>

            <div className="mt-4 overflow-x-auto rounded border border-slate-200">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Allocations</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-4 text-slate-500">
                        No transactions found.
                      </td>
                    </tr>
                  ) : (
                    visibleTransactions.map((tx) => (
                      <tr key={tx.id} className="border-t border-slate-100">
                        <td className="px-4 py-3">{tx.transaction_date}</td>
                        <td className="px-4 py-3">{tx.transaction_type}</td>
                        <td className="px-4 py-3">
                          <p>{tx.description}</p>
                          <p className="text-xs text-slate-500">{tx.party ?? "-"}</p>
                        </td>
                        <td className="px-4 py-3">{formatCurrency(tx.amount_original, tx.currency)}</td>
                        <td className="px-4 py-3">
                          {(transactionAllocationsByTx.get(tx.id) ?? []).map((alloc) => {
                            const item = budgetItems.find((row) => row.id === alloc.budget_item_id);
                            return (
                              <p key={alloc.id} className="text-xs text-slate-700">
                                {item?.category_name ?? "Unknown"}: {formatCurrency(alloc.amount_original, tx.currency)}
                              </p>
                            );
                          })}
                        </td>
                        <td className="px-4 py-3 space-x-2">
                          <button
                            type="button"
                            onClick={() => setTransactionForEditing(tx)}
                            className="rounded border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteTransaction(tx.id)}
                            className="rounded border border-rose-300 px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {activeTab === "sponsorships" && (
        <section className="space-y-4">
          {renderBudgetSelector()}

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={sponsorSearch}
                onChange={(e) => setSponsorSearch(e.target.value)}
                placeholder="Search sponsor or description"
                className="w-full max-w-sm rounded border border-slate-300 px-3 py-2 text-sm"
              />
              <select
                value={sponsorStatusFilter}
                onChange={(e) =>
                  setSponsorStatusFilter(e.target.value as "all" | SponsorshipStatus)
                }
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="all">All statuses</option>
                {SPONSORSHIP_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <form onSubmit={handleSaveSponsorship} className="mt-4 grid gap-3 md:grid-cols-3">
              <select
                required
                value={sponsorshipForm.budget_id}
                onChange={(e) =>
                  setSponsorshipForm((prev) => ({ ...prev, budget_id: e.target.value }))
                }
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Select budget</option>
                {budgetOptions.map((budget) => (
                  <option key={budget.id} value={budget.id}>
                    {budget.name}
                  </option>
                ))}
              </select>
              <input
                required
                value={sponsorshipForm.sponsor_name}
                onChange={(e) =>
                  setSponsorshipForm((prev) => ({ ...prev, sponsor_name: e.target.value }))
                }
                placeholder="Sponsor name"
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={sponsorshipForm.description}
                onChange={(e) =>
                  setSponsorshipForm((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Description"
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="number"
                step="0.01"
                min="0"
                value={sponsorshipForm.pledged_amount_original}
                onChange={(e) =>
                  setSponsorshipForm((prev) => ({
                    ...prev,
                    pledged_amount_original: e.target.value,
                  }))
                }
                placeholder="Pledged amount"
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="number"
                step="0.01"
                min="0"
                value={sponsorshipForm.paid_amount_original}
                onChange={(e) =>
                  setSponsorshipForm((prev) => ({
                    ...prev,
                    paid_amount_original: e.target.value,
                  }))
                }
                placeholder="Paid amount"
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              />
              <select
                value={sponsorshipForm.currency}
                onChange={(e) =>
                  setSponsorshipForm((prev) => ({ ...prev, currency: e.target.value as Currency }))
                }
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="EUR">EUR</option>
                <option value="HUF">HUF</option>
              </select>
              <select
                value={sponsorshipForm.status}
                onChange={(e) =>
                  setSponsorshipForm((prev) => ({
                    ...prev,
                    status: e.target.value as SponsorshipStatus,
                  }))
                }
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              >
                {SPONSORSHIP_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={sponsorshipForm.expected_date}
                onChange={(e) =>
                  setSponsorshipForm((prev) => ({ ...prev, expected_date: e.target.value }))
                }
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="date"
                value={sponsorshipForm.received_date}
                onChange={(e) =>
                  setSponsorshipForm((prev) => ({ ...prev, received_date: e.target.value }))
                }
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              />
              <select
                value={sponsorshipForm.payment_method}
                onChange={(e) =>
                  setSponsorshipForm((prev) => ({
                    ...prev,
                    payment_method: e.target.value as PaymentMethod,
                  }))
                }
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              >
                {PAYMENT_METHOD_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <input
                value={sponsorshipForm.account}
                onChange={(e) =>
                  setSponsorshipForm((prev) => ({ ...prev, account: e.target.value }))
                }
                placeholder="Account"
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={sponsorshipForm.notes}
                onChange={(e) =>
                  setSponsorshipForm((prev) => ({ ...prev, notes: e.target.value }))
                }
                placeholder="Notes"
                className="md:col-span-3 rounded border border-slate-300 px-3 py-2 text-sm"
              />

              <div className="md:col-span-3 rounded border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-700">Allocations</p>
                  <button
                    type="button"
                    onClick={() =>
                      setSponsorshipAllocationsDraft((prev) => [
                        ...prev,
                        {
                          budget_item_id: activeBudgetItems[0]?.id ?? "",
                          amount_original: 0,
                        },
                      ])
                    }
                    className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                  >
                    Add split
                  </button>
                </div>

                <div className="mt-2 space-y-2">
                  {sponsorshipAllocationsDraft.length === 0 ? (
                    <p className="text-xs text-slate-500">No splits yet. Add at least one allocation.</p>
                  ) : (
                    sponsorshipAllocationsDraft.map((row, index) => (
                      <div
                        key={`sp-split-${index}`}
                        className="grid gap-2 md:grid-cols-[1fr,180px,80px]"
                      >
                        <select
                          value={row.budget_item_id}
                          onChange={(e) =>
                            setSponsorshipAllocationsDraft((prev) =>
                              prev.map((item, i) =>
                                i === index ? { ...item, budget_item_id: e.target.value } : item
                              )
                            )
                          }
                          className="rounded border border-slate-300 px-3 py-2 text-sm"
                        >
                          <option value="">Select budget item</option>
                          {activeBudgetItems.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.category_name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={row.amount_original}
                          onChange={(e) =>
                            setSponsorshipAllocationsDraft((prev) =>
                              prev.map((item, i) =>
                                i === index
                                  ? { ...item, amount_original: toNumber(e.target.value) }
                                  : item
                              )
                            )
                          }
                          className="rounded border border-slate-300 px-3 py-2 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setSponsorshipAllocationsDraft((prev) =>
                              prev.filter((_, i) => i !== index)
                            )
                          }
                          className="rounded border border-rose-300 px-3 py-2 text-xs text-rose-700 hover:bg-rose-50"
                        >
                          Remove
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="md:col-span-3 flex gap-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {sponsorshipForm.id ? "Update sponsorship" : "Create sponsorship"}
                </button>
                {sponsorshipForm.id && (
                  <button
                    type="button"
                    onClick={resetSponsorshipForm}
                    className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Cancel edit
                  </button>
                )}
              </div>
            </form>

            <div className="mt-4 overflow-x-auto rounded border border-slate-200">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="px-4 py-3">Sponsor</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Pledged</th>
                    <th className="px-4 py-3">Paid</th>
                    <th className="px-4 py-3">Allocations</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleSponsorships.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-4 text-slate-500">
                        No sponsorships found.
                      </td>
                    </tr>
                  ) : (
                    visibleSponsorships.map((sponsorship) => (
                      <tr key={sponsorship.id} className="border-t border-slate-100">
                        <td className="px-4 py-3">
                          <p>{sponsorship.sponsor_name}</p>
                          <p className="text-xs text-slate-500">{sponsorship.description ?? "-"}</p>
                        </td>
                        <td className="px-4 py-3">{sponsorship.status}</td>
                        <td className="px-4 py-3">
                          {formatCurrency(
                            sponsorship.pledged_amount_original,
                            sponsorship.currency
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {formatCurrency(sponsorship.paid_amount_original, sponsorship.currency)}
                        </td>
                        <td className="px-4 py-3">
                          {(sponsorshipAllocationsBySponsorship.get(sponsorship.id) ?? []).map(
                            (alloc) => {
                              const item = budgetItems.find(
                                (row) => row.id === alloc.budget_item_id
                              );
                              return (
                                <p key={alloc.id} className="text-xs text-slate-700">
                                  {item?.category_name ?? "Unknown"}: {formatCurrency(alloc.amount_original, sponsorship.currency)}
                                </p>
                              );
                            }
                          )}
                        </td>
                        <td className="px-4 py-3 space-x-2">
                          <button
                            type="button"
                            onClick={() => setSponsorshipForEditing(sponsorship)}
                            className="rounded border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteSponsorship(sponsorship.id)}
                            className="rounded border border-rose-300 px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
