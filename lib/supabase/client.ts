import { createBrowserClient } from "@supabase/ssr";

function getSupabaseStorageKey(url: string): string | null {
  try {
    const projectRef = new URL(url).hostname.split(".")[0];
    return projectRef ? `sb-${projectRef}-auth-token` : null;
  } catch {
    return null;
  }
}

export function clearSupabaseBrowserSessionStorage() {
  if (typeof window === "undefined") return;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return;

  const storageKey = getSupabaseStorageKey(url);
  if (!storageKey) return;

  window.localStorage.removeItem(storageKey);
  window.localStorage.removeItem(`${storageKey}-code-verifier`);
  window.localStorage.removeItem(`${storageKey}-user`);
}

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  return createBrowserClient(url, key, {
    auth: {
      flowType: "pkce",
    },
  });
}
