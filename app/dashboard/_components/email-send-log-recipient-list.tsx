"use client";

import { useMemo, useState } from "react";
import { buildRecipientIdsClipboardText } from "@/lib/email/recipient-id-utils";

type EmailSendLogRecipientListProps = {
  recipientIds: string[];
};

export function EmailSendLogRecipientList({ recipientIds }: EmailSendLogRecipientListProps) {
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const clipboardPayload = useMemo(
    () => buildRecipientIdsClipboardText(recipientIds),
    [recipientIds]
  );

  async function copyRecipientIds() {
    setCopyFeedback(null);
    setCopyError(null);

    if (!clipboardPayload) {
      setCopyError("No recipient IDs to copy.");
      return;
    }

    try {
      await navigator.clipboard.writeText(clipboardPayload);
      setCopyFeedback("Recipient IDs copied.");
    } catch {
      setCopyError("Unable to copy recipient IDs.");
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Recipient user IDs
          </h3>
          <p className="mt-2 text-sm text-slate-700">
            Total recipients: <span className="font-semibold">{recipientIds.length}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={copyRecipientIds}
          disabled={!clipboardPayload}
          className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Copy recipient IDs
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Copied format is plain-text, one ID per line, ready to paste in exclusion filters.
      </p>
      {copyFeedback ? (
        <p className="mt-2 text-sm text-emerald-700">{copyFeedback}</p>
      ) : null}
      {copyError ? <p className="mt-2 text-sm text-red-700">{copyError}</p> : null}

      {recipientIds.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No recipients logged.</p>
      ) : (
        <ul className="mt-3 max-h-80 divide-y divide-slate-200 overflow-auto rounded border border-slate-200">
          {recipientIds.map((recipientId) => (
            <li key={recipientId} className="px-3 py-2 font-mono text-sm text-slate-700">
              {recipientId}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
