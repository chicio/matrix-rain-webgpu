import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useRoot } from '@typegpu/react';
import { buildSdfAtlas, type SdfAtlas } from '../gpu/atlas/build-sdf-atlas';
import { createRenderGraph, type RenderGraph } from '../gpu/render-graph';

type UseMatrixRainRendererArgs = {
  ctxRef: RefObject<GPUCanvasContext | null>;
  cellSize: number;
  density: number;
  stepRate: number;
  atlasLayer: number;
  atlasDebug: boolean;
  speedRange: [number, number];
  tailRange: [number, number];
  depthDim: number;
  bloomEnabled: boolean;
  bloomThreshold: number;
  bloomIntensity: number;
  crtEnabled: boolean;
  scanlineStrength: number;
  aberration: number;
};

export type MatrixRainRenderer = {
  tick: (deltaSeconds: number, elapsedSeconds: number) => void;
  regenerate: () => void;
  columnCount: number;
};

export function useMatrixRainRenderer(args: UseMatrixRainRendererArgs): MatrixRainRenderer {
  const root = useRoot();
  const graphRef = useRef<RenderGraph | null>(null);
  const latestArgsRef = useRef(args);
  latestArgsRef.current = args;

  const [columnCount, setColumnCount] = useState(0);
  const lastColumnCountRef = useRef(0);
  const atlasRef = useRef<SdfAtlas | null>(null);

  // Bake the SDF atlas once on mount; cancelable in case the component unmounts mid-bake.
  useEffect(() => {
    let cancelled = false;
    buildSdfAtlas().then((result) => {
      if (!cancelled) {
        atlasRef.current = result;
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Disposal on unmount AND on cellSize change (next tick lazy-recreates with new value).
  useEffect(() => {
    return () => {
      graphRef.current?.dispose();
      graphRef.current = null;
      lastColumnCountRef.current = 0;
      setColumnCount(0);
    };
  }, [args.cellSize]);

  // Speed/tail ranges only affect per-column init, so a change re-rolls all
  // columns. Keyed on the primitive endpoints (not the array refs) so the
  // effect fires exactly when a value moves, regardless of array identity.
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) {
      return;
    }
    graph.setSpeedRange(args.speedRange);
    graph.setTailRange(args.tailRange);
    graph.regenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [args.speedRange[0], args.speedRange[1], args.tailRange[0], args.tailRange[1]]);

  function tick(deltaSeconds: number, elapsedSeconds: number) {
    const ctx = latestArgsRef.current.ctxRef.current;
    const atlas = atlasRef.current;
    if (!ctx || !atlas) {
      return;
    }
    if (!graphRef.current) {
      graphRef.current = createRenderGraph({
        root,
        ctx,
        atlas,
        cellSize: latestArgsRef.current.cellSize,
        density: latestArgsRef.current.density,
        stepRate: latestArgsRef.current.stepRate,
        speedRange: latestArgsRef.current.speedRange,
        tailRange: latestArgsRef.current.tailRange,
        depthDim: latestArgsRef.current.depthDim,
        bloomEnabled: latestArgsRef.current.bloomEnabled,
        bloomThreshold: latestArgsRef.current.bloomThreshold,
        bloomIntensity: latestArgsRef.current.bloomIntensity,
        crtEnabled: latestArgsRef.current.crtEnabled,
        scanlineStrength: latestArgsRef.current.scanlineStrength,
        aberration: latestArgsRef.current.aberration,
      });
    }
    const graph = graphRef.current;
    const canvas = ctx.canvas;
    graph.resize(canvas.width, canvas.height);

    if (latestArgsRef.current.atlasDebug) {
      graph.setAtlasLayer(latestArgsRef.current.atlasLayer);
      graph.renderAtlasDebug();
    } else {
      graph.setDensity(latestArgsRef.current.density);
      graph.setStepRate(latestArgsRef.current.stepRate);
      graph.setDepthDim(latestArgsRef.current.depthDim);
      graph.setBloomEnabled(latestArgsRef.current.bloomEnabled);
      graph.setBloomThreshold(latestArgsRef.current.bloomThreshold);
      graph.setBloomIntensity(latestArgsRef.current.bloomIntensity);
      graph.setCrtEnabled(latestArgsRef.current.crtEnabled);
      graph.setScanlineStrength(latestArgsRef.current.scanlineStrength);
      graph.setAberration(latestArgsRef.current.aberration);
      graph.step(deltaSeconds, elapsedSeconds);
      graph.render();
    }

    const current = graph.getColumnCount();
    if (current !== lastColumnCountRef.current) {
      lastColumnCountRef.current = current;
      setColumnCount(current);
    }
  }

  const regenerate = useCallback(() => {
    graphRef.current?.regenerate();
  }, []);

  return { tick, regenerate, columnCount };
}
