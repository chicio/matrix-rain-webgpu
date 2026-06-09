import { useCallback, useMemo, useRef, useState } from 'react';
import { common, d, std } from 'typegpu';
import { useConfigureContext, useFrame, useRoot, useUniform } from '@typegpu/react';

import { GLYPH_COUNT } from '../lib/gpu/atlas/glyph-set';
import { useMatrixRainRenderer } from '../lib/hooks/use-matrix-rain-renderer';
import { DebugPanel } from './debug-panel/DebugPanel';
import type { RenderMode } from './debug-panel/RenderMode';

const DEFAULT_FONT_SIZE = 16;
const DEFAULT_DENSITY = 0.96;
// Matches chicio-blog 2D reference's frameRate; 30 felt too fast once
// glyphs were sharp + readable (M4) vs the M2 solid rectangles.
const DEFAULT_STEP_RATE = 20;
const DPR = window.devicePixelRatio || 1;

function App() {
  const root = useRoot();
  const time = useUniform(d.f32);

  const fpsRef = useRef(0);
  const lastFlushRef = useRef(0);
  const [fps, setFps] = useState<number | null>(null);

  const renderPipeline = useMemo(
    () =>
      root.createRenderPipeline({
        vertex: common.fullScreenTriangle,
        fragment: () => {
          'use gpu';

          const k = std.sin(time.$ * 2.0) * 0.5 + 0.5;
          return d.vec4f(0, k, 0, 1);
        },
      }),
    [root, time],
  );

  const { ref: configureRef, ctxRef } = useConfigureContext({
    autoResize: true,
    alphaMode: 'premultiplied',
  });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const setCanvas = useCallback(
    (el: HTMLCanvasElement | null) => {
      canvasRef.current = el;
      configureRef(el);
    },
    [configureRef],
  );

  const [renderMode, setRenderMode] = useState<RenderMode>('state-debug');
  const [density, setDensity] = useState(DEFAULT_DENSITY);
  const [stepRate, setStepRate] = useState(DEFAULT_STEP_RATE);
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  const [atlasLayer, setAtlasLayer] = useState(0);

  const isAtlasDebug = renderMode === 'atlas-debug';
  const useRainRenderer = renderMode === 'state-debug' || isAtlasDebug;

  const {
    tick: tickRain,
    regenerate,
    columnCount,
  } = useMatrixRainRenderer({
    ctxRef,
    cellSize: fontSize * DPR,
    density,
    stepRate,
    atlasLayer,
    atlasDebug: isAtlasDebug,
  });

  useFrame(({ deltaSeconds, elapsedSeconds }) => {
    if (!ctxRef.current) {
      return;
    }
    if (deltaSeconds > 0) {
      fpsRef.current = fpsRef.current * 0.9 + (1 / deltaSeconds) * 0.1;
    }
    if (elapsedSeconds - lastFlushRef.current > 1.0) {
      setFps(fpsRef.current);
      lastFlushRef.current = elapsedSeconds;
    }

    if (useRainRenderer) {
      tickRain(deltaSeconds, elapsedSeconds);
    } else {
      time.write(elapsedSeconds);
      renderPipeline.withColorAttachment({ view: ctxRef.current }).draw(3);
    }
  });

  return (
    <div id="shell">
      <section id="stage">
        <canvas ref={setCanvas} />
      </section>
      <DebugPanel
        canvasRef={canvasRef}
        renderMode={renderMode}
        onRenderModeChange={setRenderMode}
        fps={fps}
        columnCount={columnCount}
        density={density}
        stepRate={stepRate}
        fontSize={fontSize}
        atlasLayer={atlasLayer}
        atlasLayerMax={GLYPH_COUNT - 1}
        atlasDebugActive={isAtlasDebug}
        onDensityChange={setDensity}
        onStepRateChange={setStepRate}
        onFontSizeChange={setFontSize}
        onAtlasLayerChange={setAtlasLayer}
        onRegenerate={regenerate}
      />
    </div>
  );
}

export default App;
