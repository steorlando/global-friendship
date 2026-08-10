import { createClient } from "@supabase/supabase-js";

type SupabaseServiceClientOptions = {
  noStore?: boolean;
};

export function createSupabaseServiceClient(
  options: SupabaseServiceClientOptions = {}
) {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: options.noStore
      ? {
          fetch: (input, init) =>
            fetch(input, {
              ...init,
              cache: "no-store",
            }),
        }
      : undefined,
  });
}
