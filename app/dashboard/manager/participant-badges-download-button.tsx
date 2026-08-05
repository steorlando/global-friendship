"use client";

import { useState } from "react";

type ParticipantBadgesDownloadButtonProps = {
  idleLabel: string;
  loadingLabel: string;
  errorLabel: string;
};

function responseFileName(response: Response): string {
  const disposition = response.headers.get("content-disposition") ?? "";
  const match = disposition.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? "badge-partecipanti-global-friendship.pdf";
}

export function ParticipantBadgesDownloadButton({
  idleLabel,
  loadingLabel,
  errorLabel,
}: ParticipantBadgesDownloadButtonProps) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function downloadBadges() {
    if (state === "loading") return;
    setState("loading");

    try {
      const response = await fetch(
        "/api/manager/statistics/participant-badges",
        { credentials: "same-origin" },
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? `HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = responseFileName(response);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      setState("idle");
    } catch (error) {
      console.error("Participant badge download failed", error);
      setState("error");
    }
  }

  const label =
    state === "loading"
      ? loadingLabel
      : state === "error"
        ? errorLabel
        : idleLabel;

  return (
    <button
      type="button"
      onClick={downloadBadges}
      disabled={state === "loading"}
      className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 transition hover:border-blue-300 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
    >
      {state === "loading" ? (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-blue-300 border-t-blue-700"
        />
      ) : (
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          className="h-4 w-4"
        >
          <path
            d="M10 2.5v9m0 0 3.25-3.25M10 11.5 6.75 8.25M4 13.5v2A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5v-2"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {label}
    </button>
  );
}
