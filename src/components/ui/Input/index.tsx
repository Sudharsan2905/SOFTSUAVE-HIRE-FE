import React, { useId } from "react";
import styles from "./Input.module.css";
import { clsx } from "@/utils/helpers";

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
