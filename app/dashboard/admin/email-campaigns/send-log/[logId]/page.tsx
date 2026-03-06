import { ManagerAdminEmailSendLogDetailPage } from "../../../../_components/manager-admin-email-send-log-detail-page";

type AdminEmailSendLogDetailPageProps = {
  params: Promise<{ logId: string }>;
};

export default async function AdminEmailSendLogDetailPage({
  params,
}: AdminEmailSendLogDetailPageProps) {
  const { logId } = await params;
  return (
    <ManagerAdminEmailSendLogDetailPage
      basePath="/dashboard/admin/email-campaigns"
      logId={logId}
    />
  );
}
