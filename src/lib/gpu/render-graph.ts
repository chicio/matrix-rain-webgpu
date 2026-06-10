import { d, type TgpuMutable, type TgpuRoot, type TgpuUniform } from 'typegpu';
import type { SdfAtlas } from './atlas/build-sdf-atlas';
import { Column, Uniforms } from './schemas';
import {
  COMPUTE_STEP_WORKGROUP_SIZE,
  createComputeStepPipeline,
  type ComputeStepPipeline,
} from './pipelines/compute-step';
import { createRenderGlyphsPipeline, type RenderGlyphsPipeline } from './pipelines/render-glyphs';
import { atlasBindings } from './atlas/bindings';
import {
  createRenderAtlasDebugPipeline,
  type RenderAtlasDebugPipeline,
} from './pipelines/render-atlas-debug';

export type CreateRenderGraphArgs = {
  root: TgpuRoot;
  ctx: GPUCanvasContext;
  atlas: SdfAtlas;
  cellSize: number;
  density: number;
  stepRate: number;
  speedRange: [number, number];
  tailRange: [number, number];
  depthDim: number;
};

export type RenderGraph = {
  resize: (width: number, height: number) => void;
  step: (deltaSeconds: number, elapsedSeconds: number) => void;
  render: () => void;
  renderAtlasDebug: () => void;
  setDensity: (density: number) => void;
  setStepRate: (stepRate: number) => void;
  setAtlasLayer: (layer: number) => void;
  setSpeedRange: (range: [number, number]) => void;
  setTailRange: (range: [number, number]) => void;
  setDepthDim: (value: number) => void;
  regenerate: () => void;
  getColumnCount: () => number;
  dispose: () => void;
};

type ColumnsBuffer = TgpuMutable<d.WgslArray<typeof Column>>;

function initialColumns(
  count: number,
  viewportHeight: number,
  cellSize: number,
  speedRange: [number, number],
  tailRange: [number, number],
) {
  const rowCount = Math.max(1, Math.floor(viewportHeight / cellSize));
  const [minSpeed, maxSpeed] = speedRange;
  const [tailStart, tailEnd] = tailRange;

  return Array.from({ length: count }, () => {
    const speedSpan = maxSpeed - minSpeed;
    const speed = speedSpan > 0 ? minSpeed + speedSpan * Math.random() : minSpeed;
    const depth = speedSpan > 0 ? (speed - minSpeed) / speedSpan : 1;
    const tailLength = tailStart + (tailEnd - tailStart) * Math.random();

    return {
      headY: Math.random() * 2 * rowCount - rowCount, // uniform in [-rowCount, +rowCount]
      speed,
      depth,
      tailLength,
      seed: Math.floor(Math.random() * 0xffffffff),
    };
  });
}

export function createRenderGraph(args: CreateRenderGraphArgs): RenderGraph {
  const { root, ctx, atlas, cellSize } = args;
  let density = args.density;
  let stepRate = args.stepRate;
  let speedRange = args.speedRange;
  let tailRange = args.tailRange;
  let depthDim = args.depthDim;

  const uniforms: TgpuUniform<typeof Uniforms> = root.createUniform(Uniforms, {
    time: 0,
    stepProgress: 0,
    resolution: d.vec2f(0, 0),
    cellSize,
    density,
    depthDim,
    mousePosition: d.vec2f(0, 0),
    mouseStrength: 0,
    scrollVelocity: 0,
    flags: 0,
    atlasLayer: 0,
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

  const atlasBindGroup = root.createBindGroup(atlasBindings, {
    atlas: atlasTexture.createView(d.texture2dArray(d.f32)),
    sampler: atlasSampler,
  });

  const atlasDebugPipeline: RenderAtlasDebugPipeline = createRenderAtlasDebugPipeline(
    root,
    uniforms,
  );

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
      columns.write(initialColumns(columnCount, h, cellSize, speedRange, tailRange));
      computePipeline = createComputeStepPipeline(root, columns, uniforms);
      renderPipeline = createRenderGlyphsPipeline(root, columns, uniforms);
    }
    uniforms.patch({ resolution: d.vec2f(w, h) });
  }

  function regenerate() {
    if (!columns) {
      return;
    }
    columns.write(initialColumns(columnCount, viewportHeight, cellSize, speedRange, tailRange));
  }

  function step(deltaSeconds: number, elapsedSeconds: number) {
    stepAccumulator += deltaSeconds;
    const stepInterval = 1 / stepRate;
    uniforms.patch({ time: elapsedSeconds, density, depthDim });
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
    renderPipeline.with(atlasBindGroup).withColorAttachment({ view: ctx }).draw(3);
  }

  function renderAtlasDebug() {
    atlasDebugPipeline.with(atlasBindGroup).withColorAttachment({ view: ctx }).draw(3);
  }

  function setDensity(value: number) {
    density = value;
  }

  function setStepRate(value: number) {
    stepRate = value;
  }

  function setAtlasLayer(value: number) {
    uniforms.patch({ atlasLayer: value });
  }

  function setSpeedRange(range: [number, number]) {
    speedRange = range;
  }

  function setTailRange(range: [number, number]) {
    tailRange = range;
  }

  function setDepthDim(value: number) {
    depthDim = value;
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

  return {
    resize,
    step,
    render,
    renderAtlasDebug,
    setDensity,
    setStepRate,
    setAtlasLayer,
    setSpeedRange,
    setTailRange,
    setDepthDim,
    regenerate,
    getColumnCount,
    dispose,
  };
}
