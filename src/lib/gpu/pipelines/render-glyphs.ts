import { common, d, std, tgpu, type TgpuMutable, type TgpuRoot, type TgpuUniform } from 'typegpu';
import { atlasBindings } from '../atlas/bindings';
import { brightnessJitter, glyphIndex } from '../hash';
import { PALETTE } from '../palette';
import { Column, Uniforms } from '../schemas';

// Falloff exponent — steeper than linear keeps the head visually bright longer.
const FALLOFF_POWER = 1.5;
// Minimum brightness multiplier for the farthest column (depth = 0). M5 will
// vary depth per column; M4 has depth = 1 for all, so this is a no-op for now.
const MIN_DEPTH_BRIGHTNESS = 0.3;

export function createRenderGlyphsPipeline(
  root: TgpuRoot,
  columns: TgpuMutable<d.WgslArray<typeof Column>>,
  uniforms: TgpuUniform<typeof Uniforms>,
) {
  const fragMain = tgpu.fragmentFn({
    in: { uv: d.vec2f },
    out: d.vec4f,
  })(({ uv }) => {
    'use gpu';

    const resolution = uniforms.$.resolution;
    const cellSize = uniforms.$.cellSize;
    const columnCount = d.u32(std.floor(resolution.x / cellSize));

    const pixelPos = uv * resolution;
    const col = std.min(d.u32(std.floor(pixelPos.x / cellSize)), columnCount - 1);
    const row = d.u32(std.floor(pixelPos.y / cellSize));
    const localUv = d.vec2f(std.fract(pixelPos.x / cellSize), std.fract(pixelPos.y / cellSize));

    const column = columns.$[col];
    const headRow = d.i32(std.floor(column.headY));
    const k = headRow - d.i32(row);
    const tailLengthI = d.i32(column.tailLength);
    const inTail = k >= 0 && k <= tailLengthI;

    const layer = glyphIndex(column.seed, row);
    const sample = std.textureSample(
      atlasBindings.$.atlas,
      atlasBindings.$.sampler,
      localUv,
      d.i32(layer),
    );
    const edgeHalfBand = std.fwidth(localUv.x) * 0.5;
    const coverage = std.smoothstep(0.5 - edgeHalfBand, 0.5 + edgeHalfBand, sample.x);

    const tailProgress = d.f32(k) / column.tailLength;
    const tailFalloff = std.pow(std.clamp(1 - tailProgress, 0, 1), FALLOFF_POWER);
    const depthDimming = std.mix(MIN_DEPTH_BRIGHTNESS, 1, column.depth);
    // Per-cell ±20% variation so neighbours in the same trail position differ
    // slightly — film-faithful organic feel. Head stays uniformly bright.
    const trailJitter = std.select(brightnessJitter(column.seed, row), d.f32(0), k === 0);
    const brightness = std.clamp(tailFalloff * depthDimming * (1 + trailJitter), 0, 1);

    const head = d.vec3f(PALETTE.head[0], PALETTE.head[1], PALETTE.head[2]);
    const trail = d.vec3f(PALETTE.trail[0], PALETTE.trail[1], PALETTE.trail[2]);
    const fade = d.vec3f(PALETTE.fade[0], PALETTE.fade[1], PALETTE.fade[2]);
    const bg = d.vec3f(PALETTE.background[0], PALETTE.background[1], PALETTE.background[2]);

    const trailColor = std.mix(trail, fade, std.clamp(tailProgress, 0, 1));
    const baseColor = std.select(trailColor, head, k === 0);
    const glyphColor = baseColor * brightness;
    const finalRgb = std.mix(bg, glyphColor, coverage);

    const color = std.select(bg, finalRgb, inTail);
    return d.vec4f(color, 1);
  });

  return root.createRenderPipeline({
    vertex: common.fullScreenTriangle,
    fragment: fragMain,
  });
}

export type RenderGlyphsPipeline = ReturnType<typeof createRenderGlyphsPipeline>;
