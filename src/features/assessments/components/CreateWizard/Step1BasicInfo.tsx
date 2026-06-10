import { useState, type ReactNode } from "react";
import styles from "./Step1BasicInfo.module.css";
import { Input, Textarea, NumberField } from "@/components/ui/Input";
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

interface Props {
  draft: AssessmentDraft;
  onNext: (info: Partial<AssessmentDraft>) => void;
  disableNext?: boolean;
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

export function Step1BasicInfo({ draft, onNext, disableNext = false }: Readonly<Props>) {
  const [name, setName] = useState(draft.name);
  const [description, setDescription] = useState(draft.description);
  const [accessibility, setAccessibility] = useState<AssessmentAccessibility>(draft.accessibility);
  const [rounds, setRounds] = useState<RoundSetup[]>(draft.rounds);
  const [monitoring, setMonitoring] = useState<MonitoringConfig>(
    draft.monitoring_config || {
      tab_monitoring: true,
      audio_monitoring: true,
      video_monitoring: true,
      screenshot_mode: "time_interval",
      screenshot_interval_minutes: 5,
      screenshot_enabled: true,
    }
  );

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
    name.trim() &&
    rounds.length > 0 &&
    rounds.every((r) => r.question_count > 0 && r.max_duration_minutes > 0);

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
                    min={1}
                    value={monitoring.screenshot_interval_seconds ?? 5}
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

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
        <Button
          disabled={!canProceed || disableNext}
          onClick={() =>
            onNext({ name, description, accessibility, rounds, monitoring_config: monitoring })
          }
          size="lg"
        >
          Next: Select Questions
        </Button>
      </div>
    </div>
  );
}
