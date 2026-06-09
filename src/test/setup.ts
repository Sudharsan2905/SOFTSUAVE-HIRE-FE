import "@testing-library/jest-dom";
import { vi, afterEach } from "vitest";

// jsdom does not implement matchMedia — provide a minimal stub so modules that
// call it at import time (e.g. uiSlice) don't throw.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// navigator.clipboard is not available in jsdom.
// configurable: true is required so that @testing-library/user-event can
// temporarily override the clipboard API for its own paste/cut simulation.
Object.defineProperty(navigator, "clipboard", {
  writable: true,
  configurable: true,
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue(""),
  },
});

// URL.createObjectURL / revokeObjectURL used by downloadBlob helper
Object.defineProperty(URL, "createObjectURL", {
  writable: true,
  value: vi.fn(() => "mock-object-url"),
});
Object.defineProperty(URL, "revokeObjectURL", {
  writable: true,
  value: vi.fn(),
});

// Reset storage and mocks after every test to prevent state leakage
afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
});
