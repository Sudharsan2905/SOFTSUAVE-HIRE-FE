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

const VERSION_OPTIONS = [
  { value: "v1", label: "Version 1" },
  { value: "v2", label: "Version 2" },
  { value: "v3", label: "Version 3" },
];

interface StatusStat {
  label: string;
  value: string;
}

interface StatusSection {
  id: string;
  title: string;
  /**
   * Six stats rendered as a 3-column grid:
   *   row 1 → Status · Total Questions · Total Time Given
   *   row 2 → Score · Started Time · Time Taken to Complete
   */
  stats: StatusStat[];
}

// Static placeholder status data — to be wired to the real submission later.
const STATUS_SECTIONS: ReadonlyArray<StatusSection> = [
  {
    id: "overall",
    title: "Over All",
    stats: [
      { label: "Status", value: "Completed" },
      { label: "Total Questions", value: "30" },
      { label: "Total Time Given", value: "90 min" },
      { label: "Score", value: "—" },
      { label: "Started Time", value: "10:30 AM, 12 Jan 2025" },
      { label: "Time Taken to Complete", value: "78 min" },
    ],
  },
  {
    id: "round-1",
    title: "Round 1",
    stats: [
      { label: "Status", value: "Completed" },
      { label: "Total Questions", value: "15" },
      { label: "Total Time Given", value: "45 min" },
      { label: "Score", value: "—" },
      { label: "Started Time", value: "10:30 AM, 12 Jan 2025" },
      { label: "Time Taken to Complete", value: "40 min" },
    ],
  },
  {
    id: "round-2",
    title: "Round 2",
    stats: [
      { label: "Status", value: "Completed" },
      { label: "Total Questions", value: "15" },
      { label: "Total Time Given", value: "45 min" },
      { label: "Score", value: "—" },
      { label: "Started Time", value: "11:15 AM, 12 Jan 2025" },
      { label: "Time Taken to Complete", value: "38 min" },
    ],
  },
];

type ReviewQuestionType = "mcq" | "text";

interface ReviewOption {
  text: string;
  isCorrect: boolean;
}

interface ReviewQuestion {
  id: string;
  type: ReviewQuestionType;
  /** Markdown prompt — may include fenced java code blocks. */
  prompt: string;
  options?: ReviewOption[];
  /** Candidate's selected option text (mcq) or typed response (text). */
  candidateAnswer: string;
  /** Model answer, shown for descriptive questions. */
  correctAnswer?: string;
}

interface ReviewRound {
  id: string;
  title: string;
  questions: ReviewQuestion[];
}

