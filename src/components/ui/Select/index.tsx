import React, { useState, useRef, useEffect, useId } from "react";
import { createPortal } from "react-dom";
import styles from "./Select.module.css";
import { clsx } from "@/utils/helpers";
import { IconChevronDown, IconCheck } from "@/assets/icons";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label?: string;
  error?: string;
  hint?: string;
  options: readonly SelectOption[];
  placeholder?: string;
  fullWidth?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  showRequired?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function Select({
  label,
  error,
  hint,
  options,
  placeholder,
  fullWidth = true,
  value,
  onChange,
  showRequired,
  disabled,
  id,
  className,
  style,
}: Readonly<SelectProps>) {
  const uid = useId();
  const inputId = id ?? `select-${uid}`;
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  const openDropdown = () => {
    if (disabled) return;
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const estimatedHeight = Math.min(options.length * 38 + 8, 280);
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const openUp = spaceBelow < estimatedHeight + 8 && spaceAbove > spaceBelow;

      if (openUp) {
        setDropdownStyle({
          position: "fixed",
          bottom: window.innerHeight - rect.top + 4,
          left: rect.left,
          width: rect.width,
          maxHeight: Math.min(spaceAbove - 8, 280),
          overflowY: "auto",
          zIndex: 9999,
        });
      } else {
        setDropdownStyle({
          position: "fixed",
          top: rect.bottom + 4,
          left: rect.left,
          width: rect.width,
          maxHeight: Math.min(spaceBelow - 8, 280),
          overflowY: "auto",
          zIndex: 9999,
        });
      }
    }
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className={clsx(styles.wrapper, fullWidth && styles.fullWidth)} style={style}>
      {label && (
        <label className={styles.label} htmlFor={inputId}>
          {label}
          {showRequired && <span style={{ color: "var(--error-500)", marginLeft: 2 }}>*</span>}
        </label>
      )}
      <div className={clsx(styles.container, className)}>
        <button
          ref={triggerRef}
          id={inputId}
          type="button"
          className={clsx(
            styles.trigger,
            open && styles.triggerOpen,
            error && styles.hasError,
            disabled && styles.disabled
          )}
          onClick={openDropdown}
          disabled={disabled}
        >
          <span className={selected ? styles.triggerValue : styles.triggerPlaceholder}>
            {selected ? selected.label : placeholder ?? "Select…"}
          </span>
          <IconChevronDown size={14} className={clsx(styles.chevron, open && styles.chevronOpen)} />
        </button>
      </div>

      {open &&
        createPortal(
          <div ref={containerRef} className={styles.dropdown} style={dropdownStyle}>
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={clsx(styles.option, opt.value === value && styles.optionActive)}
                onClick={() => {
                  onChange?.(opt.value);
                  setOpen(false);
                }}
              >
                <span>{opt.label}</span>
                {opt.value === value && <IconCheck size={13} className={styles.optionCheck} />}
              </button>
            ))}
          </div>,
          document.body
        )}

      {error && <p className={styles.error}>{error}</p>}
      {!error && hint && <p className={styles.hint}>{hint}</p>}
    </div>
  );
}
