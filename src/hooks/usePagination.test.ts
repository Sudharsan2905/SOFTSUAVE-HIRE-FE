import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePagination } from "./usePagination";

describe("usePagination", () => {
  it("starts on page 1 with default page size", () => {
    const { result } = renderHook(() => usePagination());
    expect(result.current.page).toBe(1);
    expect(result.current.pageSize).toBeGreaterThan(0);
  });

  it("accepts a custom initial page size", () => {
    const { result } = renderHook(() => usePagination(25));
    expect(result.current.pageSize).toBe(25);
  });

  it("goToPage changes the current page", () => {
    const { result } = renderHook(() => usePagination());
    act(() => result.current.goToPage(3));
    expect(result.current.page).toBe(3);
  });

  it("reset brings page back to 1", () => {
    const { result } = renderHook(() => usePagination());
    act(() => result.current.goToPage(5));
    act(() => result.current.reset());
    expect(result.current.page).toBe(1);
  });

  it("changePageSize updates pageSize and resets to page 1", () => {
    const { result } = renderHook(() => usePagination());
    act(() => result.current.goToPage(4));
    act(() => result.current.changePageSize(50));
    expect(result.current.pageSize).toBe(50);
    expect(result.current.page).toBe(1);
  });
});
