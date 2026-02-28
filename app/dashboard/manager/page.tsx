import { readFile } from "node:fs/promises";
import path from "node:path";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { DailyPresenceSection } from "./daily-presence-section";
import { RegistrationsTabsSection } from "./registrations-tabs-section";
import { getServerTranslator } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

type ParticipantStatRow = {
  tipo_iscrizione: string | null;
  paese_residenza: string | null;
  nazione: string | null;
  gruppo_label: string | null;
  gruppo_id: string | null;
  data_arrivo: string | null;
  data_partenza: string | null;
  alloggio_short: string | null;
  alloggio: string | null;
  created_at: string | null;
};

type EnrollmentBucket = "Higher students" | "University-Worker" | "Operator";

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

const SELECT_FIELDS =
  "tipo_iscrizione,paese_residenza,nazione,gruppo_label,gruppo_id,data_arrivo,data_partenza,alloggio_short,alloggio,created_at";
const CURRENT_EVENT_DATE = "2026-10-28";
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

function sortedLabels(values: Set<string>): string[] {
  return [...values].sort((a, b) => {
    if (a === "-") return 1;
    if (b === "-") return -1;
    return a.localeCompare(b);
  });
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

async function buildTrendSeries(participants: ParticipantStatRow[]): Promise<TrendSeries | null> {
  const eventDate = parseDateOnly(CURRENT_EVENT_DATE);
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

  const windowStart = Math.max(minDay, latestCurrentDay - 21);
  const windowStartValue = pointValueAtOrBefore(currentFilled, windowStart);
  const windowLength = Math.max(1, latestCurrentDay - windowStart);
  const dailyRate = (latestCurrentValue - windowStartValue) / windowLength;
  const remainingDays = Math.max(0, 0 - latestCurrentDay);
  const forecastFinal = Math.max(
    latestCurrentValue,
    Math.round(latestCurrentValue + dailyRate * remainingDays)
  );

  const forecast =
    latestCurrentDay >= 0
      ? [{ day: 0, value: latestCurrentValue }]
      : [
          { day: latestCurrentDay, value: latestCurrentValue },
          { day: 0, value: forecastFinal },
        ];

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

export default async function ManagerStatisticsPage() {
  const { t } = await getServerTranslator();
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

  const { data: profile, error: profileError } = await supabase
    .from("profili")
    .select("ruolo")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || (profile?.ruolo !== "manager" && profile?.ruolo !== "admin")) {
    return (
      <section className="rounded border border-red-200 bg-red-50 p-6">
        <h2 className="text-xl font-bold text-red-800">{t("manager.statistics.title")}</h2>
        <p className="mt-2 text-sm text-red-700">{t("common.errorForbidden")}</p>
      </section>
    );
  }

  const service = createSupabaseServiceClient();
  const { data, error } = await service.from("partecipanti").select(SELECT_FIELDS);

  if (error) {
    return (
      <section className="rounded border border-red-200 bg-red-50 p-6">
        <h2 className="text-xl font-bold text-red-800">{t("manager.statistics.title")}</h2>
        <p className="mt-2 text-sm text-red-700">{error.message}</p>
      </section>
    );
  }

  const participants = (data ?? []) as ParticipantStatRow[];

  const counters = createEmptyBucketCounts();
  const byCountry = new Map<string, Record<EnrollmentBucket, number>>();
  const byGroup = new Map<string, Record<EnrollmentBucket, number>>();

  for (const participant of participants) {
    const bucket = mapEnrollmentBucket(participant.tipo_iscrizione);
    if (!bucket) continue;

    counters[bucket] += 1;

    const country = (participant.paese_residenza ?? participant.nazione ?? "").trim() || "-";
    const currentCountry = byCountry.get(country) ?? createEmptyBucketCounts();
    currentCountry[bucket] += 1;
    byCountry.set(country, currentCountry);

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
    return {
      label,
      counts,
      total: ENROLLMENT_BUCKETS.reduce((acc, bucket) => acc + counts[bucket], 0),
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
  try {
    trendSeries = await buildTrendSeries(participants);
  } catch {
    trendSeries = null;
  }

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">{t("manager.statistics.title")}</h2>
        <p className="mt-2 text-sm text-slate-500">{t("manager.statistics.subtitle")}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="h-max rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t("manager.statistics.sections")}
          </p>
          <nav className="mt-3 flex flex-col gap-2 text-sm">
            <a href="#top-counters" className="rounded border border-slate-200 px-4 py-3 hover:bg-slate-50">
              {t("manager.statistics.counters")}
            </a>
            <a href="#registrations" className="rounded border border-slate-200 px-4 py-3 hover:bg-slate-50">
              {t("manager.statistics.registrations")}
            </a>
            <a href="#trend" className="rounded border border-slate-200 px-4 py-3 hover:bg-slate-50">
              {t("manager.statistics.trend")}
            </a>
            <a href="#daily-presence" className="rounded border border-slate-200 px-4 py-3 hover:bg-slate-50">
              {t("manager.statistics.dailyPresence")}
            </a>
          </nav>
        </aside>

        <div className="space-y-6">
          <section id="top-counters" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">{t("manager.statistics.topCounters")}</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <article className="rounded border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  {t("manager.statistics.totalRegistrations")}
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{totalWithoutDrivers}</p>
              </article>
              {ENROLLMENT_BUCKETS.map((bucket) => (
                <article key={bucket} className="rounded border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    {t(ENROLLMENT_BUCKET_LABEL_KEYS[bucket])}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{counters[bucket]}</p>
                </article>
              ))}
            </div>
          </section>

          <RegistrationsTabsSection
            buckets={ENROLLMENT_BUCKETS}
            countryRows={countryRows}
            groupRows={groupRows}
          />

          <DailyPresenceSection participants={participants} />

          <RegistrationTrendSection series={trendSeries} t={t} />
        </div>
      </div>
    </section>
  );
}
