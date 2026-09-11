import { Button } from './Button';

export function SegmentedControl<Value extends string>({
  label,
  value,
  options,
  disabled = false,
  className = '',
  onChange,
}: {
  label: string;
  value: Value;
  options: readonly { value: Value; label: string }[];
  disabled?: boolean;
  className?: string;
  onChange(value: Value): void;
}) {
  return <div className={`ui-segmented-control ${className}`.trim()} role="group" aria-label={label}>
    {options.map(option => <Button key={option.value} type="button" variant="quiet"
      aria-pressed={value === option.value} disabled={disabled}
      onClick={() => onChange(option.value)}
    >{option.label}</Button>)}
  </div>;
}
