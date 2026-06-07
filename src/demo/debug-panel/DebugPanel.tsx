import type { RefObject } from 'react';

import { Effects } from './Effects';
import { Observability } from './Observability';
import { RenderModeSelector, type RenderMode } from './RenderMode';

type Props = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  renderMode: RenderMode;
  onRenderModeChange: (mode: RenderMode) => void;
};

export function DebugPanel({ canvasRef, renderMode, onRenderModeChange }: Props) {
  return (
    <aside id="rail">
      <Effects />
      <div className="rail-section">
        <h3 className="rail-heading">Render Mode</h3>
        <RenderModeSelector value={renderMode} onChange={onRenderModeChange} />
      </div>
      <Observability canvasRef={canvasRef} />
    </aside>
  );
}
