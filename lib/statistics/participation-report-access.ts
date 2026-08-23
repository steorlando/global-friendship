export type ParticipationReportAccessProfile = {
  ruolo: string | null;
};

export function canGenerateParticipationReport(
  profiles: ParticipationReportAccessProfile[],
): boolean {
  return profiles.some((profile) => profile.ruolo === "admin");
}
