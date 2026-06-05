import { useState, type ComponentType, type ReactNode } from "react";
import styles from "./CandidateDetailsTabs.module.css";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { RichText } from "@/components/ui/RichText";
import { clsx } from "@/utils/helpers";
import {
  IconOverview,
  IconRounds,
  IconMalpractice,
  IconScreenshot,
  IconRefresh,
  IconPlay,
  IconPower,
} from "@/assets/icons";
import type {
  CandidateSubmissionDetail,
  QuestionAnswer,
  RoundResult,
  MalpracticeEvent,
} from "@/types";
import { getStatusLabel } from "@/constants/statusColors";

interface CandidateDetailsTabsProps {
  data: CandidateSubmissionDetail;
  selectedVersion: string;
  onVersionChange?: (version: string) => void;
}

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

function StatusSummary({ data }: Readonly<{ data: CandidateSubmissionDetail }>) {
  const statusLabel = getStatusLabel(data.status);

  return (
    <div className={styles.summary}>
      <article className={styles.statusCard}>
        <h3 className={styles.statusCardTitle}>Over All</h3>
        <dl className={styles.statGrid}>
          <div className={styles.statItem}>
            <dt className={styles.statLabel}>Status</dt>
            <dd className={styles.statValue}>
              <span
                className={clsx(
                  styles.statusPill,
                  styles[`status${data.status.replace(/_([a-z])/g, (_, c) => c.toUpperCase())}`]
                )}
              >
                {statusLabel}
              </span>
            </dd>
          </div>
          <div className={styles.statItem}>
            <dt className={styles.statLabel}>Submission ID</dt>
            <dd className={styles.statValue}>{data.submission_id}</dd>
          </div>
          <div className={styles.statItem}>
            <dt className={styles.statLabel}>Score</dt>
            <dd className={styles.statValue}>{data.score}</dd>
          </div>
          <div className={styles.statItem}>
            <dt className={styles.statLabel}>Percentage</dt>
            <dd className={styles.statValue}>{data.percentage}%</dd>
          </div>
          <div className={styles.statItem}>
            <dt className={styles.statLabel}>Malpractice Count</dt>
            <dd className={styles.statValue}>{data.malpractice_count}</dd>
          </div>
          <div className={styles.statItem}>
            <dt className={styles.statLabel}>Re-access Count</dt>
            <dd className={styles.statValue}>{data.reaccess_count}</dd>
          </div>
          {data.started_at && (
            <div className={styles.statItem}>
              <dt className={styles.statLabel}>Started At</dt>
              <dd className={styles.statValue}>{new Date(data.started_at).toLocaleString()}</dd>
            </div>
          )}
          {data.completed_at && (
            <div className={styles.statItem}>
              <dt className={styles.statLabel}>Completed At</dt>
              <dd className={styles.statValue}>{new Date(data.completed_at).toLocaleString()}</dd>
            </div>
          )}
        </dl>
      </article>

      <div className={styles.statusActions}>
        <Button variant="secondary" leftIcon={<IconRefresh size={16} />}>
          Re-access
        </Button>
        <Button variant="primary" leftIcon={<IconPlay size={16} />}>
          Resume
        </Button>
        <Button variant="danger" leftIcon={<IconPower size={16} />}>
          Terminate
        </Button>
      </div>
    </div>
  );
}

// ─── Rounds Tab ──────────────────────────────────────────────────────────────

