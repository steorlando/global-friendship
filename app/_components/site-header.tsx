import Image from "next/image";
import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 sm:gap-6">
          <Image
            src="/logo_santegidio.png"
            alt="Comunità di Sant'Egidio"
            width={184}
            height={56}
            className="h-9 w-auto object-contain sm:h-10"
            priority
          />
          <Image
            src="/Logo_YFP.png"
            alt="Youth for Peace"
            width={152}
            height={56}
            className="h-9 w-auto object-contain sm:h-10"
            priority
          />
        </div>

        <Link
          href="https://www.globalfriendship.eu"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-all duration-200 hover:border-indigo-600 hover:bg-indigo-600 hover:text-white"
        >
          globalfriendship.eu
        </Link>
      </div>
    </header>
  );
}
