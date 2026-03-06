import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

type EmailSendLogRow = {
  id: string;
  sent_at: string;
  subject: string;
  body_content: string;
  recipient_count: number;
};

type EmailSendLogRecipientRow = {
  recipient_id: string;
};

type ManagerAdminEmailSendLogDetailPageProps = {
  basePath: "/dashboard/manager/email-campaigns" | "/dashboard/admin/email-campaigns";
  logId: string;
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
    second: "2-digit",
  }).format(date);
}

function htmlToReadableText(value: string): string {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<li>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function ManagerAdminEmailSendLogDetailPage({
  basePath,
  logId,
}: ManagerAdminEmailSendLogDetailPageProps) {
  const trimmedLogId = logId.trim();
  if (!trimmedLogId) notFound();

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

  const { data: log, error: logError } = await service
    .from("email_send_logs")
    .select("id,sent_at,subject,body_content,recipient_count")
    .eq("id", trimmedLogId)
    .maybeSingle();

  if (logError) {
    return (
      <section className="rounded border border-red-200 bg-red-50 p-6">
        <h2 className="text-xl font-bold text-red-800">Email send log</h2>
        <p className="mt-2 text-sm text-red-700">{logError.message}</p>
      </section>
    );
  }

  if (!log) {
    notFound();
  }

  const { data: recipients, error: recipientsError } = await service
    .from("email_send_log_recipients")
    .select("recipient_id")
    .eq("send_log_id", trimmedLogId)
    .order("recipient_id", { ascending: true });

  if (recipientsError) {
    return (
      <section className="rounded border border-red-200 bg-red-50 p-6">
        <h2 className="text-xl font-bold text-red-800">Email send log</h2>
        <p className="mt-2 text-sm text-red-700">{recipientsError.message}</p>
      </section>
    );
  }

  const logRow = log as EmailSendLogRow;
  const recipientRows = (recipients ?? []) as EmailSendLogRecipientRow[];
  const readableBody = htmlToReadableText(logRow.body_content);

  return (
    <section className="space-y-6">
      <header className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Email send detail</h2>
            <p className="mt-2 text-sm text-slate-500">
              Sent on {formatSentAt(logRow.sent_at)} to {logRow.recipient_count} recipient(s).
            </p>
          </div>
          <Link
            href={`${basePath}/send-log`}
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Back to send log
          </Link>
        </div>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Subject</h3>
        <p className="mt-2 text-base text-slate-900">{logRow.subject}</p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Body content
        </h3>
        <pre className="mt-3 whitespace-pre-wrap text-sm text-slate-800">{readableBody}</pre>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Recipient user IDs
        </h3>
        <p className="mt-2 text-sm text-slate-700">
          Total recipients: <span className="font-semibold">{recipientRows.length}</span>
        </p>
        {recipientRows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No recipients logged.</p>
        ) : (
          <ul className="mt-3 max-h-80 divide-y divide-slate-200 overflow-auto rounded border border-slate-200">
            {recipientRows.map((row) => (
              <li key={row.recipient_id} className="px-3 py-2 font-mono text-sm text-slate-700">
                {row.recipient_id}
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
