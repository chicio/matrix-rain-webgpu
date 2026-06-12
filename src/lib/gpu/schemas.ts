import { d } from 'typegpu';

export const Column = d.struct({
  headY: d.f32,
  speed: d.f32,
  depth: d.f32,
  tailLength: d.f32,
  seed: d.u32,
});

export const Uniforms = d.struct({
  time: d.f32,
  stepProgress: d.f32,
  resolution: d.vec2f,
  cellSize: d.f32,
  density: d.f32,
  depthDim: d.f32,
  bloomThreshold: d.f32,
  bloomIntensity: d.f32,
  scanlineStrength: d.f32,
  aberration: d.f32,
});
