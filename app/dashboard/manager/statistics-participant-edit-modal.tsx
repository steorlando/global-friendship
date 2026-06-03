"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ParticipantsTable } from "../_components/participants-table";
import { useI18n } from "@/lib/i18n/provider";

export function StatisticsParticipantEditModal() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const editParticipantId = searchParams.get("editParticipant");

  if (!editParticipantId) return null;

  function closeModal() {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("editParticipant");
    const query = nextParams.toString();
    const hash = window.location.hash;
    router.replace(`${pathname}${query ? `?${query}` : ""}${hash}`, {
      scroll: false,
    });
  }

  return (
    <ParticipantsTable
      apiBasePath="/api/manager/participants"
      groupSummaryLabel={t("participants.table.header.group")}
      showRegistrationDate
      showTotalFee={false}
      canEditGroupAssignment
      initialEditParticipantId={editParticipantId}
      modalOnly
      onCloseEditModal={closeModal}
    />
  );
}
