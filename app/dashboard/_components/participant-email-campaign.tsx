"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
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
import {
  GROUP_LEADER_TEMPLATE_FIELDS,
  renderGroupLeaderTemplateHtml,
  renderGroupLeaderTemplateText,
  type GroupLeaderTemplateData,
} from "@/lib/email/group-leader-template";

type RecipientType = "participants" | "group_leaders";

type Participant = ParticipantTemplateData;

type GroupLeader = GroupLeaderTemplateData;

type ParticipantSortKey =
  | "group"
  | "nome"
  | "cognome"
  | "email"
  | "data_arrivo"
  | "data_partenza"
  | "alloggio"
  | "quota_totale";

type GroupLeaderSortKey = "nome" | "cognome" | "email" | "telefono" | "italia" | "roma";

type SortDirection = "asc" | "desc";

type ParticipantsLoadResponse = {
  participants: Participant[];
  groups: string[];
  showGroupColumn: boolean;
};

type GroupLeadersLoadResponse = {
  groupLeaders: GroupLeader[];
};

type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  html: string;
  updatedAt: string;
};

type ComposerAttachment = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  content: string;
};

const MAX_ATTACHMENT_COUNT = 5;
const MAX_ATTACHMENT_SIZE_BYTES = 7 * 1024 * 1024;
const SAFE_PREVIEW_TAGS = new Set([
  "a",
  "b",
  "blockquote",
  "br",
  "code",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "li",
  "ol",
  "p",
  "pre",
  "span",
  "strong",
  "u",
  "ul",
]);

function safeLower(value: string | null): string {
  return (value ?? "").toLowerCase();
}

function safeIncludes(value: string | null, search: string): boolean {
  return safeLower(value).includes(search.toLowerCase());
}

function formatBoolean(value: boolean | null): string {
  if (value === null) return "-";
  return value ? "Yes" : "No";
}

