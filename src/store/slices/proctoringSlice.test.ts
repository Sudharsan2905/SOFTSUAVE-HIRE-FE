import { describe, it, expect } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import proctoringReducer, {
  setMalpracticeCount,
  setLastViolation,
  dismissWarning,
  setTerminated,
  resetProctoring,
} from "./proctoringSlice";

function makeStore() {
  return configureStore({ reducer: { proctoring: proctoringReducer } });
}

describe("proctoringSlice — reducers", () => {
  describe("initial state", () => {
    it("starts with zero counts and no violations", () => {
      const state = makeStore().getState().proctoring;
      expect(state.malpracticeCount).toBe(0);
      expect(state.totalMalpracticeLimit).toBe(3);
      expect(state.lastViolationType).toBeNull();
      expect(state.isWarningVisible).toBe(false);
      expect(state.warningMessage).toBe("");
      expect(state.isTerminated).toBe(false);
      expect(state.terminationReason).toBeNull();
    });
  });

  describe("setMalpracticeCount", () => {
    it("updates malpracticeCount", () => {
      const store = makeStore();
      store.dispatch(setMalpracticeCount(2));
      expect(store.getState().proctoring.malpracticeCount).toBe(2);
    });

    it("accepts zero", () => {
      const store = makeStore();
      store.dispatch(setMalpracticeCount(5));
      store.dispatch(setMalpracticeCount(0));
      expect(store.getState().proctoring.malpracticeCount).toBe(0);
    });
  });

  describe("setLastViolation", () => {
    it("sets violation type, message, and shows warning", () => {
      const store = makeStore();
      store.dispatch(setLastViolation({ type: "tab_switch", message: "Tab switch detected" }));
      const state = store.getState().proctoring;
      expect(state.lastViolationType).toBe("tab_switch");
      expect(state.warningMessage).toBe("Tab switch detected");
      expect(state.isWarningVisible).toBe(true);
    });

    it("overwrites a previous violation", () => {
      const store = makeStore();
      store.dispatch(setLastViolation({ type: "tab_switch", message: "First" }));
      store.dispatch(setLastViolation({ type: "face_absence", message: "Second" }));
      const state = store.getState().proctoring;
      expect(state.lastViolationType).toBe("face_absence");
      expect(state.warningMessage).toBe("Second");
    });
  });

  describe("dismissWarning", () => {
    it("hides the warning but retains the last violation type", () => {
      const store = makeStore();
      store.dispatch(setLastViolation({ type: "tab_switch", message: "Detected" }));
      store.dispatch(dismissWarning());
      const state = store.getState().proctoring;
      expect(state.isWarningVisible).toBe(false);
      expect(state.lastViolationType).toBe("tab_switch");
    });
  });

  describe("setTerminated", () => {
    it("marks session as terminated with reason and hides warning", () => {
      const store = makeStore();
      store.dispatch(setLastViolation({ type: "multiple_faces", message: "Multiple faces" }));
      store.dispatch(setTerminated({ reason: "Too many violations" }));
      const state = store.getState().proctoring;
      expect(state.isTerminated).toBe(true);
      expect(state.terminationReason).toBe("Too many violations");
      expect(state.isWarningVisible).toBe(false);
    });
  });

  describe("resetProctoring", () => {
    it("resets all fields to initial state", () => {
      const store = makeStore();
      store.dispatch(setMalpracticeCount(3));
      store.dispatch(setLastViolation({ type: "tab_switch", message: "Switch" }));
      store.dispatch(setTerminated({ reason: "Done" }));
      store.dispatch(resetProctoring());
      const state = store.getState().proctoring;
      expect(state.malpracticeCount).toBe(0);
      expect(state.lastViolationType).toBeNull();
      expect(state.isWarningVisible).toBe(false);
      expect(state.isTerminated).toBe(false);
      expect(state.terminationReason).toBeNull();
    });
  });
});
