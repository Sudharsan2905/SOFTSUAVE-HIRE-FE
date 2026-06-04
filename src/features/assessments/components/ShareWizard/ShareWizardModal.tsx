import React, { useState, useEffect, useCallback } from "react";
import styles from "./ShareWizard.module.css";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Toggle } from "@/components/ui/Toggle";
import { Select } from "@/components/ui/Select";
import { IconCopy, IconCheck, IconDelete, IconGlobe, IconTime, IconShield } from "@/assets/icons";
import { api } from "@/utils/api";
import { ShareLink, MonitoringOverrides } from "@/types";
import toast from "react-hot-toast";
import { clsx } from "@/utils/helpers";

// ─── Props ────────────────────────────────────────────────────────────────────

interface ShareWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  assessment: {
    id: string;
    name: string;
    share_link: string;
    workspace_id: string;
  };
}

// ─── Tab IDs ──────────────────────────────────────────────────────────────────

type TabId = "permanent" | "temporary" | "custom";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "permanent", label: "Permanent Link", icon: <IconGlobe size={15} /> },
  { id: "temporary", label: "Temporary Link", icon: <IconTime size={15} /> },
  { id: "custom", label: "Custom Monitoring", icon: <IconShield size={15} /> },
];

// ─── Copy button (shared) ─────────────────────────────────────────────────────

function CopyButton({ text }: Readonly<{ text: string }>) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed — please copy manually.");
    }
  };

  return (
    <Button
      variant={copied ? "success" : "secondary"}
      size="sm"
      leftIcon={copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
      onClick={() => void handleCopy()}
    >
      {copied ? "Copied!" : "Copy"}
    </Button>
  );
}

// ─── Link display row ─────────────────────────────────────────────────────────

