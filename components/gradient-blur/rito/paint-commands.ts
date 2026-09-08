// SPDX-License-Identifier: AGPL-3.0-only
// Adapted from Ringyuki/Rito's frame-command-renderer.ts; see vendor/UPSTREAM.md.
import type { CoreFrameCommand } from "./vendor/frame-types";
import { renderCanvasBlockDecoration } from "./vendor/canvas-block/renderer";
import { strokeBorder } from "./vendor/canvas-block/border-stroke";
import { traceRoundedRect } from "./vendor/canvas-path";
import {
  drawCanvasRubyFragment,
  drawCanvasTextFragment,
} from "./vendor/canvas-text/renderer";

export function paintCommands(
  ctx: CanvasRenderingContext2D,
  commands: readonly CoreFrameCommand[],
  images: ReadonlyMap<string, ImageBitmap | HTMLImageElement>,
): void {
  let depth = 0;
  ctx.save();
  try {
    for (const command of commands) {
      if (command.kind === "pushState") {
        ctx.save();
        depth += 1;
      } else if (command.kind === "popState") {
        if (!depth) throw new Error("Unbalanced Rito drawing state");
        ctx.restore();
        depth -= 1;
      } else {
        paintCommand(ctx, command, images);
      }
    }
    if (depth) throw new Error("Unbalanced Rito drawing state");
  } finally {
    while (depth-- > 0) ctx.restore();
    ctx.restore();
  }
}

function paintCommand(
  ctx: CanvasRenderingContext2D,
  command: Exclude<CoreFrameCommand, { kind: "pushState" | "popState" }>,
  images: ReadonlyMap<string, ImageBitmap | HTMLImageElement>,
): void {
  switch (command.kind) {
    case "translate":
      ctx.translate(command.dx, command.dy);
      return;
    case "transform":
      ctx.translate(command.origin.x, command.origin.y);
      for (const transform of command.transforms) {
        if (transform.kind === "rotate") ctx.rotate(transform.rad);
        else if (transform.kind === "scale")
          ctx.scale(transform.sx, transform.sy);
        else {
          const length = (value: typeof transform.x, basis: number) =>
            value.unit === "percent"
              ? (value.value * basis) / 100
              : value.value;
          ctx.translate(
            length(transform.x, command.box.width),
            length(transform.y, command.box.height),
          );
        }
      }
      ctx.translate(-command.origin.x, -command.origin.y);
      return;
    case "opacity":
      ctx.globalAlpha *= command.value;
      return;
    case "clipRect": {
      const { rect, radius } = command;
      traceRoundedRect(
        ctx,
        rect.x,
        rect.y,
        rect.width,
        rect.height,
        radius?.rx ?? 0,
        radius?.ry ?? 0,
      );
      ctx.clip();
      return;
    }
    case "paintPage":
      ctx.fillStyle = command.paint.backgroundColor ?? "transparent";
      ctx.fillRect(
        command.rect.x,
        command.rect.y,
        command.rect.width,
        command.rect.height,
      );
      return;
    case "paintBlock":
      renderCanvasBlockDecoration(ctx, command, (src) => images.get(src));
      return;
    case "paintText":
      drawCanvasTextFragment(ctx, command);
      return;
    case "paintRuby":
      drawCanvasRubyFragment(ctx, command);
      return;
    case "paintImage": {
      const image = images.get(command.src);
      if (!image) throw new Error("Rito image is not ready");
      const { rect, sourceRect } = command;
      if (sourceRect) {
        ctx.drawImage(
          image,
          sourceRect.x,
          sourceRect.y,
          sourceRect.width,
          sourceRect.height,
          rect.x,
          rect.y,
          rect.width,
          rect.height,
        );
      } else ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height);
      return;
    }
    case "paintHorizontalRule": {
      const { rect, paint } = command;
      ctx.save();
      try {
        strokeBorder(
          ctx,
          { ...paint, width: rect.height },
          rect.x,
          rect.y + rect.height / 2,
          rect.x + rect.width,
          rect.y + rect.height / 2,
        );
      } finally {
        ctx.restore();
      }
    }
  }
}
