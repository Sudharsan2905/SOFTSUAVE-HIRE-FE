import React, { useState, useCallback, useEffect, useRef } from "react";
import styles from "./ScheduleWizard.module.css";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";
import { Spinner } from "@/components/ui/Spinner";
import { ComplexityBadge } from "@/components/ui/Badge";
import { DatePicker } from "@/components/ui/DatePicker";
import {
  IconSearch,
  IconCheck,
  IconDelete,
  IconEye,
  IconEyeOff,
  IconCopy,
  IconPlus,
  IconRefresh,
  IconChevronDown,
  IconChevronRight,
} from "@/assets/icons";
import { api } from "@/utils/api";
import { useDebounce } from "@/hooks/useDebounce";
import {
  Assessment,
  MonitoringConfig,
  MonitoringOverrides,
  Question,
  QuestionCategory,
} from "@/types";
import { COMPLEXITY_OPTIONS, QUESTION_TYPE_OPTIONS } from "@/constants/app";
import toast from "react-hot-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScheduledRoundDraft {
  round_number: number;
  question_count: number;
  question_ids: string[];
}

interface CandidateDraft {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  gender: string;
  dob?: string; // "YYYY-MM-DD" or ""
  password: string;
}

interface BulkScheduleResult {
  email: string;
  name: string;
  shareLink?: string;
  error?: string;
}

interface Props {
  assessment: Assessment;
  workspaceId: string;
  onClose: () => void;
  onSuccess: () => void;
}

// ─── Constants & Utilities ────────────────────────────────────────────────────

const SCHEDULE_GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

const PW_UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const PW_LOWER = "abcdefghijklmnopqrstuvwxyz";
const PW_DIGITS = "0123456789";
const PW_SPECIAL = "!@#$%^&*";
const PW_POOL = PW_UPPER + PW_LOWER + PW_DIGITS + PW_SPECIAL;

let _draftCounter = 0;
function newId(): string {
  _draftCounter += 1;
  return `draft-${_draftCounter}-${Date.now().toString(36)}`;
}

function getRandChar(charset: string): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return charset[arr[0] % charset.length];
}

function generateSecurePassword(): string {
  const required = [
    getRandChar(PW_UPPER),
    getRandChar(PW_LOWER),
    getRandChar(PW_DIGITS),
    getRandChar(PW_SPECIAL),
  ];
  const extra = Array.from({ length: 8 }, () => getRandChar(PW_POOL));
  const combined = [...required, ...extra];
  for (let i = combined.length - 1; i > 0; i--) {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    const j = arr[0] % (i + 1);
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }
  return combined.join("");
}

function passwordStrength(pw: string): 0 | 1 | 2 | 3 | 4 {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score as 0 | 1 | 2 | 3 | 4;
}

const STRENGTH_LABELS = ["", "Weak", "Fair", "Good", "Strong"];
const STRENGTH_COLORS = [
  "",
  "var(--error-500)",
  "var(--warning-500)",
  "var(--primary-500)",
  "var(--success-500)",
];

function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-()+.]/g, "");
  return /^\d{7,15}$/.test(cleaned);
}

function validateDraft(d: CandidateDraft): string | null {
  if (!d.first_name.trim()) return "First name is required";
  if (!d.last_name.trim()) return "Last name is required";
  if (!d.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim()))
    return "Valid email is required";
  if (!d.phone.trim()) return "Phone number is required";
  if (!isValidPhone(d.phone)) return "Enter a valid phone number (7–15 digits)";
  if (!d.gender) return "Gender is required";
  if (!d.password) return "Password is required";
  if (d.password.length < 8) return "Min 8 characters required";
  if (!/[A-Z]/.test(d.password)) return "Needs an uppercase letter";
  if (!/[a-z]/.test(d.password)) return "Needs a lowercase letter";
  if (!/\d/.test(d.password)) return "Needs a number";
  if (!/[^A-Za-z0-9]/.test(d.password)) return "Needs a special character";
  return null;
}

