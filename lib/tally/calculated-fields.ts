export const GLOBAL_FRIENDSHIP_EVENT_DATE = "2026-08-28";

type CalculatedFieldInput = {
  arrival: Date | null;
  departure: Date | null;
  dataNascita: string | null;
};

type CalculatedFieldOutput = {
  giorniPermanenza: number | null;
  quotaTotale: number | null;
  eta: number | null;
  isMinorenne: boolean | null;
};

function parseDateOnlyUtc(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);
}

export function calcNights(
  arrival: Date | null,
  departure: Date | null
): number | null {
  if (!arrival || !departure) return null;
  const ms = departure.getTime() - arrival.getTime();
  if (ms <= 0) return null;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function calcQuotaTotale(giorniPermanenza: number | null): number | null {
  if (giorniPermanenza === null) return null;
  return giorniPermanenza >= 4 ? 235 : 200;
}

export function calcEtaAtEvent(
  dataNascita: string | null,
  eventDate: string = GLOBAL_FRIENDSHIP_EVENT_DATE
): number | null {
  if (!dataNascita) return null;

  const birth = parseDateOnlyUtc(dataNascita);
  const event = parseDateOnlyUtc(eventDate);
  if (!birth || !event) return null;
  if (event.getTime() < birth.getTime()) return null;

  let age = event.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = event.getUTCMonth() - birth.getUTCMonth();
  const dayDiff = event.getUTCDate() - birth.getUTCDate();
  const hadBirthday = monthDiff > 0 || (monthDiff === 0 && dayDiff >= 0);

  if (!hadBirthday) age -= 1;
  return age;
}

export function calcIsMinorenne(eta: number | null): boolean | null {
  if (eta === null) return null;
  return eta < 18;
}

export function computeParticipantCalculatedFields(
  input: CalculatedFieldInput
): CalculatedFieldOutput {
  const giorniPermanenza = calcNights(input.arrival, input.departure);
  const quotaTotale = calcQuotaTotale(giorniPermanenza);
  const eta = calcEtaAtEvent(input.dataNascita);
  const isMinorenne = calcIsMinorenne(eta);

  return {
    giorniPermanenza,
    quotaTotale,
    eta,
    isMinorenne,
  };
}
