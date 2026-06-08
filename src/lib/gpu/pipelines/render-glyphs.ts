import { common, d, std, tgpu, type TgpuMutable, type TgpuRoot, type TgpuUniform } from 'typegpu';
import { PALETTE } from '../palette';
import { Column, Uniforms } from '../schemas';

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

    const col = std.min(d.u32(std.floor(uv.x * d.f32(columnCount))), columnCount - 1);
    const column = columns.$[col];

    const slotY = (uv.y * resolution.y) / cellSize;
    const k = column.headY - slotY;
    const inTail = k >= 0 && k <= column.tailLength;
    const brightness = std.clamp(1 - k / column.tailLength, 0, 1);

    const fade = d.vec3f(PALETTE.fade[0], PALETTE.fade[1], PALETTE.fade[2]);
    const trail = d.vec3f(PALETTE.trail[0], PALETTE.trail[1], PALETTE.trail[2]);
    const bg = d.vec3f(PALETTE.background[0], PALETTE.background[1], PALETTE.background[2]);

    const trailColor = std.mix(fade, trail, brightness);
    const color = std.select(bg, trailColor, inTail);
    return d.vec4f(color, 1);
  });

  return root.createRenderPipeline({
    vertex: common.fullScreenTriangle,
    fragment: fragMain,
  });
}

export type RenderGlyphsPipeline = ReturnType<typeof createRenderGlyphsPipeline>;
