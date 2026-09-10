const paths = {
  arrow: "M7 17 17 7M7 7h10v10",
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  clock: "M12 8v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  play: "m9 5 11 7-11 7Z",
  pause: "M9 5v14M15 5v14",
  reset: "M3 10a9 9 0 1 1 1 8M3 4v6h6",
  check: "m5 12 4 4L19 6",
  leaf: "M5 19C-1 5 8 4 21 3c-1 13-5 19-16 16Zm0 0L16 8",
} as const;

export function Icon({
  name,
  size = 18,
}: {
  name: keyof typeof paths;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
