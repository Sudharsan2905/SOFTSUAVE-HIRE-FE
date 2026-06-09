import { describe, it, expect, beforeEach } from "vitest";
import {
  assessmentSessionKey,
  assessmentDoneKey,
  saveSubmissionId,
  getSubmissionId,
  markAssessmentDone,
  isAssessmentDone,
  clearAssessmentSession,
  saveLocalTimerState,
  getLocalTimerState,
  saveLocalQuestionIdx,
  getLocalQuestionIdx,
} from "./assessmentSession";

const LINK = "abc123";

beforeEach(() => sessionStorage.clear());

describe("key helpers", () => {
  it("assessmentSessionKey returns scoped key", () => {
    expect(assessmentSessionKey(LINK)).toBe(`ssh_sub_${LINK}`);
  });

  it("assessmentDoneKey returns scoped key", () => {
    expect(assessmentDoneKey(LINK)).toBe(`ssh_done_${LINK}`);
  });
});

describe("submission ID", () => {
  it("saves and retrieves a submission ID", () => {
    saveSubmissionId(LINK, "sub-42");
    expect(getSubmissionId(LINK)).toBe("sub-42");
  });

  it("returns null when no submission ID has been saved", () => {
    expect(getSubmissionId(LINK)).toBeNull();
  });

  it("overwrites an existing submission ID", () => {
    saveSubmissionId(LINK, "sub-1");
    saveSubmissionId(LINK, "sub-2");
    expect(getSubmissionId(LINK)).toBe("sub-2");
  });
});

describe("assessment done marker", () => {
  it("isAssessmentDone returns false before marking", () => {
    expect(isAssessmentDone(LINK)).toBe(false);
  });

  it("marks as done and returns true", () => {
    markAssessmentDone(LINK);
    expect(isAssessmentDone(LINK)).toBe(true);
  });

  it("different share links are independent", () => {
    markAssessmentDone("link-a");
    expect(isAssessmentDone("link-b")).toBe(false);
  });
});

describe("clearAssessmentSession", () => {
  it("removes submission ID, done marker, timer, and question index", () => {
    saveSubmissionId(LINK, "sub-1");
    markAssessmentDone(LINK);
    saveLocalTimerState(LINK, 120);
    saveLocalQuestionIdx(LINK, 3);

    clearAssessmentSession(LINK);

    expect(getSubmissionId(LINK)).toBeNull();
    expect(isAssessmentDone(LINK)).toBe(false);
    expect(getLocalTimerState(LINK)).toBeNull();
    expect(getLocalQuestionIdx(LINK)).toBe(0);
  });

  it("does not affect a different share link", () => {
    saveSubmissionId("other", "sub-9");
    clearAssessmentSession(LINK);
    expect(getSubmissionId("other")).toBe("sub-9");
  });
});

describe("timer state", () => {
  it("saves and retrieves remaining seconds", () => {
    saveLocalTimerState(LINK, 300);
    expect(getLocalTimerState(LINK)).toBe(300);
  });

  it("returns null when nothing saved", () => {
    expect(getLocalTimerState(LINK)).toBeNull();
  });

  it("overwrites previous timer value", () => {
    saveLocalTimerState(LINK, 300);
    saveLocalTimerState(LINK, 250);
    expect(getLocalTimerState(LINK)).toBe(250);
  });

  it("returns null for non-numeric stored value", () => {
    sessionStorage.setItem(`ssh_timer_${LINK}`, "not-a-number");
    expect(getLocalTimerState(LINK)).toBeNull();
  });

  it("saves and retrieves zero seconds", () => {
    saveLocalTimerState(LINK, 0);
    expect(getLocalTimerState(LINK)).toBe(0);
  });
});

describe("question index", () => {
  it("saves and retrieves an index", () => {
    saveLocalQuestionIdx(LINK, 5);
    expect(getLocalQuestionIdx(LINK)).toBe(5);
  });

  it("returns 0 when nothing saved", () => {
    expect(getLocalQuestionIdx(LINK)).toBe(0);
  });

  it("returns 0 for non-numeric stored value", () => {
    sessionStorage.setItem(`ssh_qidx_${LINK}`, "bad");
    expect(getLocalQuestionIdx(LINK)).toBe(0);
  });

  it("returns 0 for negative stored value", () => {
    sessionStorage.setItem(`ssh_qidx_${LINK}`, "-1");
    expect(getLocalQuestionIdx(LINK)).toBe(0);
  });

  it("overwrites previous index", () => {
    saveLocalQuestionIdx(LINK, 2);
    saveLocalQuestionIdx(LINK, 7);
    expect(getLocalQuestionIdx(LINK)).toBe(7);
  });
});
