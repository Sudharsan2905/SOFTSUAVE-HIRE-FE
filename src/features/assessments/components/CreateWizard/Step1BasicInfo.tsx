import { useRef, useState, type ReactNode } from "react";
import styles from "./Step1BasicInfo.module.css";
import { Input, Textarea, NumberField } from "@/components/ui/Input";
import { MIN_SCREENSHOT_INTERVAL_SECONDS } from "../../constants/form";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { SkeuToggle } from "./SkeuToggle";
import { Badge } from "@/components/ui/Badge";
import {
  IconPlus,
  IconDelete,
  IconMonitor,
  IconShield,
  IconMic,
  IconVideoCamera,
  IconCamera,
  IconSettings,
} from "@/assets/icons";
import { AssessmentDraft, RoundSetup } from "./WizardContainer";
import { AssessmentAccessibility, MonitoringConfig } from "@/types";
import { DEFAULT_PASS_PERCENTAGE } from "@/constants/app";

interface Props {
  draft: AssessmentDraft;
  onNext: (info: Partial<AssessmentDraft>) => void;
  disableNext?: boolean;
  // Edit mode only: shows a Save button that persists without walking through the questions.
  onSave?: (info: Partial<AssessmentDraft>) => void;
  saving?: boolean;
  // True when edits made outside this step (e.g. question picks) are still unsaved.
  hasOtherChanges?: boolean;
}

// ─── Monitoring toggle row — icon + label/hint on the left, toggle on the right ──

