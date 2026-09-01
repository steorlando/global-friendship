import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { loadEventRuntimeSettings } from "@/lib/event/settings";
import { DailyPresenceSection } from "./daily-presence-section";
import { RegistrationsTabsSection } from "./registrations-tabs-section";
import { StatisticsSectionsSidebar } from "./statistics-sections-sidebar";
import { StatisticsSectionNavigator } from "./statistics-section-navigator";
import { StatisticsParticipantEditModal } from "./statistics-participant-edit-modal";
import { ParticipantBadgesDownloadButton } from "./participant-badges-download-button";
import { ParticipationReportDownloadButton } from "./participation-report-download-button";
import { getServerTranslator } from "@/lib/i18n/server";
import {
  isOperatorRegistrationType,
  isAutonomousAccommodation,
  normalizeOperatorAccommodationPreference,
} from "@/lib/partecipante/constants";
import {
  buildStaffAvailabilitySummary,
  emptyStaffAvailabilitySummary,
  type StaffAvailabilityFilter,
  type StaffAvailabilityStatRow,
  type StaffAvailabilitySummary,
} from "@/lib/statistics/staff-availability";
import {
  ACCESSIBILITY_FILTERS,
  buildAccessibilitySummary,
  type AccessibilityFilter,
} from "@/lib/statistics/accessibility";
import {
  FOOD_NEEDS_FORM_FILTERS,
  FOOD_NEEDS_TEXT_FILTERS,
  buildFoodNeedsSummary,
  type FoodNeedsFilter,
} from "@/lib/statistics/food-needs";
import { STATISTICS_GROUP_LEADER_ROLES } from "@/lib/statistics/group-leader-associations";
import {
  normalizeRegistrationCityLabel,
  registrationCityKey,
} from "@/lib/statistics/registration-cities";
import {
  buildHostelCheckInGroupSummary,
  buildHostelCheckInHostelSummary,
  loadHostelCheckInStatuses,
  participantMayNeedHostelCheckIn,
  type HostelCheckInGroupRow,
  type HostelCheckInHostelRow,
  type HostelCheckInStatus,
} from "@/lib/alloggi/check-in";
import { loadAssignedHostelNameByParticipant } from "@/lib/alloggi/assigned-hostels-server";
import { ArrivalGroupSummaryTable } from "@/app/dashboard/_components/arrival-group-summary-table";
import { loadParticipantArrivalStatuses } from "@/lib/accoglienza/arrival-data";
import {
  buildArrivalGroupSummary,
  type ArrivalGroupSummaryRow,
} from "@/lib/accoglienza/arrivals";
import {
  parseStatisticsSection,
  type StatisticsSectionKey,
} from "@/lib/statistics/dashboard-sections";
import {
  canGenerateParticipationReport,
  type ParticipationReportAccessProfile,
} from "@/lib/statistics/participation-report-access";

export const dynamic = "force-dynamic";

type ParticipantStatRow = {
  id: string;
  nome: string | null;
  cognome: string | null;
  citta: string | null;
  dati_tally?: unknown;
  email: string | null;
  tipo_iscrizione: string | null;
  preferenza_alloggio_operatore: string | null;
  paese_residenza: string | null;
  nazione: string | null;
  gruppo_label: string | null;
  gruppo_id: string | null;
  partecipa_intero_evento?: boolean | null;
  presenza_dettaglio?: Record<string, unknown> | null;
  data_arrivo: string | null;
  data_partenza: string | null;
  alloggio_short: string | null;
  alloggio: string | null;
  created_at: string | null;
  deleted_at?: string | null;
  disabilita_accessibilita?: boolean | null;
  difficolta_accessibilita?: string | null;
  esigenze_alimentari?: string | null;
  allergie?: string | null;
};

type ProfileLinkRow = {
  profilo_id: string | null;
  gruppo_id: string | null;
};

type ProfileRoleRow = {
  id: string;
};

type DuplicateReasonCode = "same-name" | "similar-name";

type DuplicateCandidateRow = {
  id: string;
  nome: string | null;
  cognome: string | null;
  email: string | null;
  group: string;
  reasonCodes: DuplicateReasonCode[];
  matchedWith: { id: string; label: string }[];
};

type FalsePositiveRow = {
  participant_a_id: string | null;
  participant_b_id: string | null;
};

type EnrollmentBucket = "Higher students" | "University-Worker" | "Operator";

type CityBucketEntry = {
  label: string;
  counts: Record<EnrollmentBucket, number>;
};

const ENROLLMENT_BUCKETS: EnrollmentBucket[] = [
  "Higher students",
  "University-Worker",
  "Operator",
];
const ENROLLMENT_BUCKET_LABEL_KEYS: Record<EnrollmentBucket, string> = {
  "Higher students": "enrollment.bucket.higherStudents",
  "University-Worker": "enrollment.bucket.universityWorker",
  Operator: "enrollment.bucket.operator",
};

const SELECT_FIELDS_BASE =
  "id,nome,cognome,email,tipo_iscrizione,preferenza_alloggio_operatore,paese_residenza,nazione,gruppo_label,gruppo_id,data_arrivo,data_partenza,partecipa_intero_evento,presenza_dettaglio,alloggio_short,alloggio,created_at,deleted_at,dati_tally,disabilita_accessibilita,difficolta_accessibilita,esigenze_alimentari,allergie";
const SELECT_FIELDS_BASE_LEGACY =
  "id,nome,cognome,email,tipo_iscrizione,paese_residenza,nazione,gruppo_label,gruppo_id,data_arrivo,data_partenza,alloggio_short,alloggio,created_at";
const SELECT_FIELDS_WITH_CITY = `${SELECT_FIELDS_BASE},citta:città`;
const SELECT_FIELDS_WITH_CITY_LEGACY = `${SELECT_FIELDS_BASE_LEGACY},citta:città`;
const SECTION_SELECT_FIELDS: Record<StatisticsSectionKey, string> = {
  registrations:
    "id,tipo_iscrizione,paese_residenza,nazione,gruppo_label,gruppo_id,deleted_at,citta:città",
  trend: "id,created_at,deleted_at",
  "daily-presence":
    "id,data_arrivo,data_partenza,partecipa_intero_evento,presenza_dettaglio,alloggio_short,alloggio,tipo_iscrizione,preferenza_alloggio_operatore,deleted_at,citta:città",
  "event-arrivals": "id,gruppo_label,gruppo_id,deleted_at",
  "hostel-check-in":
    "id,tipo_iscrizione,preferenza_alloggio_operatore,gruppo_label,gruppo_id,alloggio_short,alloggio,deleted_at",
  "operator-accommodation":
    "id,tipo_iscrizione,preferenza_alloggio_operatore,alloggio_short,alloggio,deleted_at",
  "staff-availability": "id,deleted_at",
  accessibility:
    "id,disabilita_accessibilita,difficolta_accessibilita,deleted_at",
  "food-needs": "id,esigenze_alimentari,allergie,deleted_at",
  duplicates:
    "id,nome,cognome,email,gruppo_label,gruppo_id,dati_tally,deleted_at",
};
const REGISTRATIONS_SELECT_FIELDS_WITHOUT_CITY =
  "id,tipo_iscrizione,paese_residenza,nazione,gruppo_label,gruppo_id,deleted_at";
const HISTORY_FILES = ["history_2023.csv", "history_2024.csv", "history_2025.csv"] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

type TrendPoint = {
  day: number;
  value: number;
};

type TrendSeries = {
  minDay: number;
  current: TrendPoint[];
  historyAverage: TrendPoint[];
  forecast: TrendPoint[];
  todayDay: number;
  currentToday: number;
  historyToday: number;
  forecastFinal: number;
  latestCurrentDay: number;
};

type OperatorAccommodationPreferenceCounts = {
  hotel: number;
  hostel: number;
  missing: number;
  notApplicable: number;
};

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

function createEmptyBucketCounts(): Record<EnrollmentBucket, number> {
  return {
    "Higher students": 0,
    "University-Worker": 0,
    Operator: 0,
  };
}

function compareLabels(a: string, b: string): number {
  if (a === "-") return 1;
  if (b === "-") return -1;
  return a.localeCompare(b);
}

function sortedLabels(values: Set<string>): string[] {
  return [...values].sort(compareLabels);
}

function incrementCityBucket(
  cityBuckets: Map<string, CityBucketEntry>,
  rawCity: string | null | undefined,
  bucket: EnrollmentBucket,
): void {
  const key = registrationCityKey(rawCity) || "-";
  const label = normalizeRegistrationCityLabel(rawCity) ?? "-";
  const current = cityBuckets.get(key) ?? {
    label,
    counts: createEmptyBucketCounts(),
  };
  current.counts[bucket] += 1;
  cityBuckets.set(key, current);
}

function normalizeTallyValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value.map(normalizeTallyValue).filter(Boolean).join(", ");
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return normalizeTallyValue(record.text ?? record.label ?? record.value);
  }
  return "";
}

