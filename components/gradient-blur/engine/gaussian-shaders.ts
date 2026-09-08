import { GAUSSIAN_PAIRS } from "./gaussian-kernel";

export const GAUSSIAN_SHADER = `#version 300 es
precision highp float;
uniform sampler2D uSource;
uniform vec2 uAtlasSize;
uniform vec4 uRect;
uniform vec2 uRange;
uniform vec2 uViewSize;
uniform vec2 uAxis;
uniform float uSigma;
uniform float uDirection;
uniform bool uUniformRadius;
uniform vec2 uResampleVariance;
uniform int uPairs;
uniform float uWeights[${GAUSSIAN_PAIRS + 1}];
uniform float uOffsets[${GAUSSIAN_PAIRS}];
out vec4 color;

vec4 sampleAt(vec2 pixel) {
  vec2 minimum = uRect.xy + 0.5;
  vec2 maximum = uRect.xy + uRect.zw - 0.5;
  return texture(uSource, clamp(pixel, minimum, maximum) / uAtlasSize);
}
float profileAt(float y) {
  float t = clamp(y, 0.0, 1.0);
  return 1.0 - t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}
float expNegApprox(float x) {
  // Range reduction keeps the fifth-order polynomial accurate even for
  // narrow kernels; repeated squaring reconstructs exp(-x) without exp().
  float y = clamp(x, 0.0, 32.0) * 0.03125;
  float y2 = y * y;
  float y3 = y2 * y;
  float y4 = y3 * y;
  float y5 = y4 * y;
  float base = 1.0 - y + 0.5 * y2 - y3 / 6.0 + y4 / 24.0 - y5 / 120.0;
  float squared = base * base;
  squared *= squared;
  squared *= squared;
  squared *= squared;
  squared *= squared;
  return squared;
}
void main() {
  // A constant-radius image computes coefficients once on the CPU, not once
  // per fragment. Radius changes only submit a small uniform array.
  if (uUniformRadius) {
    color = sampleAt(gl_FragCoord.xy) * uWeights[0];
    for (int pair = 0; pair < ${GAUSSIAN_PAIRS}; pair++) {
      if (pair >= uPairs) break;
      vec2 offset = uAxis * uOffsets[pair];
      color += (sampleAt(gl_FragCoord.xy - offset) + sampleAt(gl_FragCoord.xy + offset)) * uWeights[pair + 1];
    }
    return;
  }
  vec2 local = (gl_FragCoord.xy - uRect.xy) / uRect.zw;
  float progress = mix(uRange.x, uRange.y, mix(local.y, 1.0 - local.y, uDirection));
  float sigma = uSigma * profileAt(progress);
  vec2 density = uRect.zw / (uViewSize * vec2(1.0, uRange.y - uRange.x));
  float texelSigma = sigma * dot(density, uAxis);
  // Downsampling + reconstruction already contribute variance. The correction
  // is supplied separately from CSS sigma, so px keeps its Gaussian meaning.
  float variance = max(0.0, texelSigma * texelSigma - dot(uResampleVariance, uAxis));
  if (variance < 0.01) { color = sampleAt(gl_FragCoord.xy); return; }
  float exponent = 0.5 / variance;
  float ratio = expNegApprox(exponent);
  float ratioStep = ratio * ratio;
  float coefficient = 1.0;
  float total = 1.0;
  vec4 sum = sampleAt(gl_FragCoord.xy);
  // Pair adjacent taps with bilinear filtering: 17 texels need at most 9 reads.
  for (int pair = 0; pair < ${GAUSSIAN_PAIRS}; pair++) {
    float first = float(pair * 2 + 1);
    if (pair >= uPairs || first > ceil(3.0 * texelSigma)) break;
    coefficient *= ratio;
    ratio *= ratioStep;
    float a = coefficient;
    coefficient *= ratio;
    ratio *= ratioStep;
    float b = coefficient;
    float weight = a + b;
    vec2 offset = uAxis * (first + b / max(weight, 0.000001));
    sum += (sampleAt(gl_FragCoord.xy - offset) + sampleAt(gl_FragCoord.xy + offset)) * weight;
    total += 2.0 * weight;
  }
  color = sum / total;
}`;
