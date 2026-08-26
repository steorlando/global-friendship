import { notFound, redirect } from "next/navigation";
import { AdminDiscussionMeetingsManager } from "@/app/dashboard/_components/admin-discussion-meetings-manager";
import { requireAdminUser } from "@/lib/admin/auth";

export default async function AdminDiscussionMeetingsPage() {
  const auth = await requireAdminUser();
  if ("errorResponse" in auth && auth.errorResponse) {
    if (auth.errorResponse.status === 401) redirect("/login");
    notFound();
  }

  return <AdminDiscussionMeetingsManager />;
}
