"use client";

import { useEffect, useMemo, useState } from "react";
import { AVAILABLE_ROLES, ROLE_LABELS } from "@/lib/auth/roles";

type Profilo = {
  id: string;
  email: string;
  nome: string | null;
  cognome: string | null;
  ruolo: string;
  created_at: string;
  groups: string[];
};

type UploadResult = {
  imported: number;
  skipped: number;
  errors: string[];
};

type EditDraft = {
  nome: string;
  cognome: string;
  ruolo: string;
  groupsText: string;
};

export default function AdminUsersProfilesPage() {
  const [profiles, setProfiles] = useState<Profilo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDrafts, setEditDrafts] = useState<Record<string, EditDraft>>({});
  const [newProfile, setNewProfile] = useState({
    email: "",
    nome: "",
    cognome: "",
    ruolo: "capogruppo",
  });
  const [uploading, setUploading] = useState(false);
  const [uploadSummary, setUploadSummary] = useState<UploadResult | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);

  const sorted = useMemo(
    () => [...profiles].sort((a, b) => a.email.localeCompare(b.email)),
    [profiles]
  );

  async function loadProfiles() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/profili", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Loading error");
      setProfiles(json.data || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfiles();
  }, []);

  function startEdit(profile: Profilo) {
    setEditingId(profile.id);
    setEditDrafts((prev) => ({
      ...prev,
      [profile.id]: {
        nome: profile.nome ?? "",
        cognome: profile.cognome ?? "",
        ruolo: profile.ruolo,
        groupsText: profile.groups.join(", "),
      },
    }));
  }

  function cancelEdit(profileId: string) {
    setEditingId((current) => (current === profileId ? null : current));
    setEditDrafts((prev) => {
      const copy = { ...prev };
      delete copy[profileId];
      return copy;
    });
  }

  function parseGroupsFromText(groupsText: string): string[] {
    return [...new Set(groupsText.split(",").map((item) => item.trim()).filter(Boolean))];
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const response = await fetch("/api/admin/profili", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProfile),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Create error");
      setNewProfile({ email: "", nome: "", cognome: "", ruolo: "capogruppo" });
      await loadProfiles();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function saveRow(profileId: string) {
    const draft = editDrafts[profileId];
    if (!draft) return;

    setSavingId(profileId);
    setError(null);
    try {
      const response = await fetch("/api/admin/profili", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: profileId,
          nome: draft.nome,
          cognome: draft.cognome,
          ruolo: draft.ruolo,
          groups: parseGroupsFromText(draft.groupsText),
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Update error");
      await loadProfiles();
      cancelEdit(profileId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingId(null);
    }
  }

  async function handleCsvUpload(event: React.FormEvent) {
    event.preventDefault();
    if (!csvFile) return;

    setUploading(true);
    setError(null);
    setUploadSummary(null);

    try {
      const form = new FormData();
      form.set("file", csvFile);
      form.set("defaultRole", "capogruppo");

      const response = await fetch("/api/admin/profili/upload", {
        method: "POST",
        body: form,
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "CSV upload error");
      setUploadSummary(json);
      setCsvFile(null);
      await loadProfiles();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Users & Profiles</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Manage users/profiles: view, edit, add new users, or import from CSV.
        </p>
      </header>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="rounded border border-neutral-200 p-4">
        <h2 className="text-base font-medium">Add User</h2>
        <form onSubmit={handleCreate} className="mt-4 grid gap-3 md:grid-cols-4">
          <input
            type="email"
            required
            value={newProfile.email}
            onChange={(e) =>
              setNewProfile((prev) => ({ ...prev, email: e.target.value }))
            }
            className="rounded border border-neutral-300 px-3 py-2 text-sm"
            placeholder="email"
          />
          <input
            type="text"
            value={newProfile.nome}
            onChange={(e) =>
              setNewProfile((prev) => ({ ...prev, nome: e.target.value }))
            }
            className="rounded border border-neutral-300 px-3 py-2 text-sm"
            placeholder="first name"
          />
          <input
            type="text"
            value={newProfile.cognome}
            onChange={(e) =>
              setNewProfile((prev) => ({ ...prev, cognome: e.target.value }))
            }
            className="rounded border border-neutral-300 px-3 py-2 text-sm"
            placeholder="last name"
          />
          <div className="flex gap-2">
            <select
              value={newProfile.ruolo}
              onChange={(e) =>
                setNewProfile((prev) => ({ ...prev, ruolo: e.target.value }))
              }
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
            >
              {AVAILABLE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
            >
              Add
            </button>
          </div>
        </form>
      </section>

      <section className="rounded border border-neutral-200 p-4">
        <h2 className="text-base font-medium">Upload CSV</h2>
        <form onSubmit={handleCsvUpload} className="mt-4 flex flex-col gap-3 md:flex-row">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
            className="block text-sm"
          />
          <button
            type="submit"
            disabled={!csvFile || uploading}
            className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </form>
        {uploadSummary && (
          <div className="mt-3 rounded border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
            Imported: {uploadSummary.imported} | Skipped: {uploadSummary.skipped} | Errors:{" "}
            {uploadSummary.errors.length}
            {uploadSummary.errors.length > 0 && (
              <div className="mt-2 max-h-40 overflow-auto rounded border border-neutral-200 bg-white p-2 text-xs">
                {uploadSummary.errors.slice(0, 20).map((line, index) => (
                  <div key={`${line}-${index}`} className="font-mono text-red-700">
                    {line}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="rounded border border-neutral-200 p-4">
        <h2 className="text-base font-medium">Current Profiles</h2>
        {loading ? (
          <p className="mt-3 text-sm text-neutral-600">Loading...</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">First Name</th>
                  <th className="px-3 py-2">Last Name</th>
                  <th className="px-3 py-2">Groups</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((profile) => (
                  <tr key={profile.id} className="border-t border-neutral-100 align-top">
                    <td className="px-3 py-2">{profile.email}</td>
                    <td className="px-3 py-2">
                      {editingId === profile.id ? (
                      <input
                        type="text"
                        value={editDrafts[profile.id]?.nome ?? ""}
                        onChange={(e) =>
                          setEditDrafts((prev) => ({
                            ...prev,
                            [profile.id]: {
                              ...prev[profile.id],
                              nome: e.target.value,
                            },
                          }))
                        }
                        className="w-full rounded border border-neutral-300 px-2 py-1"
                      />
                      ) : (
                        <span>{profile.nome ?? ""}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {editingId === profile.id ? (
                        <input
                          type="text"
                          value={editDrafts[profile.id]?.cognome ?? ""}
                          onChange={(e) =>
                            setEditDrafts((prev) => ({
                              ...prev,
                              [profile.id]: {
                                ...prev[profile.id],
                                cognome: e.target.value,
                              },
                            }))
                          }
                        className="w-full rounded border border-neutral-300 px-2 py-1"
                      />
                      ) : (
                        <span>{profile.cognome ?? ""}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {editingId === profile.id ? (
                        <input
                          type="text"
                          value={editDrafts[profile.id]?.groupsText ?? ""}
                          onChange={(e) =>
                            setEditDrafts((prev) => ({
                              ...prev,
                              [profile.id]: {
                                ...prev[profile.id],
                                groupsText: e.target.value,
                              },
                            }))
                          }
                          className="w-full rounded border border-neutral-300 px-2 py-1"
                          placeholder="Group A, Group B"
                        />
                      ) : profile.groups.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {profile.groups.map((group) => (
                            <span
                              key={`${profile.id}-${group}`}
                              className="rounded bg-neutral-100 px-2 py-0.5 text-xs"
                            >
                              {group}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-neutral-500">No groups</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {editingId === profile.id ? (
                        <select
                          value={editDrafts[profile.id]?.ruolo ?? profile.ruolo}
                          onChange={(e) =>
                            setEditDrafts((prev) => ({
                              ...prev,
                              [profile.id]: {
                                ...prev[profile.id],
                                ruolo: e.target.value,
                              },
                            }))
                          }
                          className="w-full rounded border border-neutral-300 px-2 py-1"
                        >
                          {AVAILABLE_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span>{ROLE_LABELS[profile.ruolo] ?? profile.ruolo}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {editingId === profile.id ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => saveRow(profile.id)}
                            disabled={savingId === profile.id}
                            className="rounded bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                          >
                            {savingId === profile.id ? "Saving..." : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={() => cancelEdit(profile.id)}
                            disabled={savingId === profile.id}
                            className="rounded border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEdit(profile)}
                          className="rounded border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-800"
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
