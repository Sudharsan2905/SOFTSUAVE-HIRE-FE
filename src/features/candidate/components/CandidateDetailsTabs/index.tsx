import { useState, type ComponentType, type ReactNode } from "react";
import styles from "./CandidateDetailsTabs.module.css";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";

import { RichText } from "@/components/ui/RichText";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { clsx, formatDateTime } from "@/utils/helpers";
import { api } from "@/utils/api";
import { API_ENDPOINTS } from "@/constants/api";
import { generateAndDownloadPDF } from "@/features/candidate/components/SubmissionReportPDF";
import toast from "react-hot-toast";
import {
  IconOverview,
  IconRounds,
  IconMalpractice,
  IconScreenshot,
  IconRefresh,
  IconPlay,
  IconPower,
  IconUsers,
  IconUser,
  IconEye,
  IconCopy,
  IconExternalLink,
  IconMonitor,
  IconMic,
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconHourglass,
  IconListCheck,
  IconBullseye,
  IconCalendar,
  IconCircleCheck,
  IconArrowsRotate,
  IconClock,
  IconTriangleExclamation,
} from "@/assets/icons";
import type {
  MalpracticeType,
  CandidateSubmissionDetail,
  QuestionAnswer,
  RoundResult,
  MalpracticeEvent,
} from "@/types";
import { getStatusLabel, STATUS_COLORS } from "@/constants/statusColors";

interface CandidateDetailsTabsProps {
  data: CandidateSubmissionDetail;
  workspaceId: string;
  assessmentId: string;
  onRefresh: () => void;
}

const REACCESS_CATEGORY_OPTIONS = [
  {
    value: "poor_network",
    label: "Poor Network",
    description: "Candidate experienced connectivity issues during the assessment.",
  },
  {
    value: "candidate_request",
    label: "Candidate Request",
    description: "Candidate made a personal request for re-access.",
  },
  {
    value: "technical_issue",
    label: "Technical Issue",
    description: "A technical problem on our end disrupted the candidate's session.",
  },
  {
    value: "other",
    label: "Other",
    description: "",
  },
];

interface DetailTab {
  id: string;
  label: string;
  Icon: ComponentType<{ size?: number | string }>;
}

const TABS: ReadonlyArray<DetailTab> = [
  { id: "overall", label: "Over All", Icon: IconOverview },
  { id: "rounds", label: "Rounds", Icon: IconRounds },
  { id: "malpractice", label: "Malpractice", Icon: IconMalpractice },
  { id: "screenshots", label: "Screenshots", Icon: IconScreenshot },
];

// ─── Overall Tab ─────────────────────────────────────────────────────────────

interface StatusSummaryProps {
  data: CandidateSubmissionDetail;
  workspaceId: string;
  assessmentId: string;
  onRefresh: () => void;
}

