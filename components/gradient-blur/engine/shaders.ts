import { MAX_ATLAS_BANDS } from "./atlas-layout";
import { GAUSSIAN_PAIRS } from "./gaussian-kernel";

export const VERTEX_SHADER = `#version 300 es
precision highp float;

out vec2 vUv;

void main() {
  vec2 position = vec2(
    gl_VertexID == 1 ? 3.0 : -1.0,
    gl_VertexID == 2 ? 3.0 : -1.0
  );
  gl_Position = vec4(position, 0.0, 1.0);
  vUv = vec2((position.x + 1.0) * 0.5, (1.0 - position.y) * 0.5);
}
`;

export const FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D uAtlas;
uniform vec2 uAtlasSize;
uniform vec4 uSampleRegion;
uniform float uDirection;
uniform int uBandCount;
uniform float uBandEnds[${MAX_ATLAS_BANDS}];
uniform float uBandBlendEnds[${MAX_ATLAS_BANDS}];
uniform vec4 uBandRects[${MAX_ATLAS_BANDS}];
uniform vec2 uBandRanges[${MAX_ATLAS_BANDS}];
uniform bool uBlurY;
uniform int uPairs;
uniform float uWeights[${GAUSSIAN_PAIRS + 1}];
uniform float uOffsets[${GAUSSIAN_PAIRS}];
in vec2 vUv;
out vec4 outputColor;

vec4 sampleBand(int index, float progress, float x) {
  vec4 rect = uBandRects[index];
  vec2 range = uBandRanges[index];
  float localY = clamp((progress - range.x) / max(range.y - range.x, 0.0001), 0.0, 1.0);
  localY = mix(localY, 1.0 - localY, uDirection);
  vec2 pixel = rect.xy + vec2(x, localY) * rect.zw;
  vec2 uv = clamp(pixel, rect.xy + 0.5, rect.xy + rect.zw - 0.5) / uAtlasSize;
  vec4 color = texture(uAtlas, uv);
  if (uBlurY) {
    color *= uWeights[0];
    for (int pair = 0; pair < ${GAUSSIAN_PAIRS}; pair++) {
      if (pair >= uPairs) break;
      vec2 offset = vec2(0.0, uOffsets[pair] / uAtlasSize.y);
      vec2 minimum = (rect.xy + 0.5) / uAtlasSize;
      vec2 maximum = (rect.xy + rect.zw - 0.5) / uAtlasSize;
      color += (texture(uAtlas, clamp(uv - offset, minimum, maximum)) + texture(uAtlas, clamp(uv + offset, minimum, maximum))) * uWeights[pair + 1];
    }
  }
  return color;
}
void main() {
  vec2 sourceUv = uSampleRegion.xy + vUv * uSampleRegion.zw;
  float progress = mix(sourceUv.y, 1.0 - sourceUv.y, uDirection);
  vec4 color = vec4(0.0);
  for (int index = 0; index < ${MAX_ATLAS_BANDS}; index++) {
    float start = uBandEnds[index];
    float end = uBandBlendEnds[index];
    if (index == uBandCount - 1 || progress < end) {
      color = sampleBand(index, progress, sourceUv.x);
      if (index < uBandCount - 1 && progress > start) {
        float blend = smoothstep(start, end, progress);
        color = mix(color, sampleBand(index + 1, progress, sourceUv.x), blend);
      }
      break;
    }
  }
  // All filtering is in premultiplied, encoded sRGB, as required by CSS blur().
  outputColor = vec4(color.rgb / max(color.a, 0.00001), 1.0);
}
`;
