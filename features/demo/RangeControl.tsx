import type { CSSProperties } from "react";
import styles from "./controls.module.css";

interface RangeControlProps {
  id: string;
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
}

export function RangeControl({
  id,
  label,
  min,
  max,
  value,
  onChange,
}: RangeControlProps) {
  const progress = ((value - min) / (max - min)) * 100;
  return (
    <label className={styles.range} htmlFor={id}>
      <span>
        {label}
        <output htmlFor={id}>{value}px</output>
      </span>
      <input
        id={id}
        max={max}
        min={min}
        style={{ "--range-progress": `${progress}%` } as CSSProperties}
        type="range"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
