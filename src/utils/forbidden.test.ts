import { describe, it, expect } from "vitest";
import { classifyForbidden } from "./forbidden";

describe("classifyForbidden", () => {
  it.each([
    "This assessment has already been completed.",
    "This session has been terminated by an administrator.",
    "This session has ended due to malpractice.",
    "You have already completed this assessment. Please contact admin for re-access.",
  ])("treats %s as finished", (m) => expect(classifyForbidden(m)).toBe("finished"));

  it("detects revoked links", () => {
    expect(classifyForbidden("This link has been revoked")).toBe("revoked");
  });

  it.each([
    "",
    "Your account has been deactivated. Contact support.",
    "Candidate access required",
    "You are not authorized to access this assessment link.",
  ])("does NOT treat %j as finished", (m) => expect(classifyForbidden(m)).toBe("other"));
});
