"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";

type DeletedParticipant = {
  id: string;
  created_at: string | null;
  deleted_at: string | null;
  deleted_by_email: string | null;
  deleted_by_role: string | null;
  nome: string | null;
  cognome: string | null;
  email: string | null;
  citta: string | null;
  paese_residenza: string | null;
  tipo_iscrizione: string | null;
  alloggio: string | null;
  group: string;
};

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function DeletedParticipantsTable() {
  const { t } = useI18n();
  const [participants, setParticipants] = useState<DeletedParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadParticipants = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/deleted-participants", { cache: "no-store" });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? t("deletedParticipants.loadError"));
        return;
      }

      setParticipants(Array.isArray(json.participants) ? json.participants : []);
    } catch {
      setError(t("deletedParticipants.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadParticipants();
  }, [loadParticipants]);

  const countLabel = useMemo(
    () =>
      t("deletedParticipants.count").replace(
        "{count}",
        String(participants.length)
      ),
    [participants.length, t]
  );

  async function restoreParticipant(participant: DeletedParticipant) {
    const confirmed = window.confirm(t("deletedParticipants.restoreConfirm"));
    if (!confirmed) return;

    setRestoringId(participant.id);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/admin/deleted-participants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: participant.id }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? t("deletedParticipants.restoreError"));
        return;
      }

      setParticipants((prev) => prev.filter((row) => row.id !== participant.id));
      setSuccess(t("deletedParticipants.restoreSuccess"));
    } catch {
      setError(t("deletedParticipants.restoreError"));
    } finally {
      setRestoringId(null);
    }
  }

  if (loading) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
        {t("common.loadingParticipants")}
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">
          {t("deletedParticipants.title")}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{countLabel}</p>
      </header>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">{t("participants.table.header.firstName")}</th>
              <th className="px-4 py-3">{t("participants.table.header.lastName")}</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">{t("participants.table.header.group")}</th>
              <th className="px-4 py-3">{t("participants.table.header.registrationType")}</th>
              <th className="px-4 py-3">{t("deletedParticipants.deletedAt")}</th>
              <th className="px-4 py-3">{t("deletedParticipants.deletedBy")}</th>
              <th className="px-4 py-3">{t("participants.table.header.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {participants.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-slate-500" colSpan={8}>
                  {t("deletedParticipants.empty")}
                </td>
              </tr>
            ) : (
              participants.map((participant) => (
                <tr key={participant.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {participant.nome ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{participant.cognome ?? "-"}</td>
                  <td className="px-4 py-3 text-slate-700">{participant.email ?? "-"}</td>
                  <td className="px-4 py-3 text-slate-700">{participant.group}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {participant.tipo_iscrizione ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {formatDateTime(participant.deleted_at)}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {participant.deleted_by_email ?? participant.deleted_by_role ?? "-"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => restoreParticipant(participant)}
                      disabled={restoringId === participant.id}
                      className="rounded-md border border-emerald-600 px-3 py-1.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {restoringId === participant.id
                        ? t("deletedParticipants.restoring")
                        : t("deletedParticipants.restore")}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
