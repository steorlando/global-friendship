import { ManagerAdminEmailSendLogListPage } from "../../../_components/manager-admin-email-send-log-list-page";

export default async function ManagerEmailSendLogPage() {
  return (
    <ManagerAdminEmailSendLogListPage basePath="/dashboard/manager/email-campaigns" />
  );
}
