export function toursArePublicFromApiPayload(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;

  const settings = (payload as { settings?: unknown }).settings;
  if (!settings || typeof settings !== "object") return false;

  return (settings as { publicEnabled?: unknown }).publicEnabled === true;
}
