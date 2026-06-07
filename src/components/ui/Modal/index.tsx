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

export const Modal = React.memo(function Modal({
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
  // Always-current reference to onClose so effects never need it as a dep,
  // preventing re-registration on every parent render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Escape key — only re-registers when isOpen or the flag actually changes.
  useEffect(() => {
    if (!isOpen || disableEscapeKey) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isOpen, disableEscapeKey]);

  // Body scroll lock — stable dep, never re-runs on parent re-render.
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Backdrop close: fires only when the mousedown lands directly on the overlay
  // div itself (e.target === e.currentTarget). This means clicks inside the
  // dialog, or inside any portaled child (Select dropdown, DateTimePicker
  // popup, etc.), never trigger modal close — fixes the dropdown-closes-modal bug.
  const handleOverlayMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!disableBackdropClose && e.target === e.currentTarget) {
        onCloseRef.current();
      }
    },
    [disableBackdropClose]
  );

  if (!isOpen) return null;

  return createPortal(
    <div className={styles.overlay} onMouseDown={handleOverlayMouseDown}>
      <dialog
        open
        className={clsx(styles.modal, styles[size], className)}
        aria-modal="true"
        aria-label={title}
      >
        {(title || showClose) && (
          <div className={styles.header}>
            {title && <h2 className={styles.title}>{title}</h2>}
            {showClose && (
              <button
                className={styles.closeBtn}
                onClick={() => onCloseRef.current()}
                aria-label="Close"
              >
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
});