function newDraft(): CandidateDraft {
  return {
    id: newId(),
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    gender: "",
    dob: undefined,
    password: "",
  };
}

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS = ["Candidates", "Monitoring", "Questions"];

function StepIndicator({ current }: Readonly<{ current: number }>) {
  return (
    <div className={styles.steps}>
      {STEPS.map((label, i) => {
        const num = i + 1;
        const isActive = num === current;
        const isDone = num < current;
        return (
          <React.Fragment key={label}>
            <div
              className={`${styles.step} ${isActive ? styles.active : ""} ${isDone ? styles.done : ""}`}
            >
              <div className={styles.stepDot}>{isDone ? "✓" : num}</div>
              <span>{label}</span>
            </div>
            {i < STEPS.length - 1 && <div className={styles.stepLine} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Candidate accordion card ─────────────────────────────────────────────────

interface CandidateAccordionCardProps {
  draft: CandidateDraft;
  index: number;
  canRemove: boolean;
  error?: string;
  isOpen: boolean;
  onToggle: () => void;
  onUpdate: (patch: Partial<CandidateDraft>) => void;
  onRemove: () => void;
}

function CandidateAccordionCard({
  draft,
  index,
  canRemove,
  error,
  isOpen,
  onToggle,
  onUpdate,
  onRemove,
}: Readonly<CandidateAccordionCardProps>) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [showPw, setShowPw] = useState(false);
  const [copied, setCopied] = useState(false);

  // Scroll into view when a new card is added (only on first mount)
  useEffect(() => {
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  const handleGenerate = () => {
    onUpdate({ password: generateSecurePassword() });
    setShowPw(true);
  };

  const handleCopyPassword = async () => {
    if (!draft.password) return;
    try {
      await navigator.clipboard.writeText(draft.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed — please copy manually.");
    }
  };

  const strength = passwordStrength(draft.password);

  const firstName = draft.first_name.trim();
  const lastName = draft.last_name.trim();
  const fullName = lastName ? `${firstName} ${lastName}` : firstName;
  const displayName = firstName ? `${index + 1}. ${fullName}` : `User ${index + 1}`;

  return (
    <div
      ref={cardRef}
      className={`${styles.accordionCard} ${error && !isOpen ? styles.accordionCardError : ""}`}
    >
      {/* ── Accordion header ── */}
      <div className={styles.accordionHeaderRow}>
        <button
          type="button"
          className={styles.accordionHeader}
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-controls={`accordion-body-${draft.id}`}
        >
          <span className={styles.accordionChevron}>
            {isOpen ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
          </span>
          <span className={styles.accordionTitle}>{displayName}</span>
        </button>
        <span className={styles.accordionHeaderActions}>
          {error && !isOpen && (
            <span
              className={styles.accordionErrorBadge}
              aria-label="Has validation errors"
              title={error}
            >
              !
            </span>
          )}
          {canRemove && (
            <button
              type="button"
              className={styles.removeEntryBtn}
              onClick={onRemove}
              aria-label={`Remove candidate ${index + 1}`}
            >
              <IconDelete size={12} />
              Remove
            </button>
          )}
        </span>
      </div>

      {/* ── Accordion body ── */}
      {isOpen && (
        <div id={`accordion-body-${draft.id}`} className={styles.accordionBody}>
          {/* Row 1: First Name | Last Name */}
          <div className={styles.formGrid}>
            <Input
              label="First Name *"
              value={draft.first_name}
              onChange={(e) => onUpdate({ first_name: e.target.value })}
              placeholder="Jane"
            />
            <Input
              label="Last Name *"
              value={draft.last_name}
              onChange={(e) => onUpdate({ last_name: e.target.value })}
              placeholder="Doe"
            />

            {/* Row 2: Email | Phone */}
            <Input
              label="Email *"
              type="email"
              value={draft.email}
              onChange={(e) => onUpdate({ email: e.target.value })}
              placeholder="jane@example.com"
            />
            <Input
              label="Phone *"
              type="tel"
              value={draft.phone}
              onChange={(e) => onUpdate({ phone: e.target.value })}
              placeholder="+91 99999 00000"
            />

            {/* Row 3: Gender | Date of Birth */}
            <Select
              label="Gender *"
              options={SCHEDULE_GENDER_OPTIONS}
              value={draft.gender}
              onChange={(v) => onUpdate({ gender: v })}
              placeholder="Select gender"
            />
            <DatePicker
              label="Date of Birth *"
              value={draft.dob}
              onChange={(v) => onUpdate({ dob: v })}
              placeholder="Select DOB"
            />
          </div>

          {/* Password row */}
          <div className={styles.passwordRow}>
            <div style={{ flex: 1 }}>
              <Input
                label="Password *"
                type={showPw ? "text" : "password"}
                value={draft.password}
                onChange={(e) => onUpdate({ password: e.target.value })}
                placeholder="Min 8 chars · uppercase · number · symbol"
                rightElement={
                  <button
                    type="button"
                    className={styles.pwIconBtn}
                    onClick={() => setShowPw((p) => !p)}
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                  </button>
                }
              />
              {draft.password && (
                <div className={styles.strengthBar}>
                  {Array.from({ length: 4 }, (_, i) => (
                    <div
                      key={i}
                      className={styles.strengthSegment}
                      style={{
                        background:
                          i < strength ? STRENGTH_COLORS[strength] : "var(--border-primary)",
                      }}
                    />
                  ))}
                  <span
                    className={styles.strengthLabel}
                    style={{ color: STRENGTH_COLORS[strength] }}
                  >
                    {STRENGTH_LABELS[strength]}
                  </span>
                </div>
              )}
            </div>

            <div className={styles.pwActions}>
              <button
                type="button"
                className={styles.pwBtn}
                onClick={handleGenerate}
                title="Auto-generate a secure password"
              >
                <IconRefresh size={13} />
                <span>Generate</span>
              </button>
              <button
                type="button"
                className={`${styles.pwBtn} ${copied ? styles.pwBtnCopied : ""}`}
                onClick={() => void handleCopyPassword()}
                disabled={!draft.password}
                title="Copy password to clipboard"
              >
                <IconCopy size={13} />
                <span>{copied ? "Copied!" : "Copy"}</span>
              </button>
            </div>
          </div>

          {error && <p className={styles.entryError}>{error}</p>}
        </div>
      )}
    </div>
  );
}

// ─── Step 1 — Bulk new candidates ─────────────────────────────────────────────

function Step1Candidates({
  drafts,
  errors,
  openStates,
  onToggle,
  onUpdate,
  onAdd,
  onRemove,
}: Readonly<{
  drafts: CandidateDraft[];
  errors: Record<string, string>;
  openStates: Record<string, boolean>;
  onToggle: (id: string) => void;
  onUpdate: (id: string, patch: Partial<CandidateDraft>) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}>) {
  return (
    <div>
      <div className={styles.inheritBanner}>
        ℹ️ All candidates below will be freshly onboarded with the credentials you provide. Existing
        accounts with the same email will be flagged as errors at scheduling time.
      </div>

      <div className={styles.candidateList}>
        {drafts.map((d, i) => (
          <CandidateAccordionCard
            key={d.id}
            draft={d}
            index={i}
            canRemove={drafts.length > 1}
            error={errors[d.id]}
            isOpen={openStates[d.id] ?? true}
            onToggle={() => onToggle(d.id)}
            onUpdate={(patch) => onUpdate(d.id, patch)}
            onRemove={() => onRemove(d.id)}
          />
        ))}
      </div>

      <div className={styles.addCandidateRow}>
        <Button variant="ghost" size="sm" leftIcon={<IconPlus size={13} />} onClick={onAdd}>
          Add Candidate
        </Button>
      </div>
    </div>
  );
}

// ─── Step 2 — Monitoring Overrides ───────────────────────────────────────────

interface MonitoringToggleRowProps {
  label: string;
  hint: string;
  assessmentValue: boolean;
  overrideValue: boolean | undefined;
  onChange: (v: boolean) => void;
}

function MonitoringToggleRow({
  label,
  hint,
  assessmentValue,
  overrideValue,
  onChange,
}: Readonly<MonitoringToggleRowProps>) {
  const effective = overrideValue ?? assessmentValue;
  const isOverridden = overrideValue !== undefined && overrideValue !== assessmentValue;
  return (
    <div className={styles.toggleRow}>
      <div className={styles.toggleMeta}>
        <p className={styles.toggleLabel}>
          {label}
          {isOverridden && <span className={styles.overridePill}>overridden</span>}
        </p>
        <p className={styles.toggleHint}>
          {hint} — assessment default: {assessmentValue ? "on" : "off"}
        </p>
      </div>
      <Toggle checked={effective} onChange={onChange} />
    </div>
  );
}

// Navigation buttons are in the Modal footer; Step2Monitoring renders content only.
function Step2Monitoring({
  assessmentMonitoring,
  overrides,
  onChange,
  startTime,
  endTime,
  onStartTime,
  onEndTime,
}: Readonly<{
  assessmentMonitoring: MonitoringConfig | undefined;
  overrides: MonitoringOverrides;
  onChange: (o: MonitoringOverrides) => void;
  startTime: string;
  endTime: string;
  onStartTime: (v: string) => void;
  onEndTime: (v: string) => void;
}>) {
  const base = assessmentMonitoring;
  const set = (key: keyof MonitoringOverrides) => (v: boolean | string | number) =>
    onChange({ ...overrides, [key]: v });

  const effectiveScreenshot = overrides.screenshot_enabled ?? base?.screenshot_enabled ?? true;
  const effectiveMode = overrides.screenshot_mode ?? base?.screenshot_mode ?? "time_interval";

  return (
    <div>
      <div className={styles.inheritBanner}>
        ℹ️ All toggles inherit the assessment defaults. Only fields you change here will override
        them for these candidates.
      </div>

      <div className={styles.monitoringSection}>
        <MonitoringToggleRow
          label="Tab switch detection"
          hint="Flags malpractice on tab/window switch"
          assessmentValue={base?.tab_monitoring ?? true}
          overrideValue={overrides.tab_monitoring}
          onChange={set("tab_monitoring")}
        />
        <MonitoringToggleRow
          label="Voice / noise monitoring"
          hint="Detects sustained background audio"
          assessmentValue={base?.audio_monitoring ?? true}
          overrideValue={overrides.audio_monitoring}
          onChange={set("audio_monitoring")}
        />
        <MonitoringToggleRow
          label="Camera required"
          hint="Live camera feed checked for face presence"
          assessmentValue={base?.video_monitoring ?? true}
          overrideValue={overrides.video_monitoring}
          onChange={set("video_monitoring")}
        />
        <MonitoringToggleRow
          label="Screenshot capture"
          hint="Periodic screenshots uploaded during the session"
          assessmentValue={base?.screenshot_enabled ?? true}
          overrideValue={overrides.screenshot_enabled}
          onChange={set("screenshot_enabled")}
        />

        {effectiveScreenshot && (
          <div className={styles.screenshotOptions}>
            <Select
              label="Screenshot mode"
              options={[
                { value: "time_interval", label: "Time interval" },
                { value: "count", label: "Total count" },
              ]}
              value={effectiveMode}
              onChange={(v) =>
                onChange({ ...overrides, screenshot_mode: v as "time_interval" | "count" })
              }
            />
            {effectiveMode === "time_interval" ? (
              <Input
                label="Interval (minutes)"
                type="number"
                min={1}
                value={
                  overrides.screenshot_interval_minutes ?? base?.screenshot_interval_minutes ?? 5
                }
                onChange={(e) =>
                  onChange({ ...overrides, screenshot_interval_minutes: Number(e.target.value) })
                }
              />
            ) : (
              <Input
                label="Total screenshots"
                type="number"
                min={1}
                value={overrides.screenshot_count ?? base?.screenshot_count ?? 10}
                onChange={(e) =>
                  onChange({ ...overrides, screenshot_count: Number(e.target.value) })
                }
              />
            )}
          </div>
        )}
      </div>

      <div className={styles.timeWindow}>
        <div>
          <p className={styles.timeWindowLabel}>Link valid from (optional)</p>
          <Input
            type="datetime-local"
            value={startTime}
            onChange={(e) => onStartTime(e.target.value)}
          />
        </div>
        <div>
          <p className={styles.timeWindowLabel}>Link expires at (optional)</p>
          <Input
            type="datetime-local"
            value={endTime}
            onChange={(e) => onEndTime(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Step 3 — Question Selection ─────────────────────────────────────────────

// Navigation buttons are in the Modal footer; Step3Questions renders content only.
function Step3Questions({
  rounds,
  onUpdateRound,
}: Readonly<{
  rounds: ScheduledRoundDraft[];
  onUpdateRound: (roundNumber: number, ids: string[]) => void;
}>) {
  const [activeRound, setActiveRound] = useState(rounds[0]?.round_number ?? 1);
  const [categories, setCategories] = useState<QuestionCategory[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [search, setSearch] = useState("");
  const [complexity, setComplexity] = useState("");
  const [questionType, setQuestionType] = useState("");
  const [loadingQ, setLoadingQ] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  const currentRound = rounds.find((r) => r.round_number === activeRound) ?? rounds[0];
  const selectedIds = currentRound?.question_ids ?? [];
  const required = currentRound?.question_count ?? 0;

  const fetchCategories = async () => {
    try {
      const { data } = await api.get("/api/questions/categories?page_size=100");
      const cats: QuestionCategory[] = data.data?.categories || [];
      setCategories(cats);
      if (cats[0]) setSelectedCategory(cats[0].id);
    } catch {
      /* silent */
    }
  };

  const fetchQuestions = useCallback(async () => {
    if (!selectedCategory) return;
    setLoadingQ(true);
    try {
      const params = new URLSearchParams({
        page_size: "100",
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(complexity && { complexity }),
        ...(questionType && { question_type: questionType }),
      });
      const { data } = await api.get(
        `/api/questions/categories/${selectedCategory}/questions?${params}`
      );
      setQuestions(data.data?.questions || []);
    } catch {
      /* silent */
    } finally {
      setLoadingQ(false);
    }
  }, [selectedCategory, debouncedSearch, complexity, questionType]);

  useEffect(() => {
    void fetchCategories();
  }, []);
  useEffect(() => {
    void fetchQuestions();
  }, [fetchQuestions]);

  const toggle = (q: Question) => {
    if (selectedIds.includes(q.id)) {
      onUpdateRound(
        activeRound,
        selectedIds.filter((id) => id !== q.id)
      );
    } else {
      onUpdateRound(activeRound, [...selectedIds, q.id]);
    }
  };

  const available = questions.filter((q) => !selectedIds.includes(q.id));
  const selectedQuestions = questions.filter((q) => selectedIds.includes(q.id));

  return (
    <div className={styles.questionStep}>
      {rounds.length > 1 && (
        <div className={styles.roundTabs}>
          {rounds.map((r) => {
            const done = r.question_ids.length >= r.question_count;
            return (
              <button
                key={r.round_number}
                className={`${styles.roundTab} ${activeRound === r.round_number ? styles.roundTabActive : ""} ${done && activeRound !== r.round_number ? styles.roundTabDone : ""}`}
                onClick={() => setActiveRound(r.round_number)}
              >
                Round {r.round_number} ({r.question_ids.length}/{r.question_count})
              </button>
            );
          })}
        </div>
      )}

      <div className={styles.questionPanes}>
        {/* Selected pane */}
        <div className={styles.pane}>
          <div className={styles.paneHeader}>
            <p className={styles.paneTitle}>Selected</p>
            <span className={styles.paneCount}>
              {selectedIds.length} / {required} required
            </span>
          </div>
          <div className={styles.paneBody}>
            {selectedQuestions.length === 0 ? (
              <div className={styles.emptyHint}>Click questions on the right to add them</div>
            ) : (
              selectedQuestions.map((q) => (
                <div key={q.id} className={`${styles.qItem} ${styles.qItemSelected}`}>
                  <ComplexityBadge complexity={q.complexity} />
                  <p className={styles.qText}>{q.question_text}</p>
                  <button
                    className={styles.qRemove}
                    onClick={() =>
                      onUpdateRound(
                        activeRound,
                        selectedIds.filter((id) => id !== q.id)
                      )
                    }
                  >
                    <IconDelete size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Browser pane */}
        <div className={styles.pane}>
          <div className={styles.filterRow}>
            <Select
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              value={selectedCategory}
              onChange={setSelectedCategory}
              placeholder="Category"
              fullWidth={false}
              style={{ flex: 1, minWidth: 100 }}
            />
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftElement={<IconSearch size={13} />}
              fullWidth={false}
              style={{ flex: 1, minWidth: 80 }}
            />
            <Select
              options={COMPLEXITY_OPTIONS}
              value={complexity}
              onChange={setComplexity}
              placeholder="Level"
              fullWidth={false}
              style={{ minWidth: 80 }}
            />
            <Select
              options={QUESTION_TYPE_OPTIONS}
              value={questionType}
              onChange={setQuestionType}
              placeholder="Type"
              fullWidth={false}
              style={{ minWidth: 80 }}
            />
          </div>
          <div className={styles.paneBody}>
            {(() => {
              if (loadingQ) {
                return (
                  <div style={{ display: "flex", justifyContent: "center", padding: 30 }}>
                    <Spinner />
                  </div>
                );
              }
              if (available.length === 0) {
                return <div className={styles.emptyHint}>No questions available</div>;
              }
              return available.map((q) => (
                <button key={q.id} type="button" className={styles.qItem} onClick={() => toggle(q)}>
                  <ComplexityBadge complexity={q.complexity} />
                  <p className={styles.qText}>{q.question_text}</p>
                  {/* span instead of button — cannot nest interactive elements */}
                  <span className={styles.qRemove} aria-hidden="true">
                    <IconCheck size={13} color="var(--primary-600)" />
                  </span>
                </button>
              ));
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step 4 — Results (per-candidate share links) ─────────────────────────────

function LinkResultRow({
  result,
}: Readonly<{ result: BulkScheduleResult & { shareLink: string } }>) {
  const [copied, setCopied] = useState(false);
  const fullUrl = `${globalThis.location.origin}/assessment-access/${result.shareLink}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed — please copy manually.");
    }
  };

  return (
    <div className={styles.linkEntry}>
      <div className={styles.linkEntryMeta}>
        <p className={styles.linkEntryName}>{result.name}</p>
        <p className={styles.linkEntryEmail}>{result.email}</p>
      </div>
      <div className={styles.shareLinkInput}>
        <input className={styles.shareLinkField} readOnly value={fullUrl} />
        <Button onClick={() => void copy()} variant={copied ? "secondary" : "primary"} size="sm">
          {copied ? "Copied!" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

function StepResult({
  results,
  onClose,
}: Readonly<{
  results: BulkScheduleResult[];
  onClose: () => void;
}>) {
  const succeeded = results.filter(
    (r): r is BulkScheduleResult & { shareLink: string } => !!r.shareLink
  );
  const failed = results.filter((r) => r.error);

  return (
    <div className={styles.shareLinkBox}>
      <div style={{ fontSize: 40 }}>🎉</div>
      <p className={styles.shareLinkTitle}>
        {succeeded.length} Candidate{succeeded.length === 1 ? "" : "s"} Scheduled!
      </p>
      <p className={styles.shareLinkSub}>
        Share each candidate's personalised assessment link below. They will be prompted to log in
        using the password you set.
      </p>

      {succeeded.length > 0 && (
        <div className={styles.linksGrid}>
          {succeeded.map((r) => (
            <LinkResultRow key={r.email} result={r} />
          ))}
        </div>
      )}

      {failed.length > 0 && (
        <div className={styles.failedList}>
          <p className={styles.failedListTitle}>
            {failed.length} {failed.length === 1 ? "entry" : "entries"} could not be created:
          </p>
          {failed.map((r) => (
            <div key={r.email} className={styles.failedEntry}>
              <span className={styles.failedEntryName}>{r.name || r.email}</span>
              <span className={styles.failedEntryError}>{r.error}</span>
            </div>
          ))}
        </div>
      )}

      <Button variant="secondary" onClick={onClose} style={{ marginTop: 8 }}>
        Done
      </Button>
    </div>
  );
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

export function ScheduleWizardModal({
  assessment,
  workspaceId,
  onClose,
  onSuccess,
}: Readonly<Props>) {
  const [step, setStep] = useState(1);
  const [candidateDrafts, setCandidateDrafts] = useState<CandidateDraft[]>(() => [newDraft()]);
  // openStates defaults missing keys to true (cards open by default)
  const [openStates, setOpenStates] = useState<Record<string, boolean>>({});
  const [step1Errors, setStep1Errors] = useState<Record<string, string>>({});
  const [overrides, setOverrides] = useState<MonitoringOverrides>({});
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [shareResults, setShareResults] = useState<BulkScheduleResult[]>([]);

  const [roundDrafts, setRoundDrafts] = useState<ScheduledRoundDraft[]>(() =>
    (assessment.rounds ?? []).map((r) => ({
      round_number: r.round_number,
      question_count: r.question_count,
      question_ids: [],
    }))
  );

  const allRoundsDone = roundDrafts.every((r) => r.question_ids.length >= r.question_count);

  const toggleAccordion = (id: string) => {
    setOpenStates((prev) => ({ ...prev, [id]: !(prev[id] ?? true) }));
  };

  const updateDraft = (id: string, patch: Partial<CandidateDraft>) => {
    setCandidateDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
    if (step1Errors[id]) {
      setStep1Errors((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const addCandidate = () => {
    const draft = newDraft();
    setCandidateDrafts((prev) => [...prev, draft]);
    // Explicitly open the new card (others keep their current state)
    setOpenStates((prev) => ({ ...prev, [draft.id]: true }));
  };

  const removeCandidate = (id: string) => {
    setCandidateDrafts((prev) => prev.filter((d) => d.id !== id));
    setOpenStates((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setStep1Errors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleStep1Next = () => {
    const errors: Record<string, string> = {};
    const seenEmails = new Set<string>();

    for (const d of candidateDrafts) {
      const err = validateDraft(d);
      if (err) {
        errors[d.id] = err;
        continue;
      }
      const key = d.email.trim().toLowerCase();
      if (seenEmails.has(key)) {
        errors[d.id] = "Duplicate email in this list";
      } else {
        seenEmails.add(key);
      }
    }

    setStep1Errors(errors);

    if (Object.keys(errors).length) {
      // Auto-expand cards with errors so user can see them
      setOpenStates((prev) => {
        const next = { ...prev };
        for (const id of Object.keys(errors)) next[id] = true;
        return next;
      });
    } else {
      setStep(2);
    }
  };

  const updateRound = (roundNumber: number, ids: string[]) => {
    setRoundDrafts((prev) =>
      prev.map((r) => (r.round_number === roundNumber ? { ...r, question_ids: ids } : r))
    );
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      // Build clean monitoring overrides (strip keys that match assessment defaults)
      const base = assessment.monitoring_config;
      const cleanOverrides: MonitoringOverrides = {};
      (Object.keys(overrides) as (keyof MonitoringOverrides)[]).forEach((k) => {
        const v = overrides[k];
        if (v !== undefined && v !== (base as unknown as Record<string, unknown>)?.[k]) {
          (cleanOverrides as Record<string, unknown>)[k] = v;
        }
      });

      const payload: Record<string, unknown> = {
        candidates: candidateDrafts.map((d) => ({
          first_name: d.first_name.trim(),
          last_name: d.last_name.trim(),
          email: d.email.trim(),
          password: d.password,
          phone: d.phone.trim(),
          gender: d.gender,
          dob: d.dob,
        })),
        monitoring_overrides: Object.keys(cleanOverrides).length ? cleanOverrides : null,
        rounds: roundDrafts.map((r) => ({
          round_number: r.round_number,
          question_ids: r.question_ids,
        })),
      };

      if (startTime && endTime) {
        payload.start_time = new Date(startTime).toISOString();
        payload.end_time = new Date(endTime).toISOString();
      }

      const { data } = await api.post(
        `/api/workspaces/${workspaceId}/assessments/${assessment.id}/schedules`,
        payload
      );

      type ScheduledEntry = { email: string; name: string; share_link: string };
      type FailedEntry = { email: string; error: string };

      const scheduledEntries: ScheduledEntry[] = data.data?.scheduled ?? [];
      const failedEntries: FailedEntry[] = data.data?.failed ?? [];

      const results: BulkScheduleResult[] = [
        ...scheduledEntries.map((s) => ({
          email: s.email,
          name: s.name || s.email,
          shareLink: s.share_link,
        })),
        ...failedEntries.map((f) => ({
          email: f.email,
          name: f.email,
          error: f.error,
        })),
      ];

      setShareResults(results);
      setStep(4);
      onSuccess();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Failed to schedule candidates");
    } finally {
      setSaving(false);
    }
  };

  // Sticky footer — navigation buttons passed to Modal's footer prop
  const renderFooter = (): React.ReactNode | undefined => {
    if (step === 1) {
      return (
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleStep1Next}>Next: Monitoring</Button>
        </>
      );
    }
    if (step === 2) {
      return (
        <>
          <Button variant="secondary" onClick={() => setStep(1)}>
            Back
          </Button>
          <Button onClick={() => setStep(3)}>Next: Questions</Button>
        </>
      );
    }
    if (step === 3) {
      return (
        <>
          <Button variant="secondary" onClick={() => setStep(2)}>
            Back
          </Button>
          <Button onClick={() => void handleFinish()} isLoading={saving} disabled={!allRoundsDone}>
            Schedule & Generate Links
          </Button>
        </>
      );
    }
    return undefined;
  };

  const TITLES: Record<number, string> = {
    1: "Schedule Candidates — Step 1: Candidate Details",
    2: "Schedule Candidates — Step 2: Monitoring",
    3: "Schedule Candidates — Step 3: Questions",
    4: "Candidates Scheduled",
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={TITLES[step]}
      size="xl"
      disableBackdropClose={step < 4}
      footer={renderFooter()}
    >
      {step < 4 && <StepIndicator current={step} />}

      {step === 1 && (
        <Step1Candidates
          drafts={candidateDrafts}
          errors={step1Errors}
          openStates={openStates}
          onToggle={toggleAccordion}
          onUpdate={updateDraft}
          onAdd={addCandidate}
          onRemove={removeCandidate}
        />
      )}

      {step === 2 && (
        <Step2Monitoring
          assessmentMonitoring={assessment.monitoring_config}
          overrides={overrides}
          onChange={setOverrides}
          startTime={startTime}
          endTime={endTime}
          onStartTime={setStartTime}
          onEndTime={setEndTime}
        />
      )}

      {step === 3 && <Step3Questions rounds={roundDrafts} onUpdateRound={updateRound} />}

      {step === 4 && <StepResult results={shareResults} onClose={onClose} />}
    </Modal>
  );
}
