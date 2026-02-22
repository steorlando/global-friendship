"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const LOCAL_STORAGE_KEYS_TO_CLEAR = ["gf_requested_role", "gf_participant_id"];

export function LogoutButton() {
  const [signingOut, setSigningOut] = useState(false);

  async function handleLogout() {
    if (signingOut) return;
    setSigningOut(true);

    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
    } catch {
      // Continue with local cleanup and redirect even if signOut fails.
    } finally {
      for (const key of LOCAL_STORAGE_KEYS_TO_CLEAR) {
        window.localStorage.removeItem(key);
      }
      window.location.replace("/login");
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={signingOut}
      className="rounded-full border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition-all duration-200 hover:border-red-500 hover:bg-red-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
    >
      {signingOut ? "Signing out..." : "Log out"}
    </button>
  );
}
