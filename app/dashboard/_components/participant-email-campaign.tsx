"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  PARTICIPANT_TEMPLATE_FIELDS,
  renderParticipantTemplateHtml,
  renderParticipantTemplateText,
  type ParticipantTemplateData,
} from "@/lib/email/participant-template";

type Participant = ParticipantTemplateData;

type SortKey =
  | "group"
  | "nome"
  | "cognome"
  | "email"
  | "data_arrivo"
  | "data_partenza"
  | "alloggio"
  | "quota_totale";

type SortDirection = "asc" | "desc";

type LoadResponse = {
  participants: Participant[];
  groups: string[];
  showGroupColumn: boolean;
};

function safeLower(value: string | null): string {
  return (value ?? "").toLowerCase();
}

function safeIncludes(value: string | null, search: string): boolean {
  return safeLower(value).includes(search.toLowerCase());
}

export function ParticipantEmailCampaign() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [showGroupColumn, setShowGroupColumn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [subject, setSubject] = useState("Global Friendship update");
  const [bodyHtml, setBodyHtml] = useState(
    "<p>Hello {{nome}},</p><p>We are writing regarding your Global Friendship registration.</p><p>Best regards,<br />Global Friendship team</p>"
  );
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
      }),
    ],
    content: bodyHtml,
    editorProps: {
      attributes: {
        class:
          "min-h-52 rounded border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300",
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      setBodyHtml(currentEditor.getHTML());
    },
    immediatelyRender: false,
  });

  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [arrivoFilter, setArrivoFilter] = useState("");
  const [partenzaFilter, setPartenzaFilter] = useState("");
  const [alloggioFilter, setAlloggioFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("cognome");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch("/api/manager/participants");
        const json = (await res.json()) as LoadResponse & { error?: string };
        if (!res.ok) {
          setLoadError(json.error ?? "Unable to load participants.");
          return;
        }
        setParticipants(Array.isArray(json.participants) ? json.participants : []);
        setGroups(Array.isArray(json.groups) ? json.groups : []);
        setShowGroupColumn(Boolean(json.showGroupColumn));
      } catch {
        setLoadError("Unable to load participants.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredSortedParticipants = useMemo(() => {
    const filtered = participants.filter((participant) => {
      if (search) {
        const s = search.toLowerCase();
        const matches =
          safeIncludes(participant.nome, s) ||
          safeIncludes(participant.cognome, s) ||
          safeIncludes(participant.email, s) ||
          safeIncludes(participant.group, s);
        if (!matches) return false;
      }

      if (showGroupColumn && groupFilter) {
        if (!safeIncludes(participant.group, groupFilter)) return false;
      }
      if (arrivoFilter && (participant.data_arrivo ?? "") !== arrivoFilter) return false;
      if (partenzaFilter && (participant.data_partenza ?? "") !== partenzaFilter) return false;
      if (alloggioFilter && (participant.alloggio ?? "") !== alloggioFilter) return false;

      return true;
    });

    filtered.sort((a, b) => {
      const direction = sortDirection === "asc" ? 1 : -1;
      const aValue =
        sortKey === "quota_totale"
          ? a.quota_totale ?? -Infinity
          : ((a[sortKey] as string | null) ?? "").toLowerCase();
      const bValue =
        sortKey === "quota_totale"
          ? b.quota_totale ?? -Infinity
          : ((b[sortKey] as string | null) ?? "").toLowerCase();

      if (aValue < bValue) return -1 * direction;
      if (aValue > bValue) return 1 * direction;
      return 0;
    });

    return filtered;
  }, [
    alloggioFilter,
    arrivoFilter,
    groupFilter,
    participants,
    partenzaFilter,
    search,
    showGroupColumn,
    sortDirection,
    sortKey,
  ]);

  const visibleIds = useMemo(
    () => filteredSortedParticipants.map((participant) => participant.id),
    [filteredSortedParticipants]
  );

  const selectedParticipants = useMemo(
    () => participants.filter((participant) => selectedIds.has(participant.id)),
    [participants, selectedIds]
  );
  const selectedParticipantsWithEmail = useMemo(
    () =>
      selectedParticipants.filter(
        (participant) => typeof participant.email === "string" && participant.email.trim()
      ),
    [selectedParticipants]
  );

  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

  const previewParticipant = selectedParticipantsWithEmail[0] ?? selectedParticipants[0] ?? null;
  const previewHtml = previewParticipant
    ? renderParticipantTemplateHtml(bodyHtml, previewParticipant)
    : "";
  const previewSubject = previewParticipant
    ? renderParticipantTemplateText(subject, previewParticipant)
    : subject;

  function applyFormat(command: "bold" | "italic" | "underline") {
    if (!editor) return;
    const chain = editor.chain().focus();
    if (command === "bold") chain.toggleBold().run();
    if (command === "italic") chain.toggleItalic().run();
    if (command === "underline") chain.toggleUnderline().run();
  }

  function addLink() {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const value = window.prompt("Insert URL", "https://");
    if (value === null) return;
    const url = value.trim();

    if (!url) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    if (url === previousUrl) return;
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  function insertToken(token: string) {
    if (!editor) return;
    editor.chain().focus().insertContent(token).run();
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((value) => (value === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  }

  function toggleParticipant(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleVisibleSelection() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function openPreview() {
    setSendError(null);
    setSendResult(null);
    if (selectedIds.size === 0) {
      setSendError("Select at least one recipient.");
      return;
    }
    if (selectedParticipantsWithEmail.length === 0) {
      setSendError("No selected participants have a valid email address.");
      return;
    }
    if (!subject.trim()) {
      setSendError("Subject is required.");
      return;
    }
    const bodyText = bodyHtml.replace(/<[^>]+>/g, "").trim();
    if (!bodyText) {
      setSendError("Write the email body before continuing.");
      return;
    }
    setShowPreview(true);
  }

  async function sendCampaign() {
    setSending(true);
    setSendError(null);
    setSendResult(null);
    try {
      const res = await fetch("/api/manager/email-campaign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          participantIds: [...selectedIds],
          subject,
          html: bodyHtml,
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        sent?: number;
        failed?: Array<{ id: string; reason: string }>;
        skipped?: Array<{ id: string; reason: string }>;
      };
      if (!res.ok) {
        setSendError(json.error ?? "Unable to send email campaign.");
        return;
      }

      const sent = json.sent ?? 0;
      const failed = json.failed?.length ?? 0;
      const skipped = json.skipped?.length ?? 0;

      setSendResult(`Sent ${sent} email(s). Failed: ${failed}. Skipped: ${skipped}.`);
      setShowPreview(false);
    } catch {
      setSendError("Unable to send email campaign.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="space-y-6">
      <header className="rounded border border-neutral-200 bg-white p-4">
        <h2 className="text-xl font-semibold text-neutral-900">Email Campaigns</h2>
        <p className="mt-2 text-sm text-neutral-600">
          Compose a personalized email and send it to selected participants. Use fields
          like <code>{"{{nome}}"}</code> to personalize content.
        </p>
      </header>

      {sendError && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {sendError}
        </div>
      )}
      {sendResult && (
        <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {sendResult}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <section className="rounded border border-neutral-200 bg-white p-4">
          <label className="block text-sm font-medium text-neutral-700">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm"
            placeholder="Email subject"
          />

          <div className="mt-4">
            <p className="text-sm font-medium text-neutral-700">Message</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => applyFormat("bold")}
                className={`rounded border px-2 py-1 text-xs font-semibold ${
                  editor?.isActive("bold")
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-300 hover:bg-neutral-100"
                }`}
              >
                Bold
              </button>
              <button
                type="button"
                onClick={() => applyFormat("italic")}
                className={`rounded border px-2 py-1 text-xs font-semibold ${
                  editor?.isActive("italic")
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-300 hover:bg-neutral-100"
                }`}
              >
                Italic
              </button>
              <button
                type="button"
                onClick={() => applyFormat("underline")}
                className={`rounded border px-2 py-1 text-xs font-semibold ${
                  editor?.isActive("underline")
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-300 hover:bg-neutral-100"
                }`}
              >
                Underline
              </button>
              <button
                type="button"
                onClick={addLink}
                className={`rounded border px-2 py-1 text-xs font-semibold ${
                  editor?.isActive("link")
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-300 hover:bg-neutral-100"
                }`}
              >
                Link
              </button>
            </div>
            <EditorContent editor={editor} className="mt-2" />
          </div>
        </section>

        <aside className="h-max rounded border border-neutral-200 bg-white p-4 xl:sticky xl:top-24">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">
            Personalization Fields
          </h3>
          <p className="mt-2 text-xs text-neutral-500">
            Click a field to insert it at cursor position.
          </p>
          <div className="mt-3 space-y-2">
            {PARTICIPANT_TEMPLATE_FIELDS.map((field) => (
              <button
                key={field.key}
                type="button"
                onClick={() => insertToken(field.token)}
                className="flex w-full items-center justify-between rounded border border-neutral-200 px-3 py-2 text-left hover:bg-neutral-50"
              >
                <span className="text-sm text-neutral-800">{field.label}</span>
                <code className="text-xs text-neutral-500">{field.token}</code>
              </button>
            ))}
          </div>
        </aside>
      </div>

      <section className="rounded border border-neutral-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Search
            </label>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, surname, email, group"
              className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          {showGroupColumn && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Group
              </label>
              <input
                type="text"
                value={groupFilter}
                onChange={(event) => setGroupFilter(event.target.value)}
                list="group-options"
                className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm"
              />
              <datalist id="group-options">
                {groups.map((group) => (
                  <option key={group} value={group} />
                ))}
              </datalist>
            </div>
          )}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Arrival
            </label>
            <input
              type="date"
              value={arrivoFilter}
              onChange={(event) => setArrivoFilter(event.target.value)}
              className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Departure
            </label>
            <input
              type="date"
              value={partenzaFilter}
              onChange={(event) => setPartenzaFilter(event.target.value)}
              className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Accommodation
            </label>
            <input
              type="text"
              value={alloggioFilter}
              onChange={(event) => setAlloggioFilter(event.target.value)}
              className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-neutral-600">
            Selected recipients: <strong>{selectedIds.size}</strong>
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={toggleVisibleSelection}
              className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-100"
            >
              {allVisibleSelected ? "Unselect visible" : "Select all visible"}
            </button>
            <button
              type="button"
              onClick={openPreview}
              className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
            >
              Send
            </button>
          </div>
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-neutral-600">Loading participants...</p>
        ) : loadError ? (
          <p className="mt-4 text-sm text-red-700">{loadError}</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200 text-sm">
              <thead className="bg-neutral-50 text-left text-neutral-700">
                <tr>
                  <th className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleVisibleSelection}
                      aria-label="Select all visible participants"
                    />
                  </th>
                  {showGroupColumn && (
                    <th className="px-3 py-2 font-semibold">
                      <button type="button" onClick={() => toggleSort("group")}>
                        Group
                      </button>
                    </th>
                  )}
                  <th className="px-3 py-2 font-semibold">
                    <button type="button" onClick={() => toggleSort("nome")}>
                      Name
                    </button>
                  </th>
                  <th className="px-3 py-2 font-semibold">
                    <button type="button" onClick={() => toggleSort("cognome")}>
                      Surname
                    </button>
                  </th>
                  <th className="px-3 py-2 font-semibold">
                    <button type="button" onClick={() => toggleSort("email")}>
                      Email
                    </button>
                  </th>
                  <th className="px-3 py-2 font-semibold">
                    <button type="button" onClick={() => toggleSort("data_arrivo")}>
                      Arrival
                    </button>
                  </th>
                  <th className="px-3 py-2 font-semibold">
                    <button type="button" onClick={() => toggleSort("data_partenza")}>
                      Departure
                    </button>
                  </th>
                  <th className="px-3 py-2 font-semibold">
                    <button type="button" onClick={() => toggleSort("alloggio")}>
                      Accommodation
                    </button>
                  </th>
                  <th className="px-3 py-2 font-semibold">
                    <button type="button" onClick={() => toggleSort("quota_totale")}>
                      Total fee
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredSortedParticipants.length === 0 ? (
                  <tr>
                    <td
                      colSpan={showGroupColumn ? 9 : 8}
                      className="px-3 py-3 text-neutral-500"
                    >
                      No participants match current filters.
                    </td>
                  </tr>
                ) : (
                  filteredSortedParticipants.map((participant) => (
                    <tr key={participant.id}>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(participant.id)}
                          onChange={() => toggleParticipant(participant.id)}
                          aria-label={`Select ${participant.nome ?? ""} ${participant.cognome ?? ""}`}
                        />
                      </td>
                      {showGroupColumn && (
                        <td className="px-3 py-2 text-neutral-700">{participant.group || "-"}</td>
                      )}
                      <td className="px-3 py-2 text-neutral-900">{participant.nome || "-"}</td>
                      <td className="px-3 py-2 text-neutral-900">{participant.cognome || "-"}</td>
                      <td className="px-3 py-2 text-neutral-700">{participant.email || "-"}</td>
                      <td className="px-3 py-2 text-neutral-700">
                        {participant.data_arrivo || "-"}
                      </td>
                      <td className="px-3 py-2 text-neutral-700">
                        {participant.data_partenza || "-"}
                      </td>
                      <td className="px-3 py-2 text-neutral-700">{participant.alloggio || "-"}</td>
                      <td className="px-3 py-2 text-neutral-700">
                        {participant.quota_totale == null ? "-" : participant.quota_totale}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8">
          <div className="max-h-full w-full max-w-3xl overflow-auto rounded border border-neutral-200 bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-neutral-900">Preview before send</h3>
            <p className="mt-1 text-sm text-neutral-600">
              Emails to send: <strong>{selectedParticipantsWithEmail.length}</strong>
            </p>
            {previewParticipant ? (
              <p className="mt-1 text-xs text-neutral-500">
                Preview based on: {previewParticipant.nome || "-"}{" "}
                {previewParticipant.cognome || "-"} ({previewParticipant.email || "no email"})
              </p>
            ) : null}

            <div className="mt-4 rounded border border-neutral-200 bg-neutral-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Subject
              </p>
              <p className="mt-1 text-sm text-neutral-900">{previewSubject}</p>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Body
              </p>
              <div
                className="prose prose-sm mt-2 max-w-none rounded bg-white p-3"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={sending}
                onClick={() => setShowPreview(false)}
                className="rounded border border-neutral-300 bg-white px-4 py-2 text-sm hover:bg-neutral-100 disabled:opacity-60"
              >
                Back
              </button>
              <button
                type="button"
                disabled={sending}
                onClick={sendCampaign}
                className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
              >
                {sending ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
