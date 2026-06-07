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
  IconTimeout,
  IconArrowRight,
  IconLink,
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

// ─── Inline icons ─────────────────────────────────────────────────────────────

function IconChevronDown({ className }: Readonly<{ className?: string }>) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function IconTabMonitor() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

function IconMic() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8" />
    </svg>
  );
}

function IconVideoCamera() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M23 7 16 12 23 17z" />
      <rect x="1" y="5" width="15" height="14" rx="2" />
    </svg>
  );
}

function IconScreenCapture() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.115.549 4.103 1.51 5.833L.057 23.428a.5.5 0 0 0 .611.611l5.648-1.453A11.94 11.94 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.9a9.854 9.854 0 0 1-5.031-1.378l-.36-.214-3.733.96.993-3.648-.235-.374A9.855 9.855 0 0 1 2.1 12C2.1 6.533 6.533 2.1 12 2.1c5.468 0 9.9 4.432 9.9 9.9 0 5.467-4.432 9.9-9.9 9.9z" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
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
  children: React.ReactNode;
}

function Accordion({ title, subtitle, children }: Readonly<AccordionProps>) {
  const [open, setOpen] = useState(false);

  return (
    <div className={styles.accordion}>
      <button
        type="button"
        className={clsx(styles.accordionTrigger, open && styles.accordionTriggerOpen)}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <div className={styles.accordionTriggerMeta}>
          <span className={styles.accordionTitle}>{title}</span>
          <span className={styles.accordionSubtitle}>{subtitle}</span>
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

  return (
    <div className={styles.tabContent}>
      <div className={styles.infoBanner}>
        <IconGlobe size={14} />
        <span>This link never expires and uses the default monitoring settings.</span>
      </div>

      <div className={styles.urlCard}>
        <input
          className={styles.urlCardField}
          readOnly
          value={fullUrl}
          aria-label="Permanent share link"
        />
      </div>

      <div className={styles.permanentActions}>
        <button
          type="button"
          className={clsx(
            styles.permanentBtn,
            styles.permanentBtnPrimary,
            copied && styles.permanentBtnCopied
          )}
          onClick={() => void handleCopy()}
        >
          {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
          <span>{copied ? "Link Copied!" : "Copy Link"}</span>
        </button>

        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className={clsx(styles.permanentBtn, styles.permanentBtnWhatsapp)}
        >
          <WhatsAppIcon />
          <span>Share via WhatsApp</span>
        </a>

        <a href={emailHref} className={clsx(styles.permanentBtn, styles.permanentBtnEmail)}>
          <EmailIcon />
          <span>Share via Email</span>
        </a>
      </div>
    </div>
  );
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
  const [endError, setEndError] = useState("");

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
    if (startTime && endTime && new Date(endTime) <= new Date(startTime)) {
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
        placeholder='e.g. "Remote office — low bandwidth"'
        value={linkLabel}
        onChange={(e) => {
          setLinkLabel(e.target.value);
          setLabelError("");
        }}
        error={labelError}
        hint="Helps identify this link later"
      />

      {/* Validity date range */}
      <div className={styles.dateGrid}>
        <DateTimePicker
          id="custom-link-from-time"
          label="From Date & Time"
          placeholder="mm/dd/yyyy --:-- --"
          value={startTime}
          onChange={(v) => {
            setStartTime(v);
            setEndError("");
          }}
        />
        <DateTimePicker
          id="custom-link-to-time"
          label="To Date & Time"
          placeholder="mm/dd/yyyy --:-- --"
          value={endTime}
          min={startTime}
          onChange={(v) => {
            setEndTime(v);
            setEndError("");
          }}
          error={endError}
        />
      </div>

      {/* Monitoring accordion */}
      <Accordion
        title="Override Monitoring Settings (Optional)"
        subtitle="Choose different monitoring settings for this custom link"
      >
        <div className={styles.monitoringSection}>
          <MonitoringToggleRow
            icon={<IconTabMonitor />}
            label="Tab Monitoring"
            hint="Flag malpractice on tab or window switch"
            checked={monitoring.tab_monitoring ?? true}
            onChange={(v) => setMonitoringKey("tab_monitoring", v)}
          />
          <MonitoringToggleRow
            icon={<IconMic />}
            label="Audio Monitoring"
            hint="Detect sustained background audio or speech"
            checked={monitoring.audio_monitoring ?? true}
            onChange={(v) => setMonitoringKey("audio_monitoring", v)}
          />
          <MonitoringToggleRow
            icon={<IconVideoCamera />}
            label="Video Monitoring"
            hint="Live camera feed checked for face presence"
            checked={monitoring.video_monitoring ?? true}
            onChange={(v) => setMonitoringKey("video_monitoring", v)}
          />
          <MonitoringToggleRow
            icon={<IconScreenCapture />}
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
            {existingLinks.map((link) => {
              const fullUrl = `${globalThis.location.origin}/assessment/${link.share_link}`;
              return (
                <div key={link.id} className={styles.customLinkCard}>
                  {/* Header: clock + label, with the expiry highlighted */}
                  <div className={styles.customLinkCardHead}>
                    <IconLink size={18} className={styles.customLinkIcon} />
                    <span className={styles.customLinkCardLabel}>
                      {link.label ?? "Unlabelled link"}
                      {link.end_time && (
                        <>
                          {" – "}
                          <strong>{formatDate(link.end_time)}</strong>
                        </>
                      )}
                    </span>
                  </div>

                  {/* Date meta */}
                  <div className={styles.customLinkCardDates}>
                    {(link.start_time || link.end_time) && (
                      <div className={styles.customLinkDateRow}>
                        {link.start_time && (
                          <span className={styles.customLinkDate}>
                            <IconClock size={15} className={styles.customLinkClock} />
                            <span className={styles.customLinkDateLabel}>From</span>
                            {formatDate(link.start_time)}
                          </span>
                        )}
                        {link.start_time && link.end_time && (
                          <IconArrowRight size={15} className={styles.customLinkArrow} />
                        )}
                        {link.end_time && (
                          <span className={styles.customLinkDate}>
                            <span className={styles.customLinkDateLabel}>To</span>
                            {formatDate(link.end_time)}
                            <IconTimeout size={15} className={styles.customLinkClock} />
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* URL field */}
                  <input
                    className={styles.linkField}
                    readOnly
                    value={fullUrl}
                    aria-label={link.label ?? "Custom share link"}
                  />

                  {/* Footer: created date on the left, actions on the right */}
                  <div className={styles.customLinkActions}>
                    <span className={styles.customLinkCreated}>
                      <span className={styles.customLinkDateLabel}>Created</span>
                      {formatDate(link.created_at)}
                    </span>
                    <div className={styles.customLinkActionBtns}>
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
        {activeTab === "custom" && (
          <CustomLinkTab assessmentId={assessment.id} workspaceId={assessment.workspace_id} />
        )}
      </div>
    </Modal>
  );
}
