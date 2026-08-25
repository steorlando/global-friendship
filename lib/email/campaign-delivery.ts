export type EmailDeliveryErrorDetails = {
  message: string;
  code: string | null;
  responseCode: number | null;
  transient: boolean;
};

type RetryOptions = {
  retryDelaysMs: readonly number[];
  waitForStart?: () => Promise<void>;
  sleep?: (delayMs: number) => Promise<void>;
};

type ErrorWithSmtpDetails = Error & {
  code?: unknown;
  responseCode?: unknown;
  response?: unknown;
};

const TRANSIENT_ERROR_CODES = new Set([
  "EAI_AGAIN",
  "ECONNECTION",
  "ECONNRESET",
  "ENETDOWN",
  "ENETUNREACH",
  "ESOCKET",
  "ETIMEDOUT",
]);

function normalizeErrorCode(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim().toUpperCase() : null;
}

function normalizeResponseCode(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d{3}$/.test(value.trim())) {
    return Number(value.trim());
  }
  return null;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return "Send failed";
}

export function getEmailDeliveryErrorDetails(error: unknown): EmailDeliveryErrorDetails {
  const smtpError = error instanceof Error ? (error as ErrorWithSmtpDetails) : null;
  const message = errorMessage(error);
  const code = normalizeErrorCode(smtpError?.code);
  const responseCode = normalizeResponseCode(smtpError?.responseCode);
  const searchable = `${message} ${String(smtpError?.response ?? "")}`.toLowerCase();
  const messageSuggestsTransient =
    searchable.includes("temporar") ||
    searchable.includes("rate limit") ||
    searchable.includes("try again") ||
    searchable.includes("too many") ||
    searchable.includes("quota");
  const transient =
    (responseCode !== null && responseCode >= 400 && responseCode < 500) ||
    (code !== null && TRANSIENT_ERROR_CODES.has(code)) ||
    (responseCode === null && messageSuggestsTransient);

  return { message, code, responseCode, transient };
}

function defaultSleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

export function createEmailSendStartThrottle(
  minimumIntervalMs: number,
  sleep: (delayMs: number) => Promise<void> = defaultSleep,
): () => Promise<void> {
  let nextStartAt = 0;
  let queue = Promise.resolve();

  return async () => {
    const scheduled = queue.then(async () => {
      const delayMs = Math.max(0, nextStartAt - Date.now());
      if (delayMs > 0) await sleep(delayMs);
      nextStartAt = Date.now() + Math.max(0, minimumIntervalMs);
    });
    queue = scheduled.catch(() => undefined);
    await scheduled;
  };
}

export async function sendEmailWithRetry(
  send: () => Promise<void>,
  options: RetryOptions,
): Promise<{ attempts: number }> {
  const sleep = options.sleep ?? defaultSleep;
  let attempts = 0;

  while (true) {
    attempts += 1;
    if (options.waitForStart) await options.waitForStart();

    try {
      await send();
      return { attempts };
    } catch (error) {
      const details = getEmailDeliveryErrorDetails(error);
      const retryDelayMs = options.retryDelaysMs[attempts - 1];
      if (!details.transient || retryDelayMs === undefined) throw error;
      await sleep(retryDelayMs);
    }
  }
}

export function redactEmailAddresses(value: string): string {
  return value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email redacted]");
}
