import { ManagerAdminEmailSendLogDetailPage } from "../../../../_components/manager-admin-email-send-log-detail-page";

type ManagerEmailSendLogDetailPageProps = {
  params: Promise<{ logId: string }>;
};

export default async function ManagerEmailSendLogDetailPage({
  params,
}: ManagerEmailSendLogDetailPageProps) {
  const { logId } = await params;
  return (
    <ManagerAdminEmailSendLogDetailPage
      basePath="/dashboard/manager/email-campaigns"
      logId={logId}
    />
  );
}
