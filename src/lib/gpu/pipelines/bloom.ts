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
