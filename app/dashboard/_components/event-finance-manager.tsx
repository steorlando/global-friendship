"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Currency = "EUR" | "HUF";
type TransactionType = "INCOME" | "EXPENSE";
type PaymentMethod = "bank transfer" | "card" | "cash" | "other";
type SponsorshipStatus = "pledged" | "partially_paid" | "paid" | "cancelled";
type FinanceTab = "overview" | "budget-plan" | "transactions" | "sponsorships" | "settings";

type FinanceSettings = {
  id: boolean;
  event_name: string;
  default_currency: Currency;
  huf_to_eur_rate: number;
  accounts: string[];
  notes: string | null;
  updated_at: string;
};

type BudgetItem = {
  id: string;
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
  settings: FinanceSettings;
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

type SettingsForm = {
  event_name: string;
  default_currency: Currency;
  eur_to_huf_rate: string;
  accounts_raw: string;
  notes: string;
};

type BudgetItemForm = {
  id: string | null;
  category_name: string;
  macro_category: string;
  unit_cost_original: string;
  currency: Currency;
  quantity: string;
  notes: string;
};

type TransactionForm = {
  id: string | null;
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

type BudgetPlanRow = {
  item: BudgetItem;
  planned: number;
  spent: number;
  income: number;
  sponsored: number;
};

const EMPTY_BUDGET_ITEMS: BudgetItem[] = [];
const EMPTY_TRANSACTIONS: FinanceTransaction[] = [];
const EMPTY_TRANSACTION_ALLOCATIONS: TransactionAllocation[] = [];
const EMPTY_SPONSORSHIPS: Sponsorship[] = [];
const EMPTY_SPONSORSHIP_ALLOCATIONS: SponsorshipAllocation[] = [];

const TABS: Array<{ id: FinanceTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "budget-plan", label: "Budget Plan" },
  { id: "transactions", label: "Transactions" },
  { id: "sponsorships", label: "Sponsorships" },
  { id: "settings", label: "Settings" },
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
  const normalized = value.replace(",", ".").trim();
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return fallback;
  return Number(parsed.toFixed(2));
}

function isValidDecimalInput(value: string) {
  return /^$|^\d+([.,]\d{0,2})?$/.test(value.trim());
}

function toEur(value: number, currency: Currency, hufToEurRate: number) {
  if (currency === "EUR") return value;
  return value * hufToEurRate;
}

function toEurToHufRate(hufToEurRate: number): number {
  if (!Number.isFinite(hufToEurRate) || hufToEurRate <= 0) return 400;
  return Number((1 / hufToEurRate).toFixed(2));
}

function parseAccountsInput(raw: string): string[] {
  const unique = new Set<string>();
  for (const part of raw.split(/\r?\n|,/)) {
    const normalized = part.trim();
    if (!normalized) continue;
    unique.add(normalized);
  }
  return [...unique];
}

type ExportCell = string | number | null;

type ExportSheet = {
  name: string;
  headers: string[];
  rows: ExportCell[][];
};

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function buildExcelXmlWorkbook(sheets: ExportSheet[]) {
  const worksheetXml = sheets
    .map((sheet) => {
      const headerRow = `<Row>${sheet.headers
        .map((header) => `<Cell><Data ss:Type="String">${escapeXml(header)}</Data></Cell>`)
        .join("")}</Row>`;

      const rowsXml = sheet.rows
        .map((row) => {
          const cells = row
            .map((cell) => {
              if (cell === null) return `<Cell><Data ss:Type="String"></Data></Cell>`;
              if (typeof cell === "number" && Number.isFinite(cell)) {
                return `<Cell><Data ss:Type="Number">${cell}</Data></Cell>`;
              }
              return `<Cell><Data ss:Type="String">${escapeXml(String(cell))}</Data></Cell>`;
            })
            .join("");
          return `<Row>${cells}</Row>`;
        })
        .join("");

      return `<Worksheet ss:Name="${escapeXml(sheet.name)}"><Table>${headerRow}${rowsXml}</Table></Worksheet>`;
    })
    .join("");

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
${worksheetXml}
</Workbook>`;
}

function emptyBudgetItemForm(): BudgetItemForm {
  return {
    id: null,
    category_name: "",
    macro_category: "General Costs",
    unit_cost_original: "0",
    currency: "EUR",
    quantity: "1",
    notes: "",
  };
}

function emptyTransactionForm(): TransactionForm {
  return {
    id: null,
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

function emptySponsorshipForm(): SponsorshipForm {
  return {
    id: null,
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
  const [dataset, setDataset] = useState<FinanceDataset | null>(null);
  const [activeTab, setActiveTab] = useState<FinanceTab>("overview");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [itemSearch, setItemSearch] = useState("");
  const [itemMacroFilter, setItemMacroFilter] = useState("");
  const [txSearch, setTxSearch] = useState("");
  const [txTypeFilter, setTxTypeFilter] = useState<"all" | TransactionType>("all");
  const [sponsorSearch, setSponsorSearch] = useState("");
  const [sponsorStatusFilter, setSponsorStatusFilter] = useState<"all" | SponsorshipStatus>(
    "all"
  );

  const [settingsForm, setSettingsForm] = useState<SettingsForm>({
    event_name: "Global Friendship",
    default_currency: "EUR",
    eur_to_huf_rate: "400",
    accounts_raw: "",
    notes: "",
  });
  const [itemForm, setItemForm] = useState<BudgetItemForm>(emptyBudgetItemForm());
  const [transactionForm, setTransactionForm] = useState<TransactionForm>(emptyTransactionForm());
  const [sponsorshipForm, setSponsorshipForm] = useState<SponsorshipForm>(emptySponsorshipForm());

  const [transactionAllocationsDraft, setTransactionAllocationsDraft] = useState<AllocationDraft[]>([]);
  const [sponsorshipAllocationsDraft, setSponsorshipAllocationsDraft] = useState<AllocationDraft[]>([]);
  const [showBudgetItemModal, setShowBudgetItemModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showSponsorshipModal, setShowSponsorshipModal] = useState(false);
  const [transactionFormError, setTransactionFormError] = useState<string | null>(null);
  const [sponsorshipFormError, setSponsorshipFormError] = useState<string | null>(null);

  const budgetItems = dataset?.budgetItems ?? EMPTY_BUDGET_ITEMS;
  const transactions = dataset?.transactions ?? EMPTY_TRANSACTIONS;
  const transactionAllocations =
    dataset?.transactionAllocations ?? EMPTY_TRANSACTION_ALLOCATIONS;
  const sponsorships = dataset?.sponsorships ?? EMPTY_SPONSORSHIPS;
  const sponsorshipAllocations =
    dataset?.sponsorshipAllocations ?? EMPTY_SPONSORSHIP_ALLOCATIONS;
  const settings = dataset?.settings ?? {
    id: true,
    event_name: "Global Friendship",
    default_currency: "EUR" as Currency,
    huf_to_eur_rate: 0.0025,
    accounts: [] as string[],
    notes: null,
    updated_at: new Date().toISOString(),
  };

  const configuredAccountOptions = useMemo(
    () =>
      settings.accounts
        .map((account) => account.trim())
        .filter((account, index, all) => account.length > 0 && all.indexOf(account) === index),
    [settings.accounts]
  );

  const usedTransactionAccounts = useMemo(
    () =>
      transactions
        .map((tx) => (tx.account ?? "").trim())
        .filter((account, index, all) => account.length > 0 && all.indexOf(account) === index),
    [transactions]
  );

  const accountOptions = useMemo(
    () => [...new Set([...configuredAccountOptions, ...usedTransactionAccounts])].sort(),
    [configuredAccountOptions, usedTransactionAccounts]
  );

  const macroCategoryOptions = useMemo(
    () => [...new Set(budgetItems.map((item) => item.macro_category))].sort(),
    [budgetItems]
  );

  const transactionAllocationsByTx = useMemo(() => {
    const grouped = new Map<string, TransactionAllocation[]>();
    for (const alloc of transactionAllocations) {
      const row = grouped.get(alloc.transaction_id);
      if (row) row.push(alloc);
      else grouped.set(alloc.transaction_id, [alloc]);
    }
    return grouped;
  }, [transactionAllocations]);

  const sponsorshipAllocationsBySponsorship = useMemo(() => {
    const grouped = new Map<string, SponsorshipAllocation[]>();
    for (const alloc of sponsorshipAllocations) {
      const row = grouped.get(alloc.sponsorship_id);
      if (row) row.push(alloc);
      else grouped.set(alloc.sponsorship_id, [alloc]);
    }
    return grouped;
  }, [sponsorshipAllocations]);

  const budgetPlanRows = useMemo<BudgetPlanRow[]>(() => {
    const txById = new Map(transactions.map((tx) => [tx.id, tx]));
    const sponsorshipById = new Map(sponsorships.map((sp) => [sp.id, sp]));

    return budgetItems.map((item) => {
      const planned = item.unit_cost_original * item.quantity;

      const spent = transactionAllocations.reduce((sum, alloc) => {
        if (alloc.budget_item_id !== item.id) return sum;
        const tx = txById.get(alloc.transaction_id);
        if (!tx || tx.transaction_type !== "EXPENSE") return sum;
        return sum + alloc.amount_original;
      }, 0);

      const income = transactionAllocations.reduce((sum, alloc) => {
        if (alloc.budget_item_id !== item.id) return sum;
        const tx = txById.get(alloc.transaction_id);
        if (!tx || tx.transaction_type !== "INCOME") return sum;
        return sum + alloc.amount_original;
      }, 0);

      const sponsored = sponsorshipAllocations.reduce((sum, alloc) => {
        if (alloc.budget_item_id !== item.id) return sum;
        const sp = sponsorshipById.get(alloc.sponsorship_id);
        if (!sp || sp.status === "cancelled") return sum;
        return sum + alloc.amount_original;
      }, 0);

      return { item, planned, spent, income, sponsored };
    });
  }, [budgetItems, sponsorshipAllocations, sponsorships, transactionAllocations, transactions]);

  const overview = useMemo(() => {
    const plannedEur = budgetPlanRows.reduce(
      (sum, row) => sum + toEur(row.planned, row.item.currency, settings.huf_to_eur_rate),
      0
    );

    const spentEur = budgetPlanRows.reduce(
      (sum, row) => sum + toEur(row.spent, row.item.currency, settings.huf_to_eur_rate),
      0
    );

    const incomeEur = budgetPlanRows.reduce(
      (sum, row) => sum + toEur(row.income, row.item.currency, settings.huf_to_eur_rate),
      0
    );

    const sponsoredEur = budgetPlanRows.reduce(
      (sum, row) => sum + toEur(row.sponsored, row.item.currency, settings.huf_to_eur_rate),
      0
    );

    return {
      plannedEur,
      spentEur,
      incomeEur,
      sponsoredEur,
      balanceEur: incomeEur + sponsoredEur - spentEur,
    };
  }, [budgetPlanRows, settings.huf_to_eur_rate]);

  const accountOverviewRows = useMemo(() => {
    const summaries = new Map<string, { incomeEur: number; expenseEur: number }>();

    for (const account of accountOptions) {
      summaries.set(account, { incomeEur: 0, expenseEur: 0 });
    }

    for (const tx of transactions) {
      const accountName = (tx.account ?? "").trim() || "No account";
      const existing = summaries.get(accountName) ?? { incomeEur: 0, expenseEur: 0 };
      const amountEur = toEur(tx.amount_original, tx.currency, settings.huf_to_eur_rate);

      if (tx.transaction_type === "INCOME") existing.incomeEur += amountEur;
      else existing.expenseEur += amountEur;

      summaries.set(accountName, existing);
    }

    return [...summaries.entries()]
      .map(([account, values]) => ({
        account,
        incomeEur: values.incomeEur,
        expenseEur: values.expenseEur,
        balanceEur: values.incomeEur - values.expenseEur,
      }))
      .sort((a, b) => {
        if (a.account === "No account") return 1;
        if (b.account === "No account") return -1;
        return a.account.localeCompare(b.account);
      });
  }, [accountOptions, settings.huf_to_eur_rate, transactions]);

  const visibleBudgetPlanRows = useMemo(() => {
    const term = itemSearch.trim().toLowerCase();
    return budgetPlanRows.filter((row) => {
      if (itemMacroFilter && row.item.macro_category !== itemMacroFilter) return false;
      if (!term) return true;
      return (
        row.item.category_name.toLowerCase().includes(term) ||
        row.item.macro_category.toLowerCase().includes(term) ||
        (row.item.notes ?? "").toLowerCase().includes(term)
      );
    });
  }, [budgetPlanRows, itemMacroFilter, itemSearch]);

  const visibleTransactions = useMemo(() => {
    const term = txSearch.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (txTypeFilter !== "all" && tx.transaction_type !== txTypeFilter) return false;
      if (!term) return true;
      return (
        tx.description.toLowerCase().includes(term) ||
        (tx.party ?? "").toLowerCase().includes(term) ||
        (tx.account ?? "").toLowerCase().includes(term)
      );
    });
  }, [transactions, txSearch, txTypeFilter]);

  const visibleSponsorships = useMemo(() => {
    const term = sponsorSearch.trim().toLowerCase();
    return sponsorships.filter((sp) => {
      if (sponsorStatusFilter !== "all" && sp.status !== sponsorStatusFilter) return false;
      if (!term) return true;
      return (
        sp.sponsor_name.toLowerCase().includes(term) ||
        (sp.description ?? "").toLowerCase().includes(term)
      );
    });
  }, [sponsorSearch, sponsorStatusFilter, sponsorships]);

  useEffect(() => {
    void reloadData();
  }, []);

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
      setDataset(json);
      setSettingsForm({
        event_name: json.settings.event_name,
        default_currency: json.settings.default_currency,
        eur_to_huf_rate: toEurToHufRate(json.settings.huf_to_eur_rate).toString(),
        accounts_raw: json.settings.accounts.join("\n"),
        notes: json.settings.notes ?? "",
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

  function resetItemForm() {
    setItemForm(emptyBudgetItemForm());
    setShowBudgetItemModal(false);
  }

  function resetTransactionForm() {
    setTransactionForm(emptyTransactionForm());
    setTransactionAllocationsDraft([]);
    setTransactionFormError(null);
    setShowTransactionModal(false);
  }

  function resetSponsorshipForm() {
    setSponsorshipForm(emptySponsorshipForm());
    setSponsorshipAllocationsDraft([]);
    setSponsorshipFormError(null);
    setShowSponsorshipModal(false);
  }

  async function handleSaveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await runMutation(
      {
        entity: "settings",
        action: "update",
        data: {
          event_name: settingsForm.event_name,
          default_currency: settingsForm.default_currency,
          eur_to_huf_rate: toNumber(settingsForm.eur_to_huf_rate, 400),
          accounts: parseAccountsInput(settingsForm.accounts_raw),
          notes: settingsForm.notes,
        },
      },
      "Settings updated."
    );
  }

  async function handleSaveBudgetItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!itemForm.category_name.trim()) return;

    const ok = await runMutation(
      {
        entity: "budget_item",
        action: itemForm.id ? "update" : "create",
        id: itemForm.id ?? undefined,
        data: {
          category_name: itemForm.category_name,
          macro_category: itemForm.macro_category,
          unit_cost_original: toNumber(itemForm.unit_cost_original),
          currency: itemForm.currency,
          quantity: toNumber(itemForm.quantity, 1),
          notes: itemForm.notes,
        },
      },
      itemForm.id ? "Budget item updated." : "Budget item created."
    );

    if (ok) resetItemForm();
  }

  async function handleDeleteBudgetItem(id: string) {
    if (!window.confirm("Delete this budget item and related allocations?")) return;
    await runMutation({ entity: "budget_item", action: "delete", id }, "Budget item deleted.");
  }

  async function handleSaveTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTransactionFormError(null);
    if (!transactionForm.description.trim()) return;

    const transactionAmount = toNumber(transactionForm.amount_original, Number.NaN);
    if (!Number.isFinite(transactionAmount) || transactionAmount <= 0) {
      setTransactionFormError("Amount must be a valid number greater than zero.");
      return;
    }

    const allocationsTotal = transactionAllocationsDraft.reduce(
      (sum, row) => sum + row.amount_original,
      0
    );
    if (Math.abs(allocationsTotal - transactionAmount) > 0.01) {
      setTransactionFormError(
        `Split total (${allocationsTotal.toFixed(2)}) must match transaction amount (${transactionAmount.toFixed(2)}).`
      );
      return;
    }

    const ok = await runMutation(
      {
        entity: "transaction",
        action: transactionForm.id ? "update" : "create",
        id: transactionForm.id ?? undefined,
        data: {
          transaction_type: transactionForm.transaction_type,
          transaction_date: transactionForm.transaction_date,
          description: transactionForm.description,
          party: transactionForm.party,
          amount_original: toNumber(transactionForm.amount_original),
          currency: transactionForm.currency,
          payment_method: transactionForm.payment_method,
          account: transactionForm.account,
          notes: transactionForm.notes,
        },
        allocations: transactionAllocationsDraft,
      },
      transactionForm.id ? "Transaction updated." : "Transaction created."
    );

    if (ok) resetTransactionForm();
  }

  async function handleDeleteTransaction(id: string) {
    if (!window.confirm("Delete this transaction and its allocations?")) return;
    await runMutation({ entity: "transaction", action: "delete", id }, "Transaction deleted.");
  }

  async function handleSaveSponsorship(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSponsorshipFormError(null);
    if (!sponsorshipForm.sponsor_name.trim()) return;

    const pledgedAmount = toNumber(sponsorshipForm.pledged_amount_original, Number.NaN);
    if (!Number.isFinite(pledgedAmount) || pledgedAmount < 0) {
      setSponsorshipFormError("Pledged amount must be a valid number (0 or higher).");
      return;
    }

    const paidAmount = toNumber(sponsorshipForm.paid_amount_original, Number.NaN);
    if (!Number.isFinite(paidAmount) || paidAmount < 0) {
      setSponsorshipFormError("Paid amount must be a valid number (0 or higher).");
      return;
    }

    const allocationsTotal = sponsorshipAllocationsDraft.reduce(
      (sum, row) => sum + row.amount_original,
      0
    );
    if (Math.abs(allocationsTotal - pledgedAmount) > 0.01) {
      setSponsorshipFormError(
        `Split total (${allocationsTotal.toFixed(2)}) must match pledged amount (${pledgedAmount.toFixed(2)}).`
      );
      return;
    }

    const ok = await runMutation(
      {
        entity: "sponsorship",
        action: sponsorshipForm.id ? "update" : "create",
        id: sponsorshipForm.id ?? undefined,
        data: {
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
      },
      sponsorshipForm.id ? "Sponsorship updated." : "Sponsorship created."
    );

    if (ok) resetSponsorshipForm();
  }

  async function handleDeleteSponsorship(id: string) {
    if (!window.confirm("Delete this sponsorship and its allocations?")) return;
    await runMutation({ entity: "sponsorship", action: "delete", id }, "Sponsorship deleted.");
  }

  function setItemForEditing(item: BudgetItem) {
    setItemForm({
      id: item.id,
      category_name: item.category_name,
      macro_category: item.macro_category,
      unit_cost_original: item.unit_cost_original.toString(),
      currency: item.currency,
      quantity: item.quantity.toString(),
      notes: item.notes ?? "",
    });
    setShowBudgetItemModal(true);
  }

  function setTransactionForEditing(tx: FinanceTransaction) {
    setTransactionFormError(null);
    setTransactionForm({
      id: tx.id,
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
    setShowTransactionModal(true);
  }

  function setSponsorshipForEditing(sp: Sponsorship) {
    setSponsorshipFormError(null);
    setSponsorshipForm({
      id: sp.id,
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
    setShowSponsorshipModal(true);
  }

  function downloadOverviewExcel() {
    const budgetPlanSheet: ExportSheet = {
      name: "Budget Plan",
      headers: ["Category", "Macro", "Currency", "Planned", "Spent", "Cash In", "Sponsored"],
      rows: budgetPlanRows.map((row) => [
        row.item.category_name,
        row.item.macro_category,
        row.item.currency,
        Number(row.planned.toFixed(2)),
        Number(row.spent.toFixed(2)),
        Number(row.income.toFixed(2)),
        Number(row.sponsored.toFixed(2)),
      ]),
    };

    const transactionsSheet: ExportSheet = {
      name: "Transactions",
      headers: [
        "Date",
        "Type",
        "Description",
        "Party / Vendor",
        "Amount",
        "Currency",
        "Payment Method",
        "Account",
        "Notes",
        "Allocations",
      ],
      rows: transactions.map((tx) => {
        const allocationSummary = (transactionAllocationsByTx.get(tx.id) ?? [])
          .map((alloc) => {
            const item = budgetItems.find((row) => row.id === alloc.budget_item_id);
            return `${item?.category_name ?? "Unknown"}: ${alloc.amount_original.toFixed(2)}`;
          })
          .join("; ");

        return [
          tx.transaction_date,
          tx.transaction_type,
          tx.description,
          tx.party ?? "",
          Number(tx.amount_original.toFixed(2)),
          tx.currency,
          tx.payment_method,
          tx.account ?? "",
          tx.notes ?? "",
          allocationSummary,
        ];
      }),
    };

    const sponsorshipsSheet: ExportSheet = {
      name: "Sponsorships",
      headers: [
        "Sponsor",
        "Status",
        "Pledged",
        "Paid",
        "Currency",
        "Expected Date",
        "Received Date",
        "Payment Method",
        "Account",
        "Notes",
        "Allocations",
      ],
      rows: sponsorships.map((sp) => {
        const allocationSummary = (sponsorshipAllocationsBySponsorship.get(sp.id) ?? [])
          .map((alloc) => {
            const item = budgetItems.find((row) => row.id === alloc.budget_item_id);
            return `${item?.category_name ?? "Unknown"}: ${alloc.amount_original.toFixed(2)}`;
          })
          .join("; ");

        return [
          sp.sponsor_name,
          sp.status,
          Number(sp.pledged_amount_original.toFixed(2)),
          Number(sp.paid_amount_original.toFixed(2)),
          sp.currency,
          sp.expected_date ?? "",
          sp.received_date ?? "",
          sp.payment_method,
          sp.account ?? "",
          sp.notes ?? "",
          allocationSummary,
        ];
      }),
    };

    const xml = buildExcelXmlWorkbook([budgetPlanSheet, transactionsSheet, sponsorshipsSheet]);
    const blob = new Blob([xml], {
      type: "application/vnd.ms-excel;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `event-finance-${stamp}.xls`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
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
          Single event budget plan with expenses, cash-in and sponsorship coverage.
        </p>
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

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <aside className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <nav className="space-y-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        <div>
      {activeTab === "overview" && (
        <section className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-slate-900">Current Settings</h3>
              <button
                type="button"
                onClick={downloadOverviewExcel}
                className="rounded bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Download Excel
              </button>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded border border-slate-200 px-3 py-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">Exchange Rate</p>
                <p className="text-sm font-medium text-slate-800">
                  1 EUR = {toEurToHufRate(settings.huf_to_eur_rate)} HUF
                </p>
              </div>
              <div className="rounded border border-slate-200 px-3 py-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">Accounts</p>
                <p className="text-sm font-medium text-slate-800">{configuredAccountOptions.length}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Planned</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {formatCurrency(overview.plannedEur, "EUR")}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Cash In</p>
              <p className="mt-2 text-lg font-semibold text-emerald-700">
                {formatCurrency(overview.incomeEur, "EUR")}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Spent</p>
              <p className="mt-2 text-lg font-semibold text-rose-700">
                {formatCurrency(overview.spentEur, "EUR")}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Sponsored</p>
              <p className="mt-2 text-lg font-semibold text-indigo-700">
                {formatCurrency(overview.sponsoredEur, "EUR")}
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
            <h3 className="text-base font-semibold text-slate-900">By Account</h3>
            <p className="mt-1 text-xs text-slate-500">Values converted and shown in EUR.</p>
            <div className="mt-3 overflow-x-auto rounded border border-slate-200">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="px-4 py-3">Account</th>
                    <th className="px-4 py-3">Income</th>
                    <th className="px-4 py-3">Expense</th>
                    <th className="px-4 py-3">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {accountOverviewRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-4 text-slate-500">
                        No account data available.
                      </td>
                    </tr>
                  ) : (
                    accountOverviewRows.map((row) => (
                      <tr key={row.account} className="border-t border-slate-100">
                        <td className="px-4 py-3">{row.account}</td>
                        <td className="px-4 py-3 text-emerald-700">
                          {formatCurrency(row.incomeEur, "EUR")}
                        </td>
                        <td className="px-4 py-3 text-rose-700">
                          {formatCurrency(row.expenseEur, "EUR")}
                        </td>
                        <td
                          className={`px-4 py-3 font-medium ${
                            row.balanceEur >= 0 ? "text-emerald-700" : "text-rose-700"
                          }`}
                        >
                          {formatCurrency(row.balanceEur, "EUR")}
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

      {activeTab === "budget-plan" && (
        <section className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
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
              <button
                type="button"
                onClick={() => {
                  setItemForm(emptyBudgetItemForm());
                  setShowBudgetItemModal(true);
                }}
                className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Create Budget Line
              </button>
            </div>

            {showBudgetItemModal && (
              <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8">
                <div className="w-full max-w-3xl rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <h3 className="text-lg font-semibold text-slate-900">
                      {itemForm.id ? "Edit Budget Line" : "Create Budget Line"}
                    </h3>
                    <button
                      type="button"
                      onClick={resetItemForm}
                      className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Close
                    </button>
                  </div>
                  <form onSubmit={handleSaveBudgetItem} className="grid gap-3 md:grid-cols-3">
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
                      onChange={(e) =>
                        setItemForm((prev) => ({ ...prev, quantity: e.target.value }))
                      }
                      placeholder="Quantity"
                      className="rounded border border-slate-300 px-3 py-2 text-sm"
                    />
                    <input
                      value={itemForm.notes}
                      onChange={(e) =>
                        setItemForm((prev) => ({ ...prev, notes: e.target.value }))
                      }
                      placeholder="Notes"
                      className="rounded border border-slate-300 px-3 py-2 text-sm"
                    />

                    <div className="md:col-span-3 flex gap-2">
                      <button
                        type="submit"
                        disabled={busy}
                        className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                      >
                        {itemForm.id ? "Update item" : "Create item"}
                      </button>
                      <button
                        type="button"
                        onClick={resetItemForm}
                        className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            <div className="mt-4 overflow-x-auto rounded border border-slate-200">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Macro</th>
                    <th className="px-4 py-3">Planned</th>
                    <th className="px-4 py-3">Spent</th>
                    <th className="px-4 py-3">Cash In</th>
                    <th className="px-4 py-3">Sponsored</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleBudgetPlanRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-4 text-slate-500">
                        No budget items found.
                      </td>
                    </tr>
                  ) : (
                    visibleBudgetPlanRows.map((row) => (
                      <tr key={row.item.id} className="border-t border-slate-100">
                        <td className="px-4 py-3">{row.item.category_name}</td>
                        <td className="px-4 py-3">{row.item.macro_category}</td>
                        <td className="px-4 py-3">{formatCurrency(row.planned, row.item.currency)}</td>
                        <td className="px-4 py-3">{formatCurrency(row.spent, row.item.currency)}</td>
                        <td className="px-4 py-3">{formatCurrency(row.income, row.item.currency)}</td>
                        <td className="px-4 py-3">{formatCurrency(row.sponsored, row.item.currency)}</td>
                        <td className="px-4 py-3 space-x-2">
                          <button
                            type="button"
                            onClick={() => setItemForEditing(row.item)}
                            className="rounded border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteBudgetItem(row.item.id)}
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
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
              <input
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
                placeholder="Search description, party, account"
                className="w-full max-w-sm rounded border border-slate-300 px-3 py-2 text-sm"
              />
              <select
                value={txTypeFilter}
                onChange={(e) => setTxTypeFilter(e.target.value as "all" | TransactionType)}
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="all">All types</option>
                <option value="INCOME">Income</option>
                <option value="EXPENSE">Expense</option>
              </select>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTransactionForm(emptyTransactionForm());
                  setTransactionAllocationsDraft([]);
                  setTransactionFormError(null);
                  setShowTransactionModal(true);
                }}
                className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Create Transaction
              </button>
            </div>

            {showTransactionModal && (
              <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8">
                <div className="w-full max-w-4xl rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <h3 className="text-lg font-semibold text-slate-900">
                      {transactionForm.id ? "Edit Transaction" : "Create Transaction"}
                    </h3>
                    <button
                      type="button"
                      onClick={resetTransactionForm}
                      className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Close
                    </button>
                  </div>
                  <form onSubmit={handleSaveTransaction} className="grid gap-3 md:grid-cols-4">
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
                      type="text"
                      inputMode="decimal"
                      required
                      value={transactionForm.amount_original}
                      onChange={(e) => {
                        if (!isValidDecimalInput(e.target.value)) return;
                        setTransactionForm((prev) => ({ ...prev, amount_original: e.target.value }));
                      }}
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
                    <input
                      required
                      value={transactionForm.description}
                      onChange={(e) =>
                        setTransactionForm((prev) => ({ ...prev, description: e.target.value }))
                      }
                      placeholder="Description"
                      className="md:col-span-2 rounded border border-slate-300 px-3 py-2 text-sm"
                    />
                    <input
                      value={transactionForm.party}
                      onChange={(e) =>
                        setTransactionForm((prev) => ({ ...prev, party: e.target.value }))
                      }
                      placeholder="Party / Vendor"
                      className="md:col-span-2 rounded border border-slate-300 px-3 py-2 text-sm"
                    />
                    <select
                      value={transactionForm.payment_method}
                      onChange={(e) =>
                        setTransactionForm((prev) => ({
                          ...prev,
                          payment_method: e.target.value as PaymentMethod,
                        }))
                      }
                      className="md:col-span-2 rounded border border-slate-300 px-3 py-2 text-sm"
                    >
                      {PAYMENT_METHOD_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <select
                      value={transactionForm.account}
                      onChange={(e) =>
                        setTransactionForm((prev) => ({ ...prev, account: e.target.value }))
                      }
                      className="md:col-span-2 rounded border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="">Select account</option>
                      {accountOptions.map((account) => (
                        <option key={account} value={account}>
                          {account}
                        </option>
                      ))}
                      {transactionForm.account &&
                        !accountOptions.includes(transactionForm.account) && (
                          <option value={transactionForm.account}>{transactionForm.account}</option>
                        )}
                    </select>
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
                              { budget_item_id: budgetItems[0]?.id ?? "", amount_original: 0 },
                            ])
                          }
                          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                        >
                          Add split
                        </button>
                      </div>

                      <div className="mt-2 space-y-2">
                        {transactionAllocationsDraft.length === 0 ? (
                          <p className="text-xs text-slate-500">No splits yet.</p>
                        ) : (
                          transactionAllocationsDraft.map((row, index) => (
                            <div
                              key={`tx-split-${index}`}
                              className="grid gap-2 md:grid-cols-[minmax(0,1fr)_120px_auto]"
                            >
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
                                {budgetItems.map((item) => (
                                  <option key={item.id} value={item.id}>
                                    {item.category_name}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={row.amount_original.toString()}
                                onChange={(e) => {
                                  if (!isValidDecimalInput(e.target.value)) return;
                                  setTransactionAllocationsDraft((prev) =>
                                    prev.map((item, i) =>
                                      i === index
                                        ? { ...item, amount_original: toNumber(e.target.value) }
                                        : item
                                    )
                                  );
                                }}
                                placeholder="0.00"
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
                      {transactionFormError && (
                        <p className="mt-2 text-xs text-rose-700">{transactionFormError}</p>
                      )}
                      {!transactionFormError && error && (
                        <p className="mt-2 text-xs text-rose-700">{error}</p>
                      )}
                    </div>

                    <div className="md:col-span-3 flex gap-2">
                      <button
                        type="submit"
                        disabled={busy}
                        className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                      >
                        {transactionForm.id ? "Update transaction" : "Create transaction"}
                      </button>
                      <button
                        type="button"
                        onClick={resetTransactionForm}
                        className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

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
                        <td className="px-4 py-3">{tx.description}</td>
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
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
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
              <button
                type="button"
                onClick={() => {
                  setSponsorshipForm(emptySponsorshipForm());
                  setSponsorshipAllocationsDraft([]);
                  setSponsorshipFormError(null);
                  setShowSponsorshipModal(true);
                }}
                className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Create Sponsorship
              </button>
            </div>

            {showSponsorshipModal && (
              <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8">
                <div className="w-full max-w-4xl rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <h3 className="text-lg font-semibold text-slate-900">
                      {sponsorshipForm.id ? "Edit Sponsorship" : "Create Sponsorship"}
                    </h3>
                    <button
                      type="button"
                      onClick={resetSponsorshipForm}
                      className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Close
                    </button>
                  </div>
                  <form onSubmit={handleSaveSponsorship} className="grid gap-3 md:grid-cols-3">
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
                type="text"
                inputMode="decimal"
                value={sponsorshipForm.pledged_amount_original}
                onChange={(e) => {
                  if (!isValidDecimalInput(e.target.value)) return;
                  setSponsorshipForm((prev) => ({
                    ...prev,
                    pledged_amount_original: e.target.value,
                  }));
                }}
                placeholder="Pledged amount"
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="text"
                inputMode="decimal"
                value={sponsorshipForm.paid_amount_original}
                onChange={(e) => {
                  if (!isValidDecimalInput(e.target.value)) return;
                  setSponsorshipForm((prev) => ({
                    ...prev,
                    paid_amount_original: e.target.value,
                  }));
                }}
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
              <select
                value={sponsorshipForm.account}
                onChange={(e) =>
                  setSponsorshipForm((prev) => ({ ...prev, account: e.target.value }))
                }
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Select account</option>
                {accountOptions.map((account) => (
                  <option key={account} value={account}>
                    {account}
                  </option>
                ))}
                {sponsorshipForm.account && !accountOptions.includes(sponsorshipForm.account) && (
                  <option value={sponsorshipForm.account}>{sponsorshipForm.account}</option>
                )}
              </select>
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
                        { budget_item_id: budgetItems[0]?.id ?? "", amount_original: 0 },
                      ])
                    }
                    className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                  >
                    Add split
                  </button>
                </div>

                <div className="mt-2 space-y-2">
                  {sponsorshipAllocationsDraft.length === 0 ? (
                    <p className="text-xs text-slate-500">No splits yet.</p>
                  ) : (
                    sponsorshipAllocationsDraft.map((row, index) => (
                      <div
                        key={`sp-split-${index}`}
                        className="grid gap-2 md:grid-cols-[minmax(0,1fr)_120px_auto]"
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
                          {budgetItems.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.category_name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={row.amount_original.toString()}
                          onChange={(e) => {
                            if (!isValidDecimalInput(e.target.value)) return;
                            setSponsorshipAllocationsDraft((prev) =>
                              prev.map((item, i) =>
                                i === index
                                  ? { ...item, amount_original: toNumber(e.target.value) }
                                  : item
                              )
                            );
                          }}
                          placeholder="0.00"
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
                {sponsorshipFormError && (
                  <p className="mt-2 text-xs text-rose-700">{sponsorshipFormError}</p>
                )}
                {!sponsorshipFormError && error && (
                  <p className="mt-2 text-xs text-rose-700">{error}</p>
                )}
              </div>

              <div className="md:col-span-3 flex gap-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {sponsorshipForm.id ? "Update sponsorship" : "Create sponsorship"}
                </button>
                <button
                  type="button"
                  onClick={resetSponsorshipForm}
                  className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
              </div>
                  </form>
                </div>
              </div>
            )}

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
                        <td className="px-4 py-3">{sponsorship.sponsor_name}</td>
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
                              const item = budgetItems.find((row) => row.id === alloc.budget_item_id);
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

      {activeTab === "settings" && (
        <section className="space-y-4">
          <form
            onSubmit={handleSaveSettings}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <h3 className="text-base font-semibold text-slate-900">Event Settings</h3>
            <p className="mt-1 text-xs text-slate-500">
              Exchange rate is stored as 1 EUR = X HUF. Internal conversions remain consistent.
            </p>
            <div className="mt-3 grid gap-2 md:max-w-md md:grid-cols-[120px_1fr_80px] md:items-center">
              <span className="text-sm font-medium text-slate-700">1 EUR =</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={settingsForm.eur_to_huf_rate}
                onChange={(e) =>
                  setSettingsForm((prev) => ({ ...prev, eur_to_huf_rate: e.target.value }))
                }
                placeholder="0.00"
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              />
              <span className="text-sm font-medium text-slate-700">HUF</span>
            </div>
            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Available Accounts
              </label>
              <textarea
                value={settingsForm.accounts_raw}
                onChange={(e) =>
                  setSettingsForm((prev) => ({ ...prev, accounts_raw: e.target.value }))
                }
                placeholder={"One account per line\nCash\nBank EUR\nBank HUF"}
                rows={5}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-slate-500">
                These values will be available in Transactions and Sponsorships account fields.
              </p>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="mt-3 rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              Save settings
            </button>
          </form>
        </section>
      )}
        </div>
      </div>
    </div>
  );
}
