import React, { useState, useCallback, useEffect } from "react";
import styles from "./ScheduleWizard.module.css";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";
import { Spinner } from "@/components/ui/Spinner";
import { ComplexityBadge } from "@/components/ui/Badge";
import { IconSearch, IconCheck, IconDelete } from "@/assets/icons";
import { api } from "@/utils/api";
import { useDebounce } from "@/hooks/useDebounce";
import { getAvatarColor, getInitials, getFullName } from "@/utils/helpers";
import {
  Assessment,
  MonitoringConfig,
  MonitoringOverrides,
  Question,
  QuestionCategory,
  User,
} from "@/types";
import { COMPLEXITY_OPTIONS, QUESTION_TYPE_OPTIONS } from "@/constants/app";
import toast from "react-hot-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScheduledRoundDraft {
  round_number: number;
  question_count: number;
  question_ids: string[];
}

interface Props {
  assessment: Assessment;
  workspaceId: string;
  onClose: () => void;
  onSuccess: () => void;
}

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS = ["Candidate Info", "Monitoring", "Questions"];

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

// ─── Step 1 — Candidate Info ──────────────────────────────────────────────────

interface NewCandidateForm {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  gender: string;
  institution: string;
  location: string;
}

const EMPTY_FORM: NewCandidateForm = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  gender: "",
  institution: "",
  location: "",
};

