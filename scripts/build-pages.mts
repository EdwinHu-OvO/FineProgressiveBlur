import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { exportWallpaper } from "./export-wallpaper.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
await exportWallpaper(
  fileURLToPath(new URL("../public/wallpaper/", import.meta.url)),
);
const build = spawnSync(
  process.execPath,
  ["node_modules/next/dist/bin/next", "build"],
  {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, NEXT_PUBLIC_STATIC_EXPORT: "true" },
  },
);
if (build.error) throw build.error;
process.exitCode = build.status ?? 1;
