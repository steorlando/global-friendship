"use client";

import {
  FormEvent,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { RoomGenderPolicy } from "@/lib/alloggi/inventory";
import { useI18n } from "@/lib/i18n/provider";

type Hotel = {
  id: string;
  name: string;
  address: string | null;
  googleMapsUrl: string | null;
  createdAt: string;
  roomCount: number;
};

type Room = {
  id: string;
  hotelId: string;
  hotel: Hotel | null;
  legacyName: string;
  internalCode: string;
  realRoomNumber: string | null;
  capacity: number;
  genderPolicy: RoomGenderPolicy;
  availableFrom: string | null;
  availableTo: string | null;
  createdAt: string;
  updatedAt: string;
  assignedGroupCount: number;
  assignedParticipantCount: number;
};

type RoomsResponse = {
  rooms?: Room[];
  error?: string;
};

type HotelsResponse = {
  hotels?: Hotel[];
  error?: string;
};

type HotelMutationResponse = {
  ok?: boolean;
  hotel?: Hotel;
  id?: string;
  error?: string;
};

type RoomMutationResponse = {
  ok?: boolean;
  room?: Room;
  id?: string;
  error?: string;
};

type RoomImportResponse = {
  ok?: boolean;
  rooms?: Room[];
  importedCount?: number;
  error?: string;
};

type RoomOccupant = {
  participantId: string;
  firstName: string | null;
  lastName: string | null;
  groupName: string | null;
};

type RoomOccupantsResponse = {
  occupants?: RoomOccupant[];
  error?: string;
};

type HotelFormState = {
  id: string | null;
  name: string;
  address: string;
  googleMapsUrl: string;
};

type RoomFormState = {
  id: string | null;
  hotelId: string;
  realRoomNumber: string;
  capacity: string;
  genderPolicy: RoomGenderPolicy;
  availableFrom: string;
  availableTo: string;
};

const EMPTY_FORM: RoomFormState = {
  id: null,
  hotelId: "",
  realRoomNumber: "",
  capacity: "1",
  genderPolicy: "mixed",
  availableFrom: "",
  availableTo: "",
};

const EMPTY_HOTEL_FORM: HotelFormState = {
  id: null,
  name: "",
  address: "",
  googleMapsUrl: "",
};

const POLICY_OPTIONS: RoomGenderPolicy[] = ["mixed", "female_only", "male_only"];
const OCCUPANCY_FILTERS = ["all", "empty", "partial"] as const;
type OccupancyFilter = (typeof OCCUPANCY_FILTERS)[number];

type RoomFormCardProps = {
  title: string;
  subtitle: string;
  hotels: Hotel[];
  rooms: Room[];
  form: RoomFormState;
  saving: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onChange: (updater: (current: RoomFormState) => RoomFormState) => void;
  onReset: () => void;
  submitLabel: string;
  resetLabel: string;
  savingLabel: string;
  cancelLabel?: string;
  onCancel?: () => void;
  t: (key: string) => string;
};

function buildEmptyForm(hotels: Hotel[]): RoomFormState {
  return {
    ...EMPTY_FORM,
    hotelId: hotels[0]?.id ?? "",
  };
}

function toRoomFormState(room: Room): RoomFormState {
  return {
    id: room.id,
    hotelId: room.hotelId,
    realRoomNumber: room.realRoomNumber ?? "",
    capacity: String(room.capacity),
    genderPolicy: room.genderPolicy,
    availableFrom: room.availableFrom ?? "",
    availableTo: room.availableTo ?? "",
  };
}

function toHotelFormState(hotel: Hotel): HotelFormState {
  return {
    id: hotel.id,
    name: hotel.name,
    address: hotel.address ?? "",
    googleMapsUrl: hotel.googleMapsUrl ?? "",
  };
}

function formatHotelAddress(hotel: Hotel) {
  return (hotel.address ?? "").trim();
}

function formatAvailability(room: Room) {
  if (room.availableFrom && room.availableTo) {
    return `${room.availableFrom} -> ${room.availableTo}`;
  }
  if (room.availableFrom) {
    return `${room.availableFrom} ->`;
  }
  if (room.availableTo) {
    return `-> ${room.availableTo}`;
  }
  return "-";
}

function roomMatchesSearch(room: Room, searchTerm: string) {
  const normalized = searchTerm.trim().toLowerCase();
  if (!normalized) return true;

  const haystack = [
    room.internalCode,
    room.realRoomNumber ?? "",
    room.hotel?.name ?? "",
    room.hotel?.address ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalized);
}

function buildRoomInventoryRowClasses(room: Room): string {
  if (room.assignedParticipantCount <= 0) {
    return "bg-white";
  }

  if (room.assignedParticipantCount >= room.capacity) {
    return "bg-emerald-50";
  }

  return "bg-amber-50";
}

function RoomFormCard({
  title,
  subtitle,
  hotels,
  rooms,
  form,
  saving,
  onSubmit,
  onChange,
  onReset,
  submitLabel,
  resetLabel,
  savingLabel,
  cancelLabel,
  onCancel,
  t,
}: RoomFormCardProps) {
  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        {onCancel && cancelLabel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            {cancelLabel}
          </button>
        ) : null}
      </div>

      {hotels.length === 0 ? (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t("accommodation.inventory.form.noHotels")}
        </p>
      ) : (
        <form className="mt-5 space-y-4" onSubmit={onSubmit}>
          <label className="block text-sm font-medium text-slate-700">
            {t("accommodation.inventory.form.hotel")}
            <select
              value={form.hotelId}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  hotelId: event.target.value,
                }))
              }
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              required
            >
              {hotels.map((hotel) => (
                <option key={hotel.id} value={hotel.id}>
                  {hotel.name}
                </option>
              ))}
            </select>
          </label>

          {form.id ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                {t("accommodation.inventory.form.currentInternalCode")}
              </p>
              <p className="mt-2 text-sm font-medium text-slate-900">
                {rooms.find((room) => room.id === form.id)?.internalCode ?? "-"}
              </p>
            </div>
          ) : (
            <p className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
              {t("accommodation.inventory.form.internalCodeGenerated")}
            </p>
          )}

          <label className="block text-sm font-medium text-slate-700">
            {t("accommodation.inventory.form.realRoomNumber")}
            <input
              type="text"
              value={form.realRoomNumber}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  realRoomNumber: event.target.value,
                }))
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              placeholder={t("accommodation.inventory.form.realRoomNumberPlaceholder")}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              {t("accommodation.inventory.form.capacity")}
              <input
                type="number"
                min="1"
                step="1"
                value={form.capacity}
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    capacity: event.target.value,
                  }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                required
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              {t("accommodation.inventory.form.genderPolicy")}
              <select
                value={form.genderPolicy}
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    genderPolicy: event.target.value as RoomGenderPolicy,
                  }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              >
                {POLICY_OPTIONS.map((policy) => (
                  <option key={policy} value={policy}>
                    {t(`accommodation.inventory.policy.${policy}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              {t("accommodation.inventory.form.availableFrom")}
              <input
                type="date"
                value={form.availableFrom}
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    availableFrom: event.target.value,
                  }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              {t("accommodation.inventory.form.availableTo")}
              <input
                type="date"
                value={form.availableTo}
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    availableTo: event.target.value,
                  }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? savingLabel : submitLabel}
            </button>
            <button
              type="button"
              onClick={onReset}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              {resetLabel}
            </button>
          </div>
        </form>
      )}
    </>
  );
}

export function AccommodationInventoryManager() {
  const { t, formatNumber } = useI18n();
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [hotelForm, setHotelForm] = useState<HotelFormState>(EMPTY_HOTEL_FORM);
  const [createForm, setCreateForm] = useState<RoomFormState>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<RoomFormState | null>(null);
  const [importHotelId, setImportHotelId] = useState("");
  const [importGenderPolicy, setImportGenderPolicy] =
    useState<RoomGenderPolicy>("mixed");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importInputResetKey, setImportInputResetKey] = useState(0);
  const [importing, setImporting] = useState(false);
  const [showImportHelp, setShowImportHelp] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [occupantsLoading, setOccupantsLoading] = useState(false);
  const [hotelSaving, setHotelSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingHotelId, setDeletingHotelId] = useState<string | null>(null);
  const [removingOccupantId, setRemovingOccupantId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hotelFilter, setHotelFilter] = useState("all");
  const [policyFilter, setPolicyFilter] = useState("all");
  const [occupancyFilter, setOccupancyFilter] = useState<OccupancyFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [editRoomOccupants, setEditRoomOccupants] = useState<RoomOccupant[]>([]);
  const deferredSearchTerm = useDeferredValue(searchTerm);

  const loadInventory = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [hotelsRes, roomsRes] = await Promise.all([
        fetch("/api/alloggi/hotels", { cache: "no-store" }),
        fetch("/api/alloggi/rooms", { cache: "no-store" }),
      ]);

      const hotelsJson = (await hotelsRes.json()) as HotelsResponse;
      const roomsJson = (await roomsRes.json()) as RoomsResponse;

      if (!hotelsRes.ok) {
        throw new Error(hotelsJson.error || t("accommodation.inventory.status.loadError"));
      }

      if (!roomsRes.ok) {
        throw new Error(roomsJson.error || t("accommodation.inventory.status.loadError"));
      }

      const nextHotels = hotelsJson.hotels ?? [];
      const nextRooms = roomsJson.rooms ?? [];
      const nextHotelIds = new Set(nextHotels.map((hotel) => hotel.id));

      setHotels(nextHotels);
      setRooms(nextRooms);
      setHotelFilter((current) =>
        current !== "all" && !nextHotelIds.has(current) ? "all" : current
      );
      setImportHotelId((current) =>
        current && nextHotelIds.has(current) ? current : nextHotels[0]?.id ?? ""
      );
      setCreateForm((current) => {
        if (current.hotelId && nextHotelIds.has(current.hotelId)) return current;
        return {
          ...current,
          hotelId: nextHotels[0]?.id ?? "",
        };
      });
      setEditForm((current) => {
        if (!current) return null;
        if (current.hotelId && nextHotelIds.has(current.hotelId)) return current;
        return {
          ...current,
          hotelId: nextHotels[0]?.id ?? "",
        };
      });
      setHotelForm((current) => {
        if (current.id && !nextHotelIds.has(current.id)) {
          return EMPTY_HOTEL_FORM;
        }
        return current;
      });
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  const summary = useMemo(() => {
    const totalCapacity = rooms.reduce((sum, room) => sum + room.capacity, 0);
    const assignedParticipants = rooms.reduce(
      (sum, room) => sum + room.assignedParticipantCount,
      0
    );
    return {
      hotelCount: hotels.length,
      roomCount: rooms.length,
      totalCapacity,
      assignedParticipants,
    };
  }, [hotels.length, rooms]);

  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      const matchesHotel = hotelFilter === "all" || room.hotelId === hotelFilter;
      const matchesPolicy = policyFilter === "all" || room.genderPolicy === policyFilter;
      const matchesOccupancy =
        occupancyFilter === "all" ||
        (occupancyFilter === "empty" && room.assignedParticipantCount === 0) ||
        (occupancyFilter === "partial" &&
          room.assignedParticipantCount > 0 &&
          room.assignedParticipantCount < room.capacity);
      const matchesSearch = roomMatchesSearch(room, deferredSearchTerm);
      return matchesHotel && matchesPolicy && matchesOccupancy && matchesSearch;
    });
  }, [deferredSearchTerm, hotelFilter, occupancyFilter, policyFilter, rooms]);

  const sortedHotels = useMemo(
    () => [...hotels].sort((a, b) => a.name.localeCompare(b.name)),
    [hotels]
  );

  function resetForm() {
    setCreateForm(buildEmptyForm(sortedHotels));
  }

  function resetEditForm() {
    setEditForm(null);
  }

  function resetHotelForm() {
    setHotelForm(EMPTY_HOTEL_FORM);
  }

  function startEditing(room: Room) {
    setError(null);
    setSuccess(null);
    setEditForm(toRoomFormState(room));
  }

  function cancelEditing() {
    resetEditForm();
    setEditRoomOccupants([]);
  }

  function startEditingHotel(hotel: Hotel) {
    setError(null);
    setSuccess(null);
    setHotelForm(toHotelFormState(hotel));
  }

  function cancelHotelEditing() {
    resetHotelForm();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const method = "POST";
      const response = await fetch("/api/alloggi/rooms", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotelId: createForm.hotelId,
          realRoomNumber: createForm.realRoomNumber,
          capacity: createForm.capacity,
          genderPolicy: createForm.genderPolicy,
          availableFrom: createForm.availableFrom,
          availableTo: createForm.availableTo,
        }),
      });

      const json = (await response.json()) as RoomMutationResponse;
      if (!response.ok) {
        throw new Error(json.error || t("accommodation.inventory.status.saveError"));
      }

      await loadInventory();
      resetForm();
      setSuccess(t("accommodation.inventory.status.roomCreated"));
    } catch (submitError) {
      setError((submitError as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editForm?.id) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/alloggi/rooms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editForm.id,
          hotelId: editForm.hotelId,
          realRoomNumber: editForm.realRoomNumber,
          capacity: editForm.capacity,
          genderPolicy: editForm.genderPolicy,
          availableFrom: editForm.availableFrom,
          availableTo: editForm.availableTo,
        }),
      });

      const json = (await response.json()) as RoomMutationResponse;
      if (!response.ok) {
        throw new Error(json.error || t("accommodation.inventory.status.saveError"));
      }

      await loadInventory();
      resetEditForm();
      setSuccess(t("accommodation.inventory.status.roomUpdated"));
    } catch (submitError) {
      setError((submitError as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleImportSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!importFile) {
      setError(t("accommodation.inventory.import.fileRequired"));
      setSuccess(null);
      return;
    }

    setImporting(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.set("hotelId", importHotelId);
      formData.set("genderPolicy", importGenderPolicy);
      formData.set("file", importFile);

      const response = await fetch("/api/alloggi/rooms/import", {
        method: "POST",
        body: formData,
      });

      const json = (await response.json()) as RoomImportResponse;
      if (!response.ok) {
        throw new Error(json.error || t("accommodation.inventory.import.importError"));
      }

      await loadInventory();
      setImportFile(null);
      setImportInputResetKey((current) => current + 1);
      setSuccess(
        t("accommodation.inventory.import.imported", {
          count: json.importedCount ?? 0,
        })
      );
    } catch (importError) {
      setError((importError as Error).message);
    } finally {
      setImporting(false);
    }
  }

  async function handleDelete(room: Room) {
    const confirmed = window.confirm(t("accommodation.inventory.actions.deleteConfirm"));
    if (!confirmed) return;

    setDeletingId(room.id);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/alloggi/rooms", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: room.id }),
      });

      const json = (await response.json()) as RoomMutationResponse;
      if (!response.ok) {
        throw new Error(json.error || t("accommodation.inventory.status.deleteError"));
      }

      await loadInventory();
      if (editForm?.id === room.id) {
        resetEditForm();
      }
      setSuccess(t("accommodation.inventory.status.roomDeleted"));
    } catch (deleteError) {
      setError((deleteError as Error).message);
    } finally {
      setDeletingId(null);
    }
  }

  const loadRoomOccupants = useCallback(async (roomId: string) => {
    setOccupantsLoading(true);

    try {
      const response = await fetch(
        `/api/alloggi/rooms/occupants?roomId=${encodeURIComponent(roomId)}`,
        { cache: "no-store" }
      );
      const json = (await response.json()) as RoomOccupantsResponse;
      if (!response.ok) {
        throw new Error(json.error || t("accommodation.inventory.form.occupantsLoadError"));
      }
      setEditRoomOccupants(json.occupants ?? []);
    } catch (loadError) {
      setError((loadError as Error).message);
      setEditRoomOccupants([]);
    } finally {
      setOccupantsLoading(false);
    }
  }, [t]);

  async function handleRemoveOccupant(participantId: string) {
    if (!editForm?.id) return;

    setRemovingOccupantId(participantId);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/alloggi/room-assignments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId,
          roomId: null,
        }),
      });

      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(json.error || t("accommodation.inventory.form.removeOccupantError"));
      }

      await Promise.all([loadInventory(), loadRoomOccupants(editForm.id)]);
      setSuccess(t("accommodation.inventory.form.occupantRemoved"));
    } catch (removeError) {
      setError((removeError as Error).message);
    } finally {
      setRemovingOccupantId(null);
    }
  }

  useEffect(() => {
    if (!editForm?.id) return;
    void loadRoomOccupants(editForm.id);
  }, [editForm?.id, loadRoomOccupants]);

  async function handleHotelSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setHotelSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const method = hotelForm.id ? "PATCH" : "POST";
      const response = await fetch("/api/alloggi/hotels", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: hotelForm.id,
          name: hotelForm.name,
          address: hotelForm.address,
          googleMapsUrl: hotelForm.googleMapsUrl,
        }),
      });

      const json = (await response.json()) as HotelMutationResponse;
      if (!response.ok) {
        throw new Error(json.error || t("accommodation.inventory.hotels.saveError"));
      }

      await loadInventory();
      resetHotelForm();
      setSuccess(
        hotelForm.id
          ? t("accommodation.inventory.hotels.updated")
          : t("accommodation.inventory.hotels.created")
      );
    } catch (submitError) {
      setError((submitError as Error).message);
    } finally {
      setHotelSaving(false);
    }
  }

  async function handleHotelDelete(hotel: Hotel) {
    const confirmed = window.confirm(
      t("accommodation.inventory.hotels.deleteConfirm")
    );
    if (!confirmed) return;

    setDeletingHotelId(hotel.id);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/alloggi/hotels", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: hotel.id }),
      });

      const json = (await response.json()) as HotelMutationResponse;
      if (!response.ok) {
        throw new Error(json.error || t("accommodation.inventory.hotels.deleteError"));
      }

      await loadInventory();
      if (hotelForm.id === hotel.id) {
        resetHotelForm();
      }
      setSuccess(t("accommodation.inventory.hotels.deleted"));
    } catch (deleteError) {
      setError((deleteError as Error).message);
    } finally {
      setDeletingHotelId(null);
    }
  }

  return (
    <section className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {t("accommodation.inventory.summary.hotels")}
          </p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {formatNumber(summary.hotelCount)}
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {t("accommodation.inventory.summary.rooms")}
          </p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {formatNumber(summary.roomCount)}
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {t("accommodation.inventory.summary.capacity")}
          </p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {formatNumber(summary.totalCapacity)}
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {t("accommodation.inventory.summary.assigned")}
          </p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {formatNumber(summary.assignedParticipants)}
          </p>
        </article>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {success ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </p>
      ) : null}

      {editForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <RoomFormCard
              title={t("accommodation.inventory.form.editTitle")}
              subtitle={t("accommodation.inventory.form.subtitle")}
              hotels={sortedHotels}
              rooms={rooms}
              form={editForm}
              saving={saving}
              onSubmit={handleEditSubmit}
              onChange={(updater) => setEditForm((current) => (current ? updater(current) : current))}
              onReset={() =>
                setEditForm((current) => {
                  if (!current) return current;
                  const room = rooms.find((item) => item.id === current.id);
                  return room ? toRoomFormState(room) : current;
                })
              }
              submitLabel={t("accommodation.inventory.form.update")}
              resetLabel={t("accommodation.inventory.form.reset")}
              savingLabel={t("accommodation.inventory.form.saving")}
              cancelLabel={t("accommodation.inventory.form.cancelEdit")}
              onCancel={cancelEditing}
              t={t}
            />

            <section className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  {t("accommodation.inventory.form.occupantsTitle")}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  {t("accommodation.inventory.form.occupantsSubtitle")}
                </p>
              </div>

              {occupantsLoading ? (
                <p className="mt-4 text-sm text-slate-500">{t("common.loading")}</p>
              ) : editRoomOccupants.length === 0 ? (
                <p className="mt-4 rounded-lg border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
                  {t("accommodation.inventory.form.occupantsEmpty")}
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {editRoomOccupants.map((occupant) => (
                    <li
                      key={occupant.participantId}
                      className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3"
                    >
                      <div>
                        <p className="font-medium text-slate-900">
                          {[occupant.firstName, occupant.lastName].filter(Boolean).join(" ") || "-"}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {occupant.groupName || "-"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleRemoveOccupant(occupant.participantId)}
                        disabled={removingOccupantId === occupant.participantId}
                        className="rounded-full border border-rose-200 px-3 py-1 text-xs font-medium text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {removingOccupantId === occupant.participantId
                          ? t("accommodation.inventory.form.removingOccupant")
                          : t("accommodation.inventory.form.removeOccupant")}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {t("accommodation.inventory.import.title")}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {t("accommodation.inventory.import.subtitle")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowImportHelp(true)}
                className="text-xs font-medium text-indigo-700 underline-offset-2 hover:text-indigo-600 hover:underline"
              >
                {t("accommodation.inventory.import.instructionsLink")}
              </button>
            </div>

            {sortedHotels.length === 0 ? (
              <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {t("accommodation.inventory.form.noHotels")}
              </p>
            ) : (
              <form className="mt-5 space-y-4" onSubmit={handleImportSubmit}>
                <label className="block text-sm font-medium text-slate-700">
                  {t("accommodation.inventory.import.hotel")}
                  <select
                    value={importHotelId}
                    onChange={(event) => setImportHotelId(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    required
                  >
                    {sortedHotels.map((hotel) => (
                      <option key={hotel.id} value={hotel.id}>
                        {hotel.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm font-medium text-slate-700">
                  {t("accommodation.inventory.import.genderPolicy")}
                  <select
                    value={importGenderPolicy}
                    onChange={(event) =>
                      setImportGenderPolicy(event.target.value as RoomGenderPolicy)
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  >
                    {POLICY_OPTIONS.map((policy) => (
                      <option key={policy} value={policy}>
                        {t(`accommodation.inventory.policy.${policy}`)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm font-medium text-slate-700">
                  {t("accommodation.inventory.import.file")}
                  <input
                    key={importInputResetKey}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(event) =>
                      setImportFile(event.target.files?.[0] ?? null)
                    }
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 file:mr-4 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
                    required
                  />
                </label>

                <div className="flex flex-wrap gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={importing}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {importing
                      ? t("accommodation.inventory.import.importing")
                      : t("accommodation.inventory.import.submit")}
                  </button>
                </div>
              </form>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <RoomFormCard
              title={t("accommodation.inventory.form.createTitle")}
              subtitle={t("accommodation.inventory.form.subtitle")}
              hotels={sortedHotels}
              rooms={rooms}
              form={createForm}
              saving={saving}
              onSubmit={handleSubmit}
              onChange={(updater) => setCreateForm((current) => updater(current))}
              onReset={resetForm}
              submitLabel={t("accommodation.inventory.form.create")}
              resetLabel={t("accommodation.inventory.form.reset")}
              savingLabel={t("accommodation.inventory.form.saving")}
              t={t}
            />
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {t("accommodation.inventory.hotels.title")}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {t("accommodation.inventory.hotels.subtitle")}
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {formatNumber(sortedHotels.length)}
              </span>
            </div>

            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    {hotelForm.id
                      ? t("accommodation.inventory.hotels.editTitle")
                      : t("accommodation.inventory.hotels.createTitle")}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {t("accommodation.inventory.hotels.formSubtitle")}
                  </p>
                </div>
                {hotelForm.id ? (
                  <button
                    type="button"
                    onClick={cancelHotelEditing}
                    className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-white"
                  >
                    {t("accommodation.inventory.form.cancelEdit")}
                  </button>
                ) : null}
              </div>

              <form className="mt-4 space-y-3" onSubmit={handleHotelSubmit}>
                <label className="block text-sm font-medium text-slate-700">
                  {t("accommodation.inventory.hotels.formName")}
                  <input
                    type="text"
                    value={hotelForm.name}
                    onChange={(event) =>
                      setHotelForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    placeholder="Hotel Roma Centro"
                    required
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-slate-700">
                    {t("accommodation.inventory.hotels.formAddress")}
                    <input
                      type="text"
                      value={hotelForm.address}
                      onChange={(event) =>
                        setHotelForm((current) => ({
                          ...current,
                          address: event.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    />
                  </label>

                  <label className="block text-sm font-medium text-slate-700">
                    {t("accommodation.inventory.hotels.formGoogleMaps")}
                    <input
                      type="url"
                      value={hotelForm.googleMapsUrl}
                      onChange={(event) =>
                        setHotelForm((current) => ({
                          ...current,
                          googleMapsUrl: event.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                      placeholder="https://maps.google.com/..."
                    />
                  </label>
                </div>

                <div className="flex flex-wrap gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={hotelSaving}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {hotelSaving
                      ? t("accommodation.inventory.form.saving")
                      : hotelForm.id
                        ? t("accommodation.inventory.hotels.update")
                        : t("accommodation.inventory.hotels.create")}
                  </button>
                  <button
                    type="button"
                    onClick={resetHotelForm}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-white"
                  >
                    {t("accommodation.inventory.form.reset")}
                  </button>
                </div>
              </form>
            </div>

            {sortedHotels.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">
                {t("accommodation.inventory.hotels.empty")}
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {sortedHotels.map((hotel) => (
                  <li
                    key={hotel.id}
                    className="rounded-lg border border-slate-200 px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">{hotel.name}</p>
                        {formatHotelAddress(hotel) ? (
                          <p className="mt-1 text-sm text-slate-500">
                            {formatHotelAddress(hotel)}
                          </p>
                        ) : null}
                        {hotel.googleMapsUrl ? (
                          <a
                            href={hotel.googleMapsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-flex text-xs font-medium text-indigo-700 underline-offset-2 hover:text-indigo-600 hover:underline"
                          >
                            {t("accommodation.inventory.hotels.googleMapsLink")}
                          </a>
                        ) : null}
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                        {hotel.roomCount} {t("accommodation.inventory.hotels.roomCount")}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => startEditingHotel(hotel)}
                        className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                      >
                        {t("common.edit")}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleHotelDelete(hotel)}
                        disabled={deletingHotelId === hotel.id || hotel.roomCount > 0}
                        className="rounded-full border border-rose-200 px-3 py-1 text-xs font-medium text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingHotelId === hotel.id
                          ? t("accommodation.inventory.actions.deleting")
                          : t("common.delete")}
                      </button>
                    </div>
                    {hotel.roomCount > 0 ? (
                      <p className="mt-2 text-xs text-slate-500">
                        {t("accommodation.inventory.hotels.deleteBlocked")}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {t("accommodation.inventory.rooms.title")}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {t("accommodation.inventory.rooms.subtitle")}
              </p>
            </div>
            <p className="text-sm text-slate-500">
              {t("accommodation.inventory.rooms.filteredCount", {
                shown: filteredRooms.length,
                total: rooms.length,
              })}
            </p>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <label className="block text-sm font-medium text-slate-700">
              {t("accommodation.inventory.filters.search")}
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                placeholder={t("accommodation.inventory.filters.searchPlaceholder")}
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              {t("accommodation.inventory.filters.hotel")}
              <select
                value={hotelFilter}
                onChange={(event) => setHotelFilter(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              >
                <option value="all">{t("common.all")}</option>
                {sortedHotels.map((hotel) => (
                  <option key={hotel.id} value={hotel.id}>
                    {hotel.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              {t("accommodation.inventory.filters.policy")}
              <select
                value={policyFilter}
                onChange={(event) => setPolicyFilter(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              >
                <option value="all">{t("common.all")}</option>
                {POLICY_OPTIONS.map((policy) => (
                  <option key={policy} value={policy}>
                    {t(`accommodation.inventory.policy.${policy}`)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              {t("accommodation.inventory.filters.occupancy")}
              <select
                value={occupancyFilter}
                onChange={(event) =>
                  setOccupancyFilter(event.target.value as OccupancyFilter)
                }
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              >
                {OCCUPANCY_FILTERS.map((filter) => (
                  <option key={filter} value={filter}>
                    {t(`accommodation.inventory.filters.occupancyOption.${filter}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {loading ? (
            <p className="mt-6 text-sm text-slate-500">{t("common.loading")}</p>
          ) : filteredRooms.length === 0 ? (
            <p className="mt-6 rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
              {t("accommodation.inventory.rooms.empty")}
            </p>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">
                      {t("accommodation.inventory.table.internalCode")}
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      {t("accommodation.inventory.table.hotel")}
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      {t("accommodation.inventory.table.realRoomNumber")}
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      {t("accommodation.inventory.table.capacity")}
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      {t("accommodation.inventory.table.policy")}
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      {t("accommodation.inventory.table.availability")}
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      {t("accommodation.inventory.table.groups")}
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      {t("accommodation.inventory.table.assigned")}
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      {t("accommodation.inventory.table.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredRooms.map((room) => (
                    <tr
                      key={room.id}
                      className={`align-top transition-colors ${buildRoomInventoryRowClasses(room)}`}
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-slate-900">{room.internalCode}</p>
                          {room.legacyName && room.legacyName !== room.internalCode ? (
                            <p className="mt-1 text-xs text-slate-500">{room.legacyName}</p>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <p className="font-medium text-slate-900">
                          {room.hotel?.name ?? "-"}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {room.realRoomNumber || "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{room.capacity}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {t(`accommodation.inventory.policy.${room.genderPolicy}`)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatAvailability(room)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {room.assignedGroupCount}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {room.assignedParticipantCount}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => startEditing(room)}
                            className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                          >
                            {t("common.edit")}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(room)}
                            disabled={deletingId === room.id}
                            className="rounded-full border border-rose-200 px-3 py-1 text-xs font-medium text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {deletingId === room.id
                              ? t("accommodation.inventory.actions.deleting")
                              : t("common.delete")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {showImportHelp ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="room-import-help-title"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="room-import-help-title"
                  className="text-lg font-semibold text-slate-900"
                >
                  {t("accommodation.inventory.import.helpTitle")}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {t("accommodation.inventory.import.helpSubtitle")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowImportHelp(false)}
                className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                {t("common.close")}
              </button>
            </div>

            <div className="mt-5 space-y-4 text-sm text-slate-700">
              <p>{t("accommodation.inventory.import.helpIntro")}</p>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">
                  {t("accommodation.inventory.import.helpColumnsTitle")}
                </p>
                <ul className="mt-3 list-disc space-y-2 pl-5">
                  <li>{t("accommodation.inventory.import.helpColumnCapacity")}</li>
                  <li>{t("accommodation.inventory.import.helpColumnRealRoom")}</li>
                  <li>{t("accommodation.inventory.import.helpColumnAvailableFrom")}</li>
                  <li>{t("accommodation.inventory.import.helpColumnAvailableTo")}</li>
                </ul>
              </div>

              <div className="rounded-lg border border-slate-200 p-4">
                <p className="font-semibold text-slate-900">
                  {t("accommodation.inventory.import.helpExampleTitle")}
                </p>
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600">
                        <th className="border border-slate-200 px-3 py-2">capienza</th>
                        <th className="border border-slate-200 px-3 py-2">numero_reale</th>
                        <th className="border border-slate-200 px-3 py-2">available_from</th>
                        <th className="border border-slate-200 px-3 py-2">available_to</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-slate-200 px-3 py-2">4</td>
                        <td className="border border-slate-200 px-3 py-2">203</td>
                        <td className="border border-slate-200 px-3 py-2">2026-08-27</td>
                        <td className="border border-slate-200 px-3 py-2">2026-08-31</td>
                      </tr>
                      <tr>
                        <td className="border border-slate-200 px-3 py-2">2</td>
                        <td className="border border-slate-200 px-3 py-2"></td>
                        <td className="border border-slate-200 px-3 py-2">2026-08-28</td>
                        <td className="border border-slate-200 px-3 py-2">2026-08-31</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
                <p>{t("accommodation.inventory.import.helpNotes")}</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