function Step1Candidate({
  onNext,
}: Readonly<{
  onNext: (candidate: User) => void;
}>) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [candidate, setCandidate] = useState<User | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState<NewCandidateForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const search = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    setCandidate(null);
    setShowCreateForm(false);
    try {
      const { data } = await api.get(
        `/api/users/candidates/search?email=${encodeURIComponent(email.trim())}`
      );
      const found: User | null = data.data?.user ?? null;
      if (!found) {
        // Pre-fill the create form with the email they searched for
        setForm({ ...EMPTY_FORM, email: email.trim() });
        setShowCreateForm(true);
      } else {
        setCandidate(found);
      }
    } catch {
      setError("Could not search. Check the email and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.first_name.trim() || !form.email.trim()) {
      setError("First name and email are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { data } = await api.post("/api/users/candidates", {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim() || undefined,
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        gender: form.gender || undefined,
        institution: form.institution.trim() || undefined,
        location: form.location.trim() || undefined,
      });
      const created: User = data.data;
      setCandidate(created);
      setShowCreateForm(false);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? "Failed to create candidate.");
    } finally {
      setSaving(false);
    }
  };

  const setField = (key: keyof NewCandidateForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const candidateName = candidate
    ? getFullName(candidate as { first_name: string; last_name?: string })
    : "";

  return (
    <div>
      {/* Search row */}
      <div className={styles.candidateSearch}>
        <Input
          placeholder="Search candidate by email…"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          leftElement={<IconSearch size={14} />}
          onKeyDown={(e) => e.key === "Enter" && void search()}
          style={{ flex: 1 }}
        />
        <Button onClick={() => void search()} isLoading={loading} disabled={!email.trim()}>
          Find
        </Button>
      </div>

      {error && (
        <p style={{ fontSize: 13, color: "var(--error-600)", marginBottom: 12 }}>{error}</p>
      )}

      {/* ── Create new candidate form ── */}
      {showCreateForm && !candidate && (
        <div className={styles.createForm}>
          <div className={styles.inheritBanner}>
            No candidate found with that email. Fill in the details below to onboard a new candidate.
          </div>

          <div className={styles.formGrid}>
            <Input
              label="First Name *"
              value={form.first_name}
              onChange={setField("first_name")}
              placeholder="Jane"
            />
            <Input
              label="Last Name"
              value={form.last_name}
              onChange={setField("last_name")}
              placeholder="Doe"
            />
            <Input
              label="Email *"
              type="email"
              value={form.email}
              onChange={setField("email")}
              placeholder="jane@example.com"
            />
            <Input
              label="Phone"
              value={form.phone}
              onChange={setField("phone")}
              placeholder="+91 99999 00000"
            />
            <Select
              label="Gender"
              options={[
                { value: "male", label: "Male" },
                { value: "female", label: "Female" },
                { value: "other", label: "Other" },
              ]}
              value={form.gender}
              onChange={(v) => setForm((prev) => ({ ...prev, gender: v }))}
              placeholder="Select gender"
            />
            <Input
              label="Institution / Company"
              value={form.institution}
              onChange={setField("institution")}
              placeholder="XYZ University"
            />
            <Input
              label="City / Location"
              value={form.location}
              onChange={setField("location")}
              placeholder="Bangalore"
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16, gap: 8 }}>
            <Button
              variant="secondary"
              onClick={() => { setShowCreateForm(false); setError(""); }}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleCreate()} isLoading={saving}>
              Create & Proceed
            </Button>
          </div>
        </div>
      )}

      {/* ── Found / created candidate card ── */}
      {candidate && (
        <>
          <div className={styles.candidateCard}>
            <div
              className={styles.candidateAvatar}
              style={{ background: getAvatarColor(candidateName) }}
            >
              {getInitials(candidateName)}
            </div>
            <div className={styles.candidateInfo}>
              <p className={styles.candidateName}>{candidateName}</p>
              <p className={styles.candidateMeta}>{candidate.email}</p>
            </div>
          </div>

          {candidate.profile && (
            <div className={styles.candidateField}>
              {candidate.profile.phone && (
                <div className={styles.fieldItem}>
                  <p className={styles.fieldLabel}>Phone</p>
                  <p className={styles.fieldValue}>{candidate.profile.phone}</p>
                </div>
              )}
              {candidate.profile.gender && (
                <div className={styles.fieldItem}>
                  <p className={styles.fieldLabel}>Gender</p>
                  <p className={styles.fieldValue} style={{ textTransform: "capitalize" }}>
                    {candidate.profile.gender}
                  </p>
                </div>
              )}
              {candidate.profile.college_name && (
                <div className={styles.fieldItem}>
                  <p className={styles.fieldLabel}>College</p>
                  <p className={styles.fieldValue}>{candidate.profile.college_name}</p>
                </div>
              )}
              {candidate.profile.college_city && (
                <div className={styles.fieldItem}>
                  <p className={styles.fieldLabel}>City</p>
                  <p className={styles.fieldValue}>{candidate.profile.college_city}</p>
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
            <Button onClick={() => onNext(candidate)}>Next: Monitoring</Button>
          </div>
        </>
      )}
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
        <p className={styles.toggleHint}>{hint} — assessment default: {assessmentValue ? "on" : "off"}</p>
      </div>
      <Toggle checked={effective} onChange={onChange} />
    </div>
  );
}

function Step2Monitoring({
  assessmentMonitoring,
  overrides,
  onChange,
  startTime,
  endTime,
  onStartTime,
  onEndTime,
  onNext,
  onBack,
}: Readonly<{
  assessmentMonitoring: MonitoringConfig | undefined;
  overrides: MonitoringOverrides;
  onChange: (o: MonitoringOverrides) => void;
  startTime: string;
  endTime: string;
  onStartTime: (v: string) => void;
  onEndTime: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
}>) {
  const base = assessmentMonitoring;
  const set = (key: keyof MonitoringOverrides) => (v: boolean | string | number) =>
    onChange({ ...overrides, [key]: v });

  const effectiveScreenshot =
    overrides.screenshot_enabled ?? base?.screenshot_enabled ?? true;
  const effectiveMode =
    overrides.screenshot_mode ?? base?.screenshot_mode ?? "time_interval";

  return (
    <div>
      <div className={styles.inheritBanner}>
        ℹ️ All toggles inherit the assessment defaults. Only fields you change here will
        override them for this candidate.
      </div>

      <div className={styles.monitoringSection}>
        <MonitoringToggleRow
          label="Tab switch detection"
          hint="Flags malpractice on tab/window switch"
          assessmentValue={base?.tab_monitoring ?? true}
          overrideValue={overrides.tab_monitoring}
          onChange={set("tab_monitoring") as (v: boolean) => void}
        />
        <MonitoringToggleRow
          label="Voice / noise monitoring"
          hint="Detects sustained background audio"
          assessmentValue={base?.audio_monitoring ?? true}
          overrideValue={overrides.audio_monitoring}
          onChange={set("audio_monitoring") as (v: boolean) => void}
        />
        <MonitoringToggleRow
          label="Camera required"
          hint="Live camera feed checked for face presence"
          assessmentValue={base?.video_monitoring ?? true}
          overrideValue={overrides.video_monitoring}
          onChange={set("video_monitoring") as (v: boolean) => void}
        />
        <MonitoringToggleRow
          label="Screenshot capture"
          hint="Periodic screenshots uploaded during the session"
          assessmentValue={base?.screenshot_enabled ?? true}
          overrideValue={overrides.screenshot_enabled}
          onChange={set("screenshot_enabled") as (v: boolean) => void}
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
                onChange({
                  ...overrides,
                  screenshot_mode: v as "time_interval" | "count",
                })
              }
            />
            {effectiveMode === "time_interval" ? (
              <Input
                label="Interval (minutes)"
                type="number"
                min={1}
                value={
                  overrides.screenshot_interval_minutes ??
                  base?.screenshot_interval_minutes ??
                  5
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
                value={
                  overrides.screenshot_count ?? base?.screenshot_count ?? 10
                }
                onChange={(e) =>
                  onChange({ ...overrides, screenshot_count: Number(e.target.value) })
                }
              />
            )}
          </div>
        )}
      </div>

      {/* Optional time window */}
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

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext}>Next: Questions</Button>
      </div>
    </div>
  );
}

