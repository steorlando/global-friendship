export const STAY_DATE_AUDIT_FIELDS = [
  "stay_dates_changed_at",
  "stay_dates_changed_by",
  "stay_dates_changed_by_email",
  "stay_dates_changed_by_role",
  "previous_data_arrivo",
  "previous_data_partenza",
] as const;

type StayDateAuditArgs = {
  previousArrival: string | null;
  previousDeparture: string | null;
  nextArrival: string | null;
  nextDeparture: string | null;
  actorId: string | null;
  actorEmail: string | null;
  actorRole: string;
  changedAt?: string;
};

export function buildStayDateAuditFields(args: StayDateAuditArgs): Record<string, unknown> {
  if (
    args.previousArrival === args.nextArrival &&
    args.previousDeparture === args.nextDeparture
  ) {
    return {};
  }

  return {
    stay_dates_changed_at: args.changedAt ?? new Date().toISOString(),
    stay_dates_changed_by: args.actorId,
    stay_dates_changed_by_email: args.actorEmail,
    stay_dates_changed_by_role: args.actorRole,
    previous_data_arrivo: args.previousArrival,
    previous_data_partenza: args.previousDeparture,
  };
}

export function withoutStayDateAuditFields(
  payload: Record<string, unknown>
): Record<string, unknown> {
  const fallback = { ...payload };
  for (const field of STAY_DATE_AUDIT_FIELDS) {
    delete fallback[field];
  }
  return fallback;
}
