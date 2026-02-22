"use client";

import { useEffect, useMemo, useState } from "react";
import { AVAILABLE_ROLES, isAppRole, ROLE_LABELS } from "@/lib/auth/roles";

type Profilo = {
  id: string;
  email: string;
  nome: string | null;
  cognome: string | null;
  ruolo: string;
  telefono: string | null;
  italia: boolean | null;
  roma: boolean | null;
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
  telefono: string;
  italia: boolean;
  roma: boolean;
  groups: string[];
  newGroup: string;
};

type NewProfileDraft = {
  email: string;
  nome: string;
  cognome: string;
  ruolo: string;
  telefono: string;
  italia: boolean;
  roma: boolean;
  groups: string[];
  newGroup: string;
};

const EMPTY_NEW_PROFILE: NewProfileDraft = {
  email: "",
  nome: "",
  cognome: "",
  ruolo: "capogruppo",
  telefono: "",
  italia: false,
  roma: false,
  groups: [],
  newGroup: "",
};

export default function AdminUsersProfilesPage() {
  const [profiles, setProfiles] = useState<Profilo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDrafts, setEditDrafts] = useState<Record<string, EditDraft>>({});
  const [newProfile, setNewProfile] = useState<NewProfileDraft>(EMPTY_NEW_PROFILE);
  const [uploading, setUploading] = useState(false);
  const [uploadSummary, setUploadSummary] = useState<UploadResult | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [allKnownGroups, setAllKnownGroups] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [italiaFilter, setItaliaFilter] = useState("all");
  const [romaFilter, setRomaFilter] = useState("all");

  const sorted = useMemo(
    () => [...profiles].sort((a, b) => a.email.localeCompare(b.email)),
    [profiles]
  );

  const filteredProfiles = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return sorted.filter((profile) => {
      const matchesSearch =
        !term ||
        profile.email.toLowerCase().includes(term) ||
        (profile.nome ?? "").toLowerCase().includes(term) ||
        (profile.cognome ?? "").toLowerCase().includes(term) ||
        (profile.telefono ?? "").toLowerCase().includes(term) ||
        profile.groups.some((group) => group.toLowerCase().includes(term));

      const matchesRole = roleFilter === "all" || profile.ruolo === roleFilter;
      const matchesGroup =
        groupFilter === "all" || profile.groups.includes(groupFilter);
      const matchesItalia =
        italiaFilter === "all" ||
        (italiaFilter === "yes" ? Boolean(profile.italia) : !Boolean(profile.italia));
      const matchesRoma =
        romaFilter === "all" ||
        (romaFilter === "yes" ? Boolean(profile.roma) : !Boolean(profile.roma));

      return (
        matchesSearch &&
        matchesRole &&
        matchesGroup &&
        matchesItalia &&
        matchesRoma
      );
    });
  }, [groupFilter, italiaFilter, roleFilter, romaFilter, searchTerm, sorted]);

  async function loadProfiles() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/profili", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Loading error");
      const data = (json.data || []) as Profilo[];
      setProfiles(data);
      const groups = [
        ...new Set(
          data.flatMap((profile) =>
            (profile.groups || []).map((group) => group.trim()).filter(Boolean)
          )
        ),
      ].sort((a, b) => a.localeCompare(b));
      setAllKnownGroups(groups);
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
        telefono: profile.telefono ?? "",
        italia: Boolean(profile.italia),
        roma: Boolean(profile.roma),
        groups: [...profile.groups],
        newGroup: "",
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

  function normalizeGroupName(value: string): string {
    return value.trim();
  }

  function addGroupToDraft(profileId: string) {
    setEditDrafts((prev) => {
      const draft = prev[profileId];
      if (!draft) return prev;
      const groupName = normalizeGroupName(draft.newGroup);
      if (!groupName) return prev;
      if (draft.groups.includes(groupName)) {
        return {
          ...prev,
          [profileId]: {
            ...draft,
            newGroup: "",
          },
        };
      }
      return {
        ...prev,
        [profileId]: {
          ...draft,
          groups: [...draft.groups, groupName].sort((a, b) => a.localeCompare(b)),
          newGroup: "",
        },
      };
    });
  }

  function removeGroupFromDraft(profileId: string, groupName: string) {
    setEditDrafts((prev) => {
      const draft = prev[profileId];
      if (!draft) return prev;
      return {
        ...prev,
        [profileId]: {
          ...draft,
          groups: draft.groups.filter((group) => group !== groupName),
        },
      };
    });
  }

  function addGroupToNewProfile() {
    setNewProfile((prev) => {
      const groupName = normalizeGroupName(prev.newGroup);
      if (!groupName) return prev;
      if (prev.groups.includes(groupName)) {
        return {
          ...prev,
          newGroup: "",
        };
      }
      return {
        ...prev,
        groups: [...prev.groups, groupName].sort((a, b) => a.localeCompare(b)),
        newGroup: "",
      };
    });
  }

  function removeGroupFromNewProfile(groupName: string) {
    setNewProfile((prev) => ({
      ...prev,
      groups: prev.groups.filter((group) => group !== groupName),
    }));
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (newProfile.groups.length === 0) {
      setError("At least one group is required");
      return;
    }

    try {
      const response = await fetch("/api/admin/profili", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProfile),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Create error");
      setNewProfile(EMPTY_NEW_PROFILE);
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
          telefono: draft.telefono,
          italia: draft.italia,
          roma: draft.roma,
          groups: draft.groups,
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
        <h1 className="text-2xl font-bold">Users & Profiles</h1>
        <p className="mt-2 text-sm text-slate-500">
          Manage users/profiles: view, edit, add new users, or import from CSV.
        </p>
      </header>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-medium">Add User</h2>
        <form onSubmit={handleCreate} className="mt-4 grid gap-3 md:grid-cols-4">
          <input
            type="email"
            required
            value={newProfile.email}
            onChange={(e) =>
              setNewProfile((prev) => ({ ...prev, email: e.target.value }))
            }
            className="rounded border border-slate-300 px-4 py-3 text-sm"
            placeholder="email"
          />
          <input
            type="text"
            value={newProfile.nome}
            onChange={(e) =>
              setNewProfile((prev) => ({ ...prev, nome: e.target.value }))
            }
            className="rounded border border-slate-300 px-4 py-3 text-sm"
            placeholder="first name"
          />
          <input
            type="text"
            value={newProfile.cognome}
            onChange={(e) =>
              setNewProfile((prev) => ({ ...prev, cognome: e.target.value }))
            }
            className="rounded border border-slate-300 px-4 py-3 text-sm"
            placeholder="last name"
          />
          <input
            type="text"
            value={newProfile.telefono}
            onChange={(e) =>
              setNewProfile((prev) => ({ ...prev, telefono: e.target.value }))
            }
            className="rounded border border-slate-300 px-4 py-3 text-sm"
            placeholder="phone"
          />
          <label className="inline-flex items-center gap-2 rounded border border-slate-300 px-4 py-3 text-sm">
            <input
              type="checkbox"
              checked={newProfile.italia}
              onChange={(e) =>
                setNewProfile((prev) => ({ ...prev, italia: e.target.checked }))
              }
            />
            <span>Italy</span>
          </label>
          <label className="inline-flex items-center gap-2 rounded border border-slate-300 px-4 py-3 text-sm">
            <input
              type="checkbox"
              checked={newProfile.roma}
              onChange={(e) =>
                setNewProfile((prev) => ({ ...prev, roma: e.target.checked }))
              }
            />
            <span>Rome</span>
          </label>
          <div className="md:col-span-3 space-y-2">
            <div className="flex flex-wrap gap-1">
              {newProfile.groups.map((group) => (
                <span
                  key={`new-profile-group-${group}`}
                  className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs"
                >
                  {group}
                  <button
                    type="button"
                    onClick={() => removeGroupFromNewProfile(group)}
                    className="rounded px-1 text-slate-500 hover:bg-slate-200"
                  >
                    Remove
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                list="all-groups-new-profile"
                type="text"
                value={newProfile.newGroup}
                onChange={(e) =>
                  setNewProfile((prev) => ({ ...prev, newGroup: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addGroupToNewProfile();
                  }
                }}
                className="w-full rounded border border-slate-300 px-4 py-3 text-sm"
                placeholder="Add a group"
              />
              <datalist id="all-groups-new-profile">
                {allKnownGroups.map((group) => (
                  <option key={`new-profile-opt-${group}`} value={group} />
                ))}
              </datalist>
              <button
                type="button"
                onClick={addGroupToNewProfile}
                className="rounded border border-slate-300 px-4 py-3 text-xs font-medium text-slate-800"
              >
                Add
              </button>
            </div>
            <p className="text-xs text-slate-500">At least one group is required.</p>
          </div>
          <div className="flex gap-2">
            <select
              value={newProfile.ruolo}
              onChange={(e) =>
                setNewProfile((prev) => ({ ...prev, ruolo: e.target.value }))
              }
              className="w-full rounded border border-slate-300 px-4 py-3 text-sm"
            >
              {AVAILABLE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={newProfile.groups.length === 0}
              className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
            >
              Add
            </button>
          </div>
        </form>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-medium">Search & Filters</h2>
            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                setRoleFilter("all");
                setGroupFilter("all");
                setItaliaFilter("all");
                setRomaFilter("all");
              }}
              className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700"
            >
              Reset filters
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="rounded border border-slate-300 px-4 py-3 text-sm md:col-span-2 xl:col-span-3"
              placeholder="Search by email, name, phone or group"
            />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded border border-slate-300 px-4 py-3 text-sm"
            >
              <option value="all">All roles</option>
              {AVAILABLE_ROLES.map((role) => (
                <option key={`filter-role-${role}`} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="rounded border border-slate-300 px-4 py-3 text-sm"
            >
              <option value="all">All groups</option>
              {allKnownGroups.map((group) => (
                <option key={`filter-group-${group}`} value={group}>
                  {group}
                </option>
              ))}
            </select>
            <select
              value={italiaFilter}
              onChange={(e) => setItaliaFilter(e.target.value)}
              className="rounded border border-slate-300 px-4 py-3 text-sm"
            >
              <option value="all">Italy: all</option>
              <option value="yes">Italy: yes</option>
              <option value="no">Italy: no</option>
            </select>
            <select
              value={romaFilter}
              onChange={(e) => setRomaFilter(e.target.value)}
              className="rounded border border-slate-300 px-4 py-3 text-sm"
            >
              <option value="all">Rome: all</option>
              <option value="yes">Rome: yes</option>
              <option value="no">Rome: no</option>
            </select>
          </div>
          <p className="mt-3 text-sm text-slate-500">
            Showing {filteredProfiles.length} of {sorted.length} users
          </p>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-medium">Upload CSV</h2>
          <form onSubmit={handleCsvUpload} className="mt-3 space-y-3">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm"
            />
            <button
              type="submit"
              disabled={!csvFile || uploading}
              className="w-full rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </form>
          {uploadSummary && (
            <div className="mt-3 rounded border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              Imported: {uploadSummary.imported} | Skipped: {uploadSummary.skipped} | Errors:{" "}
              {uploadSummary.errors.length}
              {uploadSummary.errors.length > 0 && (
                <div className="mt-2 max-h-40 overflow-auto rounded border border-slate-200 bg-white p-2 text-xs">
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
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-medium">Current Profiles</h2>
        {loading ? (
          <p className="mt-3 text-sm text-slate-500">Loading...</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">First Name</th>
                  <th className="px-4 py-3">Last Name</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Italy</th>
                  <th className="px-4 py-3">Rome</th>
                  <th className="px-4 py-3">Groups</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredProfiles.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-3 py-6 text-center text-sm text-slate-500"
                    >
                      No users found with the selected filters.
                    </td>
                  </tr>
                )}
                {filteredProfiles.map((profile) => (
                  <tr key={profile.id} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-3">{profile.email}</td>
                    <td className="px-4 py-3">
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
                          className="w-full rounded border border-slate-300 px-2 py-1"
                        />
                      ) : (
                        <span>{profile.nome ?? ""}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
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
                          className="w-full rounded border border-slate-300 px-2 py-1"
                        />
                      ) : (
                        <span>{profile.cognome ?? ""}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingId === profile.id ? (
                        <input
                          type="text"
                          value={editDrafts[profile.id]?.telefono ?? ""}
                          onChange={(e) =>
                            setEditDrafts((prev) => ({
                              ...prev,
                              [profile.id]: {
                                ...prev[profile.id],
                                telefono: e.target.value,
                              },
                            }))
                          }
                          className="w-full rounded border border-slate-300 px-2 py-1"
                        />
                      ) : (
                        <span>{profile.telefono ?? ""}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingId === profile.id ? (
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={Boolean(editDrafts[profile.id]?.italia)}
                            onChange={(e) =>
                              setEditDrafts((prev) => ({
                                ...prev,
                                [profile.id]: {
                                  ...prev[profile.id],
                                  italia: e.target.checked,
                                },
                              }))
                            }
                          />
                          <span className="text-xs text-slate-700">Italy</span>
                        </label>
                      ) : (
                        <span>{profile.italia ? "Yes" : "No"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingId === profile.id ? (
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={Boolean(editDrafts[profile.id]?.roma)}
                            onChange={(e) =>
                              setEditDrafts((prev) => ({
                                ...prev,
                                [profile.id]: {
                                  ...prev[profile.id],
                                  roma: e.target.checked,
                                },
                              }))
                            }
                          />
                          <span className="text-xs text-slate-700">Rome</span>
                        </label>
                      ) : (
                        <span>{profile.roma ? "Yes" : "No"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingId === profile.id ? (
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-1">
                            {(editDrafts[profile.id]?.groups ?? []).map((group) => (
                              <span
                                key={`${profile.id}-edit-${group}`}
                                className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs"
                              >
                                {group}
                                <button
                                  type="button"
                                  onClick={() => removeGroupFromDraft(profile.id, group)}
                                  className="rounded px-1 text-slate-500 hover:bg-slate-200"
                                >
                                  Remove
                                </button>
                              </span>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <input
                              list={`groups-${profile.id}`}
                              type="text"
                              value={editDrafts[profile.id]?.newGroup ?? ""}
                              onChange={(e) =>
                                setEditDrafts((prev) => ({
                                  ...prev,
                                  [profile.id]: {
                                    ...prev[profile.id],
                                    newGroup: e.target.value,
                                  },
                                }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  addGroupToDraft(profile.id);
                                }
                              }}
                              className="w-full rounded border border-slate-300 px-2 py-1"
                              placeholder="Add a group"
                            />
                            <datalist id={`groups-${profile.id}`}>
                              {allKnownGroups.map((group) => (
                                <option key={`${profile.id}-opt-${group}`} value={group} />
                              ))}
                            </datalist>
                            <button
                              type="button"
                              onClick={() => addGroupToDraft(profile.id)}
                              className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-800"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      ) : profile.groups.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {profile.groups.map((group) => (
                            <span
                              key={`${profile.id}-${group}`}
                              className="rounded bg-slate-100 px-2 py-0.5 text-xs"
                            >
                              {group}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-500">No groups</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
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
                          className="w-full rounded border border-slate-300 px-2 py-1"
                        >
                          {AVAILABLE_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span>
                          {isAppRole(profile.ruolo)
                            ? ROLE_LABELS[profile.ruolo]
                            : profile.ruolo}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingId === profile.id ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => saveRow(profile.id)}
                            disabled={savingId === profile.id}
                            className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                          >
                            {savingId === profile.id ? "Saving..." : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={() => cancelEdit(profile.id)}
                            disabled={savingId === profile.id}
                            className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEdit(profile)}
                          className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-800"
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
