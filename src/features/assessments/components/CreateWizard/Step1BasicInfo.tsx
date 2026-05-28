import React, { useState } from "react";
import styles from "./Step1BasicInfo.module.css";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { IconPlus, IconDelete, IconMonitor, IconShield } from "@/assets/icons";
import { AssessmentDraft, RoundSetup } from "./WizardContainer";
import { AssessmentAccessibility, MonitoringConfig } from "@/types";

interface Props {
  draft: AssessmentDraft;
  onNext: (info: Partial<AssessmentDraft>) => void;
}

export function Step1BasicInfo({ draft, onNext }: Props) {
  const [name, setName] = useState(draft.name);
  const [description, setDescription] = useState(draft.description);
  const [accessibility, setAccessibility] = useState<AssessmentAccessibility>(draft.accessibility);
  const [rounds, setRounds] = useState<RoundSetup[]>(draft.rounds);
  const [monitoring, setMonitoring] = useState<MonitoringConfig>(
    draft.monitoring_config || {
      tab_monitoring: true,
      voice_monitoring: true,
      camera_enabled: true,
      screenshot_mode: "time_interval",
      screenshot_interval_minutes: 5,
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
            <div key={idx} className={styles.roundCard}>
              <div className={styles.roundHeader}>
                <Badge variant="primary">Round {round.round_number}</Badge>
                {rounds.length > 1 && (
                  <button className={styles.removeBtn} onClick={() => removeRound(idx)}>
                    <IconDelete size={14} />
                  </button>
                )}
              </div>
              <div className={styles.roundGrid}>
                <Input
                  label="No. of Questions"
                  type="number"
                  min={1}
                  value={round.question_count}
                  onChange={(e) => updateRound(idx, "question_count", Number(e.target.value))}
                  hint="You can select more for randomization"
                />
                <Input
                  label="Duration (minutes)"
                  type="number"
                  min={1}
                  value={round.max_duration_minutes}
                  onChange={(e) => updateRound(idx, "max_duration_minutes", Number(e.target.value))}
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
            <h4
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--text-primary)",
                marginBottom: 12,
              }}
            >
              Monitoring Options
            </h4>
            <div className={styles.toggleList}>
              <Toggle
                label="Tab switch detection (auto-submit on violation)"
                checked={monitoring.tab_monitoring}
                onChange={(v) => setMonitoring((p) => ({ ...p, tab_monitoring: v }))}
              />
              <Toggle
                label="Voice/noise monitoring"
                checked={monitoring.voice_monitoring}
                onChange={(v) => setMonitoring((p) => ({ ...p, voice_monitoring: v }))}
              />
              <Toggle
                label="Camera required"
                checked={monitoring.camera_enabled}
                onChange={(v) => setMonitoring((p) => ({ ...p, camera_enabled: v }))}
              />
            </div>
            <div style={{ marginTop: 14 }}>
              <Select
                label="Screenshot mode"
                options={[
                  { value: "time_interval", label: "Time interval" },
                  { value: "count", label: "Total count" },
                ]}
                value={monitoring.screenshot_mode}
                onChange={(v) =>
                  setMonitoring((p) => ({ ...p, screenshot_mode: v as "time_interval" | "count" }))
                }
              />
              {monitoring.screenshot_mode === "time_interval" ? (
                <Input
                  label="Interval (minutes)"
                  type="number"
                  min={1}
                  value={monitoring.screenshot_interval_minutes || 5}
                  onChange={(e) =>
                    setMonitoring((p) => ({
                      ...p,
                      screenshot_interval_minutes: Number(e.target.value),
                    }))
                  }
                  style={{ marginTop: 10 }}
                />
              ) : (
                <Input
                  label="Total screenshots per candidate"
                  type="number"
                  min={1}
                  value={monitoring.screenshot_count || 10}
                  onChange={(e) =>
                    setMonitoring((p) => ({ ...p, screenshot_count: Number(e.target.value) }))
                  }
                  style={{ marginTop: 10 }}
                />
              )}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
        <Button
          disabled={!canProceed}
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
