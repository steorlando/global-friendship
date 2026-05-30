import { StatisticsDashboard } from "../manager/page";

export default async function AdminDashboardPage() {
  return StatisticsDashboard({
    publicView: false,
    participantsPath: "/dashboard/admin/participants",
  });
}
