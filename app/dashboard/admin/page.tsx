import { StatisticsDashboard } from "../manager/page";
import { parseStatisticsSection } from "@/lib/statistics/dashboard-sections";

type AdminDashboardPageProps = {
  searchParams: Promise<{
    section?: string | string[];
  }>;
};

export default async function AdminDashboardPage({
  searchParams,
}: AdminDashboardPageProps) {
  const params = await searchParams;

  return StatisticsDashboard({
    publicView: false,
    sectionedView: true,
    activeSection: parseStatisticsSection(params.section),
    sectionBasePath: "/dashboard/admin",
  });
}
