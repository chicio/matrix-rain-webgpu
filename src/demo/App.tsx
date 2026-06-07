import { useCallback, useMemo, useRef, useState } from 'react';
import { common, d, std } from 'typegpu';
import { useConfigureContext, useFrame, useRoot, useUniform } from '@typegpu/react';

import { DebugPanel } from './debug-panel/DebugPanel';
import type { RenderMode } from './debug-panel/RenderMode';

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
    time.write(elapsedSeconds);
    renderPipeline.withColorAttachment({ view: ctxRef.current }).draw(3);
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
      />
    </div>
  );
}

export default App;