function LinkRow({
  url,
  label,
  onRevoke,
}: Readonly<{ url: string; label?: string; onRevoke?: () => void }>) {
  return (
    <div className={styles.linkRow}>
      {label && <p className={styles.linkRowLabel}>{label}</p>}
      <div className={styles.linkRowInput}>
        <input
          className={styles.linkField}
          readOnly
          value={url}
          aria-label={label ?? "Share link"}
        />
        <CopyButton text={url} />
        {onRevoke && (
          <Button
            variant="danger"
            size="sm"
            leftIcon={<IconDelete size={13} />}
            onClick={onRevoke}
            title="Revoke this link"
          >
            Revoke
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Tab 1: Permanent Link ────────────────────────────────────────────────────

function PermanentTab({
  shareLink,
}: Readonly<{ shareLink: string }>) {
  const fullUrl = `${globalThis.location.origin}/assessment-access/${shareLink}`;

  return (
    <div className={styles.tabContent}>
      <div className={styles.infoBanner}>
        <IconGlobe size={14} />
        <span>
          Permanent Link — never expires, uses default monitoring settings
        </span>
      </div>
      <LinkRow url={fullUrl} />
    </div>
  );
}

// ─── Tab 2: Temporary Link ────────────────────────────────────────────────────

interface TemporaryTabProps {
  assessmentId: string;
  workspaceId: string;
}

function TemporaryTab({ assessmentId, workspaceId }: Readonly<TemporaryTabProps>) {
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [startError, setStartError] = useState("");
  const [endError, setEndError] = useState("");

  const validate = (): boolean => {
    let ok = true;
    if (!startTime) {
      setStartError("Start time is required");
      ok = false;
    } else {
      setStartError("");
    }
    if (!endTime) {
      setEndError("End time is required");
      ok = false;
    } else if (startTime && new Date(endTime) <= new Date(startTime)) {
      setEndError("End time must be after start time");
      ok = false;
    } else {
      setEndError("");
    }
    return ok;
  };

  const handleGenerate = async () => {
    if (!validate()) return;
    setGenerating(true);
    try {
      const { data } = await api.post(
        `/api/workspaces/${workspaceId}/assessments/${assessmentId}/shares`,
        {
          share_type: "expirable",
          start_time: new Date(startTime).toISOString(),
          end_time: new Date(endTime).toISOString(),
        }
      );
      const link: string = data.data?.share_link ?? data.data?.link ?? "";
      const fullUrl = `${globalThis.location.origin}/assessment-access/${link}`;
      setGeneratedLink(fullUrl);
      toast.success("Temporary link generated");
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Failed to generate temporary link");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className={styles.tabContent}>
      <div className={styles.infoBanner}>
        <IconTime size={14} />
        <span>
          Temporary link — valid only within the specified time window. Candidates cannot access the
          assessment outside this window.
        </span>
      </div>

      <div className={styles.timeGrid}>
        <div>
          <label className={styles.fieldLabel}>Start Time</label>
          <Input
            type="datetime-local"
            value={startTime}
            onChange={(e) => {
              setStartTime(e.target.value);
              setStartError("");
              setGeneratedLink(null);
            }}
            error={startError}
          />
        </div>
        <div>
          <label className={styles.fieldLabel}>End Time</label>
          <Input
            type="datetime-local"
            value={endTime}
            onChange={(e) => {
              setEndTime(e.target.value);
              setEndError("");
              setGeneratedLink(null);
            }}
            error={endError}
          />
        </div>
      </div>

      <div className={styles.generateRow}>
        <Button onClick={() => void handleGenerate()} isLoading={generating}>
          Generate Link
        </Button>
      </div>

      {generatedLink && (
        <div className={styles.resultBox}>
          <p className={styles.resultLabel}>Generated link — share with candidates:</p>
          <LinkRow url={generatedLink} />
        </div>
      )}
    </div>
  );
}

// ─── Tab 3: Custom Monitoring Link ────────────────────────────────────────────

interface MonitoringToggleRowProps {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

function MonitoringToggleRow({ label, hint, checked, onChange }: Readonly<MonitoringToggleRowProps>) {
  return (
    <div className={styles.toggleRow}>
      <div className={styles.toggleMeta}>
        <p className={styles.toggleLabel}>{label}</p>
        <p className={styles.toggleHint}>{hint}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

interface CustomTabProps {
  assessmentId: string;
  workspaceId: string;
}

function CustomTab({ assessmentId, workspaceId }: Readonly<CustomTabProps>) {
  const [linkLabel, setLinkLabel] = useState("");
  const [monitoring, setMonitoring] = useState<MonitoringOverrides>({
    tab_monitoring: true,
    audio_monitoring: true,
    video_monitoring: true,
    screenshot_enabled: true,
    screenshot_mode: "time_interval",
    screenshot_interval_minutes: 5,
  });
  const [generating, setGenerating] = useState(false);
  const [existingLinks, setExistingLinks] = useState<ShareLink[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [labelError, setLabelError] = useState("");

  const set = <K extends keyof MonitoringOverrides>(key: K, value: MonitoringOverrides[K]) => {
    setMonitoring((prev) => ({ ...prev, [key]: value }));
  };

  const fetchCustomLinks = useCallback(async () => {
    setLoadingLinks(true);
    try {
      const { data } = await api.get(
        `/api/workspaces/${workspaceId}/assessments/${assessmentId}/shares?share_type=custom`
      );
      const links: ShareLink[] = data.data?.shares ?? data.data ?? [];
      setExistingLinks(links.filter((l) => l.is_active));
    } catch {
      // silent — list is non-critical
    } finally {
      setLoadingLinks(false);
    }
  }, [assessmentId, workspaceId]);

  useEffect(() => {
    void fetchCustomLinks();
  }, [fetchCustomLinks]);

  const handleGenerate = async () => {
    if (!linkLabel.trim()) {
      setLabelError("Label is required");
      return;
    }
    setLabelError("");
    setGenerating(true);
    try {
      const { data } = await api.post(
        `/api/workspaces/${workspaceId}/assessments/${assessmentId}/shares`,
        {
          share_type: "custom",
          label: linkLabel.trim(),
          monitoring_overrides: monitoring,
        }
      );
      const newLink: ShareLink = data.data;
      setExistingLinks((prev) => [newLink, ...prev]);
      setLinkLabel("");
      toast.success("Custom monitoring link generated");
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Failed to generate custom link");
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async (shareId: string) => {
    setRevoking(shareId);
    try {
      await api.delete(
        `/api/workspaces/${workspaceId}/assessments/${assessmentId}/shares/${shareId}`
      );
      setExistingLinks((prev) => prev.filter((l) => l.id !== shareId));
      toast.success("Link revoked");
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Failed to revoke link");
    } finally {
      setRevoking(null);
    }
  };

  const effectiveScreenshot = monitoring.screenshot_enabled ?? true;

  return (
    <div className={styles.tabContent}>
      <div className={styles.infoBanner}>
        <IconShield size={14} />
        <span>
          Custom monitoring link — override proctoring settings for a specific context (e.g., remote
          office, low-bandwidth environment).
        </span>
      </div>

      {/* Label */}
      <Input
        label="Link Label"
        placeholder='e.g., "Remote office — no proctoring"'
        value={linkLabel}
        onChange={(e) => {
          setLinkLabel(e.target.value);
          setLabelError("");
        }}
        error={labelError}
        hint="Helps you identify this link later"
      />

      {/* Monitoring toggles */}
      <div className={styles.monitoringSection}>
        <MonitoringToggleRow
          label="Tab Monitoring"
          hint="Flag malpractice on tab or window switch"
          checked={monitoring.tab_monitoring ?? true}
          onChange={(v) => set("tab_monitoring", v)}
        />
        <MonitoringToggleRow
          label="Audio Monitoring"
          hint="Detect sustained background audio or speech"
          checked={monitoring.audio_monitoring ?? true}
          onChange={(v) => set("audio_monitoring", v)}
        />
        <MonitoringToggleRow
          label="Video Monitoring"
          hint="Live camera feed checked for face presence"
          checked={monitoring.video_monitoring ?? true}
          onChange={(v) => set("video_monitoring", v)}
        />
        <MonitoringToggleRow
          label="Screenshot Capture"
          hint="Periodic screenshots uploaded during the session"
          checked={monitoring.screenshot_enabled ?? true}
          onChange={(v) => set("screenshot_enabled", v)}
        />

        {effectiveScreenshot && (
          <div className={styles.screenshotOptions}>
            <Select
              label="Screenshot mode"
              options={[
                { value: "time_interval", label: "Time interval" },
                { value: "count", label: "Total count" },
              ]}
              value={monitoring.screenshot_mode ?? "time_interval"}
              onChange={(v) => set("screenshot_mode", v as "time_interval" | "count")}
            />
            {(monitoring.screenshot_mode ?? "time_interval") === "time_interval" ? (
              <Input
                label="Interval (minutes)"
                type="number"
                min={1}
                value={monitoring.screenshot_interval_minutes ?? 5}
                onChange={(e) => set("screenshot_interval_minutes", Number(e.target.value))}
              />
            ) : (
              <Input
                label="Total screenshots"
                type="number"
                min={1}
                value={monitoring.screenshot_count ?? 10}
                onChange={(e) => set("screenshot_count", Number(e.target.value))}
              />
            )}
          </div>
        )}
      </div>

      <div className={styles.generateRow}>
        <Button onClick={() => void handleGenerate()} isLoading={generating}>
          Generate Link
        </Button>
      </div>

      {/* Existing custom links */}
      <div className={styles.existingLinksSection}>
        <h4 className={styles.existingLinksTitle}>Existing Custom Links</h4>

        {loadingLinks ? (
          <p className={styles.emptyHint}>Loading...</p>
        ) : existingLinks.length === 0 ? (
          <p className={styles.emptyHint}>No custom links yet. Generate one above.</p>
        ) : (
          <div className={styles.customLinksList}>
            {existingLinks.map((link) => {
              const fullUrl = `${globalThis.location.origin}/assessment-access/${link.share_link}`;
              return (
                <div key={link.id} className={styles.customLinkCard}>
                  <div className={styles.customLinkCardHeader}>
                    <span className={styles.customLinkCardLabel}>
                      {link.label ?? "Unlabelled link"}
                    </span>
                    <span className={clsx(styles.activePill, link.is_active && styles.activePillOn)}>
                      {link.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className={styles.linkRowInput}>
                    <input
                      className={styles.linkField}
                      readOnly
                      value={fullUrl}
                      aria-label={link.label ?? "Custom share link"}
                    />
                    <CopyButton text={fullUrl} />
                    <Button
                      variant="danger"
                      size="sm"
                      leftIcon={<IconDelete size={13} />}
                      onClick={() => void handleRevoke(link.id)}
                      isLoading={revoking === link.id}
                      title="Revoke this link"
                    >
                      Revoke
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ShareWizardModal({ isOpen, onClose, assessment }: Readonly<ShareWizardModalProps>) {
  const [activeTab, setActiveTab] = useState<TabId>("permanent");

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Share — ${assessment.name}`}
      size="lg"
    >
      {/* Tab bar */}
      <div className={styles.tabBar} role="tablist" aria-label="Share options">
        {TABS.map(({ id, label, icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={activeTab === id}
            className={clsx(styles.tabBtn, activeTab === id && styles.tabBtnActive)}
            onClick={() => setActiveTab(id)}
          >
            <span className={styles.tabIcon}>{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <div role="tabpanel">
        {activeTab === "permanent" && (
          <PermanentTab shareLink={assessment.share_link} />
        )}
        {activeTab === "temporary" && (
          <TemporaryTab
            assessmentId={assessment.id}
            workspaceId={assessment.workspace_id}
          />
        )}
        {activeTab === "custom" && (
          <CustomTab
            assessmentId={assessment.id}
            workspaceId={assessment.workspace_id}
          />
        )}
      </div>
    </Modal>
  );
}
