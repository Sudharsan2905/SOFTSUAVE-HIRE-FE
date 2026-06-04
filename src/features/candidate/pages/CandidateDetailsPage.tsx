import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import styles from "./CandidateDetailsPage.module.css";
import { getAvatarColor, getInitials } from "@/utils/helpers";
import { IconMail } from "@/assets/icons";
import { CandidateDetailsTabs } from "@/features/candidate/components/CandidateDetailsTabs";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import type { CandidateSubmissionDetail, SubmissionStatus } from "@/types";
import { api } from "@/utils/api";
import { getStatusLabel } from "@/constants/statusColors";

const STATUS_VARIANT: Record<
  SubmissionStatus,
  "default" | "primary" | "success" | "warning" | "error" | "accent"
> = {
  pending: "default",
  in_progress: "primary",
  completed: "success",
  malpractice: "error",
  on_hold: "warning",
  terminated: "default",
};

function PhoneIcon() {
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
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.19a16 16 0 0 0 5.9 5.9l.7-.7a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function MapPinIcon() {
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
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export default function CandidateDetailsPage() {
  const { workspaceId, assessmentId, candidateId } = useParams<{
    workspaceId: string;
    assessmentId: string;
    candidateId: string;
  }>();

  const [data, setData] = useState<CandidateSubmissionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<string>("current");
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const fetchSubmission = useCallback(
    async (version: string) => {
      if (!workspaceId || !assessmentId || !candidateId) return;
      setIsLoading(true);
      setError(null);
      try {
        const resp = await api.get(
          `/api/workspaces/${workspaceId}/assessments/${assessmentId}/candidates/${candidateId}/submission`,
          { params: { version } }
        );
        setData(resp.data.data);
      } catch (err: any) {
        setError(err.response?.data?.message ?? "Failed to load candidate data");
      } finally {
        setIsLoading(false);
      }
    },
    [workspaceId, assessmentId, candidateId]
  );

  useEffect(() => {
    fetchSubmission(selectedVersion);
  }, [selectedVersion, fetchSubmission]);

  const handleVersionChange = (version: string) => {
    setSelectedVersion(version);
  };

  const handleDownloadPdf = useCallback(async () => {
    if (!workspaceId || !assessmentId || !data?.submission_id) return;
    setDownloadingPdf(true);
    try {
      const resp = await api.get(
        `/api/workspaces/${workspaceId}/assessments/${assessmentId}/submissions/${data.submission_id}/pdf`,
        { responseType: "blob" }
      );
      const url = URL.createObjectURL(resp.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `submission_${data.submission_id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // error handled by API interceptor
    } finally {
      setDownloadingPdf(false);
    }
  }, [workspaceId, assessmentId, data?.submission_id]);

  if (isLoading) {
    return (
      <div className={styles.loadingWrap}>
        <Spinner />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={styles.errorWrap}>
        {error ?? "Candidate data not found"}
      </div>
    );
  }

  const { candidate } = data;
  const fullName = `${candidate.first_name} ${candidate.last_name}`;

  return (
    <div className={styles.page}>
      <article className={styles.profileCard} aria-label="Candidate profile">
        <div className={styles.profileInner}>
          <div
            className={styles.avatar}
            style={{ background: getAvatarColor(fullName) }}
            aria-hidden="true"
          >
            {getInitials(fullName)}
          </div>

          <div className={styles.identity}>
            <div className={styles.nameRow}>
              <h1 className={styles.name}>{fullName}</h1>
              <Badge variant={STATUS_VARIANT[data.status] ?? "default"} dot>
                {getStatusLabel(data.status)}
              </Badge>
            </div>

            <div className={styles.contactRow} aria-label="Contact information">
              {candidate.email && (
                <span className={styles.contactItem}>
                  <IconMail size={14} aria-hidden="true" />
                  <span>{candidate.email}</span>
                </span>
              )}
              {candidate.phone && (
                <span className={styles.contactItem}>
                  <PhoneIcon />
                  <span>{candidate.phone}</span>
                </span>
              )}
              {candidate.location && (
                <span className={styles.contactItem}>
                  <MapPinIcon />
                  <span>{candidate.location}</span>
                </span>
              )}
            </div>
          </div>

          <div className={styles.profileActions}>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDownloadPdf}
              isLoading={downloadingPdf}
            >
              Download PDF
            </Button>
          </div>
        </div>
      </article>

      <div className={styles.tabsArea}>
        <CandidateDetailsTabs
          data={data}
          selectedVersion={selectedVersion}
          onVersionChange={handleVersionChange}
        />
      </div>
    </div>
  );
}
