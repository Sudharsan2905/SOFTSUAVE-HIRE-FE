import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRef } from "react";
import { useClickOutside } from "./useClickOutside";
import { fireEvent } from "@testing-library/dom";

function setup(enabled = true) {
  const handler = vi.fn();
  const container = document.createElement("div");
  document.body.appendChild(container);

  const { unmount } = renderHook(() => {
    const ref = useRef<HTMLDivElement>(container);
    useClickOutside(ref, handler, enabled);
  });

  return { handler, container, unmount };
}

describe("useClickOutside", () => {
  it("calls handler when clicking outside the element", () => {
    const { handler, unmount } = setup();
    fireEvent.pointerDown(document.body);
    expect(handler).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("does NOT call handler when clicking inside the element", () => {
    const { handler, container, unmount } = setup();
    const inner = document.createElement("button");
    container.appendChild(inner);
    fireEvent.pointerDown(inner);
    expect(handler).not.toHaveBeenCalled();
    unmount();
  });

  it("does NOT call handler when enabled=false", () => {
    const { handler, unmount } = setup(false);
    fireEvent.pointerDown(document.body);
    expect(handler).not.toHaveBeenCalled();
    unmount();
  });

  it("removes the event listener on unmount", () => {
    const { handler, unmount } = setup();
    unmount();
    fireEvent.pointerDown(document.body);
    expect(handler).not.toHaveBeenCalled();
  });
});
