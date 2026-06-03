import styles from "./SkeuToggle.module.css";

interface SkeuToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export function SkeuToggle({ checked, onChange, label, disabled }: Readonly<SkeuToggleProps>) {
  return (
    <label className={`${styles.wrapper} ${disabled ? styles.disabled : ""}`}>
      <input
        type="checkbox"
        role="switch"
        className={styles.hiddenInput}
        checked={!!checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div aria-hidden="true" className={`${styles.track} ${checked ? styles.checked : ""}`}>
        <span className={styles.offText}>OFF</span>
        <span className={styles.onText}>ON</span>
      </div>
      {label && <span className={styles.label}>{label}</span>}
    </label>
  );
}
