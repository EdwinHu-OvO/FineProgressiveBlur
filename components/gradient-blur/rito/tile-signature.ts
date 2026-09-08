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
      let pad = 0;
      if (command.kind === "paintText" || command.kind === "paintRuby") {
        pad = command.paint.font.sizePx * 2;
        for (const shadow of command.paint.textShadow ?? [])
          pad = Math.max(
            pad,
            Math.abs(shadow.offsetY) +
              shadow.blur * 2 +
              command.paint.font.sizePx,
          );
      } else if (command.kind === "paintBlock") {
        for (const shadow of command.paint.boxShadow ?? [])
          pad = Math.max(
            pad,
            Math.abs(shadow.offsetY) +
              shadow.blur * 2 +
              Math.max(0, shadow.spread),
          );
      }
      if (
        command.rect.y - pad < top + height &&
        command.rect.y + command.rect.height + pad > top
      )
        visible.push([scopes.flat(), command]);
    }
  }
  return JSON.stringify(visible);
}
