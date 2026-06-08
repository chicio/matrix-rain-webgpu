import { useEffect, useRef, type RefObject } from 'react';
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
};

export function useMatrixRainRenderer(args: UseMatrixRainRendererArgs): MatrixRainRenderer {
  const root = useRoot();
  const graphRef = useRef<RenderGraph | null>(null);

  useEffect(() => {
    return () => {
      graphRef.current?.dispose();
      graphRef.current = null;
    };
  }, []);

  function tick(deltaSeconds: number, elapsedSeconds: number) {
    const ctx = args.ctxRef.current;
    if (!ctx) {
      return;
    }
    if (!graphRef.current) {
      graphRef.current = createRenderGraph({
        root,
        ctx,
        cellSize: args.cellSize,
        density: args.density,
        stepRate: args.stepRate,
      });
    }
    const canvas = ctx.canvas;
    graphRef.current.resize(canvas.width, canvas.height);
    graphRef.current.step(deltaSeconds, elapsedSeconds);
    graphRef.current.render();
  }

  return { tick };
}