function sanitizePreviewHtml(html: string): string {
  if (typeof window === "undefined" || !html.trim()) {
    return "";
  }

  const parser = new window.DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  const stripNode = (element: Element) => {
    const parent = element.parentNode;
    if (!parent) return;
    while (element.firstChild) {
      parent.insertBefore(element.firstChild, element);
    }
    parent.removeChild(element);
  };

  for (const element of Array.from(doc.body.querySelectorAll("*"))) {
    const tag = element.tagName.toLowerCase();
    if (!SAFE_PREVIEW_TAGS.has(tag)) {
      stripNode(element);
      continue;
    }

    for (const attr of Array.from(element.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim();
      if (name.startsWith("on")) {
        element.removeAttribute(attr.name);
        continue;
      }
      if (name === "style") {
        element.removeAttribute(attr.name);
        continue;
      }
      if (name === "href") {
        const lower = value.toLowerCase();
        const safeHref =
          lower.startsWith("http://") ||
          lower.startsWith("https://") ||
          lower.startsWith("mailto:");
        if (!safeHref) {
          element.removeAttribute(attr.name);
          continue;
        }
      } else if (
        !["title", "aria-label", "aria-hidden", "class", "target", "rel"].includes(
          name
        )
      ) {
        element.removeAttribute(attr.name);
      }
    }

    if (tag === "a") {
      element.setAttribute("target", "_blank");
      element.setAttribute("rel", "noopener noreferrer");
    }
  }

  return doc.body.innerHTML;
}

async function fileToBase64(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        resolve(null);
        return;
      }
      const marker = "base64,";
      const idx = result.indexOf(marker);
      if (idx === -1) {
        resolve(null);
        return;
      }
      resolve(result.slice(idx + marker.length));
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

export function ParticipantEmailCampaign() {
  const [activeRecipientType, setActiveRecipientType] = useState<RecipientType>("participants");

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [showGroupColumn, setShowGroupColumn] = useState(false);
  const [participantsLoading, setParticipantsLoading] = useState(true);
  const [participantsError, setParticipantsError] = useState<string | null>(null);

  const [groupLeaders, setGroupLeaders] = useState<GroupLeader[]>([]);
  const [groupLeadersLoading, setGroupLeadersLoading] = useState(true);
  const [groupLeadersError, setGroupLeadersError] = useState<string | null>(null);

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
          "min-h-52 rounded border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 [&_h2]:mt-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:leading-tight [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_p]:my-2",
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      setBodyHtml(currentEditor.getHTML());
    },
    immediatelyRender: false,
  });

  const [participantSearch, setParticipantSearch] = useState("");
  const [participantGroupFilter, setParticipantGroupFilter] = useState("");
  const [participantArrivoFilter, setParticipantArrivoFilter] = useState("");
  const [participantPartenzaFilter, setParticipantPartenzaFilter] = useState("");
  const [participantAlloggioFilter, setParticipantAlloggioFilter] = useState("");
  const [participantSortKey, setParticipantSortKey] = useState<ParticipantSortKey>("cognome");
  const [participantSortDirection, setParticipantSortDirection] = useState<SortDirection>("asc");

  const [groupLeaderSearch, setGroupLeaderSearch] = useState("");
  const [groupLeaderItaliaFilter, setGroupLeaderItaliaFilter] = useState("all");
  const [groupLeaderRomaFilter, setGroupLeaderRomaFilter] = useState("all");
  const [groupLeaderSortKey, setGroupLeaderSortKey] = useState<GroupLeaderSortKey>("cognome");
  const [groupLeaderSortDirection, setGroupLeaderSortDirection] = useState<SortDirection>("asc");

  const [selectedParticipantIds, setSelectedParticipantIds] = useState<Set<string>>(new Set());
  const [selectedGroupLeaderIds, setSelectedGroupLeaderIds] = useState<Set<string>>(new Set());

  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);

  const [savedTemplates, setSavedTemplates] = useState<EmailTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);

  useEffect(() => {
    async function loadParticipants() {
      setParticipantsLoading(true);
      setParticipantsError(null);
      try {
        const res = await fetch("/api/manager/participants");
        const json = (await res.json()) as ParticipantsLoadResponse & { error?: string };
        if (!res.ok) {
          setParticipantsError(json.error ?? "Unable to load participants.");
          return;
        }
        setParticipants(Array.isArray(json.participants) ? json.participants : []);
        setGroups(Array.isArray(json.groups) ? json.groups : []);
        setShowGroupColumn(Boolean(json.showGroupColumn));
      } catch {
        setParticipantsError("Unable to load participants.");
      } finally {
        setParticipantsLoading(false);
      }
    }

    loadParticipants();
  }, []);

  useEffect(() => {
    async function loadGroupLeaders() {
      setGroupLeadersLoading(true);
      setGroupLeadersError(null);
      try {
        const res = await fetch("/api/manager/group-leaders");
        const json = (await res.json()) as GroupLeadersLoadResponse & { error?: string };
        if (!res.ok) {
          setGroupLeadersError(json.error ?? "Unable to load group leaders.");
          return;
        }
        setGroupLeaders(Array.isArray(json.groupLeaders) ? json.groupLeaders : []);
      } catch {
        setGroupLeadersError("Unable to load group leaders.");
      } finally {
        setGroupLeadersLoading(false);
      }
    }

    loadGroupLeaders();
  }, []);

  useEffect(() => {
    async function loadTemplates() {
      setTemplatesLoading(true);
      try {
        const res = await fetch("/api/manager/email-templates");
        const json = (await res.json()) as {
          error?: string;
          templates?: EmailTemplate[];
        };
        if (!res.ok) {
          setSendError(json.error ?? "Unable to load saved templates.");
          return;
        }
        setSavedTemplates(Array.isArray(json.templates) ? json.templates : []);
      } catch {
        setSendError("Unable to load saved templates.");
      } finally {
        setTemplatesLoading(false);
      }
    }

    loadTemplates();
  }, []);

  const filteredSortedParticipants = useMemo(() => {
    const filtered = participants.filter((participant) => {
      if (participantSearch) {
        const s = participantSearch.toLowerCase();
        const matches =
          safeIncludes(participant.nome, s) ||
          safeIncludes(participant.cognome, s) ||
          safeIncludes(participant.email, s) ||
          safeIncludes(participant.group, s);
        if (!matches) return false;
      }

      if (showGroupColumn && participantGroupFilter) {
        if (!safeIncludes(participant.group, participantGroupFilter)) return false;
      }
      if (participantArrivoFilter && (participant.data_arrivo ?? "") !== participantArrivoFilter) {
        return false;
      }
      if (
        participantPartenzaFilter &&
        (participant.data_partenza ?? "") !== participantPartenzaFilter
      ) {
        return false;
      }
      if (participantAlloggioFilter && (participant.alloggio ?? "") !== participantAlloggioFilter) {
        return false;
      }

      return true;
    });

    filtered.sort((a, b) => {
      const direction = participantSortDirection === "asc" ? 1 : -1;
      const aValue =
        participantSortKey === "quota_totale"
          ? a.quota_totale ?? -Infinity
          : ((a[participantSortKey] as string | null) ?? "").toLowerCase();
      const bValue =
        participantSortKey === "quota_totale"
          ? b.quota_totale ?? -Infinity
          : ((b[participantSortKey] as string | null) ?? "").toLowerCase();

      if (aValue < bValue) return -1 * direction;
      if (aValue > bValue) return 1 * direction;
      return 0;
    });

    return filtered;
  }, [
    participantAlloggioFilter,
    participantArrivoFilter,
    participantGroupFilter,
    participantPartenzaFilter,
    participantSearch,
    participantSortDirection,
    participantSortKey,
    participants,
    showGroupColumn,
  ]);

  const filteredSortedGroupLeaders = useMemo(() => {
    const filtered = groupLeaders.filter((leader) => {
      if (groupLeaderSearch) {
        const s = groupLeaderSearch.toLowerCase();
        const matches =
          safeIncludes(leader.nome, s) ||
          safeIncludes(leader.cognome, s) ||
          safeIncludes(leader.email, s) ||
          safeIncludes(leader.telefono, s);
        if (!matches) return false;
      }

      if (groupLeaderItaliaFilter === "yes" && leader.italia !== true) return false;
      if (groupLeaderItaliaFilter === "no" && leader.italia !== false) return false;
      if (groupLeaderRomaFilter === "yes" && leader.roma !== true) return false;
      if (groupLeaderRomaFilter === "no" && leader.roma !== false) return false;

      return true;
    });

    filtered.sort((a, b) => {
      const direction = groupLeaderSortDirection === "asc" ? 1 : -1;
      const getBooleanSortValue = (value: boolean | null) => {
        if (value === true) return 1;
        if (value === false) return 0;
        return -1;
      };

      let aValue: string | number = "";
      let bValue: string | number = "";

      if (groupLeaderSortKey === "italia") {
        aValue = getBooleanSortValue(a.italia);
        bValue = getBooleanSortValue(b.italia);
      } else if (groupLeaderSortKey === "roma") {
        aValue = getBooleanSortValue(a.roma);
        bValue = getBooleanSortValue(b.roma);
      } else {
        aValue = ((a[groupLeaderSortKey] as string | null) ?? "").toLowerCase();
        bValue = ((b[groupLeaderSortKey] as string | null) ?? "").toLowerCase();
      }

      if (aValue < bValue) return -1 * direction;
      if (aValue > bValue) return 1 * direction;
      return 0;
    });

    return filtered;
  }, [
    groupLeaderItaliaFilter,
    groupLeaderRomaFilter,
    groupLeaderSearch,
    groupLeaderSortDirection,
    groupLeaderSortKey,
    groupLeaders,
  ]);

  const participantVisibleIds = useMemo(
    () => filteredSortedParticipants.map((participant) => participant.id),
    [filteredSortedParticipants]
  );

  const groupLeaderVisibleIds = useMemo(
    () => filteredSortedGroupLeaders.map((groupLeader) => groupLeader.id),
    [filteredSortedGroupLeaders]
  );

  const activeVisibleIds =
    activeRecipientType === "participants" ? participantVisibleIds : groupLeaderVisibleIds;

  const activeSelectedIds =
    activeRecipientType === "participants" ? selectedParticipantIds : selectedGroupLeaderIds;

  const allVisibleSelected =
    activeVisibleIds.length > 0 && activeVisibleIds.every((id) => activeSelectedIds.has(id));

  const selectedParticipants = useMemo(
    () => participants.filter((participant) => selectedParticipantIds.has(participant.id)),
    [participants, selectedParticipantIds]
  );

  const selectedGroupLeaders = useMemo(
    () => groupLeaders.filter((leader) => selectedGroupLeaderIds.has(leader.id)),
    [groupLeaders, selectedGroupLeaderIds]
  );

  const selectedRecipientsWithEmail =
    activeRecipientType === "participants"
      ? selectedParticipants.filter(
          (participant) => typeof participant.email === "string" && participant.email.trim()
        )
      : selectedGroupLeaders.filter(
          (leader) => typeof leader.email === "string" && leader.email.trim()
        );

  const selectedRecipients =
    activeRecipientType === "participants" ? selectedParticipants : selectedGroupLeaders;

  const previewRecipient = selectedRecipientsWithEmail[0] ?? selectedRecipients[0] ?? null;

  const previewHtml =
    previewRecipient == null
      ? ""
      : activeRecipientType === "participants"
        ? renderParticipantTemplateHtml(bodyHtml, previewRecipient as Participant)
        : renderGroupLeaderTemplateHtml(bodyHtml, previewRecipient as GroupLeader);
  const sanitizedPreviewHtml = useMemo(
    () => sanitizePreviewHtml(previewHtml),
    [previewHtml]
  );

  const previewSubject =
    previewRecipient == null
      ? subject
      : activeRecipientType === "participants"
        ? renderParticipantTemplateText(subject, previewRecipient as Participant)
        : renderGroupLeaderTemplateText(subject, previewRecipient as GroupLeader);

  const activeFieldList =
    activeRecipientType === "participants"
      ? PARTICIPANT_TEMPLATE_FIELDS
      : GROUP_LEADER_TEMPLATE_FIELDS;

  function applyFormat(
    command:
      | "bold"
      | "italic"
      | "underline"
      | "heading"
      | "bulletList"
      | "orderedList"
      | "clear"
  ) {
    if (!editor) return;
    const chain = editor.chain().focus();
    if (command === "bold") chain.toggleBold().run();
    if (command === "italic") chain.toggleItalic().run();
    if (command === "underline") chain.toggleUnderline().run();
    if (command === "heading") chain.toggleHeading({ level: 2 }).run();
    if (command === "bulletList") chain.toggleBulletList().run();
    if (command === "orderedList") chain.toggleOrderedList().run();
    if (command === "clear") chain.clearNodes().unsetAllMarks().run();
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

  async function onAttachmentChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const slotsLeft = MAX_ATTACHMENT_COUNT - attachments.length;
    if (slotsLeft <= 0) {
      setSendError(`Maximum ${MAX_ATTACHMENT_COUNT} attachments allowed.`);
      event.target.value = "";
      return;
    }

    const picked = Array.from(files).slice(0, slotsLeft);
    const next: ComposerAttachment[] = [];

    for (const file of picked) {
      if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
        setSendError(`File "${file.name}" is too large (max 7 MB).`);
        continue;
      }

      const base64 = await fileToBase64(file);
      if (!base64) {
        setSendError(`Unable to read file "${file.name}".`);
        continue;
      }

      next.push({
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
        content: base64,
      });
    }

    if (next.length > 0) {
      setAttachments((current) => [...current, ...next]);
      setSendError(null);
    }

    event.target.value = "";
  }

  function removeAttachment(id: string) {
    setAttachments((current) => current.filter((item) => item.id !== id));
  }

  async function saveTemplate() {
    const defaultName = `Template ${savedTemplates.length + 1}`;
    const nameInput = window.prompt("Template name", defaultName);
    if (nameInput === null) return;
    const name = nameInput.trim();
    if (!name) {
      setSendError("Template name is required.");
      return;
    }

    const existing = savedTemplates.find(
      (template) => template.name.toLowerCase() === name.toLowerCase()
    );
    if (existing) {
      const shouldOverwrite = window.confirm(
        `A template named "${name}" already exists. Overwrite it?`
      );
      if (!shouldOverwrite) return;
      await updateTemplate(existing.id, name, subject, bodyHtml);
      return;
    }

    try {
      const res = await fetch("/api/manager/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          subject,
          html: bodyHtml,
        }),
      });
      const json = (await res.json()) as { error?: string; template?: EmailTemplate };
      if (!res.ok || !json.template) {
        setSendError(json.error ?? "Unable to save template.");
        return;
      }
      setSavedTemplates((current) => [json.template as EmailTemplate, ...current]);
      setSendResult(`Template "${name}" saved.`);
      setSendError(null);
    } catch {
      setSendError("Unable to save template.");
    }
  }

  function applyTemplate(template: EmailTemplate) {
    setSubject(template.subject);
    setBodyHtml(template.html);
    if (editor) {
      editor.commands.setContent(template.html);
    }
    setSendResult(`Template "${template.name}" loaded.`);
    setSendError(null);
  }

  async function editTemplate(template: EmailTemplate) {
    const renamed = window.prompt("Edit template name", template.name);
    if (renamed === null) return;
    const name = renamed.trim();
    if (!name) {
      setSendError("Template name is required.");
      return;
    }

    const shouldUpdateFromComposer = window.confirm(
      "Update this template with current composer content?"
    );
    await updateTemplate(
      template.id,
      name,
      shouldUpdateFromComposer ? subject : template.subject,
      shouldUpdateFromComposer ? bodyHtml : template.html
    );
  }

  async function deleteTemplate(template: EmailTemplate) {
    const ok = window.confirm(`Delete template "${template.name}"?`);
    if (!ok) return;
    try {
      const res = await fetch("/api/manager/email-templates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: template.id }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setSendError(json.error ?? "Unable to delete template.");
        return;
      }
      setSavedTemplates((current) => current.filter((item) => item.id !== template.id));
      setSendResult(`Template "${template.name}" deleted.`);
      setSendError(null);
    } catch {
      setSendError("Unable to delete template.");
    }
  }

  async function updateTemplate(
    id: string,
    name: string,
    nextSubject: string,
    nextHtml: string
  ) {
    try {
      const res = await fetch("/api/manager/email-templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          name,
          subject: nextSubject,
          html: nextHtml,
        }),
      });
      const json = (await res.json()) as { error?: string; template?: EmailTemplate };
      if (!res.ok || !json.template) {
        setSendError(json.error ?? "Unable to update template.");
        return;
      }
      const updated = json.template as EmailTemplate;
      setSavedTemplates((current) => {
        const next = current
          .map((item) => (item.id === id ? updated : item))
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        return next;
      });
      setSendResult(`Template "${name}" updated.`);
      setSendError(null);
    } catch {
      setSendError("Unable to update template.");
    }
  }

  function toggleParticipantSort(key: ParticipantSortKey) {
    if (participantSortKey === key) {
      setParticipantSortDirection((value) => (value === "asc" ? "desc" : "asc"));
      return;
    }
    setParticipantSortKey(key);
    setParticipantSortDirection("asc");
  }

  function toggleGroupLeaderSort(key: GroupLeaderSortKey) {
    if (groupLeaderSortKey === key) {
      setGroupLeaderSortDirection((value) => (value === "asc" ? "desc" : "asc"));
      return;
    }
    setGroupLeaderSortKey(key);
    setGroupLeaderSortDirection("asc");
  }

  function toggleRecipient(id: string) {
    if (activeRecipientType === "participants") {
      setSelectedParticipantIds((current) => {
        const next = new Set(current);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
      return;
    }

    setSelectedGroupLeaderIds((current) => {
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
    if (activeRecipientType === "participants") {
      setSelectedParticipantIds((current) => {
        const next = new Set(current);
        if (allVisibleSelected) {
          participantVisibleIds.forEach((id) => next.delete(id));
        } else {
          participantVisibleIds.forEach((id) => next.add(id));
        }
        return next;
      });
      return;
    }

    setSelectedGroupLeaderIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        groupLeaderVisibleIds.forEach((id) => next.delete(id));
      } else {
        groupLeaderVisibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function openPreview() {
    setSendError(null);
    setSendResult(null);

    if (activeSelectedIds.size === 0) {
      setSendError("Select at least one recipient.");
      return;
    }

    if (selectedRecipientsWithEmail.length === 0) {
      setSendError("No selected recipients have a valid email address.");
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
          recipientType: activeRecipientType,
          recipientIds: [...activeSelectedIds],
          subject,
          html: bodyHtml,
          attachments: attachments.map((attachment) => ({
            filename: attachment.filename,
            contentType: attachment.contentType,
            content: attachment.content,
            encoding: "base64",
          })),
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
      <header className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Email Campaigns</h2>
        <p className="mt-2 text-sm text-slate-500">
          Compose a personalized email and send it to selected participants or group leaders.
        </p>
      </header>

      {sendError && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {sendError}
        </div>
      )}
      {sendResult && (
        <div className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {sendResult}
        </div>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="block text-sm font-medium text-slate-700">Subject</label>
              <button
                type="button"
                onClick={saveTemplate}
                className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-100"
              >
                Save template
              </button>
            </div>
            <input
              type="text"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-4 py-3 text-sm"
              placeholder="Email subject"
            />

            <div className="mt-4">
              <p className="text-sm font-medium text-slate-700">Message</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => applyFormat("bold")}
                  className={`rounded border px-2 py-1 text-xs font-semibold ${
                    editor?.isActive("bold")
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-slate-300 hover:bg-slate-100"
                  }`}
                >
                  Bold
                </button>
                <button
                  type="button"
                  onClick={() => applyFormat("italic")}
                  className={`rounded border px-2 py-1 text-xs font-semibold ${
                    editor?.isActive("italic")
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-slate-300 hover:bg-slate-100"
                  }`}
                >
                  Italic
                </button>
                <button
                  type="button"
                  onClick={() => applyFormat("underline")}
                  className={`rounded border px-2 py-1 text-xs font-semibold ${
                    editor?.isActive("underline")
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-slate-300 hover:bg-slate-100"
                  }`}
                >
                  Underline
                </button>
                <button
                  type="button"
                  onClick={() => applyFormat("heading")}
                  className={`rounded border px-2 py-1 text-xs font-semibold ${
                    editor?.isActive("heading", { level: 2 })
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-slate-300 hover:bg-slate-100"
                  }`}
                >
                  H2
                </button>
                <button
                  type="button"
                  onClick={() => applyFormat("bulletList")}
                  className={`rounded border px-2 py-1 text-xs font-semibold ${
                    editor?.isActive("bulletList")
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-slate-300 hover:bg-slate-100"
                  }`}
                >
                  Bullet list
                </button>
                <button
                  type="button"
                  onClick={() => applyFormat("orderedList")}
                  className={`rounded border px-2 py-1 text-xs font-semibold ${
                    editor?.isActive("orderedList")
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-slate-300 hover:bg-slate-100"
                  }`}
                >
                  Numbered list
                </button>
                <button
                  type="button"
                  onClick={addLink}
                  className={`rounded border px-2 py-1 text-xs font-semibold ${
                    editor?.isActive("link")
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-slate-300 hover:bg-slate-100"
                  }`}
                >
                  Link
                </button>
                <button
                  type="button"
                  onClick={() => applyFormat("clear")}
                  className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold hover:bg-slate-100"
                >
                  Clear formatting
                </button>
              </div>
              <EditorContent editor={editor} className="mt-2" />
            </div>

            <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-700">Attachments</p>
                <label className="cursor-pointer rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-100">
                  Add files
                  <input
                    type="file"
                    multiple
                    onChange={onAttachmentChange}
                    className="hidden"
                  />
                </label>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Up to {MAX_ATTACHMENT_COUNT} files, max 7 MB each.
              </p>
              {attachments.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">No attachments selected.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-white px-2 py-1.5"
                    >
                      <span className="truncate text-xs text-slate-700">
                        {attachment.filename} ({Math.ceil(attachment.size / 1024)} KB)
                      </span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(attachment.id)}
                        className="rounded border border-red-200 px-2 py-0.5 text-xs text-red-700 hover:bg-red-50"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
              Saved Templates
            </h3>
            {templatesLoading ? (
              <p className="mt-2 text-xs text-slate-500">Loading templates...</p>
            ) : savedTemplates.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">No saved templates yet.</p>
            ) : (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {savedTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="rounded border border-slate-200 px-4 py-3"
                  >
                    <p className="text-sm font-medium text-slate-900">{template.name}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {template.subject || "(No subject)"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => applyTemplate(template)}
                        className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100"
                      >
                        Use
                      </button>
                      <button
                        type="button"
                        onClick={() => editTemplate(template)}
                        className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteTemplate(template)}
                        className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="h-max rounded-xl border border-slate-200 bg-white p-6 shadow-sm xl:sticky xl:top-24">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
            Personalization Fields
          </h3>
          <p className="mt-2 text-xs text-slate-500">
            Click a field to insert it at cursor position.
          </p>
          <div className="mt-3 space-y-2">
            {activeFieldList.map((field) => (
              <button
                key={field.key}
                type="button"
                onClick={() => insertToken(field.token)}
                className="flex w-full items-center justify-between rounded border border-slate-200 px-4 py-3 text-left hover:bg-slate-50"
              >
                <span className="text-sm text-slate-800">{field.label}</span>
                <code className="text-xs text-slate-500">{field.token}</code>
              </button>
            ))}
          </div>
        </aside>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveRecipientType("participants")}
            className={`rounded border px-3 py-1.5 text-sm ${
              activeRecipientType === "participants"
                ? "border-indigo-600 bg-indigo-600 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
            }`}
          >
            Participants ({participants.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveRecipientType("group_leaders")}
            className={`rounded border px-3 py-1.5 text-sm ${
              activeRecipientType === "group_leaders"
                ? "border-indigo-600 bg-indigo-600 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
            }`}
          >
            Group leaders ({groupLeaders.length})
          </button>
        </div>

        {activeRecipientType === "participants" ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Search
              </label>
              <input
                type="text"
                value={participantSearch}
                onChange={(event) => setParticipantSearch(event.target.value)}
                placeholder="Name, surname, email, group"
                className="mt-1 w-full rounded border border-slate-300 px-4 py-3 text-sm"
              />
            </div>
            {showGroupColumn && (
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Group
                </label>
                <input
                  type="text"
                  value={participantGroupFilter}
                  onChange={(event) => setParticipantGroupFilter(event.target.value)}
                  list="group-options"
                  className="mt-1 w-full rounded border border-slate-300 px-4 py-3 text-sm"
                />
                <datalist id="group-options">
                  {groups.map((group) => (
                    <option key={group} value={group} />
                  ))}
                </datalist>
              </div>
            )}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Arrival
              </label>
              <input
                type="date"
                value={participantArrivoFilter}
                onChange={(event) => setParticipantArrivoFilter(event.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-4 py-3 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Departure
              </label>
              <input
                type="date"
                value={participantPartenzaFilter}
                onChange={(event) => setParticipantPartenzaFilter(event.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-4 py-3 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Accommodation
              </label>
              <input
                type="text"
                value={participantAlloggioFilter}
                onChange={(event) => setParticipantAlloggioFilter(event.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-4 py-3 text-sm"
              />
            </div>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Search
              </label>
              <input
                type="text"
                value={groupLeaderSearch}
                onChange={(event) => setGroupLeaderSearch(event.target.value)}
                placeholder="Name, surname, email, phone"
                className="mt-1 w-full rounded border border-slate-300 px-4 py-3 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Italy
              </label>
              <select
                value={groupLeaderItaliaFilter}
                onChange={(event) => setGroupLeaderItaliaFilter(event.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-4 py-3 text-sm"
              >
                <option value="all">All</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Rome
              </label>
              <select
                value={groupLeaderRomaFilter}
                onChange={(event) => setGroupLeaderRomaFilter(event.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-4 py-3 text-sm"
              >
                <option value="all">All</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            Selected recipients: <strong>{activeSelectedIds.size}</strong>
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={toggleVisibleSelection}
              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-100"
            >
              {allVisibleSelected ? "Unselect visible" : "Select all visible"}
            </button>
            <button
              type="button"
              onClick={openPreview}
              className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Send
            </button>
          </div>
        </div>

        {activeRecipientType === "participants" ? (
          participantsLoading ? (
            <p className="mt-4 text-sm text-slate-500">Loading participants...</p>
          ) : participantsError ? (
            <p className="mt-4 text-sm text-red-700">{participantsError}</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50/50 text-left text-slate-700">
                  <tr>
                    <th className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleVisibleSelection}
                        aria-label="Select all visible participants"
                      />
                    </th>
                    {showGroupColumn && (
                      <th className="px-4 py-3 font-semibold">
                        <button type="button" onClick={() => toggleParticipantSort("group")}>
                          Group
                        </button>
                      </th>
                    )}
                    <th className="px-4 py-3 font-semibold">
                      <button type="button" onClick={() => toggleParticipantSort("nome")}>Name</button>
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      <button type="button" onClick={() => toggleParticipantSort("cognome")}>
                        Surname
                      </button>
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      <button type="button" onClick={() => toggleParticipantSort("email")}>
                        Email
                      </button>
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      <button
                        type="button"
                        onClick={() => toggleParticipantSort("data_arrivo")}
                      >
                        Arrival
                      </button>
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      <button
                        type="button"
                        onClick={() => toggleParticipantSort("data_partenza")}
                      >
                        Departure
                      </button>
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      <button type="button" onClick={() => toggleParticipantSort("alloggio")}>
                        Accommodation
                      </button>
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      <button
                        type="button"
                        onClick={() => toggleParticipantSort("quota_totale")}
                      >
                        Total fee
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSortedParticipants.length === 0 ? (
                    <tr>
                      <td
                        colSpan={showGroupColumn ? 9 : 8}
                        className="px-3 py-3 text-slate-500"
                      >
                        No participants match current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredSortedParticipants.map((participant) => (
                      <tr key={participant.id}>
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedParticipantIds.has(participant.id)}
                            onChange={() => toggleRecipient(participant.id)}
                            aria-label={`Select ${participant.nome ?? ""} ${participant.cognome ?? ""}`}
                          />
                        </td>
                        {showGroupColumn && (
                          <td className="px-4 py-3 text-slate-700">{participant.group || "-"}</td>
                        )}
                        <td className="px-4 py-3 text-slate-900">{participant.nome || "-"}</td>
                        <td className="px-4 py-3 text-slate-900">{participant.cognome || "-"}</td>
                        <td className="px-4 py-3 text-slate-700">{participant.email || "-"}</td>
                        <td className="px-4 py-3 text-slate-700">
                          {participant.data_arrivo || "-"}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {participant.data_partenza || "-"}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{participant.alloggio || "-"}</td>
                        <td className="px-4 py-3 text-slate-700">
                          {participant.quota_totale == null ? "-" : participant.quota_totale}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )
        ) : groupLeadersLoading ? (
          <p className="mt-4 text-sm text-slate-500">Loading group leaders...</p>
        ) : groupLeadersError ? (
          <p className="mt-4 text-sm text-red-700">{groupLeadersError}</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50/50 text-left text-slate-700">
                <tr>
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleVisibleSelection}
                      aria-label="Select all visible group leaders"
                    />
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    <button type="button" onClick={() => toggleGroupLeaderSort("nome")}>Name</button>
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    <button type="button" onClick={() => toggleGroupLeaderSort("cognome")}>Surname</button>
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    <button type="button" onClick={() => toggleGroupLeaderSort("email")}>Email</button>
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    <button type="button" onClick={() => toggleGroupLeaderSort("telefono")}>Phone</button>
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    <button type="button" onClick={() => toggleGroupLeaderSort("italia")}>Italy</button>
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    <button type="button" onClick={() => toggleGroupLeaderSort("roma")}>Rome</button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSortedGroupLeaders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-3 text-slate-500">
                      No group leaders match current filters.
                    </td>
                  </tr>
                ) : (
                  filteredSortedGroupLeaders.map((leader) => (
                    <tr key={leader.id}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedGroupLeaderIds.has(leader.id)}
                          onChange={() => toggleRecipient(leader.id)}
                          aria-label={`Select ${leader.nome ?? ""} ${leader.cognome ?? ""}`}
                        />
                      </td>
                      <td className="px-4 py-3 text-slate-900">{leader.nome || "-"}</td>
                      <td className="px-4 py-3 text-slate-900">{leader.cognome || "-"}</td>
                      <td className="px-4 py-3 text-slate-700">{leader.email || "-"}</td>
                      <td className="px-4 py-3 text-slate-700">{leader.telefono || "-"}</td>
                      <td className="px-4 py-3 text-slate-700">{formatBoolean(leader.italia)}</td>
                      <td className="px-4 py-3 text-slate-700">{formatBoolean(leader.roma)}</td>
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
          <div className="max-h-full w-full max-w-3xl overflow-auto rounded border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Preview before send</h3>
            <p className="mt-1 text-sm text-slate-500">
              Emails to send: <strong>{selectedRecipientsWithEmail.length}</strong>
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Attachments: <strong>{attachments.length}</strong>
            </p>
            {previewRecipient ? (
              <p className="mt-1 text-xs text-slate-500">
                Preview based on: {(previewRecipient as Participant | GroupLeader).nome || "-"}{" "}
                {(previewRecipient as Participant | GroupLeader).cognome || "-"} ({(previewRecipient as Participant | GroupLeader).email || "no email"})
              </p>
            ) : null}

            <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Subject
              </p>
              <p className="mt-1 text-sm text-slate-900">{previewSubject}</p>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Body
              </p>
              <div
                className="prose prose-sm mt-2 max-w-none rounded bg-white p-3"
                dangerouslySetInnerHTML={{ __html: sanitizedPreviewHtml }}
              />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={sending}
                onClick={() => setShowPreview(false)}
                className="rounded border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-100 disabled:opacity-60"
              >
                Back
              </button>
              <button
                type="button"
                disabled={sending}
                onClick={sendCampaign}
                className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
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
