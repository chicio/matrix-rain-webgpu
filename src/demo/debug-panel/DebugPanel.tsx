import type { RefObject } from 'react';

import { Effects, type EffectsProps } from './Effects';
import { Observability } from './Observability';
import { RenderModeSelector, type RenderMode } from './RenderMode';

type Props = EffectsProps & {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  renderMode: RenderMode;
  onRenderModeChange: (mode: RenderMode) => void;
  fpsRef: RefObject<HTMLElement | null>;
  columnCount: number | null;
};

export function DebugPanel({
  canvasRef,
  renderMode,
  onRenderModeChange,
  fpsRef,
  columnCount,
  ...effectsProps
}: Props) {
  return (
    <aside id="rail">
      <Effects {...effectsProps} />
      <div className="rail-section">
        <h3 className="rail-heading">Render Mode</h3>
        <RenderModeSelector value={renderMode} onChange={onRenderModeChange} />
      </div>
      <Observability canvasRef={canvasRef} fpsRef={fpsRef} columnCount={columnCount} />
    </aside>
  );
}
