"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ALLOGGIO_SHORT_OPTIONS,
  ARRIVAL_DATE_MAX,
  ARRIVAL_DATE_MIN,
  DEPARTURE_DATE_MAX,
  DEPARTURE_DATE_MIN,
  DIFFICOLTA_ACCESSIBILITA_OPTIONS,
  ESIGENZE_ALIMENTARI_OPTIONS,
  OPERATOR_ACCOMMODATION_PREFERENCE_OPTIONS,
  REGISTRATION_TYPE_OPTIONS,
  isOperatorRegistrationType,
  isAutonomousAccommodation,
  normalizeOperatorAccommodationPreference,
} from "@/lib/partecipante/constants";
import { useI18n } from "@/lib/i18n/provider";

type PresenceDettaglioMap = Record<string, boolean>;

type Participant = {
  id: string;
  personal_code?: string | null;
  created_at: string | null;
  nome: string | null;
  cognome: string | null;
  eta: number | null;
  tipo_iscrizione: string | null;
  preferenza_alloggio_operatore: string | null;
  gruppo_leader?: string | null;
  citta: string | null;
  paese_residenza: string | null;
  nazione: string | null;
  email: string | null;
  telefono: string | null;
  data_nascita: string | null;
  data_arrivo: string | null;
  data_partenza: string | null;
  alloggio: string | null;
  allergie: string | null;
  esigenze_alimentari: string[];
  disabilita_accessibilita: boolean | null;
  difficolta_accessibilita: string[];
  quota_totale: number | null;
  fee_paid?: number | null;
  group: string;
  gruppo_roma?: string | null;
  partecipa_intero_evento?: boolean | null;
  presenza_dettaglio?: PresenceDettaglioMap | null;
  can_manage_host_city_fields?: boolean | null;
};

type FormState = {
  nome: string;
  cognome: string;
  tipo_iscrizione: string;
  paese_residenza: string;
  citta: string;
  gruppo_roma: string;
  nazione: string;
  email: string;
  telefono: string;
  data_nascita: string;
  data_arrivo: string;
  data_partenza: string;
  alloggio: string;
  preferenza_alloggio_operatore: string;
  allergie: string;
  esigenze_alimentari: string[];
  disabilita_accessibilita: boolean;
  difficolta_accessibilita: string[];
  partecipa_intero_evento: boolean | null;
  presenza_dettaglio: PresenceDettaglioMap | null;
};

type SortKey =
  | "group"
  | "created_at"
  | "nome"
  | "cognome"
  | "eta"
  | "tipo_iscrizione"
  | "citta"
  | "data_arrivo"
  | "data_partenza"
  | "alloggio"
  | "quota_totale";

type OptionalColumnKey = "tipo_iscrizione" | "citta" | "eta";

type SortDirection = "asc" | "desc";
type EnrollmentBucket = "Higher students" | "University-Worker" | "Operator";

type ParticipantsTableProps = {
  apiBasePath: string;
  groupSummaryLabel: string;
  showRegistrationDate?: boolean;
  showTotalFee?: boolean;
  showPaymentSummary?: boolean;
  allowExcelExport?: boolean;
  canEditGroupAssignment?: boolean;
  initialEditParticipantId?: string | null;
  modalOnly?: boolean;
  onCloseEditModal?: () => void;
};

const EMPTY_FORM: FormState = {
  nome: "",
  cognome: "",
  tipo_iscrizione: "",
  paese_residenza: "",
  citta: "",
  gruppo_roma: "",
  nazione: "",
  email: "",
  telefono: "",
  data_nascita: "",
  data_arrivo: "",
  data_partenza: "",
  alloggio: "",
  preferenza_alloggio_operatore: "",
  allergie: "",
  esigenze_alimentari: [],
  disabilita_accessibilita: false,
  difficolta_accessibilita: [],
  partecipa_intero_evento: null,
  presenza_dettaglio: null,
};

const OPTIONAL_COLUMNS: OptionalColumnKey[] = ["tipo_iscrizione", "citta", "eta"];
const HOST_CITY_PRESENCE_OPTIONS = [
  "Opening ceremony Friday 28th August",
  "Dinner - Friday 28th August",
  "Friday 29 August – Morning",
  "Lunch – August 29",
  "Afternoon – August 29",
  "Dinner – August 29",
  "Saturday morning, August 30",
  "Lunch – August 30",
  "Afternoon – August 30",
  "Dinner and party – August 30",
];

function parseBooleanLoose(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1 ? true : value === 0 ? false : null;
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "off", ""].includes(normalized)) return false;
  return null;
}

function normalizePresenceDettaglio(value: unknown): PresenceDettaglioMap | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const map: PresenceDettaglioMap = {};
  for (const [rawKey, rawValue] of Object.entries(value as Record<string, unknown>)) {
    const key = rawKey.trim();
    if (!key || key.toLowerCase() === "general") continue;
    const parsed = parseBooleanLoose(rawValue);
    if (parsed === null) continue;
    map[key] = parsed;
  }
  return Object.keys(map).length > 0 ? map : null;
}

function toFormState(participant: Participant): FormState {
  const citta = participant.citta ?? "";
  const isRomaCity = normalizeFilterText(citta) === "roma";
  return {
    nome: participant.nome ?? "",
    cognome: participant.cognome ?? "",
    tipo_iscrizione: participant.tipo_iscrizione ?? "",
    paese_residenza: participant.paese_residenza ?? "",
    citta,
    gruppo_roma: isRomaCity ? participant.group ?? "" : "",
    nazione: participant.nazione ?? "",
    email: participant.email ?? "",
    telefono: participant.telefono ?? "",
    data_nascita: participant.data_nascita ?? "",
    data_arrivo: participant.data_arrivo ?? "",
    data_partenza: participant.data_partenza ?? "",
    alloggio: participant.alloggio ?? "",
    preferenza_alloggio_operatore:
      participant.preferenza_alloggio_operatore ?? "",
    allergie: participant.allergie ?? "",
    esigenze_alimentari: Array.isArray(participant.esigenze_alimentari)
      ? participant.esigenze_alimentari
      : [],
    disabilita_accessibilita: Boolean(participant.disabilita_accessibilita),
    difficolta_accessibilita: participant.difficolta_accessibilita ?? [],
    partecipa_intero_evento:
      typeof participant.partecipa_intero_evento === "boolean"
        ? participant.partecipa_intero_evento
        : null,
    presenza_dettaglio: normalizePresenceDettaglio(participant.presenza_dettaglio),
  };
}

