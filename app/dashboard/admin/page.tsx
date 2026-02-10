import Link from "next/link";

export default function AdminDashboardPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Dashboard Admin</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Sei loggato come admin.
      </p>

      <div className="mt-6 rounded border border-neutral-200 p-4">
        <h2 className="text-base font-medium">Azioni</h2>
        <div className="mt-3 flex flex-col gap-2 text-sm">
          <Link className="text-blue-600 hover:underline" href="/dashboard/capogruppo">
            Vai alla dashboard capogruppo
          </Link>
          <Link className="text-blue-600 hover:underline" href="/dashboard/partecipante">
            Vai alla dashboard partecipante
          </Link>
        </div>
      </div>
    </main>
  );
}
