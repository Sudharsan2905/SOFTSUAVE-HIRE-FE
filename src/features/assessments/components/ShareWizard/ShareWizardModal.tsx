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

// ─── Social share ─────────────────────────────────────────────────────────────

const SOCIAL_PLATFORMS = [
  {
    id: "whatsapp",
    label: "WhatsApp",
    bg: "#25D366",
    href: (url: string) => `https://wa.me/?text=${encodeURIComponent(url)}`,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.115.549 4.103 1.51 5.833L.057 23.428a.5.5 0 0 0 .611.611l5.648-1.453A11.94 11.94 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.9a9.854 9.854 0 0 1-5.031-1.378l-.36-.214-3.733.96.993-3.648-.235-.374A9.855 9.855 0 0 1 2.1 12C2.1 6.533 6.533 2.1 12 2.1c5.468 0 9.9 4.432 9.9 9.9 0 5.467-4.432 9.9-9.9 9.9z" />
      </svg>
    ),
  },
  {
    id: "telegram",
    label: "Telegram",
    bg: "#0088CC",
    href: (url: string) => `https://t.me/share/url?url=${encodeURIComponent(url)}`,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L8.32 13.617l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.828.942z" />
      </svg>
    ),
  },
  {
    id: "email",
    label: "Email",
    bg: "#6B7280",
    href: (url: string, name: string) =>
      `mailto:?subject=${encodeURIComponent(`Assessment Invitation: ${name}`)}&body=${encodeURIComponent(`You have been invited to take an assessment.\n\nClick the link below to get started:\n${url}`)}`,
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      </svg>
    ),
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    bg: "#0A66C2",
    href: (url: string) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
  {
    id: "twitter",
    label: "X (Twitter)",
    bg: "#000000",
    href: (url: string, name: string) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Take the "${name}" assessment`)}&url=${encodeURIComponent(url)}`,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.261 5.632 5.903-5.632zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
] as const;

function SocialShareRow({
  url,
  assessmentName,
}: Readonly<{ url: string; assessmentName: string }>) {
  return (
    <div className={styles.socialShareSection}>
      <span className={styles.socialShareLabel}>Share via</span>
      <div className={styles.socialShareButtons}>
        {SOCIAL_PLATFORMS.map((p) => (
          <a
            key={p.id}
            href={p.href(url, assessmentName)}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.socialBtn}
            style={{ "--social-bg": p.bg } as React.CSSProperties}
            title={p.label}
            aria-label={`Share via ${p.label}`}
          >
            {p.icon}
            <span className={styles.socialBtnLabel}>{p.label}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

// ─── Tab 1: Permanent Link ────────────────────────────────────────────────────

function PermanentTab({
  shareLink,
  assessmentName,
}: Readonly<{ shareLink: string; assessmentName: string }>) {
  const fullUrl = `${globalThis.location.origin}/assessment/${shareLink}`;

  return (
    <div className={styles.tabContent}>
      <div className={styles.infoBanner}>
        <IconGlobe size={14} />
        <span>Permanent Link — never expires, uses default monitoring settings</span>
      </div>
      <LinkRow url={fullUrl} />
      <SocialShareRow url={fullUrl} assessmentName={assessmentName} />
    </div>
  );
}

// ─── Tab 2: Temporary Link ────────────────────────────────────────────────────

interface TemporaryTabProps {
  assessmentId: string;
  workspaceId: string;
  assessmentName: string;
}

function TemporaryTab({ assessmentId, workspaceId, assessmentName }: Readonly<TemporaryTabProps>) {
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
      const fullUrl = `${globalThis.location.origin}/assessment/${link}`;
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
          <SocialShareRow url={generatedLink} assessmentName={assessmentName} />
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

function MonitoringToggleRow({
  label,
  hint,
  checked,
  onChange,
}: Readonly<MonitoringToggleRowProps>) {
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
              const fullUrl = `${globalThis.location.origin}/assessment/${link.share_link}`;
              return (
                <div key={link.id} className={styles.customLinkCard}>
                  <div className={styles.customLinkCardHeader}>
                    <span className={styles.customLinkCardLabel}>
                      {link.label ?? "Unlabelled link"}
                    </span>
                    <span
                      className={clsx(styles.activePill, link.is_active && styles.activePillOn)}
                    >
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
    <Modal isOpen={isOpen} onClose={onClose} title={`Share — ${assessment.name}`} size="lg">
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
          <PermanentTab shareLink={assessment.share_link} assessmentName={assessment.name} />
        )}
        {activeTab === "temporary" && (
          <TemporaryTab
            assessmentId={assessment.id}
            workspaceId={assessment.workspace_id}
            assessmentName={assessment.name}
          />
        )}
        {activeTab === "custom" && (
          <CustomTab assessmentId={assessment.id} workspaceId={assessment.workspace_id} />
        )}
      </div>
    </Modal>
  );
}
