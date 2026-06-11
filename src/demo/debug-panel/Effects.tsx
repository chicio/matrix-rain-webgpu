import { Group } from './Group';
import { Slider } from './Slider';
import { Toggle } from './Toggle';

type ButtonProps = {
  label: string;
  onClick?: () => void;
};

function Button({ label, onClick }: ButtonProps) {
  return (
    <button type="button" className="rail-button" disabled={!onClick} onClick={onClick}>
      {label}
    </button>
  );
}

export type EffectsProps = {
  density: number;
  stepRate: number;
  fontSize: number;
  atlasLayer: number;
  atlasLayerMax: number;
  atlasDebugActive: boolean;
  speedRange: [number, number];
  tailRange: [number, number];
  depthDim: number;
  bloomEnabled: boolean;
  bloomThreshold: number;
  bloomIntensity: number;
  crtEnabled: boolean;
  scanlineStrength: number;
  aberration: number;
  onDensityChange: (value: number) => void;
  onStepRateChange: (value: number) => void;
  onFontSizeChange: (value: number) => void;
  onAtlasLayerChange: (value: number) => void;
  onSpeedRangeChange: (value: [number, number]) => void;
  onTailRangeChange: (value: [number, number]) => void;
  onDepthDimChange: (value: number) => void;
  onBloomEnabledChange: (value: boolean) => void;
  onBloomThresholdChange: (value: number) => void;
  onBloomIntensityChange: (value: number) => void;
  onCrtEnabledChange: (value: boolean) => void;
  onScanlineStrengthChange: (value: number) => void;
  onAberrationChange: (value: number) => void;
  onRegenerate: () => void;
};

export function Effects({
  density,
  stepRate,
  fontSize,
  atlasLayer,
  atlasLayerMax,
  atlasDebugActive,
  speedRange,
  tailRange,
  depthDim,
  bloomEnabled,
  bloomThreshold,
  bloomIntensity,
  crtEnabled,
  scanlineStrength,
  aberration,
  onDensityChange,
  onStepRateChange,
  onFontSizeChange,
  onAtlasLayerChange,
  onSpeedRangeChange,
  onTailRangeChange,
  onDepthDimChange,
  onBloomEnabledChange,
  onBloomThresholdChange,
  onBloomIntensityChange,
  onCrtEnabledChange,
  onScanlineStrengthChange,
  onAberrationChange,
  onRegenerate,
}: EffectsProps) {
  return (
    <div className="rail-section">
      <h3 className="rail-heading">Effects</h3>

      <Group title="Simulation" disabled={false}>
        <Slider
          label="density"
          min={0}
          max={1}
          step={0.01}
          value={density}
          onChange={onDensityChange}
        />
        <Slider
          label="stepRate (Hz)"
          min={1}
          max={60}
          step={1}
          value={stepRate}
          onChange={onStepRateChange}
        />
        <Slider
          label="fontSize (px)"
          min={8}
          max={40}
          step={1}
          value={fontSize}
          onChange={onFontSizeChange}
        />
        <Button label="Regenerate seeds" onClick={onRegenerate} />
      </Group>

      <Group title="Atlas debug" milestone="diagnostic" disabled={!atlasDebugActive}>
        <Slider
          label="atlas layer"
          min={0}
          max={atlasLayerMax}
          step={1}
          value={atlasLayer}
          onChange={onAtlasLayerChange}
        />
      </Group>

      <Group title="Parallax" disabled={false}>
        <Slider
          label="speed min"
          min={0.1}
          max={2}
          step={0.1}
          value={speedRange[0]}
          onChange={(value) => onSpeedRangeChange([value, speedRange[1]])}
        />
        <Slider
          label="speed max"
          min={0.1}
          max={2}
          step={0.1}
          value={speedRange[1]}
          onChange={(value) => onSpeedRangeChange([speedRange[0], value])}
        />
        <Slider
          label="tail min"
          min={2}
          max={40}
          step={1}
          value={tailRange[0]}
          onChange={(value) => onTailRangeChange([value, tailRange[1]])}
        />
        <Slider
          label="tail max"
          min={2}
          max={40}
          step={1}
          value={tailRange[1]}
          onChange={(value) => onTailRangeChange([tailRange[0], value])}
        />
        <Slider
          label="depthDim"
          min={0}
          max={1}
          step={0.05}
          value={depthDim}
          onChange={onDepthDimChange}
        />
      </Group>

      <Group title="Bloom" disabled={false}>
        <Toggle label="bloom" checked={bloomEnabled} onChange={onBloomEnabledChange} />
        <Slider
          label="intensity"
          min={0}
          max={3}
          step={0.05}
          value={bloomIntensity}
          onChange={onBloomIntensityChange}
        />
        <Slider
          label="threshold"
          min={0}
          max={2}
          step={0.05}
          value={bloomThreshold}
          onChange={onBloomThresholdChange}
        />
      </Group>

      <Group title="CRT" disabled={false}>
        <Toggle label="crt" checked={crtEnabled} onChange={onCrtEnabledChange} />
        <Slider
          label="scanlineStrength"
          min={0}
          max={1}
          step={0.05}
          value={scanlineStrength}
          onChange={onScanlineStrengthChange}
        />
        <Slider
          label="aberration (px)"
          min={0}
          max={5}
          step={0.1}
          value={aberration}
          onChange={onAberrationChange}
        />
      </Group>

      <Group title="Interaction" milestone="wired in M8">
        <Toggle label="interaction" />
        <Slider label="strength" min={0} max={2} step={0.05} value={1.0} />
        <Slider label="radius (cells)" min={1} max={40} step={1} value={10} />
      </Group>

      <Group title="Lifecycle" milestone="wired in M9">
        <Toggle label="paused" />
      </Group>
    </div>
  );
}
