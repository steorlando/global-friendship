import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = (await searchParams) ?? {};

  const authKeys = [
    "code",
    "token_hash",
    "token",
    "type",
    "error",
    "error_code",
    "error_description",
  ] as const;

  const hasAuthParams = authKeys.some((key) => Boolean(firstValue(params[key])));
  if (hasAuthParams) {
    const forward = new URLSearchParams();
    for (const key of authKeys) {
      const value = firstValue(params[key]);
      if (value) forward.set(key, value);
    }
    const query = forward.toString();
    redirect(query ? `/auth/callback?${query}` : "/auth/callback");
  }

  redirect("/login");
}