function extractTallyFieldValue(
  payload: unknown,
  predicate: (label: string) => boolean
): string {
  const fields =
    (payload as { data?: { fields?: unknown[] }; fields?: unknown[] } | null)
      ?.data?.fields ?? (payload as { fields?: unknown[] } | null)?.fields ?? [];
  if (!Array.isArray(fields)) return "";

  for (const field of fields) {
    if (!field || typeof field !== "object") continue;
    const record = field as Record<string, unknown>;
    const label = normalizeTallyValue(record.label ?? record.name ?? record.key);
    if (!label || !predicate(label.toLowerCase())) continue;
    const value = normalizeTallyValue(record.value);
    if (value) return value;
  }

  return "";
}

function participantTallyDetail(participant: ParticipantStatRow): string {
  const explicitOtherCity = extractTallyFieldValue(participant.dati_tally, (label) =>
    (label.includes("city") || label.includes("citt")) && label.includes("other")
  );
  if (explicitOtherCity) return explicitOtherCity;

  const city = extractTallyFieldValue(participant.dati_tally, (label) =>
    label === "city" || label === "città" || label === "citta"
  );
  const leader = extractTallyFieldValue(participant.dati_tally, (label) =>
    label.includes("group leader") || label.includes("capogruppo")
  );

  if (leader) return city ? `${city}; leader: ${leader}` : `Leader: ${leader}`;
  return city || "-";
}

function parseDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateOnlyFromIso(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const dateOnly = trimmed.slice(0, 10);
  return parseDateOnly(dateOnly);
}

function daysToEvent(registrationDate: Date, eventDate: Date): number {
  return Math.floor((registrationDate.getTime() - eventDate.getTime()) / DAY_MS);
}

function buildFilledSeries(
  raw: Map<number, number>,
  minDay: number,
  maxDay: number
): TrendPoint[] {
  let last = 0;
  const series: TrendPoint[] = [];

  for (let day = minDay; day <= maxDay; day += 1) {
    const next = raw.get(day);
    if (typeof next === "number") {
      last = next;
    }
    series.push({ day, value: last });
  }

  return series;
}

function pointValueAtOrBefore(series: TrendPoint[], day: number): number {
  if (series.length === 0) return 0;
  if (day <= series[0].day) return series[0].value;
  if (day >= series[series.length - 1].day) return series[series.length - 1].value;
  const index = day - series[0].day;
  const point = series[index];
  return point ? point.value : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

async function parseHistoryCsv(
  filename: string
): Promise<{ raw: Map<number, number>; minDay: number | null }> {
  const filePath = path.join(process.cwd(), "data", filename);
  const content = await readFile(filePath, "utf8");
  const lines = content.split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) {
    return { raw: new Map(), minDay: null };
  }

  const header = lines[0].split(",").map((cell) => cell.trim());
  const dateIndex = header.indexOf("data_registrazione");
  const cumulativeIndex = header.indexOf("cumulativo");
  const eventIndex = header.indexOf("data_evento");

  if (dateIndex < 0 || cumulativeIndex < 0 || eventIndex < 0) {
    throw new Error(`Invalid CSV header in ${filename}`);
  }

  const raw = new Map<number, number>();
  let minDay: number | null = null;

  for (let i = 1; i < lines.length; i += 1) {
    const cells = lines[i].split(",").map((cell) => cell.trim());
    const registrationDate = parseDateOnly(cells[dateIndex] ?? "");
    const eventDate = parseDateOnly(cells[eventIndex] ?? "");
    const cumulative = Number(cells[cumulativeIndex] ?? "");

    if (!registrationDate || !eventDate || Number.isNaN(cumulative)) continue;

    const day = daysToEvent(registrationDate, eventDate);
    raw.set(day, cumulative);
    minDay = minDay === null ? day : Math.min(minDay, day);
  }

  return { raw, minDay };
}

async function buildTrendSeries(
  participants: ParticipantStatRow[],
  eventStartDate: string
): Promise<TrendSeries | null> {
  const eventDate = parseDateOnly(eventStartDate);
  if (!eventDate) return null;

  const currentRaw = new Map<number, number>();
  const byDay = new Map<number, number>();
  for (const participant of participants) {
    const registrationDate = participant.created_at
      ? toDateOnlyFromIso(participant.created_at)
      : null;
    if (!registrationDate) continue;
    const day = daysToEvent(registrationDate, eventDate);
    if (day > 0) continue;
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }

  const currentDays = [...byDay.keys()].sort((a, b) => a - b);
  let cumulative = 0;
  for (const day of currentDays) {
    cumulative += byDay.get(day) ?? 0;
    currentRaw.set(day, cumulative);
  }

  const historyRawSeries = await Promise.all(
    HISTORY_FILES.map(async (filename) => {
      const parsed = await parseHistoryCsv(filename);
      return parsed.raw;
    })
  );

  const candidateMins = [
    ...currentDays,
    ...historyRawSeries.flatMap((series) => [...series.keys()]),
  ];
  if (candidateMins.length === 0) return null;

  const minDay = Math.min(...candidateMins);
  const maxDay = 0;
  const currentFilled = buildFilledSeries(currentRaw, minDay, maxDay);
  const historyFilled = historyRawSeries.map((series) =>
    buildFilledSeries(series, minDay, maxDay)
  );

  const historyAverage = currentFilled.map((point, index) => {
    const values = historyFilled.map((series) => series[index]?.value ?? 0);
    const avg =
      values.length === 0
        ? 0
        : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
    return { day: point.day, value: avg };
  });

  const today = new Date();
  const todayDate = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  );
  const todayDay = daysToEvent(todayDate, eventDate);
  const clampedTodayDay = Math.max(minDay, Math.min(maxDay, todayDay));

  const observedCurrentDays = currentDays.filter((day) => day <= 0);
  const latestCurrentDay =
    observedCurrentDays.length > 0 ? observedCurrentDays[observedCurrentDays.length - 1] : minDay;
  const latestCurrentValue = pointValueAtOrBefore(currentFilled, latestCurrentDay);

  let forecast: TrendPoint[] = [{ day: 0, value: latestCurrentValue }];
  let forecastFinal = latestCurrentValue;

  if (latestCurrentDay < 0) {
    const eps = 1e-6;
    const histAtLatest = pointValueAtOrBefore(historyAverage, latestCurrentDay);
    const histFinal = pointValueAtOrBefore(historyAverage, 0);
    const maxHistoricalRemainingGain = Math.max(
      0,
      ...historyFilled.map((series) => {
        const atLatest = pointValueAtOrBefore(series, latestCurrentDay);
        const atFinal = pointValueAtOrBefore(series, 0);
        return Math.max(0, atFinal - atLatest);
      })
    );

    const levelRatio =
      histAtLatest > eps ? latestCurrentValue / histAtLatest : 1;

    const growthWindowStart = Math.max(minDay, latestCurrentDay - 14);
    const currentAtWindowStart = pointValueAtOrBefore(currentFilled, growthWindowStart);
    const histAtWindowStart = pointValueAtOrBefore(historyAverage, growthWindowStart);
    const currentGrowth = Math.max(0, latestCurrentValue - currentAtWindowStart);
    const histGrowth = Math.max(0, histAtLatest - histAtWindowStart);
    const growthRatio =
      histGrowth > eps ? currentGrowth / histGrowth : levelRatio;

    // Blend level-fit and recent-growth fit; keep it bounded to avoid unstable tails.
    const shapeScale = clamp(0.7 * levelRatio + 0.3 * growthRatio, 0.35, 3.5);

    const rawCurve: TrendPoint[] = [];
    let previous = latestCurrentValue;
    for (let day = latestCurrentDay; day <= 0; day += 1) {
      const histValue = pointValueAtOrBefore(historyAverage, day);
      const centered = Math.max(0, histValue - histAtLatest);
      const projected = latestCurrentValue + shapeScale * centered;
      const value = Math.max(previous, Math.round(projected));
      rawCurve.push({ day, value });
      previous = value;
    }

    const terminalFromShape =
      rawCurve.length > 0 ? rawCurve[rawCurve.length - 1].value : latestCurrentValue;
    const fallbackLinear = Math.round(
      latestCurrentValue +
        ((latestCurrentValue - currentAtWindowStart) / Math.max(1, latestCurrentDay - growthWindowStart)) *
          Math.max(0, 0 - latestCurrentDay)
    );

    const uncappedForecastFinal = Math.max(
      latestCurrentValue,
      terminalFromShape,
      histFinal > eps ? Math.round(shapeScale * histFinal) : latestCurrentValue,
      fallbackLinear
    );
    const averageCap = histFinal > eps ? Math.round(histFinal * 1.2) : uncappedForecastFinal;
    const remainingGainCap = latestCurrentValue + maxHistoricalRemainingGain;
    const conservativeCap = Math.max(
      latestCurrentValue,
      Math.min(averageCap, remainingGainCap)
    );

    forecastFinal = Math.min(uncappedForecastFinal, conservativeCap);

    if (rawCurve.length > 0) {
      const rawFinal = rawCurve[rawCurve.length - 1].value;
      if (rawFinal > latestCurrentValue && forecastFinal < rawFinal) {
        const adjustedCurve: TrendPoint[] = [];
        let previous = latestCurrentValue;
        for (const point of rawCurve) {
          const progress = clamp(
            (point.value - latestCurrentValue) / Math.max(1, rawFinal - latestCurrentValue),
            0,
            1
          );
          const value = Math.max(
            previous,
            Math.round(latestCurrentValue + progress * (forecastFinal - latestCurrentValue))
          );
          adjustedCurve.push({ day: point.day, value });
          previous = value;
        }
        rawCurve.splice(0, rawCurve.length, ...adjustedCurve);
      }
    }

    rawCurve[rawCurve.length - 1] = { day: 0, value: forecastFinal };
    forecast = rawCurve;
  }

  return {
    minDay,
    current: currentFilled.filter((point) => point.day <= latestCurrentDay),
    historyAverage,
    forecast,
    todayDay: clampedTodayDay,
    currentToday: pointValueAtOrBefore(currentFilled, clampedTodayDay),
    historyToday: pointValueAtOrBefore(historyAverage, clampedTodayDay),
    forecastFinal,
    latestCurrentDay,
  };
}

