import React, { useState, useRef, useCallback, useId, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import styles from "./Tooltip.module.css";
import { clsx } from "@/utils/helpers";

type Placement = "top" | "bottom" | "left" | "right";

interface TooltipProps {
  content: string;
  children: React.ReactElement;
  placement?: Placement;
  disabled?: boolean;
  delayMs?: number;
}

interface TooltipPos {
  top: number;
  left: number;
  placement: Placement;
}

function mergeRefs<T>(
  ...refs: Array<React.Ref<T> | null | undefined>
): React.RefCallback<T> {
  return (node) => {
    refs.forEach((ref) => {
      if (typeof ref === "function") ref(node);
      else if (ref != null)
        (ref as React.MutableRefObject<T | null>).current = node;
    });
  };
}

function computePosition(
  anchor: DOMRect,
  tip: { width: number; height: number },
  placement: Placement,
  gap = 8
): TooltipPos {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const positions: Record<Placement, TooltipPos> = {
    top: {
      top: anchor.top - tip.height - gap,
      left: anchor.left + anchor.width / 2 - tip.width / 2,
      placement: "top",
    },
    bottom: {
      top: anchor.bottom + gap,
      left: anchor.left + anchor.width / 2 - tip.width / 2,
      placement: "bottom",
    },
    left: {
      top: anchor.top + anchor.height / 2 - tip.height / 2,
      left: anchor.left - tip.width - gap,
      placement: "left",
    },
    right: {
      top: anchor.top + anchor.height / 2 - tip.height / 2,
      left: anchor.right + gap,
      placement: "right",
    },
  };

  const preferred = positions[placement];
  const fallbacks = (["top", "bottom", "right", "left"] as Placement[]).filter(
    (p) => p !== placement
  );

  const fits = (pos: TooltipPos) =>
    pos.top >= 4 &&
    pos.top + tip.height <= vh - 4 &&
    pos.left >= 4 &&
    pos.left + tip.width <= vw - 4;

  if (fits(preferred)) return preferred;
  for (const fb of fallbacks) {
    if (fits(positions[fb])) return positions[fb];
  }

  return {
    ...preferred,
    top: Math.max(4, Math.min(preferred.top, vh - tip.height - 4)),
    left: Math.max(4, Math.min(preferred.left, vw - tip.width - 4)),
  };
}

export function Tooltip({
  content,
  children,
  placement = "top",
  disabled = false,
  delayMs = 280,
}: Readonly<TooltipProps>) {
  const uid = useId();
  const tipId = `tooltip-${uid}`;
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<TooltipPos | null>(null);
  const anchorRef = useRef<HTMLElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (touchHideTimer.current) clearTimeout(touchHideTimer.current);
  }, []);

  const show = useCallback(() => {
    if (disabled || !content) return;
    clearTimers();
    timer.current = setTimeout(() => {
      if (!anchorRef.current) return;
      const rect = anchorRef.current.getBoundingClientRect();
      const estimated = { width: content.length * 7 + 24, height: 32 };
      setPos(computePosition(rect, estimated, placement));
      setVisible(true);
    }, delayMs);
  }, [disabled, content, placement, delayMs, clearTimers]);

  const hide = useCallback(() => {
    clearTimers();
    setVisible(false);
  }, [clearTimers]);

  // Touch: show briefly then auto-dismiss so it doesn't persist
  const showTouch = useCallback(() => {
    if (disabled || !content) return;
    clearTimers();
    timer.current = setTimeout(() => {
      if (!anchorRef.current) return;
      const rect = anchorRef.current.getBoundingClientRect();
      const estimated = { width: content.length * 7 + 24, height: 32 };
      setPos(computePosition(rect, estimated, placement));
      setVisible(true);
      touchHideTimer.current = setTimeout(() => setVisible(false), 1800);
    }, 80);
  }, [disabled, content, placement, clearTimers]);

  // Refine position with actual rendered dimensions — runs once per visibility toggle
  useLayoutEffect(() => {
    if (!visible || !tipRef.current || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const tipRect = tipRef.current.getBoundingClientRect();
    setPos(
      computePosition(
        rect,
        { width: tipRect.width, height: tipRect.height },
        placement
      )
    );
  }, [visible, placement]);

  // Dismiss on scroll
  useLayoutEffect(() => {
    if (!visible) return;
    const handler = () => hide();
    window.addEventListener("scroll", handler, { passive: true, capture: true });
    return () => window.removeEventListener("scroll", handler, { capture: true });
  }, [visible, hide]);

  const childRef = (children as React.ReactElement & { ref?: React.Ref<HTMLElement> }).ref;

  const child = React.cloneElement(children, {
    ref: childRef ? mergeRefs(anchorRef, childRef) : anchorRef,
    onMouseEnter: (e: React.MouseEvent) => {
      show();
      (children.props as { onMouseEnter?: (e: React.MouseEvent) => void }).onMouseEnter?.(e);
    },
    onMouseLeave: (e: React.MouseEvent) => {
      hide();
      (children.props as { onMouseLeave?: (e: React.MouseEvent) => void }).onMouseLeave?.(e);
    },
    onFocus: (e: React.FocusEvent) => {
      show();
      (children.props as { onFocus?: (e: React.FocusEvent) => void }).onFocus?.(e);
    },
    onBlur: (e: React.FocusEvent) => {
      hide();
      (children.props as { onBlur?: (e: React.FocusEvent) => void }).onBlur?.(e);
    },
    onTouchStart: (e: React.TouchEvent) => {
      showTouch();
      (children.props as { onTouchStart?: (e: React.TouchEvent) => void }).onTouchStart?.(e);
    },
    onTouchEnd: (e: React.TouchEvent) => {
      (children.props as { onTouchEnd?: (e: React.TouchEvent) => void }).onTouchEnd?.(e);
    },
    onTouchMove: (e: React.TouchEvent) => {
      hide();
      (children.props as { onTouchMove?: (e: React.TouchEvent) => void }).onTouchMove?.(e);
    },
    "aria-describedby": visible ? tipId : undefined,
  });

  return (
    <>
      {child}
      {visible && pos &&
        createPortal(
          <div
            ref={tipRef}
            id={tipId}
            role="tooltip"
            className={clsx(styles.tooltip, styles[pos.placement])}
            style={{ top: pos.top, left: pos.left }}
          >
            {content}
          </div>,
          document.body
        )}
    </>
  );
}
