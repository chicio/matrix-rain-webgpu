type ToggleProps = { label: string };

export function Toggle({ label }: ToggleProps) {
  return (
    <label className="rail-row">
      <input type="checkbox" disabled />
      <span>{label}</span>
    </label>
  );
}
