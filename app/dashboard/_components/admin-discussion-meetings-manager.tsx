"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  DiscussionGroupAssignmentStatus,
  DiscussionGroupSummary,
  DiscussionMeetingAllocationScope,
  DiscussionMeetingDashboard,
} from "@/lib/admin/discussion-meetings";
import { DISCUSSION_MEETING_COUNT } from "@/lib/admin/discussion-meetings";
import { useI18n } from "@/lib/i18n/provider";

type DashboardResponse = DiscussionMeetingDashboard & {
  persistence: "database" | "local-preview";
};

type GroupFilter = "all" | "needs-assignment" | "assigned";

function selectMeetingNumber(value: string): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= DISCUSSION_MEETING_COUNT
    ? parsed
    : null;
}

function statusClass(status: DiscussionGroupAssignmentStatus): string {
  if (status === "assigned") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (status === "partial") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  if (status === "unassigned") {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }
  return "border-slate-200 bg-slate-50 text-slate-600";
}

export function AdminDiscussionMeetingsManager() {
  const { t, formatNumber } = useI18n();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingGroupId, setSavingGroupId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<GroupFilter>("all");

  async function loadDashboard() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/discussion-meetings", {
        cache: "no-store",
      });
      const json = (await response.json()) as DashboardResponse & { error?: string };
      if (!response.ok) {
        throw new Error(json.error || t("discussionMeetings.error.load"));
      }
      setDashboard(json);
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
    // The translator is stable for the lifetime of the provider.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveAssignment(
    group: DiscussionGroupSummary,
    higherMeetingNumber: number | null,
    universityWorkerMeetingNumber: number | null,
  ) {
    setSavingGroupId(group.id);
    setError(null);
    try {
      const response = await fetch("/api/admin/discussion-meetings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: group.id,
          higherMeetingNumber,
          universityWorkerMeetingNumber,
        }),
      });
      const json = (await response.json()) as DashboardResponse & { error?: string };
      if (!response.ok) {
        throw new Error(json.error || t("discussionMeetings.error.save"));
      }
      setDashboard(json);
    } catch (saveError) {
      setError((saveError as Error).message);
    } finally {
      setSavingGroupId(null);
    }
  }

  const visibleGroups = useMemo(() => {
    if (!dashboard) return [];
    const normalizedSearch = search.trim().toLocaleLowerCase("it");
    return dashboard.groups.filter((group) => {
      if (
        normalizedSearch &&
        !group.name.toLocaleLowerCase("it").includes(normalizedSearch)
      ) {
        return false;
      }
      if (groupFilter === "needs-assignment") {
        return group.unassignedParticipants > 0;
      }
      if (groupFilter === "assigned") return group.assignmentStatus === "assigned";
      return true;
    });
  }, [dashboard, groupFilter, search]);

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm text-slate-600">{t("discussionMeetings.loading")}</p>
      </section>
    );
  }

  if (!dashboard) {
    return (
      <section className="rounded-xl border border-red-200 bg-red-50 p-6">
        <h1 className="text-xl font-bold text-red-900">
          {t("discussionMeetings.title")}
        </h1>
        <p className="mt-2 text-sm text-red-700">
          {error || t("discussionMeetings.error.load")}
        </p>
        <button
          type="button"
          onClick={() => void loadDashboard()}
          className="mt-4 rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white"
        >
          {t("discussionMeetings.retry")}
        </button>
      </section>
    );
  }

  const filledMeetingCount = dashboard.meetings.filter(
    (meeting) => meeting.participantCount > 0,
  ).length;

  return (
    <section className="space-y-6">
      <header className="rounded-2xl bg-gradient-to-br from-indigo-950 via-indigo-900 to-blue-800 p-6 text-white shadow-lg">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-200">
              {t("discussionMeetings.adminOnly")}
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              {t("discussionMeetings.title")}
            </h1>
            <p className="mt-2 text-sm leading-6 text-indigo-100">
              {t("discussionMeetings.subtitle")}
            </p>
          </div>
          <a
            href={
              filledMeetingCount > 0
                ? "/api/admin/discussion-meetings/report"
                : undefined
            }
            aria-disabled={filledMeetingCount === 0}
            onClick={(event) => {
              if (filledMeetingCount === 0) event.preventDefault();
            }}
            className={`inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold shadow-sm transition ${
              filledMeetingCount > 0
                ? "bg-white text-indigo-900 hover:bg-indigo-50"
                : "cursor-not-allowed bg-white/40 text-white/70"
            }`}
          >
            {t("discussionMeetings.downloadWord")}
          </a>
        </div>
      </header>

      {dashboard.persistence === "local-preview" ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-semibold">{t("discussionMeetings.localPreview.title")}</p>
          <p className="mt-1 leading-5">{t("discussionMeetings.localPreview.body")}</p>
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800"
        >
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label={t("discussionMeetings.summary.groups")}
          value={formatNumber(dashboard.totals.groupCount)}
          detail={t("discussionMeetings.summary.groupsDetail")}
        />
        <SummaryCard
          label={t("discussionMeetings.summary.people")}
          value={formatNumber(dashboard.totals.participants)}
          detail={t("discussionMeetings.summary.peopleDetail")}
        />
        <SummaryCard
          label={t("discussionMeetings.summary.assigned")}
          value={formatNumber(dashboard.totals.assignedParticipants)}
          detail={t("discussionMeetings.summary.assignedDetail", {
            groups: dashboard.totals.fullyAssignedGroups,
          })}
          tone="emerald"
        />
        <SummaryCard
          label={t("discussionMeetings.summary.unassigned")}
          value={formatNumber(dashboard.totals.unassignedParticipants)}
          detail={t("discussionMeetings.summary.unassignedDetail", {
            groups:
              dashboard.totals.unassignedGroups +
              dashboard.totals.partiallyAssignedGroups,
          })}
          tone="rose"
        />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-6 xl:max-h-[calc(100vh-3rem)]">
          <div className="border-b border-slate-200 bg-slate-50 p-5">
            <h2 className="text-xl font-bold text-slate-950">
              {t("discussionMeetings.groups.title")}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {t("discussionMeetings.groups.subtitle")}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
              <label className="sr-only" htmlFor="discussion-group-search">
                {t("discussionMeetings.groups.search")}
              </label>
              <input
                id="discussion-group-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("discussionMeetings.groups.search")}
                className="min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-indigo-500 focus:ring-2"
              />
              <label className="sr-only" htmlFor="discussion-group-filter">
                {t("discussionMeetings.groups.filter")}
              </label>
              <select
                id="discussion-group-filter"
                value={groupFilter}
                onChange={(event) => setGroupFilter(event.target.value as GroupFilter)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              >
                <option value="all">{t("discussionMeetings.groups.filterAll")}</option>
                <option value="needs-assignment">
                  {t("discussionMeetings.groups.filterNeedsAssignment")}
                </option>
                <option value="assigned">
                  {t("discussionMeetings.groups.filterAssigned")}
                </option>
              </select>
            </div>
          </div>

          <div className="space-y-4 overflow-y-auto p-4 xl:max-h-[calc(100vh-14rem)]">
            {visibleGroups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                saving={savingGroupId === group.id}
                onSave={(higher, universityWorker) =>
                  void saveAssignment(group, higher, universityWorker)
                }
              />
            ))}
            {visibleGroups.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                {t("discussionMeetings.groups.noResults")}
              </p>
            ) : null}
          </div>
        </section>

        <section className="space-y-5">
          <div>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-xl font-bold text-slate-950">
                  {t("discussionMeetings.meetings.title")}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {t("discussionMeetings.meetings.subtitle")}
                </p>
              </div>
              <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-800">
                {t("discussionMeetings.meetings.filled", {
                  filled: filledMeetingCount,
                  total: DISCUSSION_MEETING_COUNT,
                })}
              </span>
            </div>

            <div className="space-y-3">
              {dashboard.meetings.map((meeting) => (
                <article
                  key={meeting.number}
                  className={`overflow-hidden rounded-xl border bg-white shadow-sm ${
                    meeting.participantCount > 0
                      ? "border-indigo-200"
                      : "border-slate-200"
                  }`}
                >
                  <div
                    className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${
                      meeting.participantCount > 0 ? "bg-indigo-50" : "bg-slate-50"
                    }`}
                  >
                    <h3 className="font-bold text-slate-950">
                      {t("discussionMeetings.meeting", { number: meeting.number })}
                    </h3>
                    <div className="flex gap-2 text-xs font-semibold">
                      <span className="rounded-full bg-white px-2.5 py-1 text-slate-700 shadow-sm">
                        {t("discussionMeetings.meetingGroups", {
                          count: meeting.groupCount,
                        })}
                      </span>
                      <span className="rounded-full bg-indigo-700 px-2.5 py-1 text-white">
                        {t("discussionMeetings.meetingPeople", {
                          count: meeting.participantCount,
                        })}
                      </span>
                    </div>
                  </div>
                  {meeting.allocations.length > 0 ? (
                    <ul className="divide-y divide-slate-100">
                      {meeting.allocations.map((allocation) => (
                        <li
                          key={`${allocation.groupId}-${allocation.scope}`}
                          className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {allocation.groupName}
                            </p>
                            <p className="text-xs text-slate-500">
                              {scopeLabel(allocation.scope, t)}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-1.5 text-xs">
                            <CountPill
                              label={t("discussionMeetings.short.higher")}
                              value={allocation.higherStudents}
                            />
                            <CountPill
                              label={t("discussionMeetings.short.universityWorker")}
                              value={allocation.universityWorkers}
                            />
                            <CountPill
                              label={t("discussionMeetings.short.operators")}
                              value={allocation.operators}
                            />
                            <CountPill
                              label={t("discussionMeetings.short.total")}
                              value={allocation.total}
                              strong
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="px-4 py-4 text-sm text-slate-500">
                      {t("discussionMeetings.meetingEmpty")}
                    </p>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  tone = "slate",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "slate" | "emerald" | "rose";
}) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50"
      : tone === "rose"
        ? "border-rose-200 bg-rose-50"
        : "border-slate-200 bg-white";
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</p>
      <p className="mt-1 text-3xl font-bold text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-600">{detail}</p>
    </div>
  );
}

function GroupCard({
  group,
  saving,
  onSave,
}: {
  group: DiscussionGroupSummary;
  saving: boolean;
  onSave: (higher: number | null, universityWorker: number | null) => void;
}) {
  const { t, formatNumber } = useI18n();
  const assignment = group.assignment;
  const wholeMeeting =
    assignment.higherMeetingNumber !== null &&
    assignment.higherMeetingNumber === assignment.universityWorkerMeetingNumber
      ? assignment.higherMeetingNumber
      : null;
  const higherComponentTotal =
    group.higherStudents + group.operatorDistribution.higher;
  const universityComponentTotal =
    group.universityWorkers + group.operatorDistribution.universityWorker;
  const canSplit = higherComponentTotal > 0 && universityComponentTotal > 0;
  const cardClass =
    group.assignmentStatus === "assigned"
      ? "border-emerald-300 bg-emerald-50/80"
      : group.assignmentStatus === "partial"
        ? "border-amber-300 bg-amber-50/80"
        : "border-rose-300 bg-rose-50/80";

  return (
    <article
      className={`rounded-xl border p-4 shadow-sm transition-colors ${cardClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-bold text-slate-950">{group.name}</h3>
          <p className="mt-1 text-xs text-slate-500">
            {t("discussionMeetings.group.unassignedPeople", {
              count: group.unassignedParticipants,
            })}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClass(
            group.assignmentStatus,
          )}`}
        >
          {t(`discussionMeetings.status.${group.assignmentStatus}`)}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-4 gap-1 rounded-lg bg-white/75 p-2 text-center">
        <GroupCount
          label={t("discussionMeetings.short.higher")}
          value={formatNumber(group.higherStudents)}
        />
        <GroupCount
          label={t("discussionMeetings.short.universityWorker")}
          value={formatNumber(group.universityWorkers)}
        />
        <GroupCount
          label={t("discussionMeetings.short.operators")}
          value={formatNumber(group.operators)}
        />
        <GroupCount
          label={t("discussionMeetings.short.total")}
          value={formatNumber(group.total)}
          strong
        />
      </dl>

      {group.total > 0 ? (
        <div className="mt-4 space-y-3">
          <label className="block text-xs font-semibold text-slate-700">
            {t("discussionMeetings.group.whole")}
            <select
              value={wholeMeeting ?? ""}
              disabled={saving}
              onChange={(event) => {
                const meeting = selectMeetingNumber(event.target.value);
                if (meeting) onSave(meeting, meeting);
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:opacity-60"
            >
              <option value="">{t("discussionMeetings.group.chooseMeeting")}</option>
              {Array.from({ length: DISCUSSION_MEETING_COUNT }, (_, index) => (
                <option key={index + 1} value={index + 1}>
                  {t("discussionMeetings.meeting", { number: index + 1 })}
                </option>
              ))}
            </select>
          </label>

          {canSplit ? (
            <fieldset className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-3">
              <legend className="px-1 text-xs font-semibold text-indigo-950">
                {t("discussionMeetings.group.split")}
              </legend>
              <p className="mb-2 text-[11px] leading-4 text-indigo-800">
                {t("discussionMeetings.group.splitHelp")}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <SegmentSelect
                  label={t("discussionMeetings.group.higher")}
                  value={assignment.higherMeetingNumber}
                  disabled={saving}
                  onChange={(meeting) =>
                    onSave(meeting, assignment.universityWorkerMeetingNumber)
                  }
                />
                <SegmentSelect
                  label={t("discussionMeetings.group.universityWorker")}
                  value={assignment.universityWorkerMeetingNumber}
                  disabled={saving}
                  onChange={(meeting) =>
                    onSave(assignment.higherMeetingNumber, meeting)
                  }
                />
              </div>
              {group.operators > 0 ? (
                <p className="mt-2 text-[11px] text-indigo-800">
                  {t("discussionMeetings.group.operatorSplit", {
                    higher: group.operatorDistribution.higher,
                    universityWorker: group.operatorDistribution.universityWorker,
                  })}
                </p>
              ) : null}
            </fieldset>
          ) : (
            <p className="text-xs text-slate-500">
              {t("discussionMeetings.group.noSplit")}
            </p>
          )}

          {assignment.higherMeetingNumber !== null ||
          assignment.universityWorkerMeetingNumber !== null ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => onSave(null, null)}
              className="text-xs font-semibold text-rose-700 underline-offset-2 hover:underline disabled:opacity-60"
            >
              {saving
                ? t("discussionMeetings.group.saving")
                : t("discussionMeetings.group.clear")}
            </button>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-500">
          {t("discussionMeetings.group.empty")}
        </p>
      )}
    </article>
  );
}

function SegmentSelect({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: number | null;
  disabled: boolean;
  onChange: (meeting: number | null) => void;
}) {
  const { t } = useI18n();
  return (
    <label className="block text-[11px] font-semibold text-indigo-950">
      {label}
      <select
        value={value ?? ""}
        disabled={disabled}
        onChange={(event) => onChange(selectMeetingNumber(event.target.value))}
        className="mt-1 w-full rounded-md border border-indigo-200 bg-white px-2 py-2 text-xs text-slate-900 disabled:opacity-60"
      >
        <option value="">{t("discussionMeetings.group.notAssigned")}</option>
        {Array.from({ length: DISCUSSION_MEETING_COUNT }, (_, index) => (
          <option key={index + 1} value={index + 1}>
            {t("discussionMeetings.meeting", { number: index + 1 })}
          </option>
        ))}
      </select>
    </label>
  );
}

function GroupCount({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div>
      <dt className="truncate text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className={`mt-0.5 text-sm ${strong ? "font-bold text-indigo-800" : "font-semibold text-slate-800"}`}>
        {value}
      </dd>
    </div>
  );
}

function CountPill({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <span
      className={`rounded-full px-2 py-1 ${
        strong ? "bg-indigo-100 font-bold text-indigo-900" : "bg-slate-100 text-slate-700"
      }`}
    >
      {label} {value}
    </span>
  );
}

function scopeLabel(
  scope: DiscussionMeetingAllocationScope,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  return t(`discussionMeetings.scope.${scope}`);
}
