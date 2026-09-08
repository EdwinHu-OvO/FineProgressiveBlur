import { describe, expect, it } from "vitest";
import { tileSignature } from "./tile-signature";
import type { CoreFrameCommand } from "./vendor/frame-types";

const block = (y: number, color: string): CoreFrameCommand => ({
  kind: "paintBlock",
  rect: { x: 0, y, width: 120, height: 20 },
  paint: { background: { color } },
});

describe("Rito tile content revisions", () => {
  it("ignores paint changes outside the tile", () => {
    const before = [block(10, "red"), block(200, "green")];
    const after = [block(10, "red"), block(200, "blue")];
    expect(tileSignature(before, 0, 100)).toBe(tileSignature(after, 0, 100));
    expect(tileSignature(before, 100, 200)).not.toBe(
      tileSignature(after, 100, 200),
    );
  });
  it("includes inherited clipping and opacity in the tile revision", () => {
    const commands: CoreFrameCommand[] = [
      { kind: "pushState" },
      { kind: "opacity", value: 0.5 },
      block(10, "red"),
      { kind: "popState" },
    ];
    const changed = commands.map((command): CoreFrameCommand =>
      command.kind === "opacity" ? { ...command, value: 0.8 } : command,
    );
    expect(tileSignature(commands, 0, 100)).not.toBe(
      tileSignature(changed, 0, 100),
    );
  });
  it("restores state before subsequent siblings", () => {
    const scoped: CoreFrameCommand[] = [
      { kind: "pushState" },
      { kind: "opacity", value: 0.5 },
      block(200, "red"),
      { kind: "popState" },
      block(10, "green"),
    ];
    expect(tileSignature(scoped, 0, 100)).toBe(
      tileSignature([block(10, "green")], 0, 100),
    );
  });
  it("retains a shadow that reaches into the tile from outside", () => {
    const command: CoreFrameCommand = {
      kind: "paintBlock",
      rect: { x: 0, y: 120, width: 10, height: 10 },
      paint: {
        boxShadow: [
          {
            color: "red",
            offsetX: 0,
            offsetY: -30,
            blur: 2,
            spread: 0,
            inset: false,
          },
        ],
      },
    };
    expect(tileSignature([command], 0, 100)).not.toBe(
      tileSignature([], 0, 100),
    );
  });
});
