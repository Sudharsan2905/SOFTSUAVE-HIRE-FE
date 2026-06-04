import React, { useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import styles from "./Modal.module.css";
import { clsx } from "@/utils/helpers";
import { IconClose } from "@/assets/icons";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  showClose?: boolean;
  footer?: React.ReactNode;
  className?: string;
  disableBackdropClose?: boolean;
  disableEscapeKey?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  showClose = true,
  footer,
  className,
  disableBackdropClose = false,
  disableEscapeKey = false,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const handleEsc = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && !disableEscapeKey) onClose();
    },
    [onClose, disableEscapeKey]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleEsc]);

  useEffect(() => {
    if (!isOpen || disableBackdropClose) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [isOpen, disableBackdropClose, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className={styles.overlay}>
      <dialog
        ref={dialogRef}
        open
        className={clsx(styles.modal, styles[size], className)}
        aria-modal="true"
        aria-label={title}
      >
        {(title || showClose) && (
          <div className={styles.header}>
            {title && <h2 className={styles.title}>{title}</h2>}
            {showClose && (
              <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
                <IconClose size={18} />
              </button>
            )}
          </div>
        )}
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </dialog>
    </div>,
    document.body
  );
}
