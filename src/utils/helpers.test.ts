import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getFullName,
  getAvatarColor,
  getInitials,
  formatDuration,
  clsx,
  generateShareUrl,
  copyToClipboard,
  downloadBlob,
  percentageBadgeColor,
  debounce,
} from "./helpers";
import { AVATAR_COLORS } from "@/constants/app";

// ---------------------------------------------------------------------------
// getFullName
// ---------------------------------------------------------------------------

describe("getFullName", () => {
  it("joins first_name and last_name with a space", () => {
    expect(getFullName({ first_name: "John", last_name: "Doe" })).toBe("John Doe");
  });

  it("returns only first_name when last_name is undefined", () => {
    expect(getFullName({ first_name: "Alice" })).toBe("Alice");
  });

  it("omits empty last_name", () => {
    expect(getFullName({ first_name: "Bob", last_name: "" })).toBe("Bob");
  });
});

// ---------------------------------------------------------------------------
// getInitials
// ---------------------------------------------------------------------------

describe("getInitials", () => {
  it("returns '?' for an empty string", () => {
    expect(getInitials("")).toBe("?");
  });

  it("returns uppercase initial for a single word", () => {
    expect(getInitials("alice")).toBe("A");
  });

  it("returns up to 2 initials for a two-word name", () => {
    expect(getInitials("John Doe")).toBe("JD");
  });

  it("caps result at 2 characters for names with more than 2 words", () => {
    expect(getInitials("John Michael Doe")).toBe("JM");
  });

  it("uppercases each initial", () => {
    expect(getInitials("john doe")).toBe("JD");
  });
});

// ---------------------------------------------------------------------------
// getAvatarColor
// ---------------------------------------------------------------------------

describe("getAvatarColor", () => {
  it("returns the first AVATAR_COLOR for an empty name", () => {
    expect(getAvatarColor("")).toBe(AVATAR_COLORS[0]);
  });

  it("returns a value from AVATAR_COLORS for any given name", () => {
    const color = getAvatarColor("Alice");
    expect(AVATAR_COLORS as readonly string[]).toContain(color);
  });

  it("returns the same color for the same name (deterministic)", () => {
    expect(getAvatarColor("TestUser")).toBe(getAvatarColor("TestUser"));
  });

  it("produces different colors for different names (distribution check)", () => {
    const names = ["Alice", "Bob", "Charlie", "Diana", "Eve", "Frank", "Grace"];
    const uniqueColors = new Set(names.map(getAvatarColor));
    expect(uniqueColors.size).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// formatDuration
// ---------------------------------------------------------------------------

describe("formatDuration", () => {
  it("formats 0 minutes as '0 min'", () => {
    expect(formatDuration(0)).toBe("0 min");
  });

  it("formats minutes under 60 as '# min'", () => {
    expect(formatDuration(30)).toBe("30 min");
    expect(formatDuration(59)).toBe("59 min");
  });

  it("formats exact hours as '#h' with no trailing minutes", () => {
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(120)).toBe("2h");
  });

  it("formats hours and leftover minutes as '#h #min'", () => {
    expect(formatDuration(90)).toBe("1h 30min");
    expect(formatDuration(150)).toBe("2h 30min");
    expect(formatDuration(61)).toBe("1h 1min");
  });
});

// ---------------------------------------------------------------------------
// clsx
// ---------------------------------------------------------------------------

describe("clsx", () => {
  it("joins multiple class strings with a space", () => {
    expect(clsx("foo", "bar", "baz")).toBe("foo bar baz");
  });

  it("filters out undefined, null, and false values", () => {
    expect(clsx("foo", undefined, null, false, "bar")).toBe("foo bar");
  });

  it("returns an empty string when all values are falsy", () => {
    expect(clsx(undefined, null, false)).toBe("");
  });

  it("handles a single class", () => {
    expect(clsx("only")).toBe("only");
  });
});

// ---------------------------------------------------------------------------
// generateShareUrl
// ---------------------------------------------------------------------------

describe("generateShareUrl", () => {
  it("builds a full URL using window.location.origin and the share link", () => {
    const url = generateShareUrl("abc123");
    expect(url).toBe(`${window.location.origin}/assessment/abc123`);
  });
});

// ---------------------------------------------------------------------------
// copyToClipboard
// ---------------------------------------------------------------------------

describe("copyToClipboard", () => {
  it("calls navigator.clipboard.writeText with the provided text", async () => {
    await copyToClipboard("Hello, World!");
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("Hello, World!");
  });

  it("returns a Promise that resolves", async () => {
    await expect(copyToClipboard("test")).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// downloadBlob
// ---------------------------------------------------------------------------

describe("downloadBlob", () => {
  it("creates an anchor element, sets href+download, clicks it, then revokes the URL", () => {
    const clickMock = vi.fn();
    const anchorEl = { href: "", download: "", click: clickMock } as unknown as HTMLAnchorElement;
    const createElementSpy = vi.spyOn(document, "createElement").mockReturnValueOnce(anchorEl);

    const blob = new Blob(["data"], { type: "text/plain" });
    downloadBlob(blob, "report.txt");

    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(anchorEl.download).toBe("report.txt");
    expect(clickMock).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("mock-object-url");

    createElementSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// percentageBadgeColor
// ---------------------------------------------------------------------------

describe("percentageBadgeColor", () => {
  it("returns 'success' for 75", () => expect(percentageBadgeColor(75)).toBe("success"));
  it("returns 'success' for 100", () => expect(percentageBadgeColor(100)).toBe("success"));
  it("returns 'warning' for 50", () => expect(percentageBadgeColor(50)).toBe("warning"));
  it("returns 'warning' for 74", () => expect(percentageBadgeColor(74)).toBe("warning"));
  it("returns 'error' for 49", () => expect(percentageBadgeColor(49)).toBe("error"));
  it("returns 'error' for 0", () => expect(percentageBadgeColor(0)).toBe("error"));
});

// ---------------------------------------------------------------------------
// debounce
// ---------------------------------------------------------------------------

describe("debounce", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("does not invoke the function before the delay has elapsed", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced("arg");
    expect(fn).not.toHaveBeenCalled();
  });

  it("invokes the function exactly once after the delay", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced("arg");
    vi.advanceTimersByTime(300);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("arg");
  });

  it("resets the timer on rapid successive calls (only last call fires)", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced("first");
    vi.advanceTimersByTime(100);
    debounced("second");
    vi.advanceTimersByTime(100);
    debounced("third");
    vi.advanceTimersByTime(300);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("third");
  });

  it("allows multiple separate invocations after the delay each time", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 200);

    debounced("a");
    vi.advanceTimersByTime(200);
    debounced("b");
    vi.advanceTimersByTime(200);

    expect(fn).toHaveBeenCalledTimes(2);
  });
});
