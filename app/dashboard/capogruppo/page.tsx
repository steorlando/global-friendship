import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

function requireEnv(name: "SUPABASE_URL" | "SUPABASE_ANON_KEY") {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables."
    );
  }
  return value;
}

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SUPABASE_ANON_KEY = requireEnv("SUPABASE_ANON_KEY");

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
        <h1 className="text-2xl font-semibold">Dashboard Capogruppo</h1>
        <p className="mt-4 text-sm text-neutral-600">
          Devi effettuare il login per vedere i partecipanti del tuo gruppo.
        </p>
      </main>
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
      <h1 className="text-2xl font-semibold">Dashboard Capogruppo</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Partecipanti del tuo gruppo
      </p>

      {error ? (
        <div className="mt-6 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Errore nel caricamento: {error.message}
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded border border-neutral-200">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-neutral-50 text-neutral-700">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Cognome</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Gruppo</th>
                <th className="px-4 py-3">Giorni</th>
                <th className="px-4 py-3">Quota</th>
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
