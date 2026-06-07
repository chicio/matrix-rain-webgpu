import { Group } from './Group';
import { Slider } from './Slider';
import { Toggle } from './Toggle';

function Button({ label }: { label: string }) {
  return (
    <button type="button" className="rail-button" disabled>
      {label}
    </button>
  );
}

export function Effects() {
  return (
    <div className="rail-section">
      <h3 className="rail-heading">Effects</h3>

      <Group title="Simulation" milestone="wired in M2">
        <Slider label="density" min={0} max={1} step={0.01} value={0.5} />
        <Slider label="stepRate (Hz)" min={1} max={60} step={1} value={20} />
        <Slider label="fontSize (px)" min={8} max={40} step={1} value={18} />
        <Button label="Regenerate seeds" />
      </Group>

      <Group title="Parallax" milestone="wired in M5">
        <Toggle label="parallax" />
        <Slider label="speed min" min={0.1} max={2} step={0.1} value={0.5} />
        <Slider label="speed max" min={0.1} max={2} step={0.1} value={1.5} />
        <Slider label="depthDim" min={0} max={1} step={0.05} value={0.4} />
      </Group>

      <Group title="Bloom" milestone="wired in M6">
        <Toggle label="bloom" />
        <Slider label="intensity" min={0} max={3} step={0.05} value={1.0} />
        <Slider label="threshold" min={0} max={2} step={0.05} value={0.8} />
      </Group>

      <Group title="CRT" milestone="wired in M7">
        <Toggle label="crt" />
        <Slider label="scanlineStrength" min={0} max={1} step={0.05} value={0.3} />
        <Slider label="aberration (px)" min={0} max={5} step={0.1} value={1.0} />
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
