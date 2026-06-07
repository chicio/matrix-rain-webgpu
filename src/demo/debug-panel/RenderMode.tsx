export const RENDER_MODES = [
  'state-debug',
  'glyphs-flat',
  'glyphs-parallax',
  'glyphs-bloom',
  'glyphs-crt',
] as const;

export type RenderMode = (typeof RENDER_MODES)[number];

type Props = {
  value: RenderMode;
  onChange: (mode: RenderMode) => void;
};

export function RenderModeSelector({ value, onChange }: Props) {
  return (
    <label className="rail-select">
      <span className="rail-label">Render mode</span>
      <select
        value={value}
        onChange={(e) => {
          onChange(e.target.value as RenderMode);
        }}
      >
        {RENDER_MODES.map((mode) => (
          <option key={mode} value={mode}>
            {mode}
          </option>
        ))}
      </select>
    </label>
  );
}
