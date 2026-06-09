import { d, tgpu } from 'typegpu';
import { randf } from '@typegpu/noise';
import { GLYPH_COUNT } from './atlas/glyph-set';

// f32 precision dictates that PRNG seeds stay small — see @typegpu/noise docs.
// Normalize a u32 column seed into [0, 1) and a slotY into [0, ~2] per the
// noise package's recommended seed ranges.
const U32_MAX_F = 4294967295;
const SLOT_Y_SCALE = 0.01;

export const glyphIndex = tgpu.fn(
  [d.u32, d.u32],
  d.u32,
)((seed, slotY) => {
  'use gpu';
  randf.seed2(d.vec2f(d.f32(seed) / U32_MAX_F, d.f32(slotY) * SLOT_Y_SCALE));
  return d.u32(randf.sample() * d.f32(GLYPH_COUNT));
});