function dateInRange(value: string | null, min: string, max: string) {
  if (!value) return false;
  return value >= min && value <= max;
}

function displayDate(value: string | null, min: string, max: string) {
  if (!value) return "-";
  return dateInRange(value, min, max) ? value : "-";
}

function displayRegistrationDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
}

function accommodationOptionLabel(option: string, t: (key: string) => string) {
  if (option === "Provided by organization") {
    return t("manager.presence.filter.organization");
  }
  if (option === "Atonoumous") {
    return t("manager.presence.filter.autonomous");
  }
  return option;
}

function dietaryOptionLabel(option: string, t: (key: string) => string) {
  if (option === "Vegetarian") return t("participant.option.dietary.vegetarian");
  if (option === "Vegan") return t("participant.option.dietary.vegan");
  if (option === "I don't eat pork") return t("participant.option.dietary.noPork");
  if (option === "Other") return t("participant.option.dietary.other");
  return option;
}

function accessibilityOptionLabel(option: string, t: (key: string) => string) {
  if (option === "Difficulty seeing, even when wearing glasses") {
    return t("participant.option.accessibility.seeing");
  }
  if (option === "Difficulty hearing, even when using a hearing aid") {
    return t("participant.option.accessibility.hearing");
  }
  if (option === "Difficulty walking or climbing steps") {
    return t("participant.option.accessibility.walking");
  }
  if (option === "Difficulty with self-care (washing or dressing)") {
    return t("participant.option.accessibility.selfCare");
  }
  if (option === "Difficulty concentrating or remembering") {
    return t("participant.option.accessibility.concentration");
  }
  if (option === "Difficulty communicating or being understood") {
    return t("participant.option.accessibility.communicating");
  }
  if (option === "I use a wheelchair or mobility aid") {
    return t("participant.option.accessibility.wheelchair");
  }
  if (option === "I need accessible accommodation") {
    return t("participant.option.accessibility.accessibleAccommodation");
  }
  if (option === "I need assistance during the event") {
    return t("participant.option.accessibility.assistance");
  }
  return option;
}

function operatorAccommodationPreferenceLabel(
  option: string,
  t: (key: string) => string
) {
  if (option === "Hostel with group") {
    return t("operatorAccommodationPreference.option.hostelWithGroup");
  }
  if (option === "Hotel") {
    return t("operatorAccommodationPreference.option.hotel");
  }
  return option;
}