function toCandidateAnswerArray(value: string | string[]): string[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function QuestionReview({ index, qa }: Readonly<{ index: number; qa: QuestionAnswer }>) {
  const isMcq = qa.question_type === "mcq_single" || qa.question_type === "mcq_multi";
  const candidateAnswers = toCandidateAnswerArray(qa.candidate_answer);

  return (
    <article className={styles.questionCard}>
      <div className={styles.questionHead}>
        <span className={styles.questionNo}>Q{index + 1}</span>
        <span className={styles.questionType}>
          {qa.question_type === "mcq_single"
            ? "Multiple Choice"
            : qa.question_type === "mcq_multi"
              ? "Multiple Select"
              : "Descriptive"}
        </span>
        {qa.is_correct !== null && (
          <span
            className={clsx(
              styles.correctnessBadge,
              qa.is_correct ? styles.correctnessBadgeCorrect : styles.correctnessBadgeWrong
            )}
          >
            {qa.is_correct ? "Correct" : "Incorrect"}
          </span>
        )}
      </div>

      <RichText className={styles.questionText}>{qa.question_text}</RichText>

      {isMcq && qa.options.length > 0 && (
        <div className={styles.optionList}>
          {qa.options.map((opt) => {
            const isChosen = qa.candidate_answer.includes(opt.id);
            const isCorrect = opt.is_correct === true;
            const wrongChoice = isChosen && !isCorrect;
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
          <span className={qa.is_correct ? styles.answerCorrect : styles.answerWrong}>
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

function RoundsReview({ rounds }: Readonly<{ rounds: RoundResult[] }>) {
  return (
    <div className={styles.rounds}>
      {rounds.map((round) => (
        <section key={round.round_number} className={styles.round}>
          <div className={styles.roundHead}>
            <h3 className={styles.roundTitle}>Round {round.round_number}</h3>
            <span className={styles.roundMeta}>
              {round.question_answers.length} Questions &nbsp;·&nbsp; {round.percentage}%
            </span>
          </div>
          <div className={styles.questionList}>
            {round.question_answers.map((qa, index) => (
              <QuestionReview key={qa.question_id} index={index} qa={qa} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ─── Malpractice Tab ─────────────────────────────────────────────────────────

function MalpracticeTab({ events }: Readonly<{ events: MalpracticeEvent[] }>) {
  if (events.length === 0) {
    return <p className={styles.emptyPlaceholder}>No malpractice events recorded.</p>;
  }

  return (
    <div className={styles.malpracticeList}>
      {events.map((event, index) => (
        <article key={index} className={styles.malpracticeCard}>
          <div className={styles.malpracticeHead}>
            <span className={styles.malpracticeType}>{event.type.replace(/_/g, " ")}</span>
            <span className={styles.malpracticeRound}>Round {event.round}</span>
            <span className={styles.malpracticeTimestamp}>
              {new Date(event.timestamp).toLocaleString()}
            </span>
          </div>
          <div className={styles.malpracticeMedia}>
            {event.screen_image_url && (
              <div className={styles.mediaItem}>
                <span className={styles.mediaLabel}>Screen Capture</span>
                <img
                  src={event.screen_image_url}
                  alt="Screen capture"
                  className={styles.mediaImage}
                />
              </div>
            )}
            {event.face_image_url && (
              <div className={styles.mediaItem}>
                <span className={styles.mediaLabel}>Face Capture</span>
                <img src={event.face_image_url} alt="Face capture" className={styles.mediaImage} />
              </div>
            )}
            {event.screen_video_url && (
              <div className={styles.mediaItem}>
                <span className={styles.mediaLabel}>Screen Recording</span>
                <video src={event.screen_video_url} controls className={styles.mediaVideo} />
              </div>
            )}
            {event.audio_clip_url && (
              <div className={styles.mediaItem}>
                <span className={styles.mediaLabel}>Audio Clip</span>
                <audio src={event.audio_clip_url} controls className={styles.mediaAudio} />
              </div>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

// ─── Screenshots Tab ─────────────────────────────────────────────────────────

function ScreenshotsTab({
  screenshots,
}: Readonly<{ screenshots: CandidateSubmissionDetail["screenshots"] }>) {
  if (screenshots.length === 0) {
    return <p className={styles.emptyPlaceholder}>No screenshots captured.</p>;
  }

  return (
    <div className={styles.screenshotGrid}>
      {screenshots.map((screenshot, index) => (
        <figure key={index} className={styles.screenshotItem}>
          <img
            src={screenshot.url}
            alt={`Screenshot from Round ${screenshot.round}`}
            className={styles.screenshotImage}
          />
          <figcaption className={styles.screenshotCaption}>
            <span className={styles.screenshotRound}>Round {screenshot.round}</span>
            <span className={styles.screenshotTime}>
              {new Date(screenshot.taken_at).toLocaleString()}
            </span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CandidateDetailsTabs({
  data,
  selectedVersion,
  onVersionChange,
}: CandidateDetailsTabsProps) {
  const [activeTabId, setActiveTabId] = useState(TABS[0].id);

  const activeTab = TABS.find((tab) => tab.id === activeTabId) ?? TABS[0];

  const versionOptions = [
    { value: "current", label: "Latest" },
    ...data.available_versions.map((v) => ({
      value: String(v.version),
      label: `Version ${v.version}`,
    })),
  ];

  let panelContent: ReactNode;
  if (activeTab.id === "overall") {
    panelContent = <StatusSummary data={data} />;
  } else if (activeTab.id === "rounds") {
    panelContent = <RoundsReview rounds={data.rounds} />;
  } else if (activeTab.id === "malpractice") {
    panelContent = <MalpracticeTab events={data.malpractice_events} />;
  } else if (activeTab.id === "screenshots") {
    panelContent = <ScreenshotsTab screenshots={data.screenshots} />;
  }

  return (
    <section className={styles.panel}>
      <div className={styles.stickyNav}>
        <div className={styles.toolbar}>
          <Select
            options={versionOptions}
            value={selectedVersion}
            onChange={onVersionChange}
            fullWidth={false}
            style={{ width: 170 }}
          />
        </div>

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
