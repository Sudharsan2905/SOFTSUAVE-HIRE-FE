import { describe, it, expect, vi } from "vitest";
import axios from "axios";

vi.mock("@/store", () => ({
  store: {
    getState: () => ({ auth: { accessToken: null, refreshToken: null } }),
    dispatch: vi.fn(),
  },
}));

// Import after mocks are registered
import { extractApiErrorMessage } from "./api";

describe("extractApiErrorMessage", () => {
  it("returns the API message from an AxiosError response", () => {
    const err = new axios.AxiosError("Request failed");
    err.response = { data: { message: "Unauthorized" }, status: 401 } as never;
    expect(extractApiErrorMessage(err, "fallback")).toBe("Unauthorized");
  });

  it("returns fallback when AxiosError has no response", () => {
    const err = new axios.AxiosError("Network error");
    expect(extractApiErrorMessage(err, "fallback")).toBe("fallback");
  });

  it("returns fallback when AxiosError response.data has no message", () => {
    const err = new axios.AxiosError("Bad request");
    err.response = { data: {}, status: 400 } as never;
    expect(extractApiErrorMessage(err, "default msg")).toBe("default msg");
  });

  it("returns fallback for a plain Error (not axios)", () => {
    expect(extractApiErrorMessage(new Error("oops"), "fallback")).toBe("fallback");
  });

  it("returns fallback for null", () => {
    expect(extractApiErrorMessage(null, "fallback")).toBe("fallback");
  });

  it("returns fallback for undefined", () => {
    expect(extractApiErrorMessage(undefined, "fallback")).toBe("fallback");
  });

  it("returns fallback for a plain object", () => {
    expect(extractApiErrorMessage({ message: "nope" }, "fallback")).toBe("fallback");
  });

  it("returns empty string as fallback when provided", () => {
    expect(extractApiErrorMessage(new Error("x"), "")).toBe("");
  });
});
