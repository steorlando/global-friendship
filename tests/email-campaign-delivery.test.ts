import assert from "node:assert/strict";
import test from "node:test";
import {
  getEmailDeliveryErrorDetails,
  redactEmailAddresses,
  sendEmailWithRetry,
} from "../lib/email/campaign-delivery.ts";

test("classifies temporary Gmail SMTP responses as retryable", () => {
  const error = Object.assign(new Error("421 4.7.0 Try again later"), {
    code: "EENVELOPE",
    responseCode: 421,
  });

  assert.deepEqual(getEmailDeliveryErrorDetails(error), {
    message: "421 4.7.0 Try again later",
    code: "EENVELOPE",
    responseCode: 421,
    transient: true,
  });
});

test("does not retry permanent SMTP recipient errors", () => {
  const error = Object.assign(new Error("550 5.1.1 User unknown"), {
    code: "EENVELOPE",
    responseCode: 550,
  });

  assert.equal(getEmailDeliveryErrorDetails(error).transient, false);
});

test("does not retry a permanent daily quota response", () => {
  const error = Object.assign(new Error("550 Daily user sending quota exceeded"), {
    responseCode: 550,
  });

  assert.equal(getEmailDeliveryErrorDetails(error).transient, false);
});

test("retries a temporary failure and then succeeds", async () => {
  let calls = 0;
  const sleeps: number[] = [];

  const result = await sendEmailWithRetry(
    async () => {
      calls += 1;
      if (calls === 1) {
        throw Object.assign(new Error("Temporary rate limit"), { responseCode: 421 });
      }
    },
    {
      retryDelaysMs: [5000, 15000],
      sleep: async (delayMs) => {
        sleeps.push(delayMs);
      },
    },
  );

  assert.deepEqual(result, { attempts: 2 });
  assert.equal(calls, 2);
  assert.deepEqual(sleeps, [5000]);
});

test("redacts recipient addresses before writing SMTP errors to runtime logs", () => {
  assert.equal(
    redactEmailAddresses("550 failed for Person.Name+tag@example.com"),
    "550 failed for [email redacted]",
  );
});