// Static placeholder review data — to be wired to the real submission later.
const REVIEW_ROUNDS: ReadonlyArray<ReviewRound> = [
  {
    id: "round-1",
    title: "Round 1",
    questions: [
      {
        id: "r1-q1",
        type: "mcq",
        prompt:
          'What is the output of the following Java code?\n\n```java\nString s = "Hello";\ns = s.concat(" World");\nSystem.out.println(s);\n```',
        options: [
          { text: "Hello", isCorrect: false },
          { text: "Hello World", isCorrect: true },
          { text: "World", isCorrect: false },
          { text: "HelloWorld", isCorrect: false },
        ],
        candidateAnswer: "Hello World",
      },
      {
        id: "r1-q2",
        type: "mcq",
        prompt:
          "Which of the following access modifiers allows visibility across different packages?",
        options: [
          { text: "private", isCorrect: false },
          { text: "protected", isCorrect: false },
          { text: "public", isCorrect: true },
          { text: "default", isCorrect: false },
        ],
        candidateAnswer: "public",
      },
      {
        id: "r1-q3",
        type: "text",
        prompt:
          "Describe how memory management works in Java, particularly focusing on garbage collection.",
        candidateAnswer:
          "Java handles memory automatically. Objects are created on the heap and the JVM's garbage collector frees the ones that are no longer reachable, so developers don't free memory manually. The heap is split into young and old generations.",
        correctAnswer:
          "Java manages memory automatically through the JVM. Objects live on the heap, which is divided into the Young generation (Eden + Survivor spaces) and the Old generation. Minor GCs reclaim short-lived objects in the young gen; major/full GCs handle the old gen. The collector frees objects that are no longer reachable from GC roots. Common collectors include G1, Parallel, and ZGC.",
      },
      {
        id: "r1-q4",
        type: "mcq",
        prompt: "Which keyword is used to inherit a class in Java?",
        options: [
          { text: "implements", isCorrect: false },
          { text: "extends", isCorrect: true },
          { text: "inherits", isCorrect: false },
          { text: "super", isCorrect: false },
        ],
        candidateAnswer: "extends",
      },
      {
        id: "r1-q5",
        type: "mcq",
        prompt: "What is the default value of an uninitialized int instance variable?",
        options: [
          { text: "0", isCorrect: true },
          { text: "null", isCorrect: false },
          { text: "undefined", isCorrect: false },
          { text: "1", isCorrect: false },
        ],
        candidateAnswer: "null",
      },
      {
        id: "r1-q6",
        type: "mcq",
        prompt: "Which collection class does NOT allow duplicate elements?",
        options: [
          { text: "ArrayList", isCorrect: false },
          { text: "LinkedList", isCorrect: false },
          { text: "HashSet", isCorrect: true },
          { text: "Vector", isCorrect: false },
        ],
        candidateAnswer: "HashSet",
      },
      {
        id: "r1-q7",
        type: "text",
        prompt: "Explain the difference between an abstract class and an interface in Java.",
        candidateAnswer:
          "An abstract class can have both abstract and concrete methods and can hold fields/state, while an interface only declares method signatures. A class can implement many interfaces but extend only one abstract class.",
        correctAnswer:
          "An abstract class can contain implemented methods, fields, and constructors and supports single inheritance. An interface defines a contract; since Java 8 it can have default and static methods but holds no instance state. A class can implement multiple interfaces but extend only one abstract class. Prefer an interface for capability and an abstract class for shared base behavior.",
      },
      {
        id: "r1-q8",
        type: "mcq",
        prompt:
          "What is the output of the following Java code?\n\n```java\nint[] arr = {10, 20, 30};\nSystem.out.println(arr.length);\n```",
        options: [
          { text: "2", isCorrect: false },
          { text: "3", isCorrect: true },
          { text: "30", isCorrect: false },
          { text: "Compilation error", isCorrect: false },
        ],
        candidateAnswer: "3",
      },
      {
        id: "r1-q9",
        type: "mcq",
        prompt: "Which of these is NOT a primitive data type in Java?",
        options: [
          { text: "int", isCorrect: false },
          { text: "boolean", isCorrect: false },
          { text: "String", isCorrect: true },
          { text: "char", isCorrect: false },
        ],
        candidateAnswer: "String",
      },
      {
        id: "r1-q10",
        type: "text",
        prompt: "What is the difference between == and .equals() in Java? Give an example.",
        candidateAnswer:
          "== compares references (whether two variables point to the same object), while .equals() compares the actual contents. Two different String objects with the same text are equal via .equals() but not necessarily with ==.",
        correctAnswer:
          'For objects, == checks reference identity (same memory location); for primitives it checks value equality. .equals() checks logical/content equality and can be overridden. Example: new String("a") == new String("a") is false, but new String("a").equals(new String("a")) is true.',
      },
    ],
  },
  {
    id: "round-2",
    title: "Round 2",
    questions: [
      {
        id: "r2-q1",
        type: "mcq",
        prompt:
          "Which methods should you override for an object to work correctly as a HashMap key?",
        options: [
          { text: "only equals()", isCorrect: false },
          { text: "only hashCode()", isCorrect: false },
          { text: "both equals() and hashCode()", isCorrect: true },
          { text: "neither — it works by default", isCorrect: false },
        ],
        candidateAnswer: "both equals() and hashCode()",
      },
      {
        id: "r2-q2",
        type: "mcq",
        prompt:
          "What is the output of the following Java code?\n\n```java\nList<Integer> nums = new ArrayList<>();\nnums.add(1);\nnums.add(2);\nnums.add(3);\nnums.removeIf(n -> n % 2 == 0);\nSystem.out.println(nums);\n```",
        options: [
          { text: "[1, 2, 3]", isCorrect: false },
          { text: "[1, 3]", isCorrect: true },
          { text: "[2]", isCorrect: false },
          { text: "[1, 2]", isCorrect: false },
        ],
        candidateAnswer: "[1, 3]",
      },
      {
        id: "r2-q3",
        type: "mcq",
        prompt:
          "Which keyword ensures a variable's value is always read from main memory rather than a thread's local cache?",
        options: [
          { text: "transient", isCorrect: false },
          { text: "synchronized", isCorrect: false },
          { text: "volatile", isCorrect: true },
          { text: "static", isCorrect: false },
        ],
        candidateAnswer: "synchronized",
      },
      {
        id: "r2-q4",
        type: "text",
        prompt: "Explain the difference between a checked and an unchecked exception in Java.",
        candidateAnswer:
          "Checked exceptions are checked at compile time and must be declared or caught (e.g. IOException). Unchecked exceptions extend RuntimeException and happen at runtime (e.g. NullPointerException), so the compiler doesn't force you to handle them.",
        correctAnswer:
          "Checked exceptions extend Exception (but not RuntimeException) and are verified at compile time — the method must either catch them or declare them with throws (e.g. IOException, SQLException). Unchecked exceptions extend RuntimeException and are not enforced by the compiler (e.g. NullPointerException, IllegalArgumentException); they usually indicate programming errors.",
      },
      {
        id: "r2-q5",
        type: "text",
        prompt: "What are the benefits of using the Stream API introduced in Java 8?",
        candidateAnswer:
          "Streams let you process collections in a declarative, functional style with operations like map, filter, and reduce. They support method chaining and can run in parallel easily.",
        correctAnswer:
          "The Stream API enables declarative, functional-style data processing (map/filter/reduce), lazy evaluation of intermediate operations, easy parallelism via parallelStream(), and more readable pipelines than manual loops. Streams are single-use and do not modify the source collection.",
      },
    ],
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

const PLACEHOLDER_COPY: Record<string, string> = {
  malpractice: "Malpractice flags will be shown here.",
  screenshots: "Captured screenshots will be shown here.",
};

function StatusSummary() {
  return (
    <div className={styles.summary}>
      {STATUS_SECTIONS.map((section) => (
        <article key={section.id} className={styles.statusCard}>
          <h3 className={styles.statusCardTitle}>{section.title}</h3>
          <dl className={styles.statGrid}>
            {section.stats.map((stat) => (
              <div key={stat.label} className={styles.statItem}>
                <dt className={styles.statLabel}>{stat.label}</dt>
                <dd className={styles.statValue}>
                  {stat.label === "Status" ? (
                    <span className={clsx(styles.statusPill, styles.statusCompleted)}>
                      {stat.value}
                    </span>
                  ) : (
                    stat.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </article>
      ))}

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

function QuestionReview({
  index,
  question,
}: Readonly<{ index: number; question: ReviewQuestion }>) {
  const isMcq = question.type === "mcq";
  const candidateCorrect =
    isMcq &&
    (question.options?.some((o) => o.isCorrect && o.text === question.candidateAnswer) ?? false);

  return (
    <article className={styles.questionCard}>
      <div className={styles.questionHead}>
        <span className={styles.questionNo}>Q{index + 1}</span>
        <span className={styles.questionType}>{isMcq ? "Multiple Choice" : "Descriptive"}</span>
      </div>

      <RichText className={styles.questionText}>{question.prompt}</RichText>

      {isMcq && question.options && (
        <div className={styles.optionList}>
          {question.options.map((opt) => {
            const isChosen = opt.text === question.candidateAnswer;
            const wrongChoice = isChosen && !opt.isCorrect;
            return (
              <div
                key={opt.text}
                className={clsx(
                  styles.option,
                  opt.isCorrect && styles.optionCorrect,
                  wrongChoice && styles.optionWrong
                )}
              >
                {(opt.isCorrect || wrongChoice) && (
                  <span
                    className={clsx(
                      styles.optionDot,
                      opt.isCorrect ? styles.optionDotCorrect : styles.optionDotWrong
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
          <span className={candidateCorrect ? styles.answerCorrect : styles.answerWrong}>
            {question.candidateAnswer}
          </span>
        </p>
      ) : (
        <div className={styles.textAnswers}>
          <div className={styles.answerBlock}>
            <span className={styles.answerBlockLabel}>Candidate Answer</span>
            <p className={styles.answerBlockText}>{question.candidateAnswer}</p>
          </div>
          {question.correctAnswer && (
            <div className={clsx(styles.answerBlock, styles.answerBlockCorrect)}>
              <span className={styles.answerBlockLabel}>Correct Answer</span>
              <p className={styles.answerBlockText}>{question.correctAnswer}</p>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function RoundsReview() {
  return (
    <div className={styles.rounds}>
      {REVIEW_ROUNDS.map((round) => (
        <section key={round.id} className={styles.round}>
          <div className={styles.roundHead}>
            <h3 className={styles.roundTitle}>{round.title}</h3>
            <span className={styles.roundMeta}>{round.questions.length} Questions</span>
          </div>
          <div className={styles.questionList}>
            {round.questions.map((question, index) => (
              <QuestionReview key={question.id} index={index} question={question} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function CandidateDetailsTabs() {
  const [version, setVersion] = useState(VERSION_OPTIONS[0].value);
  const [activeTabId, setActiveTabId] = useState(TABS[0].id);

  const activeTab = TABS.find((tab) => tab.id === activeTabId) ?? TABS[0];

  let panelContent: ReactNode;
  if (activeTab.id === "overall") {
    panelContent = <StatusSummary />;
  } else if (activeTab.id === "rounds") {
    panelContent = <RoundsReview />;
  } else {
    panelContent = PLACEHOLDER_COPY[activeTab.id];
  }

  return (
    <section className={styles.panel}>
      <div className={styles.toolbar}>
        <Select
          options={VERSION_OPTIONS}
          value={version}
          onChange={setVersion}
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