function toSvgPath(points: TrendPoint[], x: (day: number) => number, y: (value: number) => number) {
  if (points.length === 0) return "";
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${x(point.day)} ${y(point.value)}`)
    .join(" ");
}

function normalizePersonPart(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, "")
    .replace(/\s+/g, " ");
}

function participantGroupValue(row: ParticipantStatRow): string {
  return (row.gruppo_label ?? row.gruppo_id ?? "").trim() || "-";
}

function makePairKey(a: string, b: string): string {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) prev[j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      );
    }
    for (let j = 0; j <= b.length; j += 1) prev[j] = curr[j];
  }

  return prev[b.length];
}

function namesAreVerySimilar(
  nomeA: string,
  cognomeA: string,
  nomeB: string,
  cognomeB: string
): boolean {
  if (!nomeA || !cognomeA || !nomeB || !cognomeB) return false;
  if (nomeA === nomeB && cognomeA === cognomeB) return false;

  const surnameDistance = levenshtein(cognomeA, cognomeB);
  const nameDistance = levenshtein(nomeA, nomeB);

  if (surnameDistance <= 1 && nameDistance <= 2) return true;
  if (surnameDistance === 0 && nameDistance <= 3) return true;
  if (nameDistance === 0 && surnameDistance <= 2) return true;

  return false;
}

function buildDuplicateCandidates(participants: ParticipantStatRow[]): DuplicateCandidateRow[] {
  const byKey = new Map<string, ParticipantStatRow[]>();
  const normalizedById = new Map<string, { nome: string; cognome: string }>();
  const labelById = new Map<string, string>();
  for (const participant of participants) {
    const nome = normalizePersonPart(participant.nome);
    const cognome = normalizePersonPart(participant.cognome);
    normalizedById.set(participant.id, { nome, cognome });
    labelById.set(
      participant.id,
      [participant.nome ?? "", participant.cognome ?? ""].join(" ").trim() || participant.id
    );
    const key = `${nome}|${cognome}`;
    const list = byKey.get(key) ?? [];
    list.push(participant);
    byKey.set(key, list);
  }

  const reasonsById = new Map<string, Set<DuplicateReasonCode>>();
  const matchesById = new Map<string, Set<string>>();

  for (const [, group] of byKey.entries()) {
    if (group.length < 2) continue;
    for (const participant of group) {
      const reasons =
        reasonsById.get(participant.id) ?? new Set<DuplicateReasonCode>();
      reasons.add("same-name");
      reasonsById.set(participant.id, reasons);

      const matches = matchesById.get(participant.id) ?? new Set<string>();
      for (const other of group) {
        if (other.id === participant.id) continue;
        matches.add(other.id);
      }
      matchesById.set(participant.id, matches);
    }
  }

  const list = [...participants];
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const a = list[i];
      const b = list[j];
      const normA = normalizedById.get(a.id);
      const normB = normalizedById.get(b.id);
      if (!normA || !normB) continue;

      if (
        !namesAreVerySimilar(normA.nome, normA.cognome, normB.nome, normB.cognome)
      ) {
        continue;
      }

      const reasonsA =
        reasonsById.get(a.id) ?? new Set<DuplicateReasonCode>();
      reasonsA.add("similar-name");
      reasonsById.set(a.id, reasonsA);
      const reasonsB =
        reasonsById.get(b.id) ?? new Set<DuplicateReasonCode>();
      reasonsB.add("similar-name");
      reasonsById.set(b.id, reasonsB);

      const matchesA = matchesById.get(a.id) ?? new Set<string>();
      matchesA.add(b.id);
      matchesById.set(a.id, matchesA);
      const matchesB = matchesById.get(b.id) ?? new Set<string>();
      matchesB.add(a.id);
      matchesById.set(b.id, matchesB);
    }
  }

  return participants
    .filter((participant) => reasonsById.has(participant.id))
    .map((participant) => ({
      id: participant.id,
      nome: participant.nome,
      cognome: participant.cognome,
      email: participant.email,
      group: participantGroupValue(participant),
      reasonCodes: [...(reasonsById.get(participant.id) ?? [])],
      matchedWith: [...(matchesById.get(participant.id) ?? [])]
        .map((matchedId) => ({
          id: matchedId,
          label: labelById.get(matchedId) ?? matchedId,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    }))
    .sort((a, b) => {
      const bySurname = (a.cognome ?? "").localeCompare(b.cognome ?? "");
      if (bySurname !== 0) return bySurname;
      return (a.nome ?? "").localeCompare(b.nome ?? "");
    });
}

function applyIgnoredDuplicatePairs(
  candidates: DuplicateCandidateRow[],
  ignoredPairKeys: Set<string>
): DuplicateCandidateRow[] {
  return candidates
    .map((candidate) => ({
      ...candidate,
      matchedWith: candidate.matchedWith.filter(
        (match) => !ignoredPairKeys.has(makePairKey(candidate.id, match.id))
      ),
    }))
    .filter((candidate) => candidate.matchedWith.length > 0);
}

function buildUnassignedParticipants(
  participants: ParticipantStatRow[],
  leaderGroupIds: Set<string>
): ParticipantStatRow[] {
  return participants.filter((participant) => {
    const candidateGroups = [
      (participant.gruppo_id ?? "").trim(),
      (participant.gruppo_label ?? "").trim(),
    ].filter(Boolean);

    if (candidateGroups.length === 0) return false;
    return !candidateGroups.some((groupId) => leaderGroupIds.has(groupId));
  });
}

function buildOperatorAccommodationPreferenceCounts(
  participants: ParticipantStatRow[]
): OperatorAccommodationPreferenceCounts {
  const counts: OperatorAccommodationPreferenceCounts = {
    hotel: 0,
    hostel: 0,
    missing: 0,
    notApplicable: 0,
  };

  for (const participant of participants) {
    if (!isOperatorRegistrationType(participant.tipo_iscrizione)) continue;

    if (
      isAutonomousAccommodation(participant.alloggio_short) ||
      isAutonomousAccommodation(participant.alloggio)
    ) {
      counts.notApplicable += 1;
      continue;
    }

    const preference = normalizeOperatorAccommodationPreference(
      participant.preferenza_alloggio_operatore
    );
    if (preference === "Hotel") {
      counts.hotel += 1;
    } else if (preference === "Hostel with group") {
      counts.hostel += 1;
    } else {
      counts.missing += 1;
    }
  }

  return counts;
}

function DuplicateAndUnassignedSection({
  duplicateCandidates,
  unassignedParticipants,
  t,
}: {
  duplicateCandidates: DuplicateCandidateRow[];
  unassignedParticipants: ParticipantStatRow[];
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <section
      id="duplicates-non-associated"
      className="rounded-xl border border-amber-200 bg-amber-50/30 p-6 shadow-sm"
    >
      <h3 className="text-lg font-semibold text-slate-900">
        {t("manager.duplicates.section")}
      </h3>
      <p className="mt-2 text-sm text-slate-600">
        {t("manager.duplicates.subtitle")}
      </p>

      <div className="mt-5 space-y-6">
        <div>
          <h4 className="text-base font-semibold text-slate-900">
            {t("manager.duplicates.possible", { count: duplicateCandidates.length })}
          </h4>
          <div className="mt-3 overflow-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="px-3 py-2 font-semibold text-slate-700">
                    {t("manager.duplicates.participant")}
                  </th>
                  <th className="px-3 py-2 font-semibold text-slate-700">
                    {t("manager.duplicates.email")}
                  </th>
                  <th className="px-3 py-2 font-semibold text-slate-700">
                    {t("manager.duplicates.group")}
                  </th>
                  <th className="px-3 py-2 font-semibold text-slate-700">
                    {t("manager.duplicates.reason")}
                  </th>
                  <th className="px-3 py-2 font-semibold text-slate-700">
                    {t("manager.duplicates.compareWith")}
                  </th>
                  <th className="px-3 py-2 font-semibold text-slate-700">
                    {t("manager.duplicates.action")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {duplicateCandidates.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-3 text-slate-500">
                      {t("manager.duplicates.none")}
                    </td>
                  </tr>
                ) : (
                  duplicateCandidates.map((participant) => (
                    <tr key={participant.id}>
                      <td className="px-3 py-2 text-slate-900">
                        {[participant.nome ?? "", participant.cognome ?? ""].join(" ").trim() || "-"}
                      </td>
                      <td className="px-3 py-2 text-slate-700">{participant.email ?? "-"}</td>
                      <td className="px-3 py-2 text-slate-700">{participant.group}</td>
                      <td className="px-3 py-2 text-slate-700">
                        {participant.reasonCodes
                          .map((reason) =>
                            t(`manager.duplicates.reason.${reason}`)
                          )
                          .join(" + ")}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        <div className="flex flex-col gap-2">
                          {participant.matchedWith.map((match) => (
                            <span key={`${participant.id}-${match.id}`}>{match.label}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        <div className="flex flex-col gap-2">
                          <Link
                            href={`?section=duplicates&editParticipant=${participant.id}#duplicates-non-associated`}
                            className="inline-flex w-fit rounded border border-indigo-200 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
                          >
                            {t("common.edit")}
                          </Link>
                          {participant.matchedWith.map((match) => (
                            <form
                              key={`ignore-${participant.id}-${match.id}`}
                              method="post"
                              action="/api/manager/duplicate-false-positives"
                            >
                              <input type="hidden" name="participant_a_id" value={participant.id} />
                              <input type="hidden" name="participant_b_id" value={match.id} />
                              <button
                                type="submit"
                                className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                              >
                                {t("manager.duplicates.exclude")}
                              </button>
                            </form>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h4 className="text-base font-semibold text-slate-900">
            {t("manager.unassigned.title", { count: unassignedParticipants.length })}
          </h4>
          <div className="mt-3 overflow-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="px-3 py-2 font-semibold text-slate-700">
                    {t("manager.duplicates.participant")}
                  </th>
                  <th className="px-3 py-2 font-semibold text-slate-700">
                    {t("manager.duplicates.email")}
                  </th>
                  <th className="px-3 py-2 font-semibold text-slate-700">
                    {t("manager.duplicates.group")}
                  </th>
                  <th className="px-3 py-2 font-semibold text-slate-700">
                    {t("manager.unassigned.tallyDetail")}
                  </th>
                  <th className="px-3 py-2 font-semibold text-slate-700">
                    {t("participants.table.header.actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {unassignedParticipants.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-3 text-slate-500">
                      {t("manager.unassigned.none")}
                    </td>
                  </tr>
                ) : (
                  unassignedParticipants.map((participant) => (
                    <tr key={participant.id}>
                      <td className="px-3 py-2 text-slate-900">
                        {[participant.nome ?? "", participant.cognome ?? ""].join(" ").trim() || "-"}
                      </td>
                      <td className="px-3 py-2 text-slate-700">{participant.email ?? "-"}</td>
                      <td className="px-3 py-2 text-slate-700">{participantGroupValue(participant)}</td>
                      <td className="px-3 py-2 text-slate-700">{participantTallyDetail(participant)}</td>
                      <td className="px-3 py-2 text-slate-700">
                        <Link
                          href={`?section=duplicates&editParticipant=${participant.id}#duplicates-non-associated`}
                          className="inline-flex rounded border border-indigo-200 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
                        >
                          {t("common.edit")}
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

function OperatorAccommodationPreferenceSection({
  counts,
  t,
}: {
  counts: OperatorAccommodationPreferenceCounts;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const rows = [
    {
      key: "hotel",
      label: t("manager.operatorAccommodation.hotel"),
      count: counts.hotel,
      href: "/dashboard/manager/participants?operatorAccommodation=hotel",
    },
    {
      key: "hostel",
      label: t("manager.operatorAccommodation.hostel"),
      count: counts.hostel,
      href: "/dashboard/manager/participants?operatorAccommodation=hostel",
    },
    {
      key: "missing",
      label: t("manager.operatorAccommodation.missing"),
      count: counts.missing,
      href: "/dashboard/manager/participants?operatorAccommodation=missing",
    },
    {
      key: "not-applicable",
      label: t("manager.operatorAccommodation.notApplicable"),
      count: counts.notApplicable,
      href: "/dashboard/manager/participants?operatorAccommodation=not-applicable",
    },
  ];

  return (
    <section
      id="operator-accommodation"
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            {t("manager.operatorAccommodation.title")}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {t("manager.operatorAccommodation.subtitle")}
          </p>
        </div>
        <a
          href="/api/manager/statistics/operator-hotel-export"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            className="h-4 w-4"
          >
            <path
              d="M10 2.5v9m0 0 3.25-3.25M10 11.5 6.75 8.25M4 13.5v2A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5v-2"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {t("manager.operatorAccommodation.downloadHotelExcel")}
        </a>
      </div>

      <div className="mt-4 overflow-hidden rounded border border-slate-200">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="px-4 py-3">
                {t("manager.operatorAccommodation.preference")}
              </th>
              <th className="px-4 py-3 text-right">
                {t("manager.operatorAccommodation.count")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-slate-100">
                <td className="px-4 py-3">{row.label}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={row.href}
                    className="font-semibold text-indigo-700 underline-offset-2 hover:underline"
                  >
                    {row.count}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ParticipantBadgesControl({
  t,
}: {
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  return (
    <div
      id="participant-badges"
      className="flex flex-wrap items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
        {t("manager.participantBadges.title")}
      </p>
      <ParticipantBadgesDownloadButton
        idleLabel={t("manager.participantBadges.download")}
        loadingLabel={t("manager.participantBadges.preparing")}
        errorLabel={t("manager.participantBadges.retry")}
      />
    </div>
  );
}

function ParticipationReportControl({
  t,
}: {
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
        {t("admin.participationReport.title")}
      </p>
      <ParticipationReportDownloadButton
        idleLabel={t("admin.participationReport.download")}
        loadingLabel={t("admin.participationReport.preparing")}
        errorLabel={t("admin.participationReport.retry")}
      />
    </div>
  );
}

function HostelCheckInStatisticsSection({
  rows,
  hostelRows,
  t,
}: {
  rows: HostelCheckInGroupRow[];
  hostelRows: HostelCheckInHostelRow[];
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const completed = rows.reduce((sum, row) => sum + row.completed, 0);
  const pending = rows.reduce((sum, row) => sum + row.pending, 0);

  return (
    <section
      id="hostel-check-in"
      className="rounded-xl border border-cyan-200 bg-white p-6 shadow-sm"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            {t("manager.hostelCheckIn.title")}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {t("manager.hostelCheckIn.subtitle")}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2">
            <p className="text-xs font-semibold uppercase text-emerald-700">
              {t("manager.hostelCheckIn.completed")}
            </p>
            <p className="mt-1 text-2xl font-bold text-emerald-900">{completed}</p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2">
            <p className="text-xs font-semibold uppercase text-red-700">
              {t("manager.hostelCheckIn.pending")}
            </p>
            <p className="mt-1 text-2xl font-bold text-red-900">{pending}</p>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <h4 className="text-sm font-semibold text-slate-800">
          {t("manager.hostelCheckIn.groupTableTitle")}
        </h4>
        <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-3 font-semibold">
                  {t("manager.hostelCheckIn.group")}
                </th>
                <th className="px-4 py-3 text-center font-semibold text-emerald-800">
                  {t("manager.hostelCheckIn.completed")}
                </th>
                <th className="px-4 py-3 text-center font-semibold text-red-800">
                  {t("manager.hostelCheckIn.pending")}
                </th>
                <th className="px-4 py-3 text-center font-semibold">
                  {t("manager.hostelCheckIn.total")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-slate-500">
                    {t("manager.hostelCheckIn.empty")}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.group} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-900">{row.group}</td>
                    <td className="px-4 py-3 text-center font-semibold text-emerald-700">
                      {row.completed}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-red-700">
                      {row.pending}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-700">{row.total}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6">
        <h4 className="text-sm font-semibold text-slate-800">
          {t("manager.hostelCheckIn.hostelTableTitle")}
        </h4>
        <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-3 font-semibold">
                  {t("manager.hostelCheckIn.hostel")}
                </th>
                <th className="px-4 py-3 text-center font-semibold text-emerald-800">
                  {t("manager.hostelCheckIn.completed")}
                </th>
                <th className="px-4 py-3 text-center font-semibold text-red-800">
                  {t("manager.hostelCheckIn.pending")}
                </th>
              </tr>
            </thead>
            <tbody>
              {hostelRows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-4 text-slate-500">
                    {t("manager.hostelCheckIn.empty")}
                  </td>
                </tr>
              ) : (
                hostelRows.map((row) => (
                  <tr key={row.hostel} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-900">{row.hostel}</td>
                    <td className="px-4 py-3 text-center font-semibold text-emerald-700">
                      {row.completed}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-red-700">
                      {row.pending}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function EventArrivalStatisticsSection({
  rows,
  t,
}: {
  rows: ArrivalGroupSummaryRow[];
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  return (
    <section
      id="event-arrivals"
      className="rounded-xl border border-indigo-200 bg-white p-6 shadow-sm"
    >
      <h3 className="text-lg font-semibold text-slate-900">
        {t("manager.eventArrivals.title")}
      </h3>
      <p className="mt-1 text-sm text-slate-500">
        {t("manager.eventArrivals.subtitle")}
      </p>
      <div className="mt-5">
        <ArrivalGroupSummaryTable
          rows={rows}
          labels={{
            group: t("manager.eventArrivals.group"),
            arrived: t("manager.eventArrivals.arrived"),
            notArrived: t("manager.eventArrivals.notArrived"),
            total: t("manager.eventArrivals.total"),
            empty: t("manager.eventArrivals.empty"),
          }}
        />
      </div>
    </section>
  );
}

function StaffAvailabilityMetric({
  label,
  value,
  filter,
  emphasized = false,
}: {
  label: string;
  value: number;
  filter: StaffAvailabilityFilter;
  emphasized?: boolean;
}) {
  return (
    <Link
      href={`/dashboard/manager/participants?staffAvailability=${filter}`}
      aria-label={`${label}: ${value}`}
      className={`group block rounded-lg border p-4 transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
        emphasized
          ? "border-violet-200 bg-violet-50"
          : "border-slate-200 bg-slate-50"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold text-slate-950 group-hover:text-indigo-700">
        {value}
      </p>
    </Link>
  );
}

function StaffAvailabilitySection({
  summary,
  t,
}: {
  summary: StaffAvailabilitySummary;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  return (
    <section
      id="staff-availability"
      className="rounded-xl border border-violet-200 bg-white p-6 shadow-sm"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            {t("manager.staffAvailability.title")}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {t("manager.staffAvailability.subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/manager/staff-availability"
            aria-label={t("staffAvailabilityList.open")}
            title={t("staffAvailabilityList.open")}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-5 w-5">
              <path d="M3 4.5h14M3 10h14M3 15.5h14M6.5 3v14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </Link>
          <a
            href="/api/manager/statistics/staff-availability-export"
            aria-label={t("manager.staffAvailability.downloadExcel")}
            title={t("manager.staffAvailability.downloadExcel")}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-violet-200 bg-violet-50 text-violet-700 transition hover:border-violet-300 hover:bg-violet-100 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
          >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            className="h-5 w-5"
          >
            <path
              d="M10 2.5v9m0 0 3.25-3.25M10 11.5 6.75 8.25M4 13.5v2A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5v-2"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          </a>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <StaffAvailabilityMetric
          label={t("manager.staffAvailability.responses")}
          value={summary.responses}
          filter="responses"
          emphasized
        />
        <StaffAvailabilityMetric
          label={t("manager.staffAvailability.band")}
          value={summary.band}
          filter="band"
        />
        <StaffAvailabilityMetric
          label={t("manager.staffAvailability.choir")}
          value={summary.choir}
          filter="choir"
        />
        <StaffAvailabilityMetric
          label={t("manager.staffAvailability.socialMedia")}
          value={summary.socialMedia}
          filter="social_media"
        />
      </div>

      <div className="mt-4 grid gap-4">
        <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
          <h4 className="text-sm font-semibold text-slate-900">
            {t("manager.staffAvailability.bandDetails")}
          </h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <StaffAvailabilityMetric
              label={t("manager.staffAvailability.bandVocals")}
              value={summary.bandVocals}
              filter="band_vocals"
            />
            <StaffAvailabilityMetric
              label={t("manager.staffAvailability.bandInstrument")}
              value={summary.bandInstrument}
              filter="band_instrument"
            />
          </div>
        </div>

        <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-4">
          <h4 className="text-sm font-semibold text-slate-900">
            {t("manager.staffAvailability.socialDetails")}
          </h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <StaffAvailabilityMetric
              label={t("manager.staffAvailability.socialCapture")}
              value={summary.socialCapture}
              filter="social_capture"
            />
            <StaffAvailabilityMetric
              label={t("manager.staffAvailability.socialPostProduction")}
              value={summary.socialPostProduction}
              filter="social_post_production"
            />
            <StaffAvailabilityMetric
              label={t("manager.staffAvailability.socialShortPosts")}
              value={summary.socialShortPosts}
              filter="social_short_posts"
            />
            <StaffAvailabilityMetric
              label={t("manager.staffAvailability.socialLongArticles")}
              value={summary.socialLongArticles}
              filter="social_long_articles"
            />
            <StaffAvailabilityMetric
              label={t("manager.staffAvailability.socialOther")}
              value={summary.socialOther}
              filter="social_other"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

const ACCESSIBILITY_LABEL_KEYS: Record<AccessibilityFilter, string> = {
  seeing: "participant.option.accessibility.seeing",
  hearing: "participant.option.accessibility.hearing",
  walking: "participant.option.accessibility.walking",
  self_care: "participant.option.accessibility.selfCare",
  concentration: "participant.option.accessibility.concentration",
  communicating: "participant.option.accessibility.communicating",
  wheelchair: "participant.option.accessibility.wheelchair",
  accessible_accommodation: "participant.option.accessibility.accessibleAccommodation",
  assistance: "participant.option.accessibility.assistance",
};

function AccessibilitySection({
  summary,
  t,
}: {
  summary: Record<AccessibilityFilter, number>;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  return (
    <section
      id="accessibility"
      className="rounded-xl border border-rose-200 bg-white p-6 shadow-sm"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            {t("manager.accessibility.title")}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {t("manager.accessibility.subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/manager/accessibility"
            aria-label={t("accessibilityList.open")}
            title={t("accessibilityList.open")}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-5 w-5">
              <path d="M3 4.5h14M3 10h14M3 15.5h14M6.5 3v14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </Link>
          <a
            href="/api/manager/statistics/accessibility-export"
            aria-label={t("manager.accessibility.downloadExcel")}
            title={t("manager.accessibility.downloadExcel")}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-5 w-5">
              <path d="M10 2.5v9m0 0 3.25-3.25M10 11.5 6.75 8.25M4 13.5v2A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5v-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {ACCESSIBILITY_FILTERS.map((filter) => (
          <Link
            key={filter}
            href={`/dashboard/manager/accessibility?filter=${filter}`}
            aria-label={`${t(ACCESSIBILITY_LABEL_KEYS[filter])}: ${summary[filter]}`}
            className="group block rounded-lg border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:border-rose-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              {t(ACCESSIBILITY_LABEL_KEYS[filter])}
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-950 group-hover:text-rose-700">
              {summary[filter]}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}

const FOOD_NEEDS_LABEL_KEYS: Record<FoodNeedsFilter, string> = {
  vegetarian: "manager.foodNeeds.vegetarian",
  vegan: "manager.foodNeeds.vegan",
  no_pork: "manager.foodNeeds.noPork",
  other: "manager.foodNeeds.other",
  allergies: "manager.foodNeeds.allergies",
  gluten_celiac: "manager.foodNeeds.glutenCeliac",
  lactose_dairy: "manager.foodNeeds.lactoseDairy",
  nuts_peanuts: "manager.foodNeeds.nutsPeanuts",
  fish_shellfish: "manager.foodNeeds.fishShellfish",
};

function FoodNeedsMetrics({
  filters,
  summary,
  t,
}: {
  filters: readonly FoodNeedsFilter[];
  summary: Record<FoodNeedsFilter, number>;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  return filters.map((filter) => (
    <Link
      key={filter}
      href={`/dashboard/manager/food-needs?filter=${filter}`}
      aria-label={`${t(FOOD_NEEDS_LABEL_KEYS[filter])}: ${summary[filter]}`}
      className="group block rounded-lg border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
        {t(FOOD_NEEDS_LABEL_KEYS[filter])}
      </p>
      <p className="mt-2 text-3xl font-bold text-slate-950 group-hover:text-emerald-700">
        {summary[filter]}
      </p>
    </Link>
  ));
}

function FoodNeedsSection({
  summary,
  t,
}: {
  summary: Record<FoodNeedsFilter, number>;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  return (
    <section
      id="food-needs"
      className="rounded-xl border border-emerald-200 bg-white p-6 shadow-sm"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            {t("manager.foodNeeds.title")}
          </h3>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            {t("manager.foodNeeds.subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/manager/food-needs"
            aria-label={t("foodNeedsList.open")}
            title={t("foodNeedsList.open")}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-5 w-5">
              <path d="M3 4.5h14M3 10h14M3 15.5h14M6.5 3v14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </Link>
          <a
            href="/api/manager/statistics/food-needs-export"
            aria-label={t("manager.foodNeeds.downloadExcel")}
            title={t("manager.foodNeeds.downloadExcel")}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-5 w-5">
              <path d="M10 2.5v9m0 0 3.25-3.25M10 11.5 6.75 8.25M4 13.5v2A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5v-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>
      </div>

      <div className="mt-5">
        <h4 className="text-sm font-semibold text-slate-900">
          {t("manager.foodNeeds.formResponses")}
        </h4>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <FoodNeedsMetrics filters={FOOD_NEEDS_FORM_FILTERS} summary={summary} t={t} />
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50/50 p-4">
        <h4 className="text-sm font-semibold text-slate-900">
          {t("manager.foodNeeds.detectedCategories")}
        </h4>
        <p className="mt-1 text-xs leading-5 text-slate-600">
          {t("manager.foodNeeds.detectedCategoriesHint")}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <FoodNeedsMetrics filters={FOOD_NEEDS_TEXT_FILTERS} summary={summary} t={t} />
        </div>
      </div>
    </section>
  );
}

function RegistrationTrendSection({
  series,
  t,
}: {
  series: TrendSeries | null;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  if (!series) {
    return (
      <section id="trend" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">{t("manager.trend.title")}</h3>
        <p className="mt-2 text-sm text-slate-500">{t("manager.trend.unavailable")}</p>
      </section>
    );
  }

  const width = 980;
  const height = 420;
  const paddingLeft = 64;
  const paddingRight = 24;
  const paddingTop = 18;
  const paddingBottom = 44;
  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  const allValues = [
    ...series.current.map((point) => point.value),
    ...series.historyAverage.map((point) => point.value),
    ...series.forecast.map((point) => point.value),
    series.forecastFinal,
  ];
  const maxY = Math.max(10, Math.max(...allValues));

  const x = (day: number) =>
    paddingLeft + ((day - series.minDay) / (0 - series.minDay || 1)) * plotWidth;
  const y = (value: number) =>
    paddingTop + (1 - value / maxY) * plotHeight;

  const currentPath = toSvgPath(series.current, x, y);
  const historyPath = toSvgPath(series.historyAverage, x, y);
  const forecastPath = toSvgPath(series.forecast, x, y);
  const todayX = x(series.todayDay);
  const yTicks = 6;

  return (
    <section id="trend" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{t("manager.trend.title")}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {t("manager.trend.subtitle")}
          </p>
        </div>
        <div className="grid gap-1 text-sm text-slate-700">
          <p>
            {t("manager.trend.today", {
              day: series.todayDay,
              value: series.currentToday,
            })}
          </p>
          <p>
            {t("manager.trend.historicalAverage", { value: series.historyToday })}
          </p>
          <p>
            {t("manager.trend.forecast", { value: series.forecastFinal })}
          </p>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[760px] w-full" role="img">
          <rect x="0" y="0" width={width} height={height} fill="white" />

          {Array.from({ length: yTicks + 1 }, (_, index) => {
            const value = Math.round((maxY * index) / yTicks);
            const yy = y(value);
            return (
              <g key={`y-${value}`}>
                <line
                  x1={paddingLeft}
                  y1={yy}
                  x2={paddingLeft + plotWidth}
                  y2={yy}
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />
                <text x={paddingLeft - 10} y={yy + 4} textAnchor="end" fontSize="11" fill="#64748b">
                  {value}
                </text>
              </g>
            );
          })}

          <line
            x1={paddingLeft}
            y1={paddingTop + plotHeight}
            x2={paddingLeft + plotWidth}
            y2={paddingTop + plotHeight}
            stroke="#94a3b8"
            strokeWidth="1.2"
          />
          <line
            x1={paddingLeft}
            y1={paddingTop}
            x2={paddingLeft}
            y2={paddingTop + plotHeight}
            stroke="#94a3b8"
            strokeWidth="1.2"
          />

          <line
            x1={todayX}
            y1={paddingTop}
            x2={todayX}
            y2={paddingTop + plotHeight}
            stroke="#1d4ed8"
            strokeWidth="1.2"
            strokeDasharray="5 5"
          />

          <path d={historyPath} fill="none" stroke="#dc2626" strokeWidth="2.2" />
          <path d={currentPath} fill="none" stroke="#2563eb" strokeWidth="2.2" />
          <path d={forecastPath} fill="none" stroke="#16a34a" strokeWidth="2.2" strokeDasharray="6 4" />

          <text x={width / 2} y={height - 8} textAnchor="middle" fontSize="12" fill="#334155">
            {t("manager.trend.axisDays")}
          </text>
          <text
            x={14}
            y={height / 2}
            textAnchor="middle"
            fontSize="12"
            fill="#334155"
            transform={`rotate(-90 14 ${height / 2})`}
          >
            {t("manager.trend.axisCumulative")}
          </text>
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-700">
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-6 bg-blue-600" /> {t("manager.trend.currentYear")}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-6 bg-red-600" /> {t("manager.trend.averageYears")}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-6 bg-green-600" /> {t("manager.trend.forecastLabel")}
        </span>
      </div>
    </section>
  );
}

export async function StatisticsDashboard({
  publicView = false,
  sectionedView = false,
  activeSection = "registrations",
  sectionBasePath = "/dashboard/manager",
}: {
  publicView?: boolean;
  sectionedView?: boolean;
  activeSection?: StatisticsSectionKey;
  sectionBasePath?: string;
} = {}) {
  const { t } = await getServerTranslator();
  const service = createSupabaseServiceClient({ noStore: sectionedView });
  let canDownloadParticipationReport = false;
  if (!publicView) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return (
        <section className="rounded border border-red-200 bg-red-50 p-6">
          <h2 className="text-xl font-bold text-red-800">{t("manager.statistics.title")}</h2>
          <p className="mt-2 text-sm text-red-700">{t("common.errorUnauthorized")}</p>
        </section>
      );
    }

    const email = (user.email ?? "").trim().toLowerCase();
    const { data: profile, error: profileError } = await service
      .from("profili")
      .select("ruolo")
      .ilike("email", email)
      .in("ruolo", ["manager", "admin"]);

    if (profileError || !profile || profile.length === 0) {
      return (
        <section className="rounded border border-red-200 bg-red-50 p-6">
          <h2 className="text-xl font-bold text-red-800">{t("manager.statistics.title")}</h2>
          <p className="mt-2 text-sm text-red-700">{t("common.errorForbidden")}</p>
        </section>
      );
    }
    canDownloadParticipationReport = canGenerateParticipationReport(
      profile as ParticipationReportAccessProfile[],
    );
  }

  const showSection = (section: StatisticsSectionKey) =>
    !sectionedView || activeSection === section;

  const executeSelect = async (selectFields: string) =>
    service.from("partecipanti").select(selectFields).is("deleted_at", null);

  const primarySelectFields = sectionedView
    ? SECTION_SELECT_FIELDS[activeSection]
    : SELECT_FIELDS_WITH_CITY;
  let { data, error } = await executeSelect(primarySelectFields);
  if (error && sectionedView) {
    const code = error.code ?? "";
    const message = (error.message ?? "").toLowerCase();
    const canRetry =
      ["42703", "PGRST100", "PGRST204"].includes(code) ||
      message.includes("column") ||
      message.includes("parse") ||
      message.includes("terminated") ||
      message.includes("timeout") ||
      message.includes("econnreset");

    if (canRetry) {
      const retryFields =
        activeSection === "registrations"
          ? REGISTRATIONS_SELECT_FIELDS_WITHOUT_CITY
          : primarySelectFields;
      const retry = await executeSelect(retryFields);
      data = retry.data;
      error = retry.error;
    }
  }
  if (error && !sectionedView) {
    const code = error.code ?? "";
    const message = (error.message ?? "").toLowerCase();
    const canFallback =
      ["42703", "PGRST100", "PGRST204"].includes(code) ||
      message.includes("column") ||
      message.includes("parse");

    if (!canFallback) {
      return (
        <section className="rounded border border-red-200 bg-red-50 p-6">
          <h2 className="text-xl font-bold text-red-800">{t("manager.statistics.title")}</h2>
          <p className="mt-2 text-sm text-red-700">{error.message}</p>
        </section>
      );
    }

    let fallback = await executeSelect(SELECT_FIELDS_BASE);
    if (fallback.error) {
      const fallbackCode = fallback.error.code ?? "";
      const fallbackMessage = (fallback.error.message ?? "").toLowerCase();
      const canLegacyFallback =
        ["42703", "PGRST100", "PGRST204"].includes(fallbackCode) ||
        fallbackMessage.includes("column") ||
        fallbackMessage.includes("parse");
      if (canLegacyFallback) {
        fallback = await executeSelect(SELECT_FIELDS_WITH_CITY_LEGACY);
      }
      if (fallback.error && canLegacyFallback) {
        fallback = await executeSelect(SELECT_FIELDS_BASE_LEGACY);
      }
    }
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    return (
      <section className="rounded border border-red-200 bg-red-50 p-6">
        <h2 className="text-xl font-bold text-red-800">{t("manager.statistics.title")}</h2>
        <p className="mt-2 text-sm text-red-700">{error.message}</p>
      </section>
    );
  }

  const participants = ((data ?? []) as unknown as ParticipantStatRow[]).filter(
    (participant) => !participant.deleted_at
  );
  let dailyPresenceHostelNames: string[] = [];
  let dailyPresenceAssignedHostelNames = new Map<string, string>();
  let dailyPresenceEventSettings: Awaited<ReturnType<typeof loadEventRuntimeSettings>> | null = null;
  if (showSection("daily-presence")) {
    try {
      const [assignedHostelNames, hostelResult, eventSettings] = await Promise.all([
        loadAssignedHostelNameByParticipant(
          service,
          participants.map((participant) => participant.id),
        ),
        service.from("alberghi").select("nome").order("nome", { ascending: true }),
        loadEventRuntimeSettings(service),
      ]);
      if (hostelResult.error) throw new Error(hostelResult.error.message);

      dailyPresenceAssignedHostelNames = assignedHostelNames;
      dailyPresenceEventSettings = eventSettings;
      dailyPresenceHostelNames = ((hostelResult.data ?? []) as Array<{ nome: string | null }>)
        .flatMap((hostel) => {
          const name = hostel.nome?.trim();
          return name ? [name] : [];
        });
    } catch (dailyPresenceError) {
      return (
        <section className="rounded border border-red-200 bg-red-50 p-6">
          <h2 className="text-xl font-bold text-red-800">{t("manager.statistics.title")}</h2>
          <p className="mt-2 text-sm text-red-700">
            {dailyPresenceError instanceof Error
              ? dailyPresenceError.message
              : t("manager.presence.loadError")}
          </p>
        </section>
      );
    }
  }
  const dailyPresenceParticipants = participants.map((participant) => ({
    id: participant.id,
    citta: participant.citta ?? null,
    data_arrivo: participant.data_arrivo,
    data_partenza: participant.data_partenza,
    partecipa_intero_evento: participant.partecipa_intero_evento ?? null,
    presenza_dettaglio: participant.presenza_dettaglio ?? null,
    alloggio_short: participant.alloggio_short,
    alloggio: participant.alloggio,
    tipo_iscrizione: participant.tipo_iscrizione,
    preferenza_alloggio_operatore: participant.preferenza_alloggio_operatore,
    assigned_hostel_name:
      dailyPresenceAssignedHostelNames.get(participant.id) ?? null,
  }));
  const accessibilitySummary = buildAccessibilitySummary(participants);
  const foodNeedsSummary = buildFoodNeedsSummary(participants);
  let staffAvailabilitySummary = emptyStaffAvailabilitySummary();
  let hostelCheckInGroupSummary: HostelCheckInGroupRow[] = [];
  let hostelCheckInHostelSummary: HostelCheckInHostelRow[] = [];
  let eventArrivalGroupSummary: ArrivalGroupSummaryRow[] = [];
  if (!publicView) {
    const shouldLoadStaffAvailability = showSection("staff-availability");
    const shouldLoadHostelCheckIn = showSection("hostel-check-in");
    const shouldLoadEventArrivals = showSection("event-arrivals");
    const hostelCheckInParticipantIds = shouldLoadHostelCheckIn
      ? participants
          .filter(participantMayNeedHostelCheckIn)
          .map((participant) => participant.id)
      : [];
    const [
      staffAvailabilityResult,
      hostelCheckInStatuses,
      hostelNamesByParticipant,
      eventArrivalStatuses,
    ] = await Promise.all([
      shouldLoadStaffAvailability
        ? service
            .from("participant_staff_availability")
            .select("participant_id,areas,band_role,social_media_tasks")
        : Promise.resolve({ data: [], error: null }),
      shouldLoadHostelCheckIn
        ? loadHostelCheckInStatuses(service, hostelCheckInParticipantIds)
        : Promise.resolve(new Map<string, HostelCheckInStatus>()),
      shouldLoadHostelCheckIn
        ? loadAssignedHostelNameByParticipant(service, hostelCheckInParticipantIds)
        : Promise.resolve(new Map<string, string>()),
      shouldLoadEventArrivals
        ? loadParticipantArrivalStatuses(
            service,
            participants.map((participant) => participant.id)
          )
        : Promise.resolve(new Map<string, string | null>()),
    ]);
    const { data: staffAvailabilityData, error: staffAvailabilityError } =
      staffAvailabilityResult;

    if (staffAvailabilityError) {
      return (
        <section className="rounded border border-red-200 bg-red-50 p-6">
          <h2 className="text-xl font-bold text-red-800">{t("manager.statistics.title")}</h2>
          <p className="mt-2 text-sm text-red-700">{staffAvailabilityError.message}</p>
        </section>
      );
    }

    if (shouldLoadStaffAvailability) {
      const activeParticipantIds = new Set(participants.map((participant) => participant.id));
      const activeAvailabilityRows = (
        (staffAvailabilityData ?? []) as StaffAvailabilityStatRow[]
      ).filter((row) => activeParticipantIds.has(row.participant_id));
      staffAvailabilitySummary = buildStaffAvailabilitySummary(activeAvailabilityRows);
    }

    if (shouldLoadHostelCheckIn) {
      hostelCheckInGroupSummary = buildHostelCheckInGroupSummary(
        participants.map((participant) => ({
          id: participant.id,
          group: participantGroupValue(participant),
        })),
        hostelCheckInStatuses
      );
      hostelCheckInHostelSummary = buildHostelCheckInHostelSummary(
        participants.map((participant) => ({
          id: participant.id,
          hostel: hostelNamesByParticipant.get(participant.id),
        })),
        hostelCheckInStatuses
      );
    }
    if (shouldLoadEventArrivals) {
      eventArrivalGroupSummary = buildArrivalGroupSummary(
        participants.map((participant) => ({
          group: participantGroupValue(participant),
          arrivedAt: eventArrivalStatuses.get(participant.id) ?? null,
        }))
      );
    }
  }
  const operatorAccommodationPreferenceCounts =
    buildOperatorAccommodationPreferenceCounts(participants);
  const leaderGroupIds = new Set<string>();
  let duplicateCandidates: DuplicateCandidateRow[] = [];
  let unassignedParticipants: ParticipantStatRow[] = [];
  if (!publicView && showSection("duplicates")) {
    const { data: leaderProfiles, error: leaderProfilesError } = await service
      .from("profili")
      .select("id")
      .in("ruolo", [...STATISTICS_GROUP_LEADER_ROLES]);

    if (leaderProfilesError) {
      return (
        <section className="rounded border border-red-200 bg-red-50 p-6">
          <h2 className="text-xl font-bold text-red-800">{t("manager.statistics.title")}</h2>
          <p className="mt-2 text-sm text-red-700">{leaderProfilesError.message}</p>
        </section>
      );
    }

    const leaderIds = ((leaderProfiles ?? []) as ProfileRoleRow[]).map(
      (profile) => profile.id
    );
    if (leaderIds.length > 0) {
      const { data: links, error: linksError } = await service
        .from("profili_gruppi")
        .select("profilo_id,gruppo_id")
        .in("profilo_id", leaderIds);

      if (linksError) {
        return (
          <section className="rounded border border-red-200 bg-red-50 p-6">
            <h2 className="text-xl font-bold text-red-800">{t("manager.statistics.title")}</h2>
            <p className="mt-2 text-sm text-red-700">{linksError.message}</p>
          </section>
        );
      }

      for (const row of (links ?? []) as ProfileLinkRow[]) {
        const groupId = (row.gruppo_id ?? "").trim();
        if (groupId) leaderGroupIds.add(groupId);
      }
    }
  }

  const counters = createEmptyBucketCounts();
  const byCountry = new Map<string, Record<EnrollmentBucket, number>>();
  const byCountryCity = new Map<
    string,
    Map<string, CityBucketEntry>
  >();
  const byGroup = new Map<string, Record<EnrollmentBucket, number>>();

  for (const participant of participants) {
    const bucket = mapEnrollmentBucket(participant.tipo_iscrizione);
    if (!bucket) continue;

    counters[bucket] += 1;

    const country = (participant.paese_residenza ?? participant.nazione ?? "").trim() || "-";
    const currentCountry = byCountry.get(country) ?? createEmptyBucketCounts();
    currentCountry[bucket] += 1;
    byCountry.set(country, currentCountry);

    const countryCities = byCountryCity.get(country) ?? new Map();
    incrementCityBucket(countryCities, participant.citta, bucket);
    byCountryCity.set(country, countryCities);

    const group = (participant.gruppo_label ?? participant.gruppo_id ?? "").trim() || "-";
    const currentGroup = byGroup.get(group) ?? createEmptyBucketCounts();
    currentGroup[bucket] += 1;
    byGroup.set(group, currentGroup);
  }

  const countryLabels = sortedLabels(new Set(byCountry.keys()));
  const groupLabels = sortedLabels(new Set(byGroup.keys()));
  const totalWithoutDrivers = ENROLLMENT_BUCKETS.reduce(
    (acc, bucket) => acc + counters[bucket],
    0
  );
  const countryRows = countryLabels.map((label) => {
    const counts = byCountry.get(label) ?? createEmptyBucketCounts();
    const cityCounts = byCountryCity.get(label) ?? new Map();
    return {
      label,
      counts,
      total: ENROLLMENT_BUCKETS.reduce((acc, bucket) => acc + counts[bucket], 0),
      cityRows: [...cityCounts.values()]
        .sort((a, b) => compareLabels(a.label, b.label))
        .map((city) => {
          const countsForCity = city.counts;
          return {
            label: city.label,
            counts: countsForCity,
            total: ENROLLMENT_BUCKETS.reduce(
              (acc, bucket) => acc + countsForCity[bucket],
              0
            ),
          };
        }),
    };
  });
  const groupRows = groupLabels.map((label) => {
    const counts = byGroup.get(label) ?? createEmptyBucketCounts();
    return {
      label,
      counts,
      total: ENROLLMENT_BUCKETS.reduce((acc, bucket) => acc + counts[bucket], 0),
    };
  });
  let trendSeries: TrendSeries | null = null;
  if (showSection("trend")) {
    const eventSettings = await loadEventRuntimeSettings(service);
    try {
      trendSeries = await buildTrendSeries(participants, eventSettings.eventStartDate);
    } catch {
      trendSeries = null;
    }
  }
  if (!publicView && showSection("duplicates")) {
    unassignedParticipants = buildUnassignedParticipants(participants, leaderGroupIds);
    const { data: falsePositiveRows, error: falsePositiveError } = await service
      .from("duplicate_false_positives")
      .select("participant_a_id,participant_b_id");

    if (falsePositiveError && falsePositiveError.code !== "42P01") {
      return (
        <section className="rounded border border-red-200 bg-red-50 p-6">
          <h2 className="text-xl font-bold text-red-800">{t("manager.statistics.title")}</h2>
          <p className="mt-2 text-sm text-red-700">{falsePositiveError.message}</p>
        </section>
      );
    }

    const ignoredPairKeys = new Set(
      ((falsePositiveRows ?? []) as FalsePositiveRow[])
        .map((row) => {
          const a = (row.participant_a_id ?? "").trim();
          const b = (row.participant_b_id ?? "").trim();
          if (!a || !b) return "";
          return makePairKey(a, b);
        })
        .filter(Boolean)
    );
    duplicateCandidates = applyIgnoredDuplicatePairs(
      buildDuplicateCandidates(participants),
      ignoredPairKeys
    );
  }

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">{t("manager.statistics.title")}</h2>
        <p className="mt-2 text-sm text-slate-500">{t("manager.statistics.subtitle")}</p>
      </div>

      <div
        className={`grid gap-6 lg:items-start ${
          sectionedView
            ? "lg:grid-cols-[256px_minmax(0,1fr)]"
            : "lg:grid-cols-[auto_minmax(0,1fr)]"
        }`}
      >
        {sectionedView ? (
          <StatisticsSectionNavigator
            activeSection={activeSection}
            basePath={sectionBasePath}
            labels={{
              title: t("manager.statistics.navigation"),
              mobileLabel: t("manager.statistics.mobileLabel"),
              loading: t("manager.statistics.loadingSection"),
              groups: {
                participation: t("manager.statistics.group.participation"),
                operations: t("manager.statistics.group.operations"),
                needs: t("manager.statistics.group.needs"),
                quality: t("manager.statistics.group.quality"),
              },
              sections: {
                registrations: t("manager.statistics.registrations"),
                trend: t("manager.statistics.trend"),
                "daily-presence": t("manager.statistics.dailyPresence"),
                "event-arrivals": t("manager.statistics.eventArrivals"),
                "hostel-check-in": t("manager.statistics.hostelCheckIn"),
                "operator-accommodation": t("manager.operatorAccommodation.title"),
                "staff-availability": t("manager.statistics.staffAvailability"),
                accessibility: t("manager.statistics.accessibility"),
                "food-needs": t("manager.statistics.foodNeeds"),
                duplicates: t("manager.duplicates.section"),
              },
            }}
          />
        ) : (
          <StatisticsSectionsSidebar
            labels={{
              title: t("manager.statistics.sections"),
              counters: t("manager.statistics.counters"),
              registrations: t("manager.statistics.registrations"),
              trend: t("manager.statistics.trend"),
              dailyPresence: t("manager.statistics.dailyPresence"),
              participantBadges: t("manager.statistics.participantBadges"),
              hostelCheckIn: t("manager.statistics.hostelCheckIn"),
              eventArrivals: t("manager.statistics.eventArrivals"),
              staffAvailability: t("manager.statistics.staffAvailability"),
              accessibility: t("manager.statistics.accessibility"),
              foodNeeds: t("manager.statistics.foodNeeds"),
              duplicates: t("manager.duplicates.section"),
              open: t("manager.statistics.openSections"),
              close: t("manager.statistics.closeSections"),
            }}
            includePrivateSections={!publicView}
            includeDuplicates={!publicView}
          />
        )}

        <div className="space-y-6">
          {showSection("registrations") && (
            <section
              id="top-counters"
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-lg font-semibold text-slate-900">
                  {t("manager.statistics.topCounters")}
                </h3>
                {!publicView && (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <ParticipantBadgesControl t={t} />
                    {canDownloadParticipationReport && (
                      <ParticipationReportControl t={t} />
                    )}
                  </div>
                )}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <article className="rounded border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    {t("manager.statistics.totalRegistrations")}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    {totalWithoutDrivers}
                  </p>
                </article>
                {ENROLLMENT_BUCKETS.map((bucket) => (
                  <article
                    key={bucket}
                    className="rounded border border-slate-200 bg-slate-50 p-4"
                  >
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      {t(ENROLLMENT_BUCKET_LABEL_KEYS[bucket])}
                    </p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">
                      {counters[bucket]}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          )}

          {!sectionedView ? (
            <div className="grid gap-6 xl:grid-cols-2">
              <RegistrationsTabsSection
                buckets={ENROLLMENT_BUCKETS}
                countryRows={countryRows}
                groupRows={groupRows}
              />
              <DailyPresenceSection
                participants={dailyPresenceParticipants}
                hostelNames={dailyPresenceHostelNames}
                eventStartDate={dailyPresenceEventSettings?.eventStartDate ?? ""}
                eventEndDate={dailyPresenceEventSettings?.eventEndDate ?? ""}
                hostCity={dailyPresenceEventSettings?.hostCity ?? ""}
              />
            </div>
          ) : (
            <>
              {showSection("registrations") && (
                <RegistrationsTabsSection
                  buckets={ENROLLMENT_BUCKETS}
                  countryRows={countryRows}
                  groupRows={groupRows}
                />
              )}
              {showSection("daily-presence") && (
                <DailyPresenceSection
                  participants={dailyPresenceParticipants}
                  hostelNames={dailyPresenceHostelNames}
                  eventStartDate={dailyPresenceEventSettings?.eventStartDate ?? ""}
                  eventEndDate={dailyPresenceEventSettings?.eventEndDate ?? ""}
                  hostCity={dailyPresenceEventSettings?.hostCity ?? ""}
                />
              )}
            </>
          )}

          {!publicView && showSection("event-arrivals") && (
            <EventArrivalStatisticsSection rows={eventArrivalGroupSummary} t={t} />
          )}

          {!publicView && showSection("hostel-check-in") && (
            <HostelCheckInStatisticsSection
              rows={hostelCheckInGroupSummary}
              hostelRows={hostelCheckInHostelSummary}
              t={t}
            />
          )}

          {!publicView && !sectionedView && (
            <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
              <StaffAvailabilitySection summary={staffAvailabilitySummary} t={t} />
              <AccessibilitySection summary={accessibilitySummary} t={t} />
            </div>
          )}

          {!publicView && sectionedView && showSection("staff-availability") && (
            <StaffAvailabilitySection summary={staffAvailabilitySummary} t={t} />
          )}

          {!publicView && sectionedView && showSection("accessibility") && (
            <AccessibilitySection summary={accessibilitySummary} t={t} />
          )}

          {!publicView && showSection("food-needs") && (
            <FoodNeedsSection summary={foodNeedsSummary} t={t} />
          )}

          {!publicView && showSection("operator-accommodation") && (
            <OperatorAccommodationPreferenceSection
              counts={operatorAccommodationPreferenceCounts}
              t={t}
            />
          )}

          {showSection("trend") && (
            <RegistrationTrendSection series={trendSeries} t={t} />
          )}

          {!publicView && showSection("duplicates") && (
            <DuplicateAndUnassignedSection
              duplicateCandidates={duplicateCandidates}
              unassignedParticipants={unassignedParticipants}
              t={t}
            />
          )}
        </div>
      </div>
      {!publicView && <StatisticsParticipantEditModal />}
    </section>
  );
}

type ManagerStatisticsPageProps = {
  searchParams: Promise<{
    section?: string | string[];
  }>;
};

export default async function ManagerStatisticsPage({
  searchParams,
}: ManagerStatisticsPageProps) {
  const params = await searchParams;

  return StatisticsDashboard({
    publicView: false,
    sectionedView: true,
    activeSection: parseStatisticsSection(params.section),
    sectionBasePath: "/dashboard/manager",
  });
}