// ─── Step 3 — Question Selection ─────────────────────────────────────────────

function Step3Questions({
  rounds,
  onUpdateRound,
  onBack,
  onFinish,
  saving,
}: Readonly<{
  rounds: ScheduledRoundDraft[];
  onUpdateRound: (roundNumber: number, ids: string[]) => void;
  onBack: () => void;
  onFinish: () => void;
  saving: boolean;
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
    } catch { /* silent */ }
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
    } catch { /* silent */ }
    finally { setLoadingQ(false); }
  }, [selectedCategory, debouncedSearch, complexity, questionType]);

  useEffect(() => { fetchCategories(); }, []);
  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  const toggle = (q: Question) => {
    if (selectedIds.includes(q.id)) {
      onUpdateRound(activeRound, selectedIds.filter((id) => id !== q.id));
    } else {
      onUpdateRound(activeRound, [...selectedIds, q.id]);
    }
  };

  const available = questions.filter((q) => !selectedIds.includes(q.id));
  const selectedQuestions = questions.filter((q) => selectedIds.includes(q.id));

  const allRoundsDone = rounds.every((r) => r.question_ids.length >= r.question_count);

  return (
    <div className={styles.questionStep}>
      {/* Round tabs */}
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
              <div className={styles.emptyHint}>
                Click questions on the right to add them
              </div>
            ) : (
              selectedQuestions.map((q) => (
                <div key={q.id} className={`${styles.qItem} ${styles.qItemSelected}`}>
                  <ComplexityBadge complexity={q.complexity} />
                  <p className={styles.qText}>{q.question_text}</p>
                  <button
                    className={styles.qRemove}
                    onClick={() => onUpdateRound(activeRound, selectedIds.filter((id) => id !== q.id))}
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
                <button
                  key={q.id}
                  type="button"
                  className={styles.qItem}
                  onClick={() => toggle(q)}
                >
                  <ComplexityBadge complexity={q.complexity} />
                  <p className={styles.qText}>{q.question_text}</p>
                  <button className={styles.qRemove} title="Add">
                    <IconCheck size={13} color="var(--primary-600)" />
                  </button>
                </button>
              ));
            })()}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onFinish} isLoading={saving} disabled={!allRoundsDone}>
          Schedule & Generate Link
        </Button>
      </div>
    </div>
  );
}

