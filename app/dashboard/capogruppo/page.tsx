import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

function getSupabaseEnv() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  return { url, anonKey };
}

async function getAccessTokenFromCookies() {
  const store = await cookies();
  const direct = store.get("sb-access-token")?.value;
  if (direct) return direct;

  const authCookie = store
    .getAll()
    .find(
      (c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token")
    );

  if (!authCookie) return null;

  try {
    const parsed = JSON.parse(authCookie.value);
    return parsed?.access_token ?? null;
  } catch {
    return null;
  }
}

export default async function CapogruppoPage() {
  const accessToken = await getAccessTokenFromCookies();

  if (!accessToken) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold">Group Leader Dashboard</h1>
        <p className="mt-4 text-sm text-neutral-600">
          Please sign in to view participants in your group.
        </p>
      </main>
    );
  }

  const { url, anonKey } = getSupabaseEnv();
  if (!url || !anonKey) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold">Group Leader Dashboard</h1>
        <p className="mt-4 text-sm text-neutral-600">
          Missing configuration: set SUPABASE_URL and SUPABASE_ANON_KEY.
        </p>
      </main>
    );
  }

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const { data, error } = await supabase
    .from("partecipanti")
    .select(
      "id,nome,cognome,email,gruppo_id,giorni_permanenza,quota_totale,albergo_id,stanza_id"
    )
    .order("cognome", { ascending: true });

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Group Leader Dashboard</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Participants in your group
      </p>

      {error ? (
        <div className="mt-6 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Loading error: {error.message}
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded border border-neutral-200">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-neutral-50 text-neutral-700">
              <tr>
                <th className="px-4 py-3">First Name</th>
                <th className="px-4 py-3">Last Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Group</th>
                <th className="px-4 py-3">Days</th>
                <th className="px-4 py-3">Fee</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((p) => (
                <tr key={p.id} className="border-t border-neutral-100">
                  <td className="px-4 py-3">{p.nome}</td>
                  <td className="px-4 py-3">{p.cognome}</td>
                  <td className="px-4 py-3">{p.email}</td>
                  <td className="px-4 py-3">{p.gruppo_id ?? "-"}</td>
                  <td className="px-4 py-3">{p.giorni_permanenza}</td>
                  <td className="px-4 py-3">€ {p.quota_totale}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
