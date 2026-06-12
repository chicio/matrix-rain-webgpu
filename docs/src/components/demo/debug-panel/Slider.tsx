export type SliderProps = {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange?: ((value: number) => void) | undefined;
};

export function Slider({ label, min, max, step, value, onChange }: SliderProps) {
  const disabled = !onChange;
  return (
    <label className="rail-row">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        readOnly={disabled}
        onChange={onChange ? (event) => onChange(Number(event.target.value)) : undefined}
      />
      <span className="rail-value">{value}</span>
    </label>
  );
}
