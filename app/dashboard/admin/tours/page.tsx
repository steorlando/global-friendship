import { TourManagementDashboard } from "@/app/dashboard/_components/tour-management-dashboard";

export default function AdminToursPage() {
  return <TourManagementDashboard participantsHref="/dashboard/admin/tours/participants" />;
}
