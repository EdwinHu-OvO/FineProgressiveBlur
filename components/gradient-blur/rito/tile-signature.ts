import type { CoreFrameCommand } from "./vendor/frame-types";

/** Only paint and inherited state that can reach this tile affect its revision. */
export function tileSignature(
  commands: readonly CoreFrameCommand[],
  top: number,
  height: number,
): string {
  const scopes: CoreFrameCommand[][] = [[]];
  const visible: unknown[] = [];
  for (const command of commands) {
    if (command.kind === "pushState") scopes.push([]);
    else if (command.kind === "popState") scopes.pop();
    else if (!command.kind.startsWith("paint")) scopes.at(-1)?.push(command);
    else if ("rect" in command) {
      const pad = paintHalo(command);
      if (
        command.rect.y - pad < top + height &&
        command.rect.y + command.rect.height + pad > top
      )
        visible.push([scopes.flat(), command]);
    }
  }
  return JSON.stringify(visible);
}

/** Replays only paint commands whose halo intersects a tile, retaining inherited state. */
export function tileCommands(
  commands: readonly CoreFrameCommand[],
  top: number,
  height: number,
): CoreFrameCommand[] {
  const scopes: CoreFrameCommand[][] = [[]];
  const result: CoreFrameCommand[] = [];
  for (const command of commands) {
    if (command.kind === "pushState") scopes.push([]);
    else if (command.kind === "popState") scopes.pop();
    else if (!command.kind.startsWith("paint")) scopes.at(-1)?.push(command);
    else if (
      "rect" in command &&
      command.rect.y - paintHalo(command) < top + height &&
      command.rect.y + command.rect.height + paintHalo(command) > top
    ) {
      result.push({ kind: "pushState" }, ...scopes.flat(), command, { kind: "popState" });
    }
  }
  return result;
}

function paintHalo(command: Extract<CoreFrameCommand, { rect: unknown }>): number {
  if (command.kind === "paintText" || command.kind === "paintRuby") {
    let pad = command.paint.font.sizePx * 2;
    for (const shadow of command.paint.textShadow ?? [])
      pad = Math.max(
        pad,
        Math.abs(shadow.offsetY) + shadow.blur * 2 + command.paint.font.sizePx,
      );
    return pad;
  }
  if (command.kind !== "paintBlock") return 0;
  return (command.paint.boxShadow ?? []).reduce(
    (pad, shadow) =>
      Math.max(
        pad,
        Math.abs(shadow.offsetY) +
          shadow.blur * 2 +
          Math.max(0, shadow.spread),
      ),
    0,
  );
}
