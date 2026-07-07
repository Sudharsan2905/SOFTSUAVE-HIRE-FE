import { useState, useCallback } from "react";
import { REGEX } from "@/constants/validation";

function parseRawInput(raw: string): string[] {
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
}

export interface UseRestrictedEmailsReturn {
  rawInput: string;
  setRawInput: (v: string) => void;
  emails: string[];
  inputError: string;
  commitInput: () => void;
  removeEmail: (email: string) => void;
  loadEmails: (emails: string[]) => void;
  reset: () => void;
}

export function useRestrictedEmails(): UseRestrictedEmailsReturn {
  const [rawInput, setRawInputState] = useState("");
  const [emails, setEmails] = useState<string[]>([]);
  const [inputError, setInputError] = useState("");

  const setRawInput = useCallback((v: string) => {
    setRawInputState(v);
    setInputError("");
  }, []);

  const commitInput = useCallback(() => {
    const parsed = parseRawInput(rawInput);
    if (parsed.length === 0) return;

    const invalid = parsed.filter((e) => !REGEX.EMAIL.test(e));
    if (invalid.length > 0) {
      setInputError(
        `Invalid email${invalid.length > 1 ? "s" : ""}: ${invalid.join(", ")}`
      );
      return;
    }

    setInputError("");
    setEmails((prev) => {
      const existing = new Set(prev);
      const fresh = parsed.filter((e) => !existing.has(e));
      return [...prev, ...fresh];
    });
    setRawInputState("");
  }, [rawInput]);

  const removeEmail = useCallback((email: string) => {
    setEmails((prev) => prev.filter((e) => e !== email));
  }, []);

  const loadEmails = useCallback((loaded: string[]) => {
    setEmails(loaded);
  }, []);

  const reset = useCallback(() => {
    setRawInputState("");
    setEmails([]);
    setInputError("");
  }, []);

  return { rawInput, setRawInput, emails, inputError, commitInput, removeEmail, loadEmails, reset };
}
