/** Prefix app-owned assets and fetch URLs; Next Link handles its own base path. */
export function sitePath(path: `/${string}`): string {
  return `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${path}`;
}
