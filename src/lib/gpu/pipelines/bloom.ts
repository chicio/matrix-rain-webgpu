import { common, d, std, tgpu, type TgpuRoot, type TgpuUniform } from 'typegpu';
import { blitBindings } from './blit';
import { Uniforms } from '../schemas';

// Brightness extract: keep only pixels above the bloom threshold. The classic
// soft-knee-free version — subtract the threshold per channel and clamp at 0,
// so dim pixels go black and bright ones survive (minus the threshold).
export function createExtractPipeline(
  root: TgpuRoot,
  uniforms: TgpuUniform<typeof Uniforms>,
  format: GPUTextureFormat,
) {
  const fragMain = tgpu.fragmentFn({
    in: { uv: d.vec2f },
    out: d.vec4f,
  })(({ uv }) => {
    'use gpu';

    const src = std.textureSample(blitBindings.$.source, blitBindings.$.sampler, uv);
    const threshold = uniforms.$.bloomThreshold;
    const bright = std.max(src.rgb - d.vec3f(threshold), d.vec3f(0));
    return d.vec4f(bright, 1);
  });

  return root.createRenderPipeline({
    vertex: common.fullScreenTriangle,
    fragment: fragMain,
    targets: { format },
  });
}

export type ExtractPipeline = ReturnType<typeof createExtractPipeline>;

export function createBlurPipeline(
  root: TgpuRoot,
  uniforms: TgpuUniform<typeof Uniforms>,
  format: GPUTextureFormat,
  direction: readonly [number, number],
) {
  const fragMain = tgpu.fragmentFn({
    in: { uv: d.vec2f },
    out: d.vec4f,
  })(({ uv }) => {
    'use gpu';

    // One texel of the half-res source, in UV space, stepped along the blur axis only.
    const texel = d.vec2f(2, 2) / uniforms.$.resolution;
    const step = d.vec2f(direction[0], direction[1]) * texel;

    const c = std.textureSample(blitBindings.$.source, blitBindings.$.sampler, uv).rgb;
    const p1 = std.textureSample(blitBindings.$.source, blitBindings.$.sampler, uv + step).rgb;
    const n1 = std.textureSample(blitBindings.$.source, blitBindings.$.sampler, uv - step).rgb;
    const p2 = std.textureSample(
      blitBindings.$.source,
      blitBindings.$.sampler,
      uv + step * 2.0,
    ).rgb;
    const n2 = std.textureSample(
      blitBindings.$.source,
      blitBindings.$.sampler,
      uv - step * 2.0,
    ).rgb;
    const p3 = std.textureSample(
      blitBindings.$.source,
      blitBindings.$.sampler,
      uv + step * 3.0,
    ).rgb;
    const n3 = std.textureSample(
      blitBindings.$.source,
      blitBindings.$.sampler,
      uv - step * 3.0,
    ).rgb;
    const p4 = std.textureSample(
      blitBindings.$.source,
      blitBindings.$.sampler,
      uv + step * 4.0,
    ).rgb;
    const n4 = std.textureSample(
      blitBindings.$.source,
      blitBindings.$.sampler,
      uv - step * 4.0,
    ).rgb;

    const blurred =
      c * 0.227027 +
      (p1 + n1) * 0.1945946 +
      (p2 + n2) * 0.1216216 +
      (p3 + n3) * 0.054054 +
      (p4 + n4) * 0.016216;

    return d.vec4f(blurred, 1);
  });

  return root.createRenderPipeline({
    vertex: common.fullScreenTriangle,
    fragment: fragMain,
    targets: { format },
  });
}

export type BlurPipeline = ReturnType<typeof createBlurPipeline>;

// Combine samples both the full-bright scene and the blurred bloom.
export const combineBindings = tgpu.bindGroupLayout({
  scene: { texture: d.texture2d(d.f32) },
  bloom: { texture: d.texture2d(d.f32) },
  sampler: { sampler: 'filtering' },
});

export function createCombinePipeline(root: TgpuRoot, uniforms: TgpuUniform<typeof Uniforms>) {
  const fragMain = tgpu.fragmentFn({
    in: { uv: d.vec2f },
    out: d.vec4f,
  })(({ uv }) => {
    'use gpu';
    const scene = std.textureSample(combineBindings.$.scene, combineBindings.$.sampler, uv);
    const bloom = std.textureSample(combineBindings.$.bloom, combineBindings.$.sampler, uv);
    const combined = scene.rgb + bloom.rgb * uniforms.$.bloomIntensity;
    return d.vec4f(combined, 1);
  });

  return root.createRenderPipeline({
    vertex: common.fullScreenTriangle,
    fragment: fragMain,
  });
}

export type CombinePipeline = ReturnType<typeof createCombinePipeline>;
