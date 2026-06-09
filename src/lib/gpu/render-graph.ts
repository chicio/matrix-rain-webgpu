import { d, type TgpuMutable, type TgpuRoot, type TgpuUniform } from 'typegpu';
import type { SdfAtlas } from './atlas/build-sdf-atlas';
import { Column, Uniforms } from './schemas';
import {
  COMPUTE_STEP_WORKGROUP_SIZE,
  createComputeStepPipeline,
  type ComputeStepPipeline,
} from './pipelines/compute-step';
import { createRenderGlyphsPipeline, type RenderGlyphsPipeline } from './pipelines/render-glyphs';

export type CreateRenderGraphArgs = {
  root: TgpuRoot;
  ctx: GPUCanvasContext;
  atlas: SdfAtlas;
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
  regenerate: () => void;
  getColumnCount: () => number;
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
  const { root, ctx, atlas, cellSize } = args;
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

  const atlasTexture = root
    .createTexture({
      size: [atlas.layerSize, atlas.layerSize, atlas.layerCount],
      format: 'r8unorm',
    })
    .$usage('sampled');

  const atlasSampler = root.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
    addressModeU: 'clamp-to-edge',
    addressModeV: 'clamp-to-edge',
  });

  // root.unwrap() forces GPU materialization so writeTexture has a real GPUTexture target.
  root.device.queue.writeTexture(
    { texture: root.unwrap(atlasTexture) },
    atlas.data,
    { bytesPerRow: atlas.layerSize, rowsPerImage: atlas.layerSize },
    [atlas.layerSize, atlas.layerSize, atlas.layerCount],
  );

  // T3.4 will bind atlasTexture + atlasSampler into render-glyphs; held in closure until then.
  void atlasSampler;

  let columns: ColumnsBuffer | null = null;
  let computePipeline: ComputeStepPipeline | null = null;
  let renderPipeline: RenderGlyphsPipeline | null = null;
  let columnCount = 0;
  let viewportHeight = 0;
  let stepAccumulator = 0;

  function resize(w: number, h: number) {
    viewportHeight = h;
    const newCount = Math.max(1, Math.floor(w / cellSize));
    if (newCount !== columnCount) {
      columns?.buffer.destroy();
      columnCount = newCount;
      columns = root.createMutable(d.arrayOf(Column, columnCount));
      columns.write(initialColumns(columnCount, h, cellSize));
      computePipeline = createComputeStepPipeline(root, columns, uniforms);
      renderPipeline = createRenderGlyphsPipeline(root, columns, uniforms);
    }
    uniforms.patch({ resolution: d.vec2f(w, h) });
  }

  function regenerate() {
    if (!columns) {
      return;
    }
    columns.write(initialColumns(columnCount, viewportHeight, cellSize));
  }

  function step(deltaSeconds: number, elapsedSeconds: number) {
    stepAccumulator += deltaSeconds;
    const stepInterval = 1 / stepRate;
    uniforms.patch({ time: elapsedSeconds, density });
    const workgroupCount = Math.ceil(columnCount / COMPUTE_STEP_WORKGROUP_SIZE);
    while (stepAccumulator >= stepInterval) {
      stepAccumulator -= stepInterval;
      if (computePipeline && workgroupCount > 0) {
        computePipeline.dispatchWorkgroups(workgroupCount);
      }
    }
    uniforms.patch({ stepProgress: stepAccumulator / stepInterval });
  }

  function render() {
    if (!renderPipeline) {
      return;
    }
    renderPipeline.withColorAttachment({ view: ctx }).draw(3);
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
    computePipeline = null;
    renderPipeline = null;
  }

  function getColumnCount() {
    return columnCount;
  }

  return { resize, step, render, setDensity, setStepRate, regenerate, getColumnCount, dispose };
}
