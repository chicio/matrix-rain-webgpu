import { d, type TgpuMutable, type TgpuRoot, type TgpuUniform } from 'typegpu';
import { Column, Uniforms } from './schemas';

export type CreateRenderGraphArgs = {
  root: TgpuRoot;
  ctx: GPUCanvasContext;
  cellSize: number;
  density: number;
  stepRate: number;
};

export type RenderGraph = {
  resize: (width: number, height: number) => void;
  step: (deltaSeconds: number, elapsedSeconds: number) => void;
  render: () => void;
  setDensity: (density: number) => void;
  setStepRate: (stepRate: number) => void;
  dispose: () => void;
};

type ColumnsBuffer = TgpuMutable<d.WgslArray<typeof Column>>;

const INITIAL_SPEED = 1.0;
const INITIAL_DEPTH = 1.0;
const INITIAL_TAIL_LENGTH = 15.0;

function initialColumns(count: number, viewportHeight: number, cellSize: number) {
  const rowCount = Math.max(1, Math.floor(viewportHeight / cellSize));
  return Array.from({ length: count }, () => ({
    headY: Math.random() * 2 * rowCount - rowCount, // uniform in [-rowCount, +rowCount]
    speed: INITIAL_SPEED,
    depth: INITIAL_DEPTH,
    tailLength: INITIAL_TAIL_LENGTH,
    seed: Math.floor(Math.random() * 0xffffffff),
  }));
}

export function createRenderGraph(args: CreateRenderGraphArgs): RenderGraph {
  const { root, ctx, cellSize } = args;
  let density = args.density;
  let stepRate = args.stepRate;

  const uniforms: TgpuUniform<typeof Uniforms> = root.createUniform(Uniforms, {
    time: 0,
    stepProgress: 0,
    resolution: d.vec2f(0, 0),
    cellSize,
    density,
    mousePosition: d.vec2f(0, 0),
    mouseStrength: 0,
    scrollVelocity: 0,
    flags: 0,
  });

  let columns: ColumnsBuffer | null = null;
  let columnCount = 0;
  let width = 0;
  let height = 0;
  let stepAccumulator = 0;

  function resize(w: number, h: number) {
    width = w;
    height = h;
    const newCount = Math.max(1, Math.floor(w / cellSize));
    if (newCount !== columnCount) {
      columns?.buffer.destroy();
      columnCount = newCount;
      columns = root.createMutable(d.arrayOf(Column, columnCount));
      columns.write(initialColumns(columnCount, h, cellSize));
    }
    uniforms.patch({ resolution: d.vec2f(w, h) });
  }

  function step(deltaSeconds: number, elapsedSeconds: number) {
    stepAccumulator += deltaSeconds;
    const stepInterval = 1 / stepRate;
    while (stepAccumulator >= stepInterval) {
      stepAccumulator -= stepInterval;
      // TODO Task 2.3 — dispatch compute pass
    }
    uniforms.patch({
      time: elapsedSeconds,
      stepProgress: stepAccumulator / stepInterval,
      density,
    });
  }

  function render() {
    // TODO Task 2.4 — run render pipeline to draw falling rectangles
    void ctx;
    void width;
    void height;
  }

  function setDensity(value: number) {
    density = value;
  }

  function setStepRate(value: number) {
    stepRate = value;
  }

  function dispose() {
    uniforms.buffer.destroy();
    columns?.buffer.destroy();
    columns = null;
  }

  return { resize, step, render, setDensity, setStepRate, dispose };
}
