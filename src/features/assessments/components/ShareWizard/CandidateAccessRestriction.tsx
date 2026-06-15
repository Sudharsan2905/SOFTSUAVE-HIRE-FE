import React, { useState } from "react";
import styles from "./ShareWizard.module.css";
import { SkeuToggle } from "../CreateWizard/SkeuToggle";
import { Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { IconClose, IconChevronDown, IconShield } from "@/assets/icons";
import { RestrictionMode } from "@/constants/enums";
import type { UseRestrictedEmailsReturn } from "./useRestrictedEmails";

// ─── Props ────────────────────────────────────────────────────────────────────

interface CandidateAccessRestrictionProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  mode: RestrictionMode;
  onModeChange: (mode: RestrictionMode) => void;
  emailState: UseRestrictedEmailsReturn;
}

// ─── Mode hint text ───────────────────────────────────────────────────────────

const MODE_HINTS: Record<RestrictionMode, string> = {
  [RestrictionMode.INCLUDE]: "Only the listed emails can access this link.",
  [RestrictionMode.EXCLUDE]: "The listed emails are blocked from accessing this link.",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function CandidateAccessRestriction({
  enabled,
  onToggle,
  mode,
  onModeChange,
  emailState,
}: Readonly<CandidateAccessRestrictionProps>) {
  const [accordionOpen, setAccordionOpen] = useState(false);
  const { rawInput, setRawInput, emails, inputError, commitInput, removeEmail } = emailState;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitInput();
    }
  };

  const handleToggle = (next: boolean) => {
    onToggle(next);
    if (next) setAccordionOpen(true);
  };

  return (
    <div className={styles.restrictionSection}>
      {/* Toggle row */}
      <div className={styles.restrictionToggleRow}>
        <div className={styles.restrictionToggleMeta}>
          <p className={styles.restrictionToggleLabel}>Restrict Candidate Access</p>
          <p className={styles.restrictionToggleHint}>
            Limit access to this link by candidate email
          </p>
        </div>
        <SkeuToggle checked={enabled} onChange={handleToggle} />
      </div>

      {/* Accordion — only visible when toggle is ON */}
      {enabled && (
        <div className={styles.accordion}>
          <button
            type="button"
            className={`${styles.accordionTrigger} ${accordionOpen ? styles.accordionTriggerOpen : ""}`}
            onClick={() => setAccordionOpen((p) => !p)}
            aria-expanded={accordionOpen}
          >
            <div className={styles.accordionTriggerContent}>
              <span className={styles.accordionTriggerIcon}>
                <IconShield size={20} />
              </span>
              <div className={styles.accordionTriggerMeta}>
                <span className={styles.accordionTitle}>Candidate Access Control</span>
                <span className={styles.accordionSubtitle}>
                  {emails.length === 0
                    ? "No emails added yet"
                    : `${emails.length} email${emails.length === 1 ? "" : "s"} configured`}
                </span>
              </div>
            </div>
            <IconChevronDown
              className={`${styles.accordionChevron} ${accordionOpen ? styles.accordionChevronOpen : ""}`}
            />
          </button>

          <div className={`${styles.accordionBody} ${accordionOpen ? styles.accordionBodyOpen : ""}`}>
            <div className={styles.restrictionBody}>
              {/* Include / Exclude segmented control */}
              <div className={styles.modeSwitch}>
                <button
                  type="button"
                  className={`${styles.modeSwitchBtn} ${mode === RestrictionMode.INCLUDE ? styles.modeSwitchBtnActive : ""}`}
                  onClick={() => onModeChange(RestrictionMode.INCLUDE)}
                >
                  Include Only
                </button>
                <button
                  type="button"
                  className={`${styles.modeSwitchBtn} ${mode === RestrictionMode.EXCLUDE ? styles.modeSwitchBtnActive : ""}`}
                  onClick={() => onModeChange(RestrictionMode.EXCLUDE)}
                >
                  Exclude
                </button>
              </div>

              {/* Mode description */}
              <p className={styles.modeInfo}>{MODE_HINTS[mode]}</p>

              {/* Email chips (added emails) */}
              {emails.length > 0 && (
                <div className={styles.emailChipsWrapper}>
                  <span className={styles.emailChipsLabel}>
                    {mode === RestrictionMode.INCLUDE ? "Allowed emails" : "Blocked emails"}
                  </span>
                  <div className={styles.emailChipsList}>
                    {emails.map((email) => (
                      <span key={email} className={styles.emailChip}>
                        {email}
                        <button
                          type="button"
                          className={styles.emailChipRemove}
                          onClick={() => removeEmail(email)}
                          aria-label={`Remove ${email}`}
                        >
                          <IconClose size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Email input */}
              <div className={styles.emailInputArea}>
                <Textarea
                  label="Add emails"
                  id="restriction-emails"
                  placeholder="candidate1@example.com, candidate2@example.com"
                  rows={3}
                  value={rawInput}
                  onChange={(e) => setRawInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  error={inputError}
                  hint="Comma-separated. Press Enter or click Add to confirm."
                />
                <div className={styles.emailInputActions}>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={commitInput}
                    disabled={!rawInput.trim()}
                  >
                    Add
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
