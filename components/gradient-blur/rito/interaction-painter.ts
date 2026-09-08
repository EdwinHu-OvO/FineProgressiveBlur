// SPDX-License-Identifier: AGPL-3.0-only
// Adapted from Ringyuki/Rito's kit/painter/overlay-painter.ts; see vendor/UPSTREAM.md.
import { VERTEX_SHADER } from "../engine/shaders";
import { createProgram, requireUniform } from "../engine/webgl-utils";
import type { InteractionLayer } from "./interaction";
import type { Rect } from "./vendor/frame-types";

const FILL_SHADER = `#version 300 es
precision highp float;
uniform vec4 uFill;
out vec4 color;
void main() {
  vec3 linear = mix(uFill.rgb / 12.92, pow((uFill.rgb + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), uFill.rgb));
  color = vec4(linear, uFill.a);
}`;

/** Geometry-only selection updates stay in the shared GPU context, with no texture upload. */
export class InteractionPainter {
  private readonly program: WebGLProgram;
  private readonly fill: WebGLUniformLocation;
  private readonly vertices: WebGLVertexArrayObject | null;
  constructor(private readonly gl: WebGL2RenderingContext) {
    this.program = createProgram(gl, VERTEX_SHADER, FILL_SHADER);
    this.fill = requireUniform(gl, this.program, "uFill");
    this.vertices = gl.createVertexArray();
  }

  paint(
    layers: readonly InteractionLayer[],
    ratio: number,
    left: number,
    top: number,
  ): void {
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vertices);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(
      gl.SRC_ALPHA,
      gl.ONE_MINUS_SRC_ALPHA,
      gl.ONE,
      gl.ONE_MINUS_SRC_ALPHA,
    );
    try {
      for (const layer of [...layers].sort((a, b) => a.zIndex - b.zIndex)) {
        gl.uniform4fv(this.fill, layer.color);
        for (const rect of layer.rects) {
          const regions: Rect[] = layer.border
            ? [
                { ...rect, height: 1 },
                { ...rect, y: rect.y + rect.height - 1, height: 1 },
                { ...rect, width: 1 },
                { ...rect, x: rect.x + rect.width - 1, width: 1 },
              ]
            : [rect];
          for (const region of regions) {
            gl.viewport(
              Math.round((region.x - left) * ratio),
              Math.round((region.y - top) * ratio),
              Math.max(1, Math.round(region.width * ratio)),
              Math.max(1, Math.round(region.height * ratio)),
            );
            gl.drawArrays(gl.TRIANGLES, 0, 3);
          }
        }
      }
    } finally {
      gl.disable(gl.BLEND);
    }
  }

  dispose(): void {
    this.gl.deleteProgram(this.program);
    this.gl.deleteVertexArray(this.vertices);
  }
}
