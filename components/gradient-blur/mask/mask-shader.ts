export const MASK_COMPOSITE_SHADER = `#version 300 es
precision highp float;
uniform sampler2D uAtlas;
uniform sampler2D uMask;
uniform vec2 uAtlasSize;
uniform vec4 uRect;
uniform vec4 uRange;
uniform vec4 uCore;
uniform vec4 uMaskRegion;
uniform vec3 uLevels;
uniform float uRadius;
in vec2 vUv;
out vec4 color;
void main() {
  vec2 uv = uCore.xy + vUv * uCore.zw;
  float sigma = texture(uMask, uv).r * uRadius;
  if (sigma < uLevels.x || sigma > uLevels.z) discard;
  float blend = uLevels.y <= 0.0 || sigma >= uLevels.y ? 1.0 : clamp(
    (sigma * sigma - uLevels.x * uLevels.x) /
    (uLevels.y * uLevels.y - uLevels.x * uLevels.x), 0.0, 1.0);
  if (blend <= 0.0) discard;
  vec2 sourceUv = uMaskRegion.xy + uv * uMaskRegion.zw;
  vec2 pixel = uRect.xy + (sourceUv - uRange.xy) / uRange.zw * uRect.zw;
  vec2 sampleUv = clamp(pixel, uRect.xy + 0.5, uRect.xy + uRect.zw - 0.5) / uAtlasSize;
  vec4 filtered = texture(uAtlas, sampleUv);
  // Levels draw from sharp to soft. The lower bracket replaces the backdrop;
  // the upper bracket then interpolates in Gaussian variance, not mask opacity.
  color = vec4(filtered.rgb / max(filtered.a, 0.00001) * blend, blend);
}`;