// ─── Step 4 — Result (share link) ─────────────────────────────────────────────

function StepResult({
  shareLink,
  onClose,
}: Readonly<{
  shareLink: string;
  onClose: () => void;
}>) {
  const [copied, setCopied] = useState(false);
  const fullUrl = `${window.location.origin}/assessment/${shareLink}/instructions`;

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
    <div className={styles.shareLinkBox}>
      <div style={{ fontSize: 40 }}>🎉</div>
      <p className={styles.shareLinkTitle}>Candidate Scheduled!</p>
      <p className={styles.shareLinkSub}>
        Share this personalised link with the candidate. Their monitoring settings and
        questions are applied automatically.
      </p>
      <div className={styles.shareLinkInput}>
        <input className={styles.shareLinkField} readOnly value={fullUrl} />
        <Button onClick={copy} variant={copied ? "secondary" : "primary"} size="sm">
          {copied ? "Copied!" : "Copy"}
        </Button>
      </div>
      <Button variant="secondary" onClick={onClose} style={{ marginTop: 8 }}>
        Done
      </Button>
    </div>
  );
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

export function ScheduleWizardModal({ assessment, workspaceId, onClose, onSuccess }: Readonly<Props>) {
  const [step, setStep] = useState(1);
  const [candidate, setCandidate] = useState<User | null>(null);
  const [overrides, setOverrides] = useState<MonitoringOverrides>({});
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [shareLink, setShareLink] = useState("");

  // Build one draft per round from the assessment config
  const [roundDrafts, setRoundDrafts] = useState<ScheduledRoundDraft[]>(() =>
    (assessment.rounds ?? []).map((r) => ({
      round_number: r.round_number,
      question_count: r.question_count,
      question_ids: [],
    }))
  );

  const updateRound = (roundNumber: number, ids: string[]) => {
    setRoundDrafts((prev) =>
      prev.map((r) => (r.round_number === roundNumber ? { ...r, question_ids: ids } : r))
    );
  };

  const handleFinish = async () => {
    if (!candidate) return;
    setSaving(true);
    try {
      // Strip override keys that exactly match the assessment default (no-op overrides)
      const base = assessment.monitoring_config;
      const cleanOverrides: MonitoringOverrides = {};
      (Object.keys(overrides) as (keyof MonitoringOverrides)[]).forEach((k) => {
        const v = overrides[k];
        if (v !== undefined && v !== (base as unknown as Record<string, unknown>)?.[k]) {
          (cleanOverrides as Record<string, unknown>)[k] = v;
        }
      });

      const payload: Record<string, unknown> = {
        candidate_id: candidate.id,
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
      setShareLink(data.data?.share_link ?? "");
      setStep(4);
      onSuccess();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Failed to schedule candidate");
    } finally {
      setSaving(false);
    }
  };

  const TITLES: Record<number, string> = {
    1: "Schedule Candidate — Step 1: Candidate Info",
    2: "Schedule Candidate — Step 2: Monitoring",
    3: "Schedule Candidate — Step 3: Questions",
    4: "Candidate Scheduled",
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={TITLES[step]}
      size="xl"
      disableBackdropClose={step < 4}
    >
      {step < 4 && <StepIndicator current={step} />}

      {step === 1 && (
        <Step1Candidate
          onNext={(c) => {
            setCandidate(c);
            setStep(2);
          }}
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
          onNext={() => setStep(3)}
          onBack={() => setStep(1)}
        />
      )}

      {step === 3 && (
        <Step3Questions
          rounds={roundDrafts}
          onUpdateRound={updateRound}
          onBack={() => setStep(2)}
          onFinish={handleFinish}
          saving={saving}
        />
      )}

      {step === 4 && shareLink && (
        <StepResult shareLink={shareLink} onClose={onClose} />
      )}
    </Modal>
  );
}
