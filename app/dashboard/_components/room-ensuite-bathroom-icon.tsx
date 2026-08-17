type RoomEnsuiteBathroomIconProps = {
  value: boolean | null;
  labels: {
    available: string;
    unavailable: string;
    unknown: string;
  };
  className?: string;
};

export function RoomEnsuiteBathroomIcon({
  value,
  labels,
  className = "",
}: RoomEnsuiteBathroomIconProps) {
  const state = value === true ? "available" : value === false ? "unavailable" : "unknown";
  const label = labels[state];
  const stateClasses =
    state === "available"
      ? "bg-cyan-50 text-cyan-700 ring-cyan-200"
      : state === "unavailable"
        ? "bg-slate-100 text-slate-500 ring-slate-300"
        : "bg-amber-50 text-amber-700 ring-amber-200";

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      data-testid="room-ensuite-bathroom-icon"
      data-ensuite-state={state}
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ${stateClasses} ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      >
        <path d="M4 12h16" />
        <path d="M5 12v1.5A4.5 4.5 0 0 0 9.5 18h5a4.5 4.5 0 0 0 4.5-4.5V12" />
        <path d="M7 12V6.5A2.5 2.5 0 0 1 9.5 4H11" />
        <path d="M7 20v-2M17 20v-2" />
        {state === "available" ? <path d="m15.5 7 1.5 1.5 3-3" /> : null}
        {state === "unavailable" ? <path d="M4.5 4.5 19.5 19.5" /> : null}
        {state === "unknown" ? (
          <>
            <path d="M16.25 5.75a1.75 1.75 0 1 1 2.6 1.53c-.78.43-1.1.76-1.1 1.47" />
            <path d="M17.75 10.75h.01" />
          </>
        ) : null}
      </svg>
    </span>
  );
}
