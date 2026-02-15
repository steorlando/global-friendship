"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ROLE_ROUTES, isAppRole } from "@/lib/auth/roles";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Completing sign in...");

  useEffect(() => {
    let active = true;

    async function run() {
      const code = searchParams.get("code");
      const requestedRole = searchParams.get("role");
      const supabase = createSupabaseBrowserClient();

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          if (active) {
            setMessage("Authentication failed. Redirecting to login...");
          }
          router.replace("/login?error=auth");
          return;
        }
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login?error=auth");
        return;
      }

      const { data: profile } = await supabase
        .from("profili")
        .select("ruolo")
        .eq("id", user.id)
        .maybeSingle();

      const roleFromProfile = profile?.ruolo ?? null;
      const target = isAppRole(requestedRole)
        ? ROLE_ROUTES[requestedRole]
        : isAppRole(roleFromProfile)
          ? ROLE_ROUTES[roleFromProfile]
          : "/dashboard";

      router.replace(target);
    }

    run();

    return () => {
      active = false;
    };
  }, [router, searchParams]);

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <h1 className="text-2xl font-semibold">Signing In</h1>
      <p className="mt-2 text-sm text-neutral-600">{message}</p>
    </main>
  );
}
