export function hasOutstandingParticipationFee(participant: {
  quota_totale: number | null;
  fee_paid: number | null;
}): boolean {
  if (participant.quota_totale == null || participant.quota_totale <= 0) {
    return false;
  }

  return (participant.fee_paid ?? 0) < participant.quota_totale;
}
