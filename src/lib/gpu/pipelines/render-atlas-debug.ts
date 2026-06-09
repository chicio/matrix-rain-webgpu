import { common, d, std, tgpu, type TgpuRoot, type TgpuUniform } from 'typegpu';
import { PALETTE } from '../palette';
import { Uniforms } from '../schemas';

// Fraction of the smaller canvas dimension that the centered debug quad occupies.
const QUAD_FRACTION = 0.6;

export const atlasBindings = tgpu.bindGroupLayout({
  atlas: { texture: d.texture2dArray(d.f32) },
  sampler: { sampler: 'filtering' },
});

export function createRenderAtlasDebugPipeline(
  root: TgpuRoot,
  uniforms: TgpuUniform<typeof Uniforms>,
) {
  const fragMain = tgpu.fragmentFn({
    in: { uv: d.vec2f },
    out: d.vec4f,
  })(({ uv }) => {
    'use gpu';

    const resolution = uniforms.$.resolution;
    const minDim = std.min(resolution.x, resolution.y);
    const quadSize = minDim * QUAD_FRACTION;

    const pixelPos = uv * resolution;
    const center = resolution * 0.5;
    const halfQuad = d.vec2f(quadSize * 0.5);
    const localUv = (pixelPos - (center - halfQuad)) / (halfQuad * 2);

    const inQuad = localUv.x >= 0 && localUv.x <= 1 && localUv.y >= 0 && localUv.y <= 1;

    const sample = std.textureSample(
      atlasBindings.$.atlas,
      atlasBindings.$.sampler,
      localUv,
      d.i32(uniforms.$.atlasLayer),
    );

    const aaWidth = std.fwidth(localUv.x) * 0.5;
    const alpha = std.smoothstep(0.5 - aaWidth, 0.5 + aaWidth, sample.x);

    const background = d.vec3f(PALETTE.background[0], PALETTE.background[1], PALETTE.background[2]);
    const trail = d.vec3f(PALETTE.trail[0], PALETTE.trail[1], PALETTE.trail[2]);
    const glyphColor = std.mix(background, trail, alpha);

    const color = std.select(background, glyphColor, inQuad);
    return d.vec4f(color, 1);
  });

  return root.createRenderPipeline({
    vertex: common.fullScreenTriangle,
    fragment: fragMain,
  });
}

export type RenderAtlasDebugPipeline = ReturnType<typeof createRenderAtlasDebugPipeline>;
