import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import styles from "./CandidateDetailsPage.module.css";
import { getAvatarColor, getInitials } from "@/utils/helpers";
import { IconMail, IconPhone, IconMapPin, IconGender, IconChevronLeft, IconDelete } from "@/assets/icons";
import { CandidateDetailsTabs } from "@/features/candidate/components/CandidateDetailsTabs";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import type { CandidateSubmissionDetail } from "@/types";
import { api } from "@/utils/api";
import { API_ENDPOINTS } from "@/constants/api";
import { ROUTES } from "@/constants/routes";

export default function CandidateDetailsPage() {
  const { workspaceId, assessmentId, candidateId } = useParams<{
    workspaceId: string;
    assessmentId: string;
    candidateId: string;
  }>();
  const navigate = useNavigate();

  const [data, setData] = useState<CandidateSubmissionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<string>("current");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const fetchSubmission = useCallback(
    async (version: string) => {
      if (!workspaceId || !assessmentId || !candidateId) return;
      setIsLoading(true);
      setError(null);
      try {
        const resp = await api.get(
          API_ENDPOINTS.ASSESSMENTS.CANDIDATE_SUBMISSION(workspaceId, assessmentId, candidateId),
          { params: { version } }
        );
        setData(resp.data.data);
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message;
        setError(msg ?? "Failed to load candidate data");
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

  const handleDeleteSubmission = async () => {
    if (!data) return;
    setDeleteSubmitting(true);
    try {
      await api.delete(
        API_ENDPOINTS.ASSESSMENTS.SUBMISSION_DELETE(workspaceId!, assessmentId!, data.submission_id)
      );
      toast.success("Submission deleted.");
      setShowDeleteModal(false);
      navigate(ROUTES.ADMIN.assessmentDetail(workspaceId!, assessmentId!));
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Failed to delete submission");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.loadingWrap}>
        <Spinner />
      </div>
    );
  }

  if (error || !data) {
    return <div className={styles.errorWrap}>{error ?? "Candidate data not found"}</div>;
  }

  const { candidate } = data;
  const fullName = `${candidate.first_name} ${candidate.last_name}`.trim() || "--";
  const avatarColor = getAvatarColor(fullName);

  const versionOptions = [
    { value: "current", label: "Latest" },
    ...data.available_versions.map((v) => ({
      value: String(v.version),
      label: `Version ${v.version}`,
    })),
  ];

  return (
    <div>
      <Header
        title="Candidate Details"
        subtitle="View and analyze candidate information and interview progress"
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className={styles.versionControl}>
              <span className={styles.versionLabel}>Version</span>
              <Select
                options={versionOptions}
                value={selectedVersion}
                onChange={handleVersionChange}
                fullWidth={false}
                style={{ width: 190 }}
              />
            </div>
            <Button
              variant="danger"
              leftIcon={<IconDelete size={14} />}
              onClick={() => setShowDeleteModal(true)}
            >
              Delete Submission
            </Button>
          </div>
        }
      />

      <button
        onClick={() => navigate(ROUTES.ADMIN.assessmentDetail(workspaceId!, assessmentId!))}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          color: "var(--text-secondary)",
          fontSize: 13,
          marginBottom: 16,
          cursor: "pointer",
        }}
      >
        <IconChevronLeft size={14} /> Back to Assessment
      </button>

      <div className={styles.page}>
        <article className={styles.profileCard} aria-label="Candidate profile">
          <div className={styles.profileInner}>
            <div
              className={styles.avatar}
              style={{ background: `${avatarColor}1f`, color: avatarColor }}
              aria-hidden="true"
            >
              {getInitials(fullName)}
            </div>

            <div className={styles.nameRow}>
              <h2 className={styles.name}>{fullName}</h2>
            </div>

            <div className={styles.contactRow} aria-label="Contact information">
              <span className={styles.contactItem}>
                <IconMail size={14} aria-hidden="true" />
                <span>{candidate.email ?? "--"}</span>
              </span>
              <span className={styles.contactItem}>
                <IconPhone size={14} aria-hidden="true" />
                <span>{candidate.phone ?? "--"}</span>
              </span>
              <span className={styles.contactItem}>
                <IconGender size={14} aria-hidden="true" />
                <span>
                  {candidate.gender
                    ? candidate.gender.charAt(0).toUpperCase() + candidate.gender.slice(1)
                    : "--"}
                </span>
              </span>
              <span className={styles.contactItem}>
                <IconMapPin size={14} aria-hidden="true" />
                <span>{candidate.location ?? "--"}</span>
              </span>
            </div>
          </div>
        </article>

        <div className={styles.tabsArea}>
          <CandidateDetailsTabs
            data={data}
            workspaceId={workspaceId!}
            assessmentId={assessmentId!}
            onRefresh={async () => {
              await fetchSubmission(selectedVersion);
            }}
          />
        </div>
      </div>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Submission"
        footer={
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteSubmission} isLoading={deleteSubmitting}>
              Delete
            </Button>
          </div>
        }
      >
        <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          Are you sure you want to delete this submission? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
