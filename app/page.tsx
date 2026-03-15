import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const AUTH_KEYS = [
  "code",
  "token_hash",
  "token",
  "type",
  "error",
  "error_code",
  "error_description",
];

type HomePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getFirstSearchParam(
  value: string | string[] | undefined
): string | null {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" && value[0].trim() ? value[0] : null;
  }

  return typeof value === "string" && value.trim() ? value : null;
}

function hasAuthSearchParam(
  searchParams: Record<string, string | string[] | undefined>
): boolean {
  return AUTH_KEYS.some((key) => Boolean(getFirstSearchParam(searchParams[key])));
}

export default async function Home({ searchParams }: HomePageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};

  if (hasAuthSearchParam(resolvedSearchParams)) {
    const callbackSearchParams = new URLSearchParams();

    for (const [key, rawValue] of Object.entries(resolvedSearchParams)) {
      if (Array.isArray(rawValue)) {
        for (const value of rawValue) {
          callbackSearchParams.append(key, value);
        }
      } else if (typeof rawValue === "string") {
        callbackSearchParams.set(key, rawValue);
      }
    }

    const query = callbackSearchParams.toString();
    redirect(query ? `/auth/callback?${query}` : "/auth/callback");
  }

  const cookieStore = await cookies();
  const hasSupabaseAuthCookie = cookieStore
    .getAll()
    .some(({ name }) => name.startsWith("sb-"));

  redirect(hasSupabaseAuthCookie ? "/dashboard" : "/login");
}
