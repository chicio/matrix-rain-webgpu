export type SliderProps = {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
};

export function Slider({ label, min, max, step, value }: SliderProps) {
  return (
    <label className="rail-row">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} disabled readOnly />
      <span className="rail-value">{value}</span>
    </label>
  );
}
