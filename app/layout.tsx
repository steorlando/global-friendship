import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/app/_components/site-header";
import { I18nProvider } from "@/lib/i18n/provider";
import { getServerLocale } from "@/lib/i18n/server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Global Friendship",
  description: "Global Friendship registration platform",
  icons: {
    icon: "/Logo_YFP.png",
    shortcut: "/Logo_YFP.png",
    apple: "/Logo_YFP.png",
  },
};

const APP_LAST_UPDATED = process.env.NEXT_PUBLIC_APP_LAST_UPDATED ?? "2026-03-07";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getServerLocale();
  const cookieStore = await cookies();

  const requestedRole = cookieStore.get("gf_requested_role")?.value ?? null;
  const lastUpdatedDate = new Date(`${APP_LAST_UPDATED}T00:00:00Z`);
  const formattedLastUpdated = Number.isNaN(lastUpdatedDate.getTime())
    ? APP_LAST_UPDATED
    : new Intl.DateTimeFormat(locale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(lastUpdatedDate);

  return (
    <html lang={locale}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-slate-50 text-slate-700 antialiased`}
      >
        <I18nProvider initialLocale={locale}>
          <div className="flex min-h-screen flex-col">
            <SiteHeader requestedRole={requestedRole} />
            <main className="flex-1">{children}</main>
            <footer className="border-t border-slate-200 bg-white/90 px-4 py-3 text-xs text-slate-500 sm:px-6 lg:px-8">
              <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3">
                <span>Last update: {formattedLastUpdated}</span>
                <span>For support: global@giovaniperlapace.it</span>
              </div>
            </footer>
          </div>
        </I18nProvider>
      </body>
    </html>
  );
}