function normalizeFilterText(value: string | null | undefined) {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function mapEnrollmentBucket(rawType: string | null): EnrollmentBucket | null {
  if (!rawType) return null;
  const value = rawType.toLowerCase().trim();

  if (value.includes("driver - autista")) return null;
  if (value.includes("higher student")) return "Higher students";
  if (value.includes("undergraduate")) return "University-Worker";
  if (value.includes("worker - lavoratore")) return "University-Worker";
  if (value.includes("operator - operatore")) return "Operator";

  return null;
}

function isItalyCountry(value: string | null | undefined): boolean {
  const normalized = normalizeFilterText(value);
  return normalized === "italia" || normalized === "italy";
}

function participantStatsCountryValue(participant: Participant): string {
  return (participant.paese_residenza ?? participant.nazione ?? "").trim() || "-";
}

function participantStatsGroupValue(participant: Participant): string {
  return (participant.group ?? "").trim() || "-";
}

function isRomaParticipant(participant: Participant) {
  const candidates = [
    normalizeFilterText(participant.citta),
    normalizeFilterText(participant.paese_residenza),
    normalizeFilterText(participant.group),
  ];
  return candidates.some((value) => value.includes("roma"));
}

function toPresenceOptionLabel(key: string) {
  const trimmed = key.trim();
  const match = /^\((.*)\)$/.exec(trimmed);
  return match ? match[1] : trimmed;
}

export function ParticipantsTable({
  apiBasePath,
  groupSummaryLabel,
  showRegistrationDate = false,
  showTotalFee = true,
  showPaymentSummary = false,
  allowExcelExport = false,
  canEditGroupAssignment = false,
  initialEditParticipantId: initialEditParticipantIdProp = null,
  modalOnly = false,
  onCloseEditModal,
}: ParticipantsTableProps) {
  const { t, formatNumber } = useI18n();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [showGroupColumn, setShowGroupColumn] = useState(false);
  const [visibleOptionalColumns, setVisibleOptionalColumns] = useState<OptionalColumnKey[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [assignableGroups, setAssignableGroups] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [initialEditParticipantId, setInitialEditParticipantId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("cognome");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [groupFilter, setGroupFilter] = useState("");
  const [nomeFilter, setNomeFilter] = useState("");
  const [cognomeFilter, setCognomeFilter] = useState("");
  const [tipoIscrizioneFilter, setTipoIscrizioneFilter] = useState("");
  const [cittaFilter, setCittaFilter] = useState("");
  const [etaMinFilter, setEtaMinFilter] = useState("");
  const [etaMaxFilter, setEtaMaxFilter] = useState("");
  const [registrationDateFilter, setRegistrationDateFilter] = useState("");
  const [arrivoFilter, setArrivoFilter] = useState("");
  const [partenzaFilter, setPartenzaFilter] = useState("");
  const [alloggioFilter, setAlloggioFilter] = useState("");
  const [quotaMinFilter, setQuotaMinFilter] = useState("");
  const [quotaMaxFilter, setQuotaMaxFilter] = useState("");
  const [operatorAccommodationFilter, setOperatorAccommodationFilter] = useState("");
  const [statCountryFilter, setStatCountryFilter] = useState("");
  const [statGroupFilter, setStatGroupFilter] = useState("");
  const [statCityFilter, setStatCityFilter] = useState("");
  const [statItalyOnlyFilter, setStatItalyOnlyFilter] = useState(false);
  const [enrollmentBucketFilter, setEnrollmentBucketFilter] = useState<EnrollmentBucket | "">("");
  const [onlyRoma, setOnlyRoma] = useState(false);

  const editingParticipant = useMemo(
    () => participants.find((participant) => participant.id === editingId) ?? null,
    [editingId, participants]
  );
  const canEditHostCityFields = Boolean(
    editingParticipant?.can_manage_host_city_fields
  );
  const showOperatorAccommodationPreference = isOperatorRegistrationType(
    form.tipo_iscrizione
  ) && !isAutonomousAccommodation(form.alloggio);
  const presenceOptions = useMemo(() => {
    const fromParticipant = Object.keys(editingParticipant?.presenza_dettaglio ?? {});
    const fromForm = Object.keys(form.presenza_dettaglio ?? {});
    const merged = [...new Set([...fromParticipant, ...fromForm, ...HOST_CITY_PRESENCE_OPTIONS])];
    return merged.filter(Boolean);
  }, [editingParticipant?.presenza_dettaglio, form.presenza_dettaglio]);
  const isRomaCityInForm = normalizeFilterText(form.citta) === "roma";
  const showRegistrationTypeColumn = visibleOptionalColumns.includes("tipo_iscrizione");
  const showCityColumn = visibleOptionalColumns.includes("citta");
  const showAgeColumn = visibleOptionalColumns.includes("eta");
  const paymentSummary = useMemo(() => {
    let totalExpected = 0;
    let totalPaid = 0;

    for (const participant of participants) {
      totalExpected += participant.quota_totale ?? 0;
      totalPaid += participant.fee_paid ?? 0;
    }

    return {
      totalExpected,
      totalPaid,
      outstanding: totalExpected - totalPaid,
    };
  }, [participants]);

  const formatCurrency = (value: number) =>
    formatNumber(value, { style: "currency", currency: "EUR" });
  const formatFeeProgressValue = (value: number) =>
    formatNumber(value, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  const filteredSortedParticipants = useMemo(() => {
    const filtered = participants.filter((participant) => {
      if (
        showGroupColumn &&
        groupFilter &&
        !(participant.group ?? "").toLowerCase().includes(groupFilter.toLowerCase())
      ) {
        return false;
      }
      if (
        nomeFilter &&
        !(participant.nome ?? "").toLowerCase().includes(nomeFilter.toLowerCase())
      ) {
        return false;
      }
      if (
        cognomeFilter &&
        !(participant.cognome ?? "").toLowerCase().includes(cognomeFilter.toLowerCase())
      ) {
        return false;
      }
      if (
        showRegistrationTypeColumn &&
        tipoIscrizioneFilter &&
        !(participant.tipo_iscrizione ?? "")
          .toLowerCase()
          .includes(tipoIscrizioneFilter.toLowerCase())
      ) {
        return false;
      }
      if (
        showCityColumn &&
        cittaFilter &&
        !(participant.citta ?? "").toLowerCase().includes(cittaFilter.toLowerCase())
      ) {
        return false;
      }
      if (
        statCountryFilter &&
        normalizeFilterText(participantStatsCountryValue(participant)) !==
          normalizeFilterText(statCountryFilter)
      ) {
        return false;
      }
      if (
        statGroupFilter &&
        normalizeFilterText(participantStatsGroupValue(participant)) !==
          normalizeFilterText(statGroupFilter)
      ) {
        return false;
      }
      if (
        statCityFilter &&
        normalizeFilterText(participant.citta) !== normalizeFilterText(statCityFilter)
      ) {
        return false;
      }
      if (statItalyOnlyFilter && !isItalyCountry(participant.paese_residenza)) {
        return false;
      }
      if (
        enrollmentBucketFilter &&
        mapEnrollmentBucket(participant.tipo_iscrizione) !== enrollmentBucketFilter
      ) {
        return false;
      }
      if (showAgeColumn && etaMinFilter) {
        const min = Number(etaMinFilter);
        if (!Number.isNaN(min) && (participant.eta ?? -Infinity) < min) {
          return false;
        }
      }
      if (showAgeColumn && etaMaxFilter) {
        const max = Number(etaMaxFilter);
        if (!Number.isNaN(max) && (participant.eta ?? Infinity) > max) {
          return false;
        }
      }
      if (showRegistrationDate && registrationDateFilter) {
        const registrationDateOnly = (participant.created_at ?? "").slice(0, 10);
        if (registrationDateOnly !== registrationDateFilter) {
          return false;
        }
      }
      if (arrivoFilter && (participant.data_arrivo ?? "") !== arrivoFilter) {
        return false;
      }
      if (partenzaFilter && (participant.data_partenza ?? "") !== partenzaFilter) {
        return false;
      }
      if (alloggioFilter && (participant.alloggio ?? "") !== alloggioFilter) {
        return false;
      }
      if (showTotalFee && quotaMinFilter) {
        const min = Number(quotaMinFilter);
        if (!Number.isNaN(min) && (participant.quota_totale ?? -Infinity) < min) {
          return false;
        }
      }
      if (showTotalFee && quotaMaxFilter) {
        const max = Number(quotaMaxFilter);
        if (!Number.isNaN(max) && (participant.quota_totale ?? Infinity) > max) {
          return false;
        }
      }
      if (onlyRoma && !isRomaParticipant(participant)) {
        return false;
      }
      if (operatorAccommodationFilter) {
        if (!isOperatorRegistrationType(participant.tipo_iscrizione)) {
          return false;
        }
        const preference = normalizeOperatorAccommodationPreference(
          participant.preferenza_alloggio_operatore
        );
        const isAutonomous = isAutonomousAccommodation(participant.alloggio);
        if (operatorAccommodationFilter === "not-applicable" && !isAutonomous) {
          return false;
        }
        if (
          operatorAccommodationFilter !== "not-applicable" &&
          isAutonomous
        ) {
          return false;
        }
        if (operatorAccommodationFilter === "hotel" && preference !== "Hotel") {
          return false;
        }
        if (
          operatorAccommodationFilter === "hostel" &&
          preference !== "Hostel with group"
        ) {
          return false;
        }
        if (operatorAccommodationFilter === "missing" && preference !== null) {
          return false;
        }
      }
      return true;
    });

    filtered.sort((a, b) => {
      const direction = sortDirection === "asc" ? 1 : -1;
      const aValue =
        sortKey === "quota_totale"
          ? a.quota_totale ?? -Infinity
          : sortKey === "eta"
            ? a.eta ?? -Infinity
            : sortKey === "created_at"
            ? new Date(a.created_at ?? "").getTime() || -Infinity
            : (a[sortKey] ?? "").toString().toLowerCase();
      const bValue =
        sortKey === "quota_totale"
          ? b.quota_totale ?? -Infinity
          : sortKey === "eta"
            ? b.eta ?? -Infinity
            : sortKey === "created_at"
            ? new Date(b.created_at ?? "").getTime() || -Infinity
            : (b[sortKey] ?? "").toString().toLowerCase();

      if (aValue < bValue) return -1 * direction;
      if (aValue > bValue) return 1 * direction;
      return 0;
    });

    return filtered;
  }, [
    alloggioFilter,
    arrivoFilter,
    cognomeFilter,
    cittaFilter,
    enrollmentBucketFilter,
    etaMaxFilter,
    etaMinFilter,
    groupFilter,
    nomeFilter,
    participants,
    onlyRoma,
    operatorAccommodationFilter,
    partenzaFilter,
    quotaMaxFilter,
    quotaMinFilter,
    registrationDateFilter,
    showGroupColumn,
    showCityColumn,
    showAgeColumn,
    showRegistrationDate,
    showRegistrationTypeColumn,
    sortDirection,
    sortKey,
    statCityFilter,
    statCountryFilter,
    statGroupFilter,
    statItalyOnlyFilter,
    tipoIscrizioneFilter,
    showTotalFee,
  ]);

  const tableColumnCount =
    (showGroupColumn ? 1 : 0) +
    2 +
    visibleOptionalColumns.length +
    (showRegistrationDate ? 1 : 0) +
    2 +
    1 +
    (showTotalFee ? 1 : 0) +
    1;

  useEffect(() => {
    if (initialEditParticipantIdProp) {
      setInitialEditParticipantId(initialEditParticipantIdProp);
      return;
    }
    if (modalOnly) return;

    const params = new URLSearchParams(window.location.search);
    const editParticipant = params.get("editParticipant") ?? "";
    if (editParticipant) setInitialEditParticipantId(editParticipant);

    const operatorAccommodation = params.get("operatorAccommodation") ?? "";
    if (["hotel", "hostel", "missing", "not-applicable"].includes(operatorAccommodation)) {
      setOperatorAccommodationFilter(operatorAccommodation);
      setTipoIscrizioneFilter("Operator");
      setVisibleOptionalColumns((prev) =>
        prev.includes("tipo_iscrizione") ? prev : [...prev, "tipo_iscrizione"]
      );
    }

    const statCountry = params.get("statCountry") ?? "";
    if (statCountry) setStatCountryFilter(statCountry);

    const statGroup = params.get("statGroup") ?? "";
    if (statGroup) {
      setStatGroupFilter(statGroup);
      setGroupFilter(statGroup);
    }

    const statCity = params.get("statCity") ?? "";
    if (statCity) {
      setStatCityFilter(statCity);
      setCittaFilter(statCity);
      setVisibleOptionalColumns((prev) =>
        prev.includes("citta") ? prev : [...prev, "citta"]
      );
    }

    if (params.get("statItalyOnly") === "1") {
      setStatItalyOnlyFilter(true);
    }

    const enrollmentBucket = params.get("enrollmentBucket") ?? "";
    if (
      enrollmentBucket === "Higher students" ||
      enrollmentBucket === "University-Worker" ||
      enrollmentBucket === "Operator"
    ) {
      setEnrollmentBucketFilter(enrollmentBucket);
      if (enrollmentBucket === "Operator") setTipoIscrizioneFilter("Operator");
      setVisibleOptionalColumns((prev) =>
        prev.includes("tipo_iscrizione") ? prev : [...prev, "tipo_iscrizione"]
      );
    }
  }, [initialEditParticipantIdProp, modalOnly]);

  useEffect(() => {
    if (!initialEditParticipantId || participants.length === 0 || editingId) return;
    const participant = participants.find((row) => row.id === initialEditParticipantId);
    if (!participant) return;
    openEditModal(participant);
    setInitialEditParticipantId(null);
  }, [editingId, initialEditParticipantId, participants]);

  useEffect(() => {
    async function loadParticipants() {
      setLoading(true);
      setLoadError(null);

      try {
        const res = await fetch(apiBasePath, { method: "GET" });
        const json = await res.json();

        if (!res.ok) {
          setLoadError(json.error ?? t("participants.table.loadError"));
          return;
        }

        setParticipants(Array.isArray(json.participants) ? json.participants : []);
        setShowGroupColumn(Boolean(json.showGroupColumn));
        setGroups(Array.isArray(json.groups) ? json.groups : []);
        setAssignableGroups(
          Array.isArray(json.assignableGroups) ? json.assignableGroups : []
        );
      } catch {
        setLoadError(t("participants.table.loadError"));
      } finally {
        setLoading(false);
      }
    }

    loadParticipants();
  }, [apiBasePath, t]);

  function openEditModal(participant: Participant) {
    setEditingId(participant.id);
    setForm(toFormState(participant));
    setError(null);
    setSuccess(null);
  }

  function closeEditModal() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDeleting(false);
    setError(null);
    onCloseEditModal?.();
  }

  function toggleDifficolta(option: string) {
    setForm((prev) => {
      const exists = prev.difficolta_accessibilita.includes(option);
      return {
        ...prev,
        difficolta_accessibilita: exists
          ? prev.difficolta_accessibilita.filter((item) => item !== option)
          : [...prev.difficolta_accessibilita, option],
      };
    });
  }

  function toggleEsigenza(option: string) {
    setForm((prev) => {
      const exists = prev.esigenze_alimentari.includes(option);
      return {
        ...prev,
        esigenze_alimentari: exists
          ? prev.esigenze_alimentari.filter((item) => item !== option)
          : [...prev.esigenze_alimentari, option],
      };
    });
  }

  function togglePresenzaDettaglio(option: string) {
    setForm((prev) => {
      const current = prev.presenza_dettaglio ?? {};
      return {
        ...prev,
        presenza_dettaglio: {
          ...current,
          [option]: !Boolean(current[option]),
        },
      };
    });
  }

  function toggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection("asc");
  }

  function sortLabel(key: SortKey) {
    if (sortKey !== key) return " ";
    return sortDirection === "asc" ? "↑" : "↓";
  }

  function resetFilters() {
    setGroupFilter("");
    setNomeFilter("");
    setCognomeFilter("");
    setTipoIscrizioneFilter("");
    setCittaFilter("");
    setEtaMinFilter("");
    setEtaMaxFilter("");
    setRegistrationDateFilter("");
    setArrivoFilter("");
    setPartenzaFilter("");
    setAlloggioFilter("");
    setQuotaMinFilter("");
    setQuotaMaxFilter("");
    setOperatorAccommodationFilter("");
  }

  function toggleOptionalColumn(column: OptionalColumnKey) {
    setVisibleOptionalColumns((prev) => {
      if (prev.includes(column)) {
        if (column === "tipo_iscrizione") {
          setTipoIscrizioneFilter("");
        }
        if (column === "citta") {
          setCittaFilter("");
        }
        if (column === "eta") {
          setEtaMinFilter("");
          setEtaMaxFilter("");
        }
        if (sortKey === column) {
          setSortKey("cognome");
          setSortDirection("asc");
        }
        return prev.filter((item) => item !== column);
      }
      return [...prev, column].sort(
        (a, b) => OPTIONAL_COLUMNS.indexOf(a) - OPTIONAL_COLUMNS.indexOf(b)
      );
    });
  }

  async function downloadParticipantsExcel() {
    if (exportingExcel || participants.length === 0) return;

    setExportingExcel(true);
    setExportError(null);

    try {
      const XLSX = await import("xlsx");
      const columns = [
        { label: t("participants.export.personalCode"), value: (p: Participant) => {
          const code = (p.personal_code ?? "").trim();
          return /^\d{1,4}$/.test(code) ? code.padStart(4, "0") : code;
        } },
        { label: t("participants.table.header.firstName"), value: (p: Participant) => p.nome ?? "" },
        { label: t("participants.table.header.lastName"), value: (p: Participant) => p.cognome ?? "" },
        { label: t("participants.table.header.group"), value: (p: Participant) => p.group ?? "" },
        { label: t("participants.table.header.registrationType"), value: (p: Participant) => p.tipo_iscrizione ?? "" },
        { label: t("participants.export.email"), value: (p: Participant) => p.email ?? "" },
        { label: t("participants.export.phone"), value: (p: Participant) => p.telefono ?? "" },
        { label: t("participants.export.birthDate"), value: (p: Participant) => p.data_nascita ?? "" },
        { label: t("participants.table.header.age"), value: (p: Participant) => p.eta ?? "" },
        { label: t("participants.export.country"), value: (p: Participant) => p.paese_residenza ?? p.nazione ?? "" },
        { label: t("participants.table.header.city"), value: (p: Participant) => p.citta ?? "" },
        { label: t("participants.table.header.arrivalDate"), value: (p: Participant) => p.data_arrivo ?? "" },
        { label: t("participants.table.header.departureDate"), value: (p: Participant) => p.data_partenza ?? "" },
        { label: t("participants.table.header.accommodation"), value: (p: Participant) => p.alloggio ?? "" },
        { label: t("participants.export.operatorAccommodation"), value: (p: Participant) => p.preferenza_alloggio_operatore ?? "" },
        { label: t("participants.export.dietaryNeeds"), value: (p: Participant) => p.esigenze_alimentari.join(", ") },
        { label: t("participants.export.allergies"), value: (p: Participant) => p.allergie ?? "" },
        { label: t("participants.export.accessibilityNeeds"), value: (p: Participant) => p.difficolta_accessibilita.join(", ") },
        { label: t("participants.export.totalFee"), value: (p: Participant) => p.quota_totale ?? "" },
        { label: t("participants.export.paidFee"), value: (p: Participant) => p.fee_paid ?? 0 },
        { label: t("participants.export.balance"), value: (p: Participant) => (p.quota_totale ?? 0) - (p.fee_paid ?? 0) },
      ];
      const matrix = [
        columns.map((column) => column.label),
        ...participants.map((participant) => columns.map((column) => column.value(participant))),
      ];
      const worksheet = XLSX.utils.aoa_to_sheet(matrix);
      worksheet["!autofilter"] = { ref: worksheet["!ref"] ?? "A1:U1" };
      worksheet["!cols"] = columns.map((column, columnIndex) => ({
        wch: Math.min(
          42,
          Math.max(
            10,
            column.label.length + 2,
            ...matrix.slice(1).map((row) => String(row[columnIndex] ?? "").length + 2)
          )
        ),
      }));

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, t("participants.export.sheetName"));
      const dateStamp = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `partecipanti-gruppo-${dateStamp}.xlsx`);
    } catch {
      setExportError(t("participants.export.error"));
    } finally {
      setExportingExcel(false);
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload: Record<string, unknown> = { id: editingId, ...form };
      if (!showOperatorAccommodationPreference) {
        delete payload.preferenza_alloggio_operatore;
      }
      if (!canEditGroupAssignment) {
        delete payload.paese_residenza;
        delete payload.citta;
        delete payload.gruppo_roma;
      }
      if (!canEditHostCityFields) {
        delete payload.partecipa_intero_evento;
        delete payload.presenza_dettaglio;
      }

      const res = await fetch(apiBasePath, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? t("participants.table.saveError"));
        return;
      }

      const updated = json.participant as Participant;
      setParticipants((prev) =>
        prev.map((row) => (row.id === updated.id ? updated : row))
      );
      setSuccess(t("participants.table.saveSuccess"));

      setTimeout(() => {
        closeEditModal();
      }, 500);
    } catch {
      setError(t("participants.table.saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editingId || deleting || saving) return;
    const confirmed = window.confirm(
      t("participants.table.deleteConfirm")
    );
    if (!confirmed) return;

    setDeleting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(apiBasePath, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? t("participants.table.deleteError"));
        return;
      }

      setParticipants((prev) => prev.filter((row) => row.id !== editingId));
      closeEditModal();
    } catch {
      setError(t("participants.table.deleteError"));
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    if (modalOnly) {
      return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8">
          <div className="w-full max-w-3xl rounded-lg border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500 shadow-xl">
            {t("common.loadingParticipants")}
          </div>
        </div>
      );
    }
    return (
      <div className="rounded border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
        {t("common.loadingParticipants")}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {loadError}
      </div>
    );
  }

  return (
    <>
      {!modalOnly && (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-slate-500">
            {groupSummaryLabel}: {groups.length > 0 ? groups.join(", ") : t("participants.table.noGroup")}
          </p>
          {allowExcelExport ? (
            <button
              type="button"
              onClick={downloadParticipantsExcel}
              disabled={exportingExcel || participants.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0 4-4m-4 4-4-4M5 19h14" />
              </svg>
              {exportingExcel
                ? t("participants.export.preparing")
                : t("participants.export.button")}
            </button>
          ) : null}
        </div>
        {exportError ? (
          <p className="mt-3 text-sm text-red-700" role="alert">{exportError}</p>
        ) : null}
        {showPaymentSummary ? (
          <section className="mt-5" aria-labelledby="group-payment-summary-title">
            <div>
              <h2 id="group-payment-summary-title" className="text-base font-semibold text-slate-900">
                {t("dashboard.groupLeader.paymentSummary.title")}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {t("dashboard.groupLeader.paymentSummary.subtitle")}
              </p>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {t("fees.totalExpected")}
                </p>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {formatCurrency(paymentSummary.totalExpected)}
                </p>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                  {t("fees.totalPaid")}
                </p>
                <p className="mt-1 text-xl font-semibold text-emerald-900">
                  {formatCurrency(paymentSummary.totalPaid)}
                </p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-amber-700">
                  {t("fees.outstanding")}
                </p>
                <p className="mt-1 text-xl font-semibold text-amber-900">
                  {formatCurrency(paymentSummary.outstanding)}
                </p>
              </div>
            </div>
          </section>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {t("participants.table.controls.extraColumns")}
            </span>
            <button
              type="button"
              onClick={() => toggleOptionalColumn("tipo_iscrizione")}
              className={`rounded border px-3 py-1.5 text-xs font-medium transition ${
                showRegistrationTypeColumn
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              {t("participants.table.header.registrationType")}
            </button>
            <button
              type="button"
              onClick={() => toggleOptionalColumn("citta")}
              className={`rounded border px-3 py-1.5 text-xs font-medium transition ${
                showCityColumn
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              {t("participants.table.header.city")}
            </button>
            <button
              type="button"
              onClick={() => toggleOptionalColumn("eta")}
              className={`rounded border px-3 py-1.5 text-xs font-medium transition ${
                showAgeColumn
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              {t("participants.table.header.age")}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setOnlyRoma((prev) => !prev)}
            className={`rounded border px-3 py-1.5 text-xs font-medium transition ${
              onlyRoma
                ? "border-indigo-600 bg-indigo-600 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
            }`}
          >
            Roma
          </button>
        </div>

        <div className="mt-4 overflow-x-auto rounded border border-slate-200">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                {showGroupColumn && (
                  <th className="px-4 py-3">
                    <button type="button" onClick={() => toggleSort("group")}>
                      {t("participants.table.header.group")} {sortLabel("group")}
                    </button>
                  </th>
                )}
                <th className="px-4 py-3">
                  <button type="button" onClick={() => toggleSort("nome")}>
                    {t("participants.table.header.firstName")} {sortLabel("nome")}
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button type="button" onClick={() => toggleSort("cognome")}>
                    {t("participants.table.header.lastName")} {sortLabel("cognome")}
                  </button>
                </th>
                {showRegistrationTypeColumn && (
                  <th className="px-4 py-3">
                    <button type="button" onClick={() => toggleSort("tipo_iscrizione")}>
                      {t("participants.table.header.registrationType")}{" "}
                      {sortLabel("tipo_iscrizione")}
                    </button>
                  </th>
                )}
                {showCityColumn && (
                  <th className="px-4 py-3">
                    <button type="button" onClick={() => toggleSort("citta")}>
                      {t("participants.table.header.city")} {sortLabel("citta")}
                    </button>
                  </th>
                )}
                {showAgeColumn && (
                  <th className="px-4 py-3">
                    <button type="button" onClick={() => toggleSort("eta")}>
                      {t("participants.table.header.age")} {sortLabel("eta")}
                    </button>
                  </th>
                )}
                <th className="px-4 py-3">
                  <button type="button" onClick={() => toggleSort("data_arrivo")}>
                    {t("participants.table.header.arrivalDate")} {sortLabel("data_arrivo")}
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button type="button" onClick={() => toggleSort("data_partenza")}>
                    {t("participants.table.header.departureDate")} {sortLabel("data_partenza")}
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button type="button" onClick={() => toggleSort("alloggio")}>
                    {t("participants.table.header.accommodation")} {sortLabel("alloggio")}
                  </button>
                </th>
                {showTotalFee && (
                  <th className="px-4 py-3">
                    <button type="button" onClick={() => toggleSort("quota_totale")}>
                      {t("participants.table.header.totalFee")} {sortLabel("quota_totale")}
                    </button>
                  </th>
                )}
                {showRegistrationDate && (
                  <th className="px-4 py-3">
                    <button type="button" onClick={() => toggleSort("created_at")}>
                      {t("participants.table.header.registrationDate")} {sortLabel("created_at")}
                    </button>
                  </th>
                )}
                <th className="px-4 py-3">{t("participants.table.header.actions")}</th>
              </tr>
              <tr>
                {showGroupColumn && (
                  <th className="px-2 pb-3">
                    <input
                      value={groupFilter}
                      onChange={(e) => setGroupFilter(e.target.value)}
                      placeholder={t("participants.table.filter.group")}
                      className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                    />
                  </th>
                )}
                <th className="px-2 pb-3">
                  <input
                    value={nomeFilter}
                    onChange={(e) => setNomeFilter(e.target.value)}
                    placeholder={t("participants.table.filter.firstName")}
                    className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                  />
                </th>
                <th className="px-2 pb-3">
                  <input
                    value={cognomeFilter}
                    onChange={(e) => setCognomeFilter(e.target.value)}
                    placeholder={t("participants.table.filter.lastName")}
                    className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                  />
                </th>
                {showRegistrationTypeColumn && (
                  <th className="px-2 pb-3">
                    <input
                      value={tipoIscrizioneFilter}
                      onChange={(e) => setTipoIscrizioneFilter(e.target.value)}
                      placeholder={t("participants.table.filter.registrationType")}
                      className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                    />
                  </th>
                )}
                {showCityColumn && (
                  <th className="px-2 pb-3">
                    <input
                      value={cittaFilter}
                      onChange={(e) => setCittaFilter(e.target.value)}
                      placeholder={t("participants.table.filter.city")}
                      className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                    />
                  </th>
                )}
                {showAgeColumn && (
                  <th className="px-2 pb-3">
                    <div className="grid grid-cols-2 gap-1">
                      <input
                        type="number"
                        placeholder={t("participants.table.filter.min")}
                        value={etaMinFilter}
                        onChange={(e) => setEtaMinFilter(e.target.value)}
                        className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                      />
                      <input
                        type="number"
                        placeholder={t("participants.table.filter.max")}
                        value={etaMaxFilter}
                        onChange={(e) => setEtaMaxFilter(e.target.value)}
                        className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                      />
                    </div>
                  </th>
                )}
                <th className="px-2 pb-3">
                  <input
                    type="date"
                    value={arrivoFilter}
                    onChange={(e) => setArrivoFilter(e.target.value)}
                    className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                  />
                </th>
                <th className="px-2 pb-3">
                  <input
                    type="date"
                    value={partenzaFilter}
                    onChange={(e) => setPartenzaFilter(e.target.value)}
                    className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                  />
                </th>
                <th className="px-2 pb-3">
                  <select
                    value={alloggioFilter}
                    onChange={(e) => setAlloggioFilter(e.target.value)}
                    className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                  >
                    <option value="">{t("common.all")}</option>
                    {ALLOGGIO_SHORT_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {accommodationOptionLabel(option, t)}
                      </option>
                    ))}
                  </select>
                </th>
                {showTotalFee && (
                  <th className="px-2 pb-3">
                    <div className="grid grid-cols-2 gap-1">
                      <input
                        type="number"
                        placeholder={t("participants.table.filter.min")}
                        value={quotaMinFilter}
                        onChange={(e) => setQuotaMinFilter(e.target.value)}
                        className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                      />
                      <input
                        type="number"
                        placeholder={t("participants.table.filter.max")}
                        value={quotaMaxFilter}
                        onChange={(e) => setQuotaMaxFilter(e.target.value)}
                        className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                      />
                    </div>
                  </th>
                )}
                {showRegistrationDate && (
                  <th className="px-2 pb-3">
                    <input
                      type="date"
                      value={registrationDateFilter}
                      onChange={(e) => setRegistrationDateFilter(e.target.value)}
                      className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                    />
                  </th>
                )}
                <th className="px-2 pb-3">
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                  >
                    {t("common.reset")}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredSortedParticipants.length === 0 ? (
                <tr>
                  <td
                    className="px-4 py-4 text-slate-500"
                    colSpan={tableColumnCount}
                  >
                    {t("participants.table.noResults")}
                  </td>
                </tr>
              ) : (
                filteredSortedParticipants.map((participant) => (
                  <tr
                    key={participant.id}
                    className={`border-t border-slate-100 ${
                      showTotalFee &&
                      participant.quota_totale !== null &&
                      (participant.fee_paid ?? 0) >= participant.quota_totale
                        ? "bg-emerald-50/70"
                        : ""
                    }`}
                  >
                    {showGroupColumn && (
                      <td className="px-4 py-3">{participant.group || "-"}</td>
                    )}
                    <td className="px-4 py-3">{participant.nome || "-"}</td>
                    <td className="px-4 py-3">{participant.cognome || "-"}</td>
                    {showRegistrationTypeColumn && (
                      <td className="px-4 py-3">{participant.tipo_iscrizione || "-"}</td>
                    )}
                    {showCityColumn && (
                      <td className="px-4 py-3">{participant.citta || "-"}</td>
                    )}
                    {showAgeColumn && (
                      <td className="px-4 py-3">
                        {participant.eta === null ? "-" : participant.eta}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      {displayDate(
                        participant.data_arrivo,
                        ARRIVAL_DATE_MIN,
                        ARRIVAL_DATE_MAX
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {displayDate(
                        participant.data_partenza,
                        DEPARTURE_DATE_MIN,
                        DEPARTURE_DATE_MAX
                      )}
                    </td>
                    <td className="px-4 py-3">{participant.alloggio || "-"}</td>
                    {showTotalFee && (
                      <td className="px-4 py-3">
                        {participant.quota_totale === null
                          ? "-"
                          : `€ ${formatFeeProgressValue(participant.fee_paid ?? 0)}/${formatFeeProgressValue(participant.quota_totale)}`}
                      </td>
                    )}
                    {showRegistrationDate && (
                      <td className="px-4 py-3">
                        {displayRegistrationDate(participant.created_at)}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openEditModal(participant)}
                        className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        {t("common.edit")}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {editingParticipant && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8">
          <div className="w-full max-w-3xl rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{t("participants.table.modal.editTitle")}</h2>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                  <span>
                    {editingParticipant.nome} {editingParticipant.cognome}
                  </span>
                  {editingParticipant.personal_code ? (
                    <span
                      className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 font-mono text-xs font-semibold tracking-wider text-indigo-700"
                      title={t("participants.table.modal.personalCode")}
                    >
                      #{editingParticipant.personal_code}
                    </span>
                  ) : null}
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                {t("participants.table.modal.close")}
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">{t("participant.form.name")}</label>
                  <input
                    required
                    value={form.nome}
                    onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))}
                    className="mt-1 w-full rounded border border-slate-300 px-4 py-3 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">{t("participant.form.surname")}</label>
                  <input
                    required
                    value={form.cognome}
                    onChange={(e) => setForm((prev) => ({ ...prev, cognome: e.target.value }))}
                    className="mt-1 w-full rounded border border-slate-300 px-4 py-3 text-sm"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">
                    {t("participants.table.header.registrationType")}
                  </label>
                  <select
                    value={form.tipo_iscrizione}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        tipo_iscrizione: e.target.value,
                        preferenza_alloggio_operatore: isOperatorRegistrationType(
                          e.target.value
                        )
                          ? prev.preferenza_alloggio_operatore
                          : "",
                      }))
                    }
                    className="mt-1 w-full rounded border border-slate-300 px-4 py-3 text-sm"
                  >
                    <option value="">{t("participant.form.select")}</option>
                    {form.tipo_iscrizione &&
                      !REGISTRATION_TYPE_OPTIONS.includes(
                        form.tipo_iscrizione as (typeof REGISTRATION_TYPE_OPTIONS)[number]
                      ) && (
                        <option value={form.tipo_iscrizione}>
                          {form.tipo_iscrizione}
                        </option>
                      )}
                    {REGISTRATION_TYPE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2 rounded border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {t("participant.form.groupLeader")}
                  </p>
                  <p className="mt-1 text-sm text-slate-900">
                    {editingParticipant.gruppo_leader?.trim() || "-"}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">{t("participant.form.nationality")}</label>
                  <input
                    value={form.nazione}
                    onChange={(e) => setForm((prev) => ({ ...prev, nazione: e.target.value }))}
                    className="mt-1 w-full rounded border border-slate-300 px-4 py-3 text-sm"
                  />
                </div>

                {canEditGroupAssignment && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">
                        {t("manager.registrations.country")}
                      </label>
                      <input
                        value={form.paese_residenza}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, paese_residenza: e.target.value }))
                        }
                        className="mt-1 w-full rounded border border-slate-300 px-4 py-3 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700">
                        {t("manager.registrations.city")}
                      </label>
                      <input
                        value={form.citta}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            citta: e.target.value,
                            gruppo_roma:
                              normalizeFilterText(e.target.value) === "roma"
                                ? prev.gruppo_roma
                                : "",
                          }))
                        }
                        className="mt-1 w-full rounded border border-slate-300 px-4 py-3 text-sm"
                      />
                    </div>

                    {isRomaCityInForm && (
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700">
                          {t("participant.form.group")}
                        </label>
                        <select
                          required
                          value={form.gruppo_roma}
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, gruppo_roma: e.target.value }))
                          }
                          className="mt-1 w-full rounded border border-slate-300 px-4 py-3 text-sm"
                        >
                          <option value="">{t("participant.form.select")}</option>
                          {assignableGroups.map((groupId) => (
                            <option key={groupId} value={groupId}>
                              {groupId}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700">{t("auth.login.email")}</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                    className="mt-1 w-full rounded border border-slate-300 px-4 py-3 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">{t("participants.table.phone")}</label>
                  <input
                    value={form.telefono}
                    onChange={(e) => setForm((prev) => ({ ...prev, telefono: e.target.value }))}
                    className="mt-1 w-full rounded border border-slate-300 px-4 py-3 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    {t("participant.form.dateOfBirth")}
                  </label>
                  <input
                    type="date"
                    value={form.data_nascita}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, data_nascita: e.target.value }))
                    }
                    className="mt-1 w-full rounded border border-slate-300 px-4 py-3 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">{t("participant.form.arrivalDate")}</label>
                  <input
                    type="date"
                    min={ARRIVAL_DATE_MIN}
                    max={ARRIVAL_DATE_MAX}
                    value={form.data_arrivo}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, data_arrivo: e.target.value }))
                    }
                    className="mt-1 w-full rounded border border-slate-300 px-4 py-3 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    {t("participant.form.departureDate")}
                  </label>
                  <input
                    type="date"
                    min={DEPARTURE_DATE_MIN}
                    max={DEPARTURE_DATE_MAX}
                    value={form.data_partenza}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, data_partenza: e.target.value }))
                    }
                    className="mt-1 w-full rounded border border-slate-300 px-4 py-3 text-sm"
                  />
                </div>

                {canEditHostCityFields && (
                  <div className="md:col-span-2 rounded border border-amber-200 bg-amber-50 p-3">
                    <p className="text-sm font-medium text-amber-900">
                      {t("participants.table.modal.hostCity.sectionTitle")}
                    </p>
                    <p className="mt-1 text-xs text-amber-800">
                      {t("participants.table.modal.hostCity.sectionHint")}
                    </p>

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700">
                          {t("participants.table.modal.hostCity.entireEventLabel")}
                        </label>
                        <select
                          value={
                            form.partecipa_intero_evento === null
                              ? ""
                              : form.partecipa_intero_evento
                                ? "yes"
                                : "no"
                          }
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              partecipa_intero_evento:
                                e.target.value === ""
                                  ? null
                                  : e.target.value === "yes",
                            }))
                          }
                          className="mt-1 w-full rounded border border-slate-300 px-4 py-3 text-sm"
                        >
                          <option value="">{t("participant.form.select")}</option>
                          <option value="yes">
                            {t("participants.table.modal.hostCity.optionYes")}
                          </option>
                          <option value="no">
                            {t("participants.table.modal.hostCity.optionNo")}
                          </option>
                        </select>
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className="block text-sm font-medium text-slate-700">
                        {t("participants.table.modal.hostCity.presenceLabel")}
                      </label>
                      <div className="mt-2 grid gap-2 md:grid-cols-2">
                        {presenceOptions.map((option) => (
                          <label
                            key={option}
                            className="flex items-start gap-2 rounded border border-amber-200 bg-white px-2 py-1.5 text-xs"
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(form.presenza_dettaglio?.[option])}
                              onChange={() => togglePresenzaDettaglio(option)}
                            />
                            <span>{toPresenceOptionLabel(option)}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">{t("participant.form.accommodation")}</label>
                  <select
                    value={form.alloggio}
                    onChange={(e) => setForm((prev) => ({ ...prev, alloggio: e.target.value }))}
                    className="mt-1 w-full rounded border border-slate-300 px-4 py-3 text-sm"
                  >
                    <option value="">{t("participant.form.select")}</option>
                    {ALLOGGIO_SHORT_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {accommodationOptionLabel(option, t)}
                      </option>
                    ))}
                  </select>
                </div>

                {showOperatorAccommodationPreference && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700">
                      {t("operatorAccommodationPreference.label")}
                    </label>
                    <select
                      value={form.preferenza_alloggio_operatore}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          preferenza_alloggio_operatore: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded border border-slate-300 px-4 py-3 text-sm"
                    >
                      <option value="">{t("participant.form.select")}</option>
                      {OPERATOR_ACCOMMODATION_PREFERENCE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {operatorAccommodationPreferenceLabel(option, t)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">{t("participant.form.allergies")}</label>
                  <textarea
                    rows={2}
                    value={form.allergie}
                    onChange={(e) => setForm((prev) => ({ ...prev, allergie: e.target.value }))}
                    className="mt-1 w-full rounded border border-slate-300 px-4 py-3 text-sm"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">
                    {t("participant.form.dietaryRequirements")}
                  </label>
                  <div className="mt-2 grid gap-2 rounded border border-slate-200 p-3 md:grid-cols-2">
                    {ESIGENZE_ALIMENTARI_OPTIONS.map((option) => (
                      <label key={option} className="inline-flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={form.esigenze_alimentari.includes(option)}
                          onChange={() => toggleEsigenza(option)}
                        />
                        <span>{dietaryOptionLabel(option, t)}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="md:col-span-2 rounded border border-slate-200 p-3">
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.disabilita_accessibilita}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          disabilita_accessibilita: e.target.checked,
                          difficolta_accessibilita: e.target.checked
                            ? prev.difficolta_accessibilita
                            : [],
                        }))
                      }
                    />
                    {t("participants.table.modal.accessibility")}
                  </label>

                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {DIFFICOLTA_ACCESSIBILITA_OPTIONS.map((option) => (
                      <label
                        key={option}
                        className="flex items-start gap-2 rounded border border-slate-200 px-2 py-1.5 text-xs"
                      >
                        <input
                          type="checkbox"
                          disabled={!form.disabilita_accessibilita}
                          checked={form.difficolta_accessibilita.includes(option)}
                          onChange={() => toggleDifficolta(option)}
                        />
                        <span>{accessibilityOptionLabel(option, t)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

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

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving || deleting}
                  className="mr-auto rounded border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
                >
                  {deleting ? t("participants.table.deleting") : t("common.delete")}
                </button>
                <button
                  type="button"
                  onClick={closeEditModal}
                  disabled={saving || deleting}
                  className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  {t("participants.table.modal.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={saving || deleting}
                  className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {saving ? t("participants.table.modal.saving") : t("common.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
