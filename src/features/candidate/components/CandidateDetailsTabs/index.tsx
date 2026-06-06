import { useState, type ComponentType, type ReactNode } from "react";
import styles from "./CandidateDetailsTabs.module.css";
import { Button } from "@/components/ui/Button";
import { RichText } from "@/components/ui/RichText";
import { Modal } from "@/components/ui/Modal";
import { clsx } from "@/utils/helpers";
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
} from "@/assets/icons";
import type { MalpracticeType } from "@/types";
import type {
  CandidateSubmissionDetail,
  QuestionAnswer,
  RoundResult,
  MalpracticeEvent,
} from "@/types";
import { getStatusLabel } from "@/constants/statusColors";

interface CandidateDetailsTabsProps {
  data: CandidateSubmissionDetail;
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
  const [activeRound, setActiveRound] = useState(() => rounds[0]?.round_number ?? null);

  if (rounds.length === 0) {
    return <p className={styles.emptyPlaceholder}>No rounds recorded for this candidate.</p>;
  }

  const selected = rounds.find((r) => r.round_number === activeRound) ?? rounds[0];

  return (
    <div className={styles.rounds}>
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
            <QuestionReview key={qa.question_id} index={index} qa={qa} />
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
        size="lg"
      >
        {preview?.kind === "image" && (
          <img src={preview.url} alt={preview.title} className={styles.mpPreviewImage} />
        )}
        {preview?.kind === "video" && (
          <video src={preview.url} controls autoPlay className={styles.mpPreviewVideo} />
        )}
        {preview?.kind === "audio" && (
          <audio src={preview.url} controls autoPlay style={{ width: "100%" }} />
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
      {screenshots.map((screenshot, index) => (
        <figure key={index} className={styles.screenshotItem}>
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
        size="lg"
      >
        {preview?.kind === "image" && (
          <img src={preview.url} alt={preview.title} className={styles.mpPreviewImage} />
        )}
      </Modal>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CandidateDetailsTabs({ data }: CandidateDetailsTabsProps) {
  const [activeTabId, setActiveTabId] = useState(TABS[0].id);

  const activeTab = TABS.find((tab) => tab.id === activeTabId) ?? TABS[0];

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
