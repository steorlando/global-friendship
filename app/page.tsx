"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const AUTH_KEYS = [
  "code",
  "token_hash",
  "token",
  "type",
  "error",
  "error_code",
  "error_description",
];

function hasAuthQuery(params: URLSearchParams): boolean {
  return AUTH_KEYS.some((key) => {
    const value = params.get(key);
    return Boolean(value && value.trim().length > 0);
  });
}

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    async function run() {
      const query = window.location.search ?? "";
      const hash = window.location.hash ?? "";
      const hasAuthInQuery = hasAuthQuery(new URLSearchParams(query));
      const hasAuthInHash = hasAuthQuery(
        new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash)
      );

      if (hasAuthInQuery || hasAuthInHash) {
        router.replace(`/auth/callback${query}${hash}`);
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        router.replace("/dashboard");
        return;
      }

      router.replace("/login");
    }

    run();
  }, [router]);

  return null;
}
