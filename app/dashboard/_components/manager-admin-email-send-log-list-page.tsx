import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

type EmailSendLogListRow = {
  id: string;
  sent_at: string;
  subject: string;
  recipient_count: number;
};

type ManagerAdminEmailSendLogListPageProps = {
  basePath: "/dashboard/manager/email-campaigns" | "/dashboard/admin/email-campaigns";
};

function formatSentAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export async function ManagerAdminEmailSendLogListPage({
  basePath,
}: ManagerAdminEmailSendLogListPageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <section className="rounded border border-red-200 bg-red-50 p-6">
        <h2 className="text-xl font-bold text-red-800">Email send log</h2>
        <p className="mt-2 text-sm text-red-700">Unauthorized</p>
      </section>
    );
  }

  const email = (user.email ?? "").trim().toLowerCase();
  const service = createSupabaseServiceClient();
  const { data: profile, error: profileError } = await service
    .from("profili")
    .select("ruolo")
    .ilike("email", email)
    .in("ruolo", ["manager", "admin"]);

  if (profileError || !profile || profile.length === 0) {
    return (
      <section className="rounded border border-red-200 bg-red-50 p-6">
        <h2 className="text-xl font-bold text-red-800">Email send log</h2>
        <p className="mt-2 text-sm text-red-700">Forbidden</p>
      </section>
    );
  }

  const { data, error } = await service
    .from("email_send_logs")
    .select("id,sent_at,subject,recipient_count")
    .order("sent_at", { ascending: false });

  if (error) {
    return (
      <section className="rounded border border-red-200 bg-red-50 p-6">
        <h2 className="text-xl font-bold text-red-800">Email send log</h2>
        <p className="mt-2 text-sm text-red-700">{error.message}</p>
      </section>
    );
  }

  const rows = (data ?? []) as EmailSendLogListRow[];
  const detailBasePath = `${basePath}/send-log`;

  return (
    <section className="space-y-6">
      <header className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Email send log</h2>
            <p className="mt-2 text-sm text-slate-500">
              Browse the latest sends and open each item for full recipient details.
            </p>
          </div>
          <Link
            href={basePath}
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Back to campaigns
          </Link>
        </div>
      </header>

      {rows.length === 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          No sends logged yet.
        </section>
      ) : (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-[minmax(0,220px)_minmax(0,1fr)_120px] gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
            <span>Sent at</span>
            <span>Subject</span>
            <span>Recipients</span>
          </div>
          <ul className="divide-y divide-slate-200">
            {rows.map((row) => (
              <li key={row.id}>
                <Link
                  href={`${detailBasePath}/${row.id}`}
                  className="grid grid-cols-[minmax(0,220px)_minmax(0,1fr)_120px] gap-4 px-4 py-3 text-sm text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                >
                  <span>{formatSentAt(row.sent_at)}</span>
                  <span className="truncate" title={row.subject}>
                    {row.subject}
                  </span>
                  <span>{row.recipient_count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
