import React from "react";
import styles from "./Button.module.css";
import { clsx } from "@/utils/helpers";
import { Tooltip } from "../Tooltip";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      className,
      title, // intercepted — prevents native browser tooltip; routed to branded Tooltip
      ...rest
    },
    ref
  ) => {
    const btn = (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={clsx(
          styles.button,
          styles[variant],
          styles[size],
          fullWidth && styles.fullWidth,
          isLoading && styles.loading,
          className
        )}
        {...rest}
      >
        {isLoading ? (
          <span className={styles.spinner} aria-hidden="true" />
        ) : leftIcon ? (
          <span className={styles.icon}>{leftIcon}</span>
        ) : null}
        {children && <span>{children}</span>}
        {!isLoading && rightIcon && <span className={styles.icon}>{rightIcon}</span>}
      </button>
    );

    if (!title) return btn;

    // Disabled/loading buttons don't fire mouse events in all browsers.
    // Wrap in a focusable span so the Tooltip can still trigger on hover.
    if (disabled || isLoading) {
      return (
        <Tooltip content={title}>
          <span
            style={{ display: "inline-flex", cursor: "not-allowed" }}
            aria-label={title}
          >
            {React.cloneElement(btn, {
              style: { pointerEvents: "none", ...(rest.style ?? {}) },
            })}
          </span>
        </Tooltip>
      );
    }

    return <Tooltip content={title}>{btn}</Tooltip>;
  }
);
Button.displayName = "Button";
