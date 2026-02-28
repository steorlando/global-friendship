import { redirect } from "next/navigation";

export default function AdminSettingsIndexPage() {
  redirect("/dashboard/admin/settings/email");
}
