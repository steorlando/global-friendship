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
  city: string | null;
  country: string | null;
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

type HotelFormState = {
  id: string | null;
  name: string;
  city: string;
  country: string;
};

type RoomFormState = {
  id: string | null;
  hotelId: string;
  internalCode: string;
  realRoomNumber: string;
  capacity: string;
  genderPolicy: RoomGenderPolicy;
  availableFrom: string;
  availableTo: string;
};

const EMPTY_FORM: RoomFormState = {
  id: null,
  hotelId: "",
  internalCode: "",
  realRoomNumber: "",
  capacity: "1",
  genderPolicy: "mixed",
  availableFrom: "",
  availableTo: "",
};

const EMPTY_HOTEL_FORM: HotelFormState = {
  id: null,
  name: "",
  city: "",
  country: "",
};

const POLICY_OPTIONS: RoomGenderPolicy[] = ["mixed", "female_only", "male_only"];

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
    internalCode: room.internalCode,
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
    city: hotel.city ?? "",
    country: hotel.country ?? "",
  };
}

function formatHotelLocation(hotel: Hotel) {
  const parts = [hotel.city, hotel.country].map((value) => (value ?? "").trim()).filter(Boolean);
  return parts.join(", ");
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
    room.hotel?.city ?? "",
    room.hotel?.country ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalized);
}

export function AccommodationInventoryManager() {
  const { t, formatNumber } = useI18n();
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [hotelForm, setHotelForm] = useState<HotelFormState>(EMPTY_HOTEL_FORM);
  const [form, setForm] = useState<RoomFormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hotelSaving, setHotelSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingHotelId, setDeletingHotelId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hotelFilter, setHotelFilter] = useState("all");
  const [policyFilter, setPolicyFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
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
      setForm((current) => {
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
      const matchesSearch = roomMatchesSearch(room, deferredSearchTerm);
      return matchesHotel && matchesPolicy && matchesSearch;
    });
  }, [deferredSearchTerm, hotelFilter, policyFilter, rooms]);

  const sortedHotels = useMemo(
    () => [...hotels].sort((a, b) => a.name.localeCompare(b.name)),
    [hotels]
  );

  function resetForm() {
    setForm(buildEmptyForm(sortedHotels));
  }

  function resetHotelForm() {
    setHotelForm(EMPTY_HOTEL_FORM);
  }

  function startEditing(room: Room) {
    setError(null);
    setSuccess(null);
    setForm(toRoomFormState(room));
  }

  function cancelEditing() {
    resetForm();
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
      const method = form.id ? "PATCH" : "POST";
      const response = await fetch("/api/alloggi/rooms", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: form.id,
          hotelId: form.hotelId,
          internalCode: form.internalCode,
          realRoomNumber: form.realRoomNumber,
          capacity: form.capacity,
          genderPolicy: form.genderPolicy,
          availableFrom: form.availableFrom,
          availableTo: form.availableTo,
        }),
      });

      const json = (await response.json()) as RoomMutationResponse;
      if (!response.ok) {
        throw new Error(json.error || t("accommodation.inventory.status.saveError"));
      }

      await loadInventory();
      resetForm();
      setSuccess(
        form.id
          ? t("accommodation.inventory.status.roomUpdated")
          : t("accommodation.inventory.status.roomCreated")
      );
    } catch (submitError) {
      setError((submitError as Error).message);
    } finally {
      setSaving(false);
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
      if (form.id === room.id) {
        resetForm();
      }
      setSuccess(t("accommodation.inventory.status.roomDeleted"));
    } catch (deleteError) {
      setError((deleteError as Error).message);
    } finally {
      setDeletingId(null);
    }
  }

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
          city: hotelForm.city,
          country: hotelForm.country,
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

      <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {form.id
                    ? t("accommodation.inventory.form.editTitle")
                    : t("accommodation.inventory.form.createTitle")}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {t("accommodation.inventory.form.subtitle")}
                </p>
              </div>
              {form.id ? (
                <button
                  type="button"
                  onClick={cancelEditing}
                  className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  {t("accommodation.inventory.form.cancelEdit")}
                </button>
              ) : null}
            </div>

            {sortedHotels.length === 0 ? (
              <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {t("accommodation.inventory.form.noHotels")}
              </p>
            ) : (
              <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
                <label className="block text-sm font-medium text-slate-700">
                  {t("accommodation.inventory.form.hotel")}
                  <select
                    value={form.hotelId}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        hotelId: event.target.value,
                      }))
                    }
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
                  {t("accommodation.inventory.form.internalCode")}
                  <input
                    type="text"
                    value={form.internalCode}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        internalCode: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    placeholder="GF-A12"
                    required
                  />
                </label>

                <label className="block text-sm font-medium text-slate-700">
                  {t("accommodation.inventory.form.realRoomNumber")}
                  <input
                    type="text"
                    value={form.realRoomNumber}
                    onChange={(event) =>
                      setForm((current) => ({
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
                        setForm((current) => ({
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
                        setForm((current) => ({
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
                        setForm((current) => ({
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
                        setForm((current) => ({
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
                    {saving
                      ? t("accommodation.inventory.form.saving")
                      : form.id
                        ? t("accommodation.inventory.form.update")
                        : t("accommodation.inventory.form.create")}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                  >
                    {t("accommodation.inventory.form.reset")}
                  </button>
                </div>
              </form>
            )}
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
                    {t("accommodation.inventory.hotels.formCity")}
                    <input
                      type="text"
                      value={hotelForm.city}
                      onChange={(event) =>
                        setHotelForm((current) => ({
                          ...current,
                          city: event.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    />
                  </label>

                  <label className="block text-sm font-medium text-slate-700">
                    {t("accommodation.inventory.hotels.formCountry")}
                    <input
                      type="text"
                      value={hotelForm.country}
                      onChange={(event) =>
                        setHotelForm((current) => ({
                          ...current,
                          country: event.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
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
                        {formatHotelLocation(hotel) ? (
                          <p className="mt-1 text-sm text-slate-500">
                            {formatHotelLocation(hotel)}
                          </p>
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

          <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
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
                    <tr key={room.id} className="align-top">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-slate-900">{room.internalCode}</p>
                          {room.legacyName && room.legacyName !== room.internalCode ? (
                            <p className="mt-1 text-xs text-slate-500">{room.legacyName}</p>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <div>
                          <p className="font-medium text-slate-900">
                            {room.hotel?.name ?? "-"}
                          </p>
                          {room.hotel ? (
                            <p className="mt-1 text-xs text-slate-500">
                              {formatHotelLocation(room.hotel) || "-"}
                            </p>
                          ) : null}
                        </div>
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
    </section>
  );
}
