import React, { useId, useState, useEffect } from "react";
import styles from "./Input.module.css";
import { clsx } from "@/utils/helpers";
import { IconChevronUp, IconChevronDown } from "@/assets/icons";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
  fullWidth?: boolean;
  showRequired?: boolean;
}

function InputInner(
  {
    label,
    error,
    hint,
    leftElement,
    rightElement,
    fullWidth = true,
    className,
    id,
    name,
    showRequired,
    ...rest
  }: InputProps,
  ref: React.ForwardedRef<HTMLInputElement>
) {
  const uid = useId();
  const inputId = id ?? `input-${uid}`;
  const fieldName = name;

  const errorId = error ? `${inputId}-error` : undefined;
  const hintId = !error && hint ? `${inputId}-hint` : undefined;
  const describedBy = errorId ?? hintId;

  return (
    <div className={clsx(styles.wrapper, fullWidth && styles.fullWidth)}>
      {label && (
        <label className={styles.label} htmlFor={inputId}>
          {label}
          {showRequired && <span style={{ color: "var(--error-500)", marginLeft: 2 }}>*</span>}
        </label>
      )}
      <div className={clsx(styles.inputWrapper, error && styles.hasError)}>
        {leftElement && <span className={styles.leftEl}>{leftElement}</span>}
        <input
          ref={ref}
          id={inputId}
          name={fieldName}
          className={clsx(
            styles.input,
            leftElement ? styles.hasLeft : undefined,
            rightElement ? styles.hasRight : undefined,
            className
          )}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
        {rightElement && <span className={styles.rightEl}>{rightElement}</span>}
      </div>
      {error && (
        <p id={errorId} className={styles.error} role="alert" aria-live="polite">
          {error}
        </p>
      )}
      {!error && hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
    </div>
  );
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(InputInner);
Input.displayName = "Input";

interface NumberFieldProps extends Omit<InputProps, "value" | "onChange" | "type" | "min" | "max"> {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onValueChange: (value: number) => void;
}

export function NumberField({
  value,
  min,
  max,
  step = 1,
  disabled,
  onValueChange,
  ...rest
}: Readonly<NumberFieldProps>) {
  const [text, setText] = useState(() => String(value));

  useEffect(() => {
    if (Number(text) !== value) setText(String(value));
  }, [value]);

  const clamp = (n: number) => {
    let next = min !== undefined ? Math.max(min, n) : n;
    if (max !== undefined) next = Math.min(max, next);
    return next;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Strip a leading zero ("0123" -> "123"); show "0" when the field is empty.
    const stripped = e.target.value.replace(/^0+(?=\d)/, "");
    const display = stripped === "" ? "0" : stripped;
    setText(display);
    onValueChange(Number(display));
  };

  const handleBlur = () => {
    const next = clamp(Number(text));
    onValueChange(next);
    setText(String(next));
  };

  const handleStep = (direction: 1 | -1) => {
    const next = clamp(Number(text) + direction * step);
    onValueChange(next);
    setText(String(next));
  };

  const current = Number(text);
  const atMin = min !== undefined && current <= min;
  const atMax = max !== undefined && current >= max;

  const stepper = (
    <span className={styles.stepper} aria-hidden="true">
      <button
        type="button"
        tabIndex={-1}
        className={styles.stepBtn}
        disabled={disabled || atMax}
        onClick={() => handleStep(1)}
      >
        <IconChevronUp size={12} />
      </button>
      <button
        type="button"
        tabIndex={-1}
        className={styles.stepBtn}
        disabled={disabled || atMin}
        onClick={() => handleStep(-1)}
      >
        <IconChevronDown size={12} />
      </button>
    </span>
  );

  return (
    <Input
      {...rest}
      type="number"
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      value={text}
      onChange={handleChange}
      onBlur={handleBlur}
      className={clsx(styles.numberInput, rest.className)}
      rightElement={stepper}
    />
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  fullWidth?: boolean;
}

function TextareaInner(
  { label, error, hint, fullWidth = true, className, id, name, ...rest }: TextareaProps,
  ref: React.ForwardedRef<HTMLTextAreaElement>
) {
  const uid = useId();
  const inputId = id ?? `textarea-${uid}`;
  const fieldName = name;

  const errorId = error ? `${inputId}-error` : undefined;
  const hintId = !error && hint ? `${inputId}-hint` : undefined;
  const describedBy = errorId ?? hintId;

  return (
    <div className={clsx(styles.wrapper, fullWidth && styles.fullWidth)}>
      {label && (
        <label className={styles.label} htmlFor={inputId}>
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={inputId}
        name={fieldName}
        className={clsx(styles.textarea, error && styles.textareaError, className)}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
      {error && (
        <p id={errorId} className={styles.error} role="alert" aria-live="polite">
          {error}
        </p>
      )}
      {!error && hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
    </div>
  );
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(TextareaInner);
Textarea.displayName = "Textarea";