interface MonitoringRowProps {
  icon: ReactNode;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

function MonitoringRow({ icon, label, hint, checked, onChange }: Readonly<MonitoringRowProps>) {
  return (
    <div className={styles.toggleRow}>
      <div className={styles.toggleIcon}>{icon}</div>
      <div className={styles.toggleMeta}>
        <p className={styles.toggleLabel}>{label}</p>
        <p className={styles.toggleHint}>{hint}</p>
      </div>
      <SkeuToggle checked={checked} onChange={onChange} />
    </div>
  );
}

export function Step1BasicInfo({
  draft,
  onNext,
  disableNext = false,
  onSave,
  saving = false,
  hasOtherChanges = false,
}: Readonly<Props>) {
  const [name, setName] = useState(draft.name);
  const [description, setDescription] = useState(draft.description);
  const [expectedCandidates, setExpectedCandidates] = useState<number>(
    draft.expected_candidates ?? 10
  );
  const [passPercentage, setPassPercentage] = useState<number>(
    draft.pass_percentage ?? DEFAULT_PASS_PERCENTAGE
  );
  const [accessibility, setAccessibility] = useState<AssessmentAccessibility>(draft.accessibility);
  const [rounds, setRounds] = useState<RoundSetup[]>(draft.rounds);
  const [monitoring, setMonitoring] = useState<MonitoringConfig>(() => {
    const base: MonitoringConfig = draft.monitoring_config || {
      tab_monitoring: true,
      audio_monitoring: true,
      video_monitoring: true,
      screenshot_mode: "time_interval",
      screenshot_enabled: true,
    };
    // Older assessments may hold a shorter interval; lift it to the minimum.
    return {
      ...base,
      screenshot_interval_seconds: Math.max(
        MIN_SCREENSHOT_INTERVAL_SECONDS,
        base.screenshot_interval_seconds ?? 0
      ),
    };
  });

  const addRound = () => {
    setRounds((prev) => [
      ...prev,
      {
        round_number: prev.length + 1,
        question_count: 10,
        max_duration_minutes: 30,
        question_ids: [],
      },
    ]);
  };

  const removeRound = (idx: number) => {
    setRounds((prev) =>
      prev.filter((_, i) => i !== idx).map((r, i) => ({ ...r, round_number: i + 1 }))
    );
  };

  const updateRound = (idx: number, field: keyof RoundSetup, value: number) => {
    setRounds((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  const canProceed =
    name.trim().length > 0 &&
    expectedCandidates > 0 &&
    passPercentage >= 1 &&
    passPercentage <= 100 &&
    rounds.length > 0 &&
    rounds.every((r) => r.question_count > 0 && r.max_duration_minutes > 0);

  const currentInfo: Partial<AssessmentDraft> = {
    name,
    description,
    accessibility,
    rounds,
    monitoring_config: monitoring,
    expected_candidates: expectedCandidates,
    pass_percentage: passPercentage,
  };
  // Snapshot of the values this step opened with, to detect edits.
  const baseline = useRef(JSON.stringify(currentInfo));
  const isDirty = hasOtherChanges || JSON.stringify(currentInfo) !== baseline.current;
  // Every round must still have all its questions picked; otherwise continue via Next.
  const questionsComplete = rounds.every((r) => (r.question_ids?.length ?? 0) >= r.question_count);
  const canSave = isDirty && questionsComplete;

  return (
    <div className={styles.container}>
      {/* Basic Info */}
      <div className={styles.section}>
        <Input
          label="Assessment Name *"
          placeholder="e.g., Frontend Developer Assessment"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Textarea
          label="Description (optional)"
          placeholder="What is this assessment for?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
        <div className={styles.fieldRow}>
          <NumberField
            label="Expected Candidates *"
            min={1}
            value={expectedCandidates}
            onValueChange={(v) => setExpectedCandidates(v)}
            hint="Number of candidates expected to take this assessment"
          />
          <NumberField
            label="Pass Percentage (%)"
            min={1}
            max={100}
            value={passPercentage}
            onValueChange={(v) => setPassPercentage(v)}
            hint={`Overall score needed to pass, across all rounds. Defaults to ${DEFAULT_PASS_PERCENTAGE}%.`}
          />
        </div>
      </div>

      {/* Rounds Config */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>Rounds Configuration</h3>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<IconPlus size={14} />}
            onClick={addRound}
          >
            Add Round
          </Button>
        </div>
        <div className={styles.rounds}>
          {rounds.map((round, idx) => (
            <div key={round.round_number} className={styles.roundCard}>
              <div className={styles.roundHeader}>
                <Badge variant="primary">Round {round.round_number}</Badge>
                {rounds.length > 1 && (
                  <button className={styles.removeBtn} onClick={() => removeRound(idx)}>
                    <IconDelete size={14} />
                  </button>
                )}
              </div>
              <div className={styles.roundGrid}>
                <NumberField
                  label="No. of Questions"
                  min={1}
                  value={round.question_count}
                  onValueChange={(v) => updateRound(idx, "question_count", v)}
                  hint="You can select more for randomization"
                />
                <NumberField
                  label="Duration (minutes)"
                  min={1}
                  value={round.max_duration_minutes}
                  onValueChange={(v) => updateRound(idx, "max_duration_minutes", v)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Accessibility */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Assessment Mode</h3>
        <div className={styles.modeToggle}>
          <button
            className={`${styles.modeBtn} ${accessibility === "normal" ? styles.modeActive : ""}`}
            onClick={() => setAccessibility("normal")}
          >
            <IconMonitor size={20} />
            <span>Normal</span>
            <p>Standard assessment without monitoring</p>
          </button>
          <button
            className={`${styles.modeBtn} ${accessibility === "monitoring" ? styles.modeActive : ""}`}
            onClick={() => setAccessibility("monitoring")}
          >
            <IconShield size={20} />
            <span>Monitoring</span>
            <p>Full proctoring with camera, voice & tab tracking</p>
          </button>
        </div>

        {accessibility === "monitoring" && (
          <div className={styles.monitoringConfig}>
            <div className={styles.monitoringHeader}>
              <span className={styles.monitoringHeaderIcon}>
                <IconSettings size={20} />
              </span>
              <div className={styles.monitoringHeaderMeta}>
                <span className={styles.monitoringTitle}>Monitoring Options</span>
                <span className={styles.monitoringSubtitle}>
                  Choose different monitoring settings
                </span>
              </div>
            </div>
            <div className={styles.toggleList}>
              <MonitoringRow
                icon={<IconMonitor size={18} />}
                label="Tab switch detection"
                hint="Flag tab or window switches — auto-submits on violation"
                checked={monitoring.tab_monitoring}
                onChange={(v) => setMonitoring((p) => ({ ...p, tab_monitoring: v }))}
              />
              <MonitoringRow
                icon={<IconMic size={18} />}
                label="Voice/noise monitoring"
                hint="Detect sustained background audio or speech"
                checked={monitoring.audio_monitoring}
                onChange={(v) => setMonitoring((p) => ({ ...p, audio_monitoring: v }))}
              />
              <MonitoringRow
                icon={<IconVideoCamera size={18} />}
                label="Camera required"
                hint="Live camera feed checked for face presence"
                checked={monitoring.video_monitoring}
                onChange={(v) => setMonitoring((p) => ({ ...p, video_monitoring: v }))}
              />
              <MonitoringRow
                icon={<IconCamera size={18} />}
                label="Screenshot capture"
                hint="Periodic screenshots uploaded during the session"
                checked={monitoring.screenshot_enabled}
                onChange={(v) => setMonitoring((p) => ({ ...p, screenshot_enabled: v }))}
              />
            </div>
            {monitoring.screenshot_enabled && (
              <div className={styles.screenshotOptions}>
                <Select
                  label="Screenshot mode"
                  options={[
                    { value: "time_interval", label: "Time interval" },
                    { value: "count", label: "Total count" },
                  ]}
                  value={monitoring.screenshot_mode}
                  onChange={(v) =>
                    setMonitoring((p) => ({
                      ...p,
                      screenshot_mode: v as "time_interval" | "count",
                    }))
                  }
                />
                {monitoring.screenshot_mode === "time_interval" ? (
                  <NumberField
                    label="Interval (seconds)"
                    min={MIN_SCREENSHOT_INTERVAL_SECONDS}
                    value={
                      monitoring.screenshot_interval_seconds ?? MIN_SCREENSHOT_INTERVAL_SECONDS
                    }
                    onValueChange={(n) =>
                      setMonitoring((p) => ({ ...p, screenshot_interval_seconds: n }))
                    }
                  />
                ) : (
                  <NumberField
                    label="Total screenshots per candidate"
                    min={1}
                    value={monitoring.screenshot_count ?? 10}
                    onValueChange={(n) => setMonitoring((p) => ({ ...p, screenshot_count: n }))}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
        {onSave && (
          <Button
            variant="secondary"
            size="lg"
            isLoading={saving}
            disabled={!canProceed || disableNext || !canSave}
            onClick={() => onSave(currentInfo)}
          >
            Save
          </Button>
        )}
        <Button
          disabled={!canProceed || disableNext || saving}
          onClick={() => onNext(currentInfo)}
          size="lg"
        >
          Next: Select Questions
        </Button>
      </div>
    </div>
  );
}