function OverviewScoreRing({ pct }: Readonly<{ pct: number }>) {
  const r = 16;
  const C = 2 * Math.PI * r;
  const filled = (pct / 100) * C;
  return (
    <svg width={54} height={54} viewBox="0 0 40 40">
      <circle cx={20} cy={20} r={r} fill="none" stroke="#edeef2" strokeWidth={4} />
      {pct > 0 && (
        <circle
          cx={20}
          cy={20}
          r={r}
          fill="none"
          stroke="var(--brand-orange, #ff6b2c)"
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${C - filled}`}
          transform="rotate(-90 20 20)"
        />
      )}
      <text
        x={20}
        y={20}
        dy="0.36em"
        textAnchor="middle"
        fontSize={9}
        fontWeight={700}
        fill={pct > 0 ? "#1e2330" : "#9aa0ac"}
        fontFamily="Inter, sans-serif"
      >
        {pct}%
      </text>
    </svg>
  );
}

function StatusSummary({
  data,
  workspaceId,
  assessmentId,
  onRefresh,
}: Readonly<StatusSummaryProps>) {
  const statusLabel = getStatusLabel(data.status);
  const status = data.status;

  const [resuming, setResuming] = useState(false);
  const [terminating, setTerminating] = useState(false);
  const [showReaccessModal, setShowReaccessModal] = useState(false);
  const [reaccessCategory, setReaccessCategory] = useState("poor_network");
  const [reaccessReason, setReaccessReason] = useState("");
  const [reaccessSubmitting, setReaccessSubmitting] = useState(false);

  const handleResume = async () => {
    setResuming(true);
    try {
      await api.post(
        API_ENDPOINTS.ASSESSMENTS.SUBMISSION_RESUME(workspaceId, assessmentId, data.submission_id)
      );
      toast.success("Interview resumed — candidate can continue.");
      onRefresh();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Failed to resume interview");
    } finally {
      setResuming(false);
    }
  };

  const handleTerminate = async () => {
    setTerminating(true);
    try {
      await api.post(
        API_ENDPOINTS.ASSESSMENTS.SUBMISSION_TERMINATE(
          workspaceId,
          assessmentId,
          data.submission_id
        ),
        { reason: "Terminated by admin" }
      );
      toast.success("Submission terminated.");
      onRefresh();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Failed to terminate submission");
    } finally {
      setTerminating(false);
    }
  };

  const openReaccessModal = () => {
    setReaccessCategory("poor_network");
    setReaccessReason("");
    setShowReaccessModal(true);
  };

  const handleReaccess = async () => {
    if (reaccessCategory === "other" && !reaccessReason.trim()) {
      toast.error("Please provide a reason for re-access.");
      return;
    }
    setReaccessSubmitting(true);
    try {
      const selectedOption = REACCESS_CATEGORY_OPTIONS.find((o) => o.value === reaccessCategory);
      const reason =
        reaccessCategory === "other" ? reaccessReason.trim() : (selectedOption?.description ?? "");
      await api.post(
        API_ENDPOINTS.ASSESSMENTS.SUBMISSION_REACCESS(
          workspaceId,
          assessmentId,
          data.submission_id
        ),
        { reason, reason_category: reaccessCategory }
      );
      toast.success("Re-access granted.");
      setShowReaccessModal(false);
      onRefresh();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Failed to grant re-access");
    } finally {
      setReaccessSubmitting(false);
    }
  };

  const selectedCategoryOption = REACCESS_CATEGORY_OPTIONS.find(
    (o) => o.value === reaccessCategory
  );

  const rounds = data.rounds ?? [];
  const totalQuestions = rounds.reduce((sum, r) => sum + r.question_answers.length, 0);
  const totalDuration = (() => {
    if (!data.started_at || !data.completed_at) return "—";
    const mins = Math.round(
      (new Date(data.completed_at).getTime() - new Date(data.started_at).getTime()) / 60000
    );
    return mins < 1 ? "< 1 min" : `${mins} min`;
  })();

  return (
    <div className={styles.summary}>
      <article className={styles.statusCard}>
        <h3 className={styles.statusCardTitle}>Assessment Overview</h3>

        {/* ── Stats row ── */}
        <div className={styles.overviewStats}>
          <div className={styles.overviewStat}>
            <span className={styles.overviewStatLabel}>Status</span>
            <Badge variant={STATUS_COLORS[data.status]?.variant ?? "default"}>{statusLabel}</Badge>
          </div>

          <div className={styles.overviewStat}>
            <span className={styles.overviewStatLabel}>Score</span>
            <OverviewScoreRing pct={data.percentage} />
          </div>

          <div className={styles.overviewStat}>
            <span className={styles.overviewStatLabel}>Rounds</span>
            <div className={styles.overviewIconValue}>
              <span className={styles.overviewIcon} style={{ background: "#efeaff", color: "#7c5cff" }}>
                <IconRounds size={16} />
              </span>
              <span className={styles.overviewCount}>{rounds.length}</span>
            </div>
          </div>

          <div className={styles.overviewStat}>
            <span className={styles.overviewStatLabel}>Questions</span>
            <div className={styles.overviewIconValue}>
              <span className={styles.overviewIcon} style={{ background: "#fff8e1", color: "#f59e0b" }}>
                <IconListCheck size={16} />
              </span>
              <span className={styles.overviewCount}>{totalQuestions}</span>
            </div>
          </div>

          <div className={styles.overviewStat}>
            <span className={styles.overviewStatLabel}>Malpractice Count</span>
            <div className={styles.overviewIconValue}>
              <span className={styles.overviewIcon} style={{ background: "#fde6e6", color: "#ef4444" }}>
                <IconTriangleExclamation size={16} />
              </span>
              <span className={styles.overviewCount}>{data.malpractice_count}</span>
            </div>
          </div>

          <div className={styles.overviewStat}>
            <span className={styles.overviewStatLabel}>Re-access Count</span>
            <div className={styles.overviewIconValue}>
              <span className={styles.overviewIcon} style={{ background: "#e0f2fe", color: "#0ea5e9" }}>
                <IconArrowsRotate size={16} />
              </span>
              <span className={styles.overviewCount}>{data.reaccess_count}</span>
            </div>
          </div>
        </div>

        {/* ── Divider ── */}
        <div className={styles.overviewDivider} />

        {/* ── Meta row ── */}
        <div className={styles.overviewMeta}>
          <div className={styles.overviewMetaItem}>
            <span className={styles.overviewMetaIcon}><IconCalendar size={15} /></span>
            <div>
              <span className={styles.overviewMetaLabel}>Started At</span>
              <span className={styles.overviewMetaValue}>
                {data.started_at ? formatDateTime(data.started_at) : "—"}
              </span>
            </div>
          </div>
          <div className={styles.overviewMetaItem}>
            <span className={styles.overviewMetaIcon}><IconCircleCheck size={15} /></span>
            <div>
              <span className={styles.overviewMetaLabel}>Completed At</span>
              <span className={styles.overviewMetaValue}>
                {data.completed_at ? formatDateTime(data.completed_at) : "—"}
              </span>
            </div>
          </div>
          <div className={styles.overviewMetaItem}>
            <span className={styles.overviewMetaIcon}><IconClock size={15} /></span>
            <div>
              <span className={styles.overviewMetaLabel}>Total Duration</span>
              <span className={styles.overviewMetaValue}>{totalDuration}</span>
            </div>
          </div>
        </div>
      </article>

      {/* ── Per-round cards (> 1 round) ── */}
      {rounds.length > 1 && (
        <div className={styles.roundCardsGrid}>
          {rounds.map((round) => {
            const isCompleted = Boolean(round.completed_at);
            const isStarted = Boolean(round.started_at);
            const roundBadgeVariant = isCompleted ? "warning" : isStarted ? "info" : "default";
            const roundBadgeLabel = isCompleted ? "Completed" : isStarted ? "In Progress" : "Not Started";
            const roundBorderColor = isCompleted ? "#16b674" : isStarted ? "#7c5cff" : "#9aa0ac";
            const scoreColor =
              round.percentage === 0
                ? "var(--text-tertiary)"
                : round.percentage >= 75
                  ? "#16b674"
                  : round.percentage >= 50
                    ? "#f59e0b"
                    : "#e23b3b";
            return (
              <article
                key={round.round_number}
                className={styles.roundCard}
                style={{ borderLeftColor: roundBorderColor }}
              >
                <div className={styles.roundCardHeader}>
                  <span className={styles.roundCardName}>Round {round.round_number}</span>
                  <Badge variant={roundBadgeVariant}>{roundBadgeLabel}</Badge>
                  {isCompleted ? (
                    <span style={{ color: "#22c55e", display: "inline-flex", marginLeft: "auto" }}>
                      <IconCircleCheck size={18} />
                    </span>
                  ) : (
                    <svg
                      width={18}
                      height={18}
                      viewBox="0 0 18 18"
                      fill="none"
                      style={{ marginLeft: "auto", flexShrink: 0 }}
                    >
                      <circle cx={9} cy={9} r={7} stroke="#3b82f6" strokeWidth={2} strokeDasharray="3 3" />
                    </svg>
                  )}
                </div>
                <div className={styles.roundInfoRow}>
                  <span className={styles.roundInfoIcon}><IconHourglass size={15} /></span>
                  <span className={styles.roundInfoLabel}>Max Duration</span>
                  <span className={styles.roundInfoValue}>
                    {round.max_duration_minutes != null ? `${round.max_duration_minutes} min` : "—"}
                  </span>
                </div>
                <div className={styles.roundInfoRow}>
                  <span className={styles.roundInfoIcon}><IconListCheck size={15} /></span>
                  <span className={styles.roundInfoLabel}>Questions</span>
                  <span className={styles.roundInfoValue}>{round.question_answers.length}</span>
                </div>
                <div className={styles.roundInfoRow}>
                  <span className={styles.roundInfoIcon}><IconBullseye size={15} /></span>
                  <span className={styles.roundInfoLabel}>Score</span>
                  <span className={styles.roundInfoValue} style={{ color: scoreColor }}>
                    {round.percentage}%
                  </span>
                </div>
                <div className={styles.roundInfoRow}>
                  <span className={styles.roundInfoIcon}><IconCalendar size={15} /></span>
                  <span className={styles.roundInfoLabel}>Started At</span>
                  <span className={styles.roundInfoValue}>
                    {round.started_at ? formatDateTime(round.started_at) : "—"}
                  </span>
                </div>
                <div className={styles.roundInfoRow}>
                  <span className={styles.roundInfoIcon}><IconCircleCheck size={15} /></span>
                  <span className={styles.roundInfoLabel}>Completed At</span>
                  <span className={styles.roundInfoValue}>
                    {round.completed_at ? formatDateTime(round.completed_at) : "—"}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className={styles.statusActions}>
        {(status === "completed" || status === "malpractice" || status === "terminated") && (
          <Button
            variant="secondary"
            leftIcon={<IconRefresh size={16} />}
            onClick={openReaccessModal}
          >
            Re-access
          </Button>
        )}
        {status === "on_hold" && (
          <Button
            variant="primary"
            leftIcon={<IconPlay size={16} />}
            onClick={() => void handleResume()}
            isLoading={resuming}
          >
            Resume
          </Button>
        )}
        {(status === "in_progress" || status === "pending") && (
          <Button
            variant="danger"
            leftIcon={<IconPower size={16} />}
            onClick={() => void handleTerminate()}
            isLoading={terminating}
          >
            Terminate
          </Button>
        )}
      </div>

      {/* Re-access Modal */}
      <Modal
        isOpen={showReaccessModal}
        onClose={() => setShowReaccessModal(false)}
        title="Grant Re-access"
        size="sm"
        footer={
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button variant="secondary" onClick={() => setShowReaccessModal(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleReaccess()} isLoading={reaccessSubmitting}>
              Confirm Re-access
            </Button>
          </div>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <Select
              label="Reason Category"
              options={REACCESS_CATEGORY_OPTIONS}
              value={reaccessCategory}
              onChange={(val) => {
                setReaccessCategory(val);
                setReaccessReason("");
              }}
              fullWidth
              hint={reaccessCategory === "other" ? "" : (selectedCategoryOption?.description ?? "")}
            />
          </div>

          {reaccessCategory === "other" && (
            <div>
              <label
                htmlFor="reaccess-reason"
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 500,
                  marginBottom: 6,
                  color: "var(--text-secondary)",
                }}
              >
                Reason <span style={{ color: "var(--error-500)" }}>*</span>
              </label>
              <textarea
                id="reaccess-reason"
                value={reaccessReason}
                onChange={(e) => setReaccessReason(e.target.value)}
                placeholder="Describe why re-access is being granted..."
                rows={3}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "1px solid var(--border-default)",
                  background: "var(--bg-elevated)",
                  color: "var(--text-primary)",
                  fontSize: 14,
                  resize: "vertical",
                  boxSizing: "border-box",
                }}
              />
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

// ─── Rounds Tab ──────────────────────────────────────────────────────────────

function toCandidateAnswerArray(value: string | string[]): string[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function getReviewQuestionTypeLabel(type: string): string {
  if (type === "mcq_single") return "Multiple Choice";
  if (type === "mcq_multi") return "Multiple Select";
  return "Descriptive";
}

function QuestionReview({
  index,
  qa,
  isValidated,
}: Readonly<{ index: number; qa: QuestionAnswer; isValidated: boolean }>) {
  const isMcq = qa.question_type === "mcq_single" || qa.question_type === "mcq_multi";
  const candidateAnswers = toCandidateAnswerArray(qa.candidate_answer);
  let answerClassName: string | undefined;
  if (qa.is_correct === true) answerClassName = styles.answerCorrect;
  else if (qa.is_correct === false) answerClassName = styles.answerWrong;

  return (
    <article className={styles.questionCard}>
      <div className={styles.questionHead}>
        <span className={styles.questionNo}>Q{index + 1}</span>
        <span className={styles.questionType}>{getReviewQuestionTypeLabel(qa.question_type)}</span>
        {isValidated ? (
          qa.is_correct !== null && (
            <Badge
              variant={qa.is_correct ? "success" : "error"}
              className={styles.correctnessBadge}
            >
              {qa.is_correct ? "Correct" : "Incorrect"}
            </Badge>
          )
        ) : (
          <Badge variant="info" className={styles.correctnessBadge}>
            Not Validated
          </Badge>
        )}
      </div>

      <RichText className={styles.questionText}>{qa.question_text}</RichText>

      {isMcq && qa.options.length > 0 && (
        <div className={styles.optionList}>
          {qa.options.map((opt) => {
            const isChosen = candidateAnswers.includes(opt.id);
            const isCorrect = opt.is_correct === true;
            // Only mark red when is_correct is explicitly false (not null/unknown).
            const wrongChoice = isChosen && opt.is_correct === false;
            return (
              <div
                key={opt.id}
                className={clsx(
                  styles.option,
                  isCorrect && styles.optionCorrect,
                  wrongChoice && styles.optionWrong
                )}
              >
                {(isCorrect || wrongChoice) && (
                  <span
                    className={clsx(
                      styles.optionDot,
                      isCorrect ? styles.optionDotCorrect : styles.optionDotWrong
                    )}
                  />
                )}
                <span className={styles.optionText}>{opt.text}</span>
              </div>
            );
          })}
        </div>
      )}

      {isMcq ? (
        <p className={styles.answerLine}>
          <span className={styles.answerLineLabel}>Candidate Answer: </span>
          <span className={answerClassName}>
            {candidateAnswers.length > 0 ? candidateAnswers.join(", ") : "—"}
          </span>
        </p>
      ) : (
        <div className={styles.textAnswers}>
          <div className={styles.answerBlock}>
            <span className={styles.answerBlockLabel}>Candidate Answer</span>
            <p className={styles.answerBlockText}>
              {candidateAnswers.length > 0 ? candidateAnswers.join("\n") : "—"}
            </p>
          </div>
        </div>
      )}
    </article>
  );
}

interface RoundsReviewProps {
  rounds: RoundResult[];
  submissionData: CandidateSubmissionDetail;
}

function RoundsReview({ rounds, submissionData }: Readonly<RoundsReviewProps>) {
  const [activeRound, setActiveRound] = useState(() => rounds[0]?.round_number ?? null);
  const [downloading, setDownloading] = useState(false);

  const handleDownloadRound = async (roundNumber: number) => {
    setDownloading(true);
    try {
      const roundData = rounds.filter((r) => r.round_number === roundNumber);
      await generateAndDownloadPDF(submissionData, roundData, `Round ${roundNumber}`);
    } catch {
      toast.error("Failed to generate the round report.");
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadAll = async () => {
    setDownloading(true);
    try {
      await generateAndDownloadPDF(submissionData, rounds, "All Rounds");
    } catch {
      toast.error("Failed to generate the report.");
    } finally {
      setDownloading(false);
    }
  };

  if (rounds.length === 0) {
    return <p className={styles.emptyPlaceholder}>No rounds recorded for this candidate.</p>;
  }

  const selected = rounds.find((r) => r.round_number === activeRound) ?? rounds[0];

  return (
    <div className={styles.rounds}>
      {/* Round sub-tabs with the PDF download control. On tablet/laptop the
          download sits to the right of the round tabs; on mobile it stacks
          above them. */}
      <div className={styles.roundTabRow}>
        {/* Round selector tabs — one per round in the response. */}
        <div className={styles.roundTabBar} role="tablist" aria-label="Rounds">
          {rounds.map((round) => (
            <button
              key={round.round_number}
              type="button"
              role="tab"
              aria-selected={round.round_number === selected.round_number}
              className={clsx(
                styles.roundTab,
                round.round_number === selected.round_number && styles.roundTabActive
              )}
              onClick={() => setActiveRound(round.round_number)}
            >
              Round {round.round_number}
            </button>
          ))}
        </div>

        {/* Download a round's PDF report */}
        <div className={styles.roundDownloadBar}>
          {rounds.length === 1 ? (
            <Button
              variant="secondary"
              leftIcon={<IconDownload size={16} />}
              onClick={() => void handleDownloadRound(rounds[0].round_number)}
              isLoading={downloading}
            >
              Download PDF
            </Button>
          ) : (
            <Select
              placeholder="Export as PDF"
              leftIcon={<IconDownload size={16} />}
              fullWidth={false}
              hideArrow={true}
              disabled={downloading}
              options={[
                { value: "all", label: "All Rounds" },
                ...rounds.map((r) => ({
                  value: String(r.round_number),
                  label: `Round ${r.round_number}`,
                })),
              ]}
              onChange={(val) => {
                if (val === "all") void handleDownloadAll();
                else void handleDownloadRound(Number(val));
              }}
            />
          )}
        </div>
      </div>

      <section className={styles.round}>
        <div className={styles.roundHead}>
          <div className={styles.roundHeadInfo}>
            <h3 className={styles.roundTitle}>Round {selected.round_number}</h3>
          </div>
          <span className={styles.roundMeta}>
            {selected.question_answers.length} Questions &nbsp;·&nbsp; {selected.percentage}%
          </span>
        </div>
        <div className={styles.questionList}>
          {selected.question_answers.map((qa, index) => (
            <QuestionReview
              key={qa.question_id}
              index={index}
              qa={qa}
              isValidated={selected.is_validated}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

// ─── Malpractice Tab ─────────────────────────────────────────────────────────

interface MalpracticeMeta {
  label: string;
  description: string;
  Icon: ComponentType<{ size?: number | string }>;
}

// Human-readable label, description and glyph for every detected event type.
const MALPRACTICE_META: Record<MalpracticeType, MalpracticeMeta> = {
  tab_switch: {
    label: "Tab Switch",
    description: "Candidate switched to another tab/application",
    Icon: IconExternalLink,
  },
  fullscreen_exit: {
    label: "Fullscreen Exit",
    description: "Candidate exited fullscreen mode",
    Icon: IconMonitor,
  },
  screen_share_stop: {
    label: "Screen Share Stopped",
    description: "Screen sharing was stopped during the interview",
    Icon: IconMonitor,
  },
  devtools_open: {
    label: "Developer Tools",
    description: "Browser developer tools were opened",
    Icon: IconMonitor,
  },
  copy_paste: {
    label: "Copy Paste",
    description: "Content copied and pasted during the interview",
    Icon: IconCopy,
  },
  keyboard_shortcut: {
    label: "Keyboard Shortcut",
    description: "A restricted keyboard shortcut was used",
    Icon: IconCopy,
  },
  multiple_faces: {
    label: "Multiple Face",
    description: "Multiple faces were detected in the frame",
    Icon: IconUsers,
  },
  face_absence: {
    label: "Looking Away",
    description: "Candidate was not looking at the screen",
    Icon: IconUser,
  },
  eye_direction: {
    label: "Looking Away",
    description: "Candidate was not looking at the screen",
    Icon: IconEye,
  },
  background_noise: {
    label: "Background Noise",
    description: "Background noise was detected during the interview",
    Icon: IconMic,
  },
  audio_violation: {
    label: "Audio Violation",
    description: "An audio violation was detected during the interview",
    Icon: IconMic,
  },
  speaking: {
    label: "Another Person",
    description: "Another person was detected speaking in the background",
    Icon: IconUsers,
  },
  notification_received: {
    label: "Notification",
    description: "OS notification interaction detected during the interview",
    Icon: IconMalpractice,
  },
};

const FALLBACK_MALPRACTICE_META: MalpracticeMeta = {
  label: "Malpractice",
  description: "A monitoring violation was detected during the interview",
  Icon: IconMalpractice,
};

const MALPRACTICE_PAGE_SIZE = 8;

type MediaPreview =
  | { kind: "image"; url: string; title: string }
  | { kind: "video"; url: string; title: string }
  | { kind: "audio"; url: string; title: string };

function MalpracticeTab({ events }: Readonly<{ events: MalpracticeEvent[] }>) {
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState<MediaPreview | null>(null);

  if (events.length === 0) {
    return <p className={styles.emptyPlaceholder}>No malpractice events recorded.</p>;
  }

  const totalPages = Math.ceil(events.length / MALPRACTICE_PAGE_SIZE);
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * MALPRACTICE_PAGE_SIZE;
  const pageEvents = events.slice(start, start + MALPRACTICE_PAGE_SIZE);

  return (
    <div className={styles.mpWrap}>
      <div className={styles.mpTableScroll}>
        <table className={styles.mpTable}>
          <thead>
            <tr>
              <th>#</th>
              <th>Type</th>
              <th>Description</th>
              <th>Face Image</th>
              <th>Screen Image</th>
              <th>Screen Video</th>
              <th>Audio</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {pageEvents.map((event, i) => {
              const meta = MALPRACTICE_META[event.type] ?? FALLBACK_MALPRACTICE_META;
              // Backend may override the label/description; the icon is always local.
              const label = event.label ?? meta.label;
              const description = event.description ?? meta.description;
              const rowNo = start + i + 1;
              const when = new Date(event.timestamp);
              const { face_image_url, screen_image_url, screen_video_url, audio_clip_url } = event;
              return (
                <tr key={`${event.type}-${event.timestamp}-${rowNo}`}>
                  <td className={styles.mpNo}>{rowNo}</td>
                  <td>
                    <span className={styles.mpType}>
                      <meta.Icon size={16} />
                      {label}
                    </span>
                  </td>
                  <td className={styles.mpDesc}>{description}</td>
                  <td>
                    {face_image_url ? (
                      <button
                        type="button"
                        className={styles.mpThumb}
                        onClick={() =>
                          setPreview({
                            kind: "image",
                            url: face_image_url,
                            title: `${label} — Face Capture`,
                          })
                        }
                      >
                        <img src={face_image_url} alt="Face capture" />
                      </button>
                    ) : (
                      <span className={styles.mpEmpty}>—</span>
                    )}
                  </td>
                  <td>
                    {screen_image_url ? (
                      <button
                        type="button"
                        className={styles.mpThumb}
                        onClick={() =>
                          setPreview({
                            kind: "image",
                            url: screen_image_url,
                            title: `${label} — Screen Capture`,
                          })
                        }
                      >
                        <img src={screen_image_url} alt="Screen capture" />
                      </button>
                    ) : (
                      <span className={styles.mpEmpty}>—</span>
                    )}
                  </td>
                  <td>
                    {screen_video_url ? (
                      <button
                        type="button"
                        className={styles.mpMediaBtn}
                        aria-label="Play screen recording"
                        onClick={() =>
                          setPreview({
                            kind: "video",
                            url: screen_video_url,
                            title: `${label} — Screen Recording`,
                          })
                        }
                      >
                        <IconPlay size={16} />
                      </button>
                    ) : (
                      <span className={styles.mpEmpty}>—</span>
                    )}
                  </td>
                  <td>
                    {audio_clip_url ? (
                      <button
                        type="button"
                        className={styles.mpMediaBtn}
                        aria-label="Play audio clip"
                        onClick={() =>
                          setPreview({
                            kind: "audio",
                            url: audio_clip_url,
                            title: `${label} — Audio Clip`,
                          })
                        }
                      >
                        <IconMic size={16} />
                      </button>
                    ) : (
                      <span className={styles.mpEmpty}>—</span>
                    )}
                  </td>
                  <td>
                    <span className={styles.mpTime}>
                      <span className={styles.mpDate}>
                        {when.toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      <span className={styles.mpClock}>
                        {when.toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className={styles.mpFooter}>
        <span className={styles.mpCount}>
          Showing {start + 1} to {start + pageEvents.length} of {events.length} events
        </span>
        {totalPages > 1 && (
          <div className={styles.mpPager}>
            <button
              type="button"
              className={styles.mpPageNav}
              disabled={safePage === 1}
              onClick={() => setPage(safePage - 1)}
              aria-label="Previous page"
            >
              <IconChevronLeft size={16} />
            </button>
            {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((p) => (
              <button
                key={p}
                type="button"
                className={clsx(styles.mpPageBtn, p === safePage && styles.mpPageBtnActive)}
                onClick={() => setPage(p)}
              >
                {p}
              </button>
            ))}
            <button
              type="button"
              className={styles.mpPageNav}
              disabled={safePage === totalPages}
              onClick={() => setPage(safePage + 1)}
              aria-label="Next page"
            >
              <IconChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      <Modal
        isOpen={preview !== null}
        onClose={() => setPreview(null)}
        title={preview?.title}
        size="xl"
      >
        {preview?.kind === "image" && (
          <img src={preview.url} alt={preview.title} className={styles.mpPreviewImage} />
        )}
        {preview?.kind === "video" && (
          <video src={preview.url} controls autoPlay className={styles.mpPreviewVideo}>
            <track kind="captions" src="" srcLang="en" label="Captions" default />
          </video>
        )}
        {preview?.kind === "audio" && (
          <audio src={preview.url} controls autoPlay style={{ width: "100%" }}>
            <track kind="captions" src="" srcLang="en" label="Captions" default />
          </audio>
        )}
      </Modal>
    </div>
  );
}

// ─── Screenshots Tab ─────────────────────────────────────────────────────────

function ScreenshotsTab({
  screenshots,
}: Readonly<{ screenshots: CandidateSubmissionDetail["screenshots"] }>) {
  const [preview, setPreview] = useState<MediaPreview | null>(null);

  if (screenshots.length === 0) {
    return <p className={styles.emptyPlaceholder}>No screenshots captured.</p>;
  }

  return (
    <div className={styles.screenshotGrid}>
      {screenshots.map((screenshot) => (
        <figure key={`${screenshot.url}-${screenshot.taken_at}`} className={styles.screenshotItem}>
          <button
            type="button"
            className={styles.screenshotButton}
            onClick={() =>
              setPreview({
                kind: "image",
                url: screenshot.url,
                title: `Round ${screenshot.round} — ${new Date(
                  screenshot.taken_at
                ).toLocaleString()}`,
              })
            }
          >
            <img
              src={screenshot.url}
              alt={`Screenshot from Round ${screenshot.round}`}
              className={styles.screenshotImage}
            />
          </button>
          <figcaption className={styles.screenshotCaption}>
            <span className={styles.screenshotRound}>Round {screenshot.round}</span>
            <span className={styles.screenshotTime}>
              {new Date(screenshot.taken_at).toLocaleString()}
            </span>
          </figcaption>
        </figure>
      ))}

      <Modal
        isOpen={preview !== null}
        onClose={() => setPreview(null)}
        title={preview?.title}
        size="xl"
      >
        {preview?.kind === "image" && (
          <img src={preview.url} alt={preview.title} className={styles.mpPreviewImage} />
        )}
      </Modal>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CandidateDetailsTabs({
  data,
  workspaceId,
  assessmentId,
  onRefresh,
}: Readonly<CandidateDetailsTabsProps>) {
  const [activeTabId, setActiveTabId] = useState(TABS[0].id);

  const activeTab = TABS.find((tab) => tab.id === activeTabId) ?? TABS[0];

  let panelContent: ReactNode;
  if (activeTab.id === "overall") {
    panelContent = (
      <StatusSummary
        data={data}
        workspaceId={workspaceId}
        assessmentId={assessmentId}
        onRefresh={onRefresh}
      />
    );
  } else if (activeTab.id === "rounds") {
    panelContent = <RoundsReview rounds={data.rounds} submissionData={data} />;
  } else if (activeTab.id === "malpractice") {
    panelContent = <MalpracticeTab events={data.malpractice_events} />;
  } else if (activeTab.id === "screenshots") {
    panelContent = <ScreenshotsTab screenshots={data.screenshots} />;
  }

  return (
    <section className={styles.panel}>
      <div className={styles.stickyNav}>
        <div className={styles.tabBar} role="tablist" aria-label="Candidate detail sections">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={tab.id === activeTabId}
              aria-controls={`panel-${tab.id}`}
              aria-label={tab.label}
              className={clsx(styles.tab, tab.id === activeTabId && styles.tabActive)}
              onClick={() => setActiveTabId(tab.id)}
            >
              <tab.Icon size={16} />
              <span className={styles.tabLabel}>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div
        id={`panel-${activeTab.id}`}
        className={styles.tabContent}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab.id}`}
      >
        {panelContent}
      </div>
    </section>
  );
}
