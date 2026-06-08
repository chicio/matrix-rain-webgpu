import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useRoot } from '@typegpu/react';
import { createRenderGraph, type RenderGraph } from '../gpu/render-graph';

type UseMatrixRainRendererArgs = {
  ctxRef: RefObject<GPUCanvasContext | null>;
  cellSize: number;
  density: number;
  stepRate: number;
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

  // Disposal on unmount AND on cellSize change (next tick lazy-recreates with new value).
  useEffect(() => {
    return () => {
      graphRef.current?.dispose();
      graphRef.current = null;
      lastColumnCountRef.current = 0;
      setColumnCount(0);
    };
  }, [args.cellSize]);

  function tick(deltaSeconds: number, elapsedSeconds: number) {
    const ctx = latestArgsRef.current.ctxRef.current;
    if (!ctx) {
      return;
    }
    if (!graphRef.current) {
      graphRef.current = createRenderGraph({
        root,
        ctx,
        cellSize: latestArgsRef.current.cellSize,
        density: latestArgsRef.current.density,
        stepRate: latestArgsRef.current.stepRate,
      });
    }
    const graph = graphRef.current;
    graph.setDensity(latestArgsRef.current.density);
    graph.setStepRate(latestArgsRef.current.stepRate);

    const canvas = ctx.canvas;
    graph.resize(canvas.width, canvas.height);
    graph.step(deltaSeconds, elapsedSeconds);
    graph.render();

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
