import React, { useState, useEffect, useCallback } from "react";
import styles from "./ShareWizard.module.css";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Toggle } from "@/components/ui/Toggle";
import { Select } from "@/components/ui/Select";
import { DateTimePicker } from "@/components/datetime/DateTimePicker";
import {
  IconCopy,
  IconCheck,
  IconDelete,
  IconGlobe,
  IconShield,
  IconClock,
  IconArrowRight,
  IconLink,
  IconChevronDown,
  IconSettings,
  IconMonitor,
  IconMic,
  IconCamera,
  IconVideoCamera,
  IconWhatsApp,
  IconMail,
  IconSlack,
  IconMSTeams,
} from "@/assets/icons";
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

type TabId = "permanent" | "custom";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "permanent", label: "Permanent Link", icon: <IconGlobe size={15} /> },
  { id: "custom", label: "Custom Link", icon: <IconShield size={15} /> },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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

// ─── Accordion ────────────────────────────────────────────────────────────────

interface AccordionProps {
  title: string;
  subtitle: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

function Accordion({ title, subtitle, icon, children }: Readonly<AccordionProps>) {
  const [open, setOpen] = useState(false);

  return (
    <div className={styles.accordion}>
      <button
        type="button"
        className={clsx(styles.accordionTrigger, open && styles.accordionTriggerOpen)}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <div className={styles.accordionTriggerContent}>
          {icon && <span className={styles.accordionTriggerIcon}>{icon}</span>}
          <div className={styles.accordionTriggerMeta}>
            <span className={styles.accordionTitle}>{title}</span>
            <span className={styles.accordionSubtitle}>{subtitle}</span>
          </div>
        </div>
        <IconChevronDown
          className={clsx(styles.accordionChevron, open && styles.accordionChevronOpen)}
        />
      </button>
      <div className={clsx(styles.accordionBody, open && styles.accordionBodyOpen)}>{children}</div>
    </div>
  );
}

// ─── Monitoring toggle row ────────────────────────────────────────────────────

interface MonitoringToggleRowProps {
  icon: React.ReactNode;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

function MonitoringToggleRow({
  icon,
  label,
  hint,
  checked,
  onChange,
}: Readonly<MonitoringToggleRowProps>) {
  return (
    <div className={styles.toggleRow}>
      <div className={styles.toggleIcon}>{icon}</div>
      <div className={styles.toggleMeta}>
        <p className={styles.toggleLabel}>{label}</p>
        <p className={styles.toggleHint}>{hint}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

// ─── Tab 1: Permanent Link ────────────────────────────────────────────────────

function PermanentTab({
  shareLink,
  assessmentName,
}: Readonly<{ shareLink: string; assessmentName: string }>) {
  const [copied, setCopied] = useState(false);
  const fullUrl = `${globalThis.location.origin}/assessment/${shareLink}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed — please copy manually.");
    }
  };

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(fullUrl)}`;
  const emailSubject = encodeURIComponent(`Assessment Invitation: ${assessmentName}`);
  const emailBody = encodeURIComponent(
    `You have been invited to take an assessment.\n\nClick the link below to get started:\n${fullUrl}`
  );
  const emailHref = `mailto:?subject=${emailSubject}&body=${emailBody}`;
  const teamsHref = `https://teams.microsoft.com/share?href=${encodeURIComponent(fullUrl)}`;

  const handleSlackShare = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      toast.success("Copied! Paste it in any Slack channel.");
    } catch {
      toast.error("Copy failed — please copy manually.");
    }
  };

  return (
    <div className={styles.tabContent}>
      <div className={styles.infoBanner}>
        <IconGlobe size={14} />
        <span>This link never expires and uses the default monitoring settings.</span>
      </div>

      {/* URL display with inline icon copy button */}
      <div className={styles.urlBox}>
        <input
          className={styles.urlBoxField}
          id="permanent-share-link"
          readOnly
          value={fullUrl}
          aria-label="Permanent share link"
        />
      </div>

      {/* Primary CTA */}
      <div className={styles.primaryAction}>
        <button
          type="button"
          className={clsx(styles.primaryActionBtn, copied && styles.primaryActionBtnCopied)}
          onClick={() => void handleCopy()}
        >
          {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
          <span>{copied ? "Link Copied!" : "Copy Link"}</span>
        </button>
      </div>

      {/* Divider */}
      <div className={styles.divider}>
        <span className={styles.dividerText}>or share via</span>
      </div>

      {/* Share chips */}
      <div className={styles.shareChips}>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className={clsx(styles.shareChip, styles.shareChipWhatsapp)}
        >
          <span className={styles.shareChipIcon}>
            <IconWhatsApp size={20} />
          </span>
          <span className={styles.shareChipLabel}>WhatsApp</span>
        </a>
        <a href={emailHref} className={clsx(styles.shareChip, styles.shareChipEmail)}>
          <span className={styles.shareChipIcon}>
            <IconMail size={20} />
          </span>
          <span className={styles.shareChipLabel}>Email</span>
        </a>
        <a href={teamsHref} target="_blank" rel="noopener noreferrer" className={styles.shareChip}>
          <span className={styles.shareChipIcon}>
            <IconMSTeams size={20} />
          </span>
          <span className={styles.shareChipLabel}>Teams</span>
        </a>
        <button
          type="button"
          onClick={() => void handleSlackShare()}
          className={clsx(styles.shareChip, styles.shareChipSlack)}
        >
          <span className={styles.shareChipIcon}>
            <IconSlack size={20} />
          </span>
          <span className={styles.shareChipLabel}>Slack</span>
        </button>
      </div>

      <p className={styles.helperText}>
        <IconGlobe size={12} />
        <span>Anyone with this link can access the assessment</span>
      </p>
    </div>
  );
}

// ─── Existing-link accordion card ────────────────────────────────────────────

interface LinkAccordionCardProps {
  link: ShareLink;
  revoking: string | null;
  onRevoke: (id: string) => void;
}

function LinkAccordionCard({ link, revoking, onRevoke }: Readonly<LinkAccordionCardProps>) {
  const [open, setOpen] = useState(false);
  const fullUrl = `${globalThis.location.origin}/assessment/${link.share_link}`;

  return (
    <div className={styles.customLinkCard}>
      <button
        type="button"
        className={clsx(styles.customLinkCardTrigger, open && styles.customLinkCardTriggerOpen)}
        onClick={() => setOpen((p) => !p)}
        aria-expanded={open}
      >
        <IconLink size={16} className={styles.customLinkIcon} />
        <span className={styles.customLinkCardLabel}>{link.label ?? "Unlabelled link"}</span>
        <IconChevronDown
          size={14}
          className={clsx(styles.customLinkChevron, open && styles.customLinkChevronOpen)}
        />
      </button>

      <div className={clsx(styles.customLinkBody, open && styles.customLinkBodyOpen)}>
        <div className={styles.customLinkBodyInner}>
          {/* Date range */}
          {(link.start_time ?? link.end_time) && (
            <div className={styles.customLinkDateRow}>
              {link.start_time && (
                <span className={styles.customLinkDate}>
                  <IconClock size={14} className={styles.customLinkClock} />
                  {formatDate(link.start_time)}
                </span>
              )}
              {link.start_time && link.end_time && (
                <IconArrowRight size={13} className={styles.customLinkArrow} />
              )}
              {link.end_time && (
                <span className={styles.customLinkDate}>
                  <IconClock size={14} className={styles.customLinkClock} />
                  {formatDate(link.end_time)}
                </span>
              )}
            </div>
          )}

          {/* URL */}
          <input
            className={styles.linkField}
            id={`custom-link-${link.id}`}
            readOnly
            value={fullUrl}
            aria-label={link.label ?? "Custom share link"}
          />

          {/* Footer */}
          <div className={styles.customLinkActions}>
            <span className={styles.customLinkCreated}>{formatDate(link.created_at)}</span>
            <div className={styles.customLinkActionBtns}>
              <CopyButton text={fullUrl} />
              <Button
                variant="danger"
                size="sm"
                leftIcon={<IconDelete size={13} />}
                onClick={() => onRevoke(link.id)}
                isLoading={revoking === link.id}
                title="Revoke this link"
              >
                Revoke
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Local ISO helper ─────────────────────────────────────────────────────────

function toLocalISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ─── Tab 2: Custom Link ───────────────────────────────────────────────────────

interface CustomLinkTabProps {
  assessmentId: string;
  workspaceId: string;
}

function CustomLinkTab({ assessmentId, workspaceId }: Readonly<CustomLinkTabProps>) {
  const [linkLabel, setLinkLabel] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [monitoring, setMonitoring] = useState<MonitoringOverrides>({
    tab_monitoring: true,
    audio_monitoring: true,
    video_monitoring: true,
    screenshot_enabled: true,
    screenshot_mode: "time_interval",
    screenshot_interval_seconds: 5,
  });
  const [generating, setGenerating] = useState(false);
  const [existingLinks, setExistingLinks] = useState<ShareLink[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [labelError, setLabelError] = useState("");
  const [startError, setStartError] = useState("");
  const [endError, setEndError] = useState("");

  // Computed once on mount — close enough for a session-duration form.
  const [nowMin] = useState(() => toLocalISO(new Date()));

  const setMonitoringKey = <K extends keyof MonitoringOverrides>(
    key: K,
    value: MonitoringOverrides[K]
  ) => {
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

  const validate = (): boolean => {
    let ok = true;

    if (linkLabel.trim()) {
      setLabelError("");
    } else {
      setLabelError("Label is required");
      ok = false;
    }

    if (startTime && new Date(startTime) < new Date()) {
      setStartError("Opens On must be a future date and time");
      ok = false;
    } else {
      setStartError("");
    }

    if (startTime && endTime && new Date(endTime) <= new Date(startTime)) {
      setEndError("Ends On must be after Opens On");
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
      const payload: Record<string, unknown> = {
        share_type: "custom",
        label: linkLabel.trim(),
        monitoring_overrides: monitoring,
      };
      if (startTime) payload.start_time = new Date(startTime).toISOString();
      if (endTime) payload.end_time = new Date(endTime).toISOString();

      const { data } = await api.post(
        `/api/workspaces/${workspaceId}/assessments/${assessmentId}/shares`,
        payload
      );
      const newLink: ShareLink = data.data;
      setExistingLinks((prev) => [newLink, ...prev]);
      setLinkLabel("");
      setStartTime("");
      setEndTime("");
      toast.success("Custom link generated");
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
      {/* Info banner */}
      <div className={styles.infoBanner}>
        <IconShield size={14} />
        <span>
          Custom links are valid only within the selected time window and can optionally override
          monitoring settings.
        </span>
      </div>

      {/* Label */}
      <Input
        label="Link Label"
        id="custom-link-label"
        placeholder='e.g. "Weekend Assessment Link"'
        value={linkLabel}
        onChange={(e) => {
          setLinkLabel(e.target.value);
          setLabelError("");
        }}
        error={labelError}
        hint="Helps identify this link later"
      />

      {/* Assessment availability */}
      <div className={styles.availabilitySection}>
        <p className={styles.availabilityLabel}>Assessment Availability</p>
        <div className={styles.dateGrid}>
          <DateTimePicker
            id="custom-link-opens-on"
            label="Opens On"
            value={startTime}
            min={nowMin}
            onChange={(v) => {
              setStartTime(v);
              setStartError("");
              setEndError("");
            }}
            error={startError}
          />
          <DateTimePicker
            id="custom-link-ends-on"
            label="Ends On"
            value={endTime}
            min={startTime || nowMin}
            onChange={(v) => {
              setEndTime(v);
              setEndError("");
            }}
            error={endError}
          />
        </div>
      </div>

      {/* Monitoring accordion */}
      <Accordion
        icon={<IconSettings size={20} />}
        title="Override Monitoring Settings (Optional)"
        subtitle="Choose different monitoring settings for this custom link"
      >
        <div className={styles.monitoringSection}>
          <MonitoringToggleRow
            icon={<IconMonitor size={18} />}
            label="Tab Monitoring"
            hint="Flag malpractice on tab or window switch"
            checked={monitoring.tab_monitoring ?? true}
            onChange={(v) => setMonitoringKey("tab_monitoring", v)}
          />
          <MonitoringToggleRow
            icon={<IconMic size={18} />}
            label="Audio Monitoring"
            hint="Detect sustained background audio or speech"
            checked={monitoring.audio_monitoring ?? true}
            onChange={(v) => setMonitoringKey("audio_monitoring", v)}
          />
          <MonitoringToggleRow
            icon={<IconVideoCamera size={18} />}
            label="Video Monitoring"
            hint="Live camera feed checked for face presence"
            checked={monitoring.video_monitoring ?? true}
            onChange={(v) => setMonitoringKey("video_monitoring", v)}
          />
          <MonitoringToggleRow
            icon={<IconCamera size={18} />}
            label="Screenshot Capture"
            hint="Periodic screenshots uploaded during the session"
            checked={monitoring.screenshot_enabled ?? true}
            onChange={(v) => setMonitoringKey("screenshot_enabled", v)}
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
                onChange={(v) =>
                  setMonitoringKey("screenshot_mode", v as "time_interval" | "count")
                }
              />
              {(monitoring.screenshot_mode ?? "time_interval") === "time_interval" ? (
                <Input
                  label="Interval (minutes)"
                  id="screenshot-interval"
                  type="number"
                  min={1}
                  value={monitoring.screenshot_interval_seconds ?? 5}
                  onChange={(e) =>
                    setMonitoringKey("screenshot_interval_seconds", Number(e.target.value))
                  }
                />
              ) : (
                <Input
                  label="Total screenshots"
                  id="screenshot-count"
                  type="number"
                  min={1}
                  value={monitoring.screenshot_count ?? 10}
                  onChange={(e) => setMonitoringKey("screenshot_count", Number(e.target.value))}
                />
              )}
            </div>
          )}
        </div>
      </Accordion>

      {/* Generate button */}
      <div className={styles.generateRow}>
        <Button onClick={() => void handleGenerate()} isLoading={generating}>
          Generate Link
        </Button>
      </div>

      {/* Existing custom links */}
      <div className={styles.existingLinksSection}>
        <h4 className={styles.existingLinksTitle}>Existing Custom Links</h4>

        {loadingLinks && <p className={styles.emptyHint}>Loading...</p>}
        {!loadingLinks && existingLinks.length === 0 && (
          <p className={styles.emptyHint}>No custom links yet. Generate one above.</p>
        )}
        {!loadingLinks && existingLinks.length > 0 && (
          <div className={styles.customLinksList}>
            {existingLinks.map((link) => (
              <LinkAccordionCard
                key={link.id}
                link={link}
                revoking={revoking}
                onRevoke={(id) => void handleRevoke(id)}
              />
            ))}
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
        {activeTab === "custom" && (
          <CustomLinkTab assessmentId={assessment.id} workspaceId={assessment.workspace_id} />
        )}
      </div>
    </Modal>
  );
}
