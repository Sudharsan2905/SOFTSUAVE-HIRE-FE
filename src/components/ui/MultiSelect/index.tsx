import React, { useState, useRef, useEffect, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./MultiSelect.module.css";
import { clsx } from "@/utils/helpers";
import { IconChevronDown, IconCheck } from "@/assets/icons";

interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  label?: string;
  hint?: string;
  options: readonly MultiSelectOption[];
  value: readonly string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  /** Upper limit on how many options can be chosen at once. */
  maxSelected?: number;
  fullWidth?: boolean;
  disabled?: boolean;
  id?: string;
  leftIcon?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function MultiSelect({
  label,
  hint,
  options,
  value,
  onChange,
  placeholder,
  maxSelected,
  fullWidth = true,
  disabled,
  id,
  leftIcon,
  className,
  style,
}: Readonly<MultiSelectProps>) {
  const uid = useId();
  const inputId = id ?? `multiselect-${uid}`;
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selected = new Set(value);
  const limitReached = maxSelected !== undefined && selected.size >= maxSelected;
  const selectedOptions = options.filter((o) => selected.has(o.value));

  let triggerText: string = placeholder ?? "Select…";
  if (selectedOptions.length === 1) triggerText = selectedOptions[0].label;
  else if (selectedOptions.length > 1) triggerText = `${selectedOptions.length} selected`;

  const openDropdown = () => {
    if (disabled) return;
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const estimatedHeight = Math.min(options.length * 38 + 48, 320);
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const openUp = spaceBelow < estimatedHeight + 8 && spaceAbove > spaceBelow;
      const common: React.CSSProperties = {
        position: "fixed",
        left: rect.left,
        width: Math.max(rect.width, 240),
        overflowY: "auto",
        zIndex: 9999,
      };
      setDropdownStyle(
        openUp
          ? {
              ...common,
              bottom: window.innerHeight - rect.top + 4,
              maxHeight: Math.min(spaceAbove - 8, 320),
            }
          : { ...common, top: rect.bottom + 4, maxHeight: Math.min(spaceBelow - 8, 320) }
      );
    }
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!dropdownRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const toggle = (optionValue: string) => {
    if (selected.has(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else if (!limitReached) {
      onChange([...value, optionValue]);
    }
  };

  const selectAll = () => {
    const all = options.map((o) => o.value);
    onChange(maxSelected === undefined ? all : all.slice(0, maxSelected));
  };

  return (
    <div className={clsx(styles.wrapper, fullWidth && styles.fullWidth)} style={style}>
      {label && (
        <label className={styles.label} htmlFor={inputId}>
          {label}
        </label>
      )}
      <button
        ref={triggerRef}
        id={inputId}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        className={clsx(
          styles.trigger,
          open && styles.triggerOpen,
          disabled && styles.disabled,
          className
        )}
        onClick={openDropdown}
        disabled={disabled}
      >
        {leftIcon}
        <span className={selectedOptions.length ? styles.triggerValue : styles.triggerPlaceholder}>
          {triggerText}
        </span>
        <IconChevronDown size={14} className={clsx(styles.chevron, open && styles.chevronOpen)} />
      </button>

      {open &&
        createPortal(
          <div ref={dropdownRef} className={styles.dropdown} style={dropdownStyle}>
            <div className={styles.actions}>
              <span className={styles.count}>
                {selectedOptions.length}
                {maxSelected !== undefined ? ` / ${maxSelected}` : ""} selected
              </span>
              <span className={styles.actionButtons}>
                <button type="button" className={styles.actionBtn} onClick={selectAll}>
                  Select all
                </button>
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={() => onChange([])}
                  disabled={selectedOptions.length === 0}
                >
                  Clear
                </button>
              </span>
            </div>
            <div role="listbox" aria-multiselectable="true" aria-label={label ?? placeholder}>
              {options.length === 0 && <p className={styles.empty}>No options</p>}
              {options.map((opt) => {
                const isSelected = selected.has(opt.value);
                const blocked = !isSelected && limitReached;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={blocked}
                    className={clsx(styles.option, isSelected && styles.optionActive)}
                    onClick={() => toggle(opt.value)}
                  >
                    <span className={clsx(styles.box, isSelected && styles.boxChecked)}>
                      {isSelected && <IconCheck size={11} strokeWidth={3} />}
                    </span>
                    <span className={styles.optionLabel}>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )}

      {hint && <p className={styles.hint}>{hint}</p>}
    </div>
  );
}
