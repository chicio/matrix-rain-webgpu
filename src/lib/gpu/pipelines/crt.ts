import { common, d, std, tgpu, type TgpuRoot, type TgpuUniform } from 'typegpu';
import { blitBindings } from './blit';
import { Uniforms } from '../schemas';

// One dark scanline band every ~2 device pixels. Kept as a build-time constant
// (folded into the frequency below) — the slider controls depth, not spacing.
const SCANLINE_PERIOD_PX = 2.0;

// Final full-screen pass: samples the composited scene (reusing blitBindings —
// a single texture + sampler) and stamps the CRT character onto it before it
// reaches the swap chain. Three steps: chromatic aberration → tone-map → scanlines.
export function createCrtPipeline(root: TgpuRoot, uniforms: TgpuUniform<typeof Uniforms>) {
  const fragMain = tgpu.fragmentFn({
    in: { uv: d.vec2f },
    out: d.vec4f,
  })(({ uv }) => {
    'use gpu';

    // Chromatic aberration: pull the R and B channels apart along x by `aberration`
    // pixels (converted to uv space); G stays centered. aberration = 0 → no fringing.
    const offset = d.vec2f(uniforms.$.aberration / uniforms.$.resolution.x, 0);
    const r = std.textureSample(blitBindings.$.source, blitBindings.$.sampler, uv + offset).x;
    const g = std.textureSample(blitBindings.$.source, blitBindings.$.sampler, uv).y;
    const b = std.textureSample(blitBindings.$.source, blitBindings.$.sampler, uv - offset).z;
    let color = d.vec3f(r, g, b);

    // Reinhard tone-map: compress HDR (bloom can push channels past 1.0) into [0,1).
    color = color / (color + d.vec3f(1));

    // Scanlines: a horizontal brightness ripple. Frequency scales with vertical
    // resolution so band spacing stays constant in device pixels at any canvas size.
    const scanFreq = uniforms.$.resolution.y * (Math.PI / SCANLINE_PERIOD_PX);
    const scan = 1 - uniforms.$.scanlineStrength * (0.5 + 0.5 * std.sin(uv.y * scanFreq));
    color = color * scan;

    return d.vec4f(color, 1);
  });

  return root.createRenderPipeline({
    vertex: common.fullScreenTriangle,
    fragment: fragMain,
  });
}

export type CrtPipeline = ReturnType<typeof createCrtPipeline>;
