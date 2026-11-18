import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { IconChevronLeft, IconCopy, IconMail } from "@/assets/icons";
import { extractApiErrorMessage } from "@/utils/api";
import { ROUTES } from "@/constants/routes";
import { StepTracker } from "../components/StepTracker";
import { EventLog } from "../components/EventLog";
import { PipelineCandidatesTable, isNeedsEmail } from "../components/PipelineCandidatesTable";
import { isRunActive, usePipelineRun } from "../hooks/usePipelineRun";
import { resendAllInvites, resendInvite, resendReport, retryStep } from "../api/pipelineApi";
import { PIPELINE_MESSAGES } from "../constants";
import { STATUS_VARIANT } from "./PipelineListPage";
import styles from "./PipelineDetailPage.module.css";

export default function PipelineDetailPage() {
  const { pipelineId } = useParams<{ pipelineId: string }>();
  const navigate = useNavigate();
  const { run, isLoading, error, reload } = usePipelineRun(pipelineId);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resendingAll, setResendingAll] = useState(false);
  const [retrying, setRetrying] = useState(false);

  if (isLoading && !run) {
    return (
      <div className={styles.centered}>
        <Spinner size="lg" />
      </div>
    );
  }
  if (!run || !pipelineId) {
    return (
      <div className={styles.page}>
        <p className={styles.pageError} role="alert">
          {error ?? PIPELINE_MESSAGES.LOAD_FAILED}
        </p>
        <Button variant="secondary" onClick={() => navigate(ROUTES.ADMIN.PIPELINES)}>
          Back to pipelines
        </Button>
      </div>
    );
  }

  const active = isRunActive(run);
  const invitable = run.candidates.filter((c) => !isNeedsEmail(c));
  const needsEmailCount = run.candidates.length - invitable.length;
  const examUrl =
    run.exam_url ??
    (run.share_link ? `${globalThis.location.origin}/assessment/${run.share_link}` : null);

  const showResult = (r: { invited: number; failed: number }) => {
    if (r.failed > 0) toast.error(`${r.invited} sent, ${r.failed} failed. See candidate errors.`);
    else toast.success(`${PIPELINE_MESSAGES.RESEND_OK} (${r.invited})`);
  };

  const handleResendAll = async () => {
    setResendingAll(true);
    try {
      showResult(await resendAllInvites(pipelineId));
      await reload();
    } catch (err) {
      toast.error(extractApiErrorMessage(err, PIPELINE_MESSAGES.RESEND_FAILED));
    } finally {
      setResendingAll(false);
    }
  };

  const handleResendOne = async (candidateId: string) => {
    setBusyId(candidateId);
    try {
      showResult(await resendInvite(pipelineId, candidateId));
      await reload();
    } catch (err) {
      toast.error(extractApiErrorMessage(err, PIPELINE_MESSAGES.RESEND_FAILED));
    } finally {
      setBusyId(null);
    }
  };

  const handleResendReport = async (candidateId: string) => {
    try {
      await resendReport(pipelineId, candidateId);
      toast.success("Report resent.");
      await reload();
    } catch (err) {
      toast.error(extractApiErrorMessage(err, "Failed to resend the report."));
    }
  };

  const handleRetry = async (stepKey?: string) => {
    setRetrying(true);
    try {
      await retryStep(pipelineId, stepKey);
      toast.success(PIPELINE_MESSAGES.RETRY_OK);
      await reload();
    } catch (err) {
      toast.error(extractApiErrorMessage(err, PIPELINE_MESSAGES.RETRY_FAILED));
    } finally {
      setRetrying(false);
    }
  };

  const copyLink = async () => {
    if (!examUrl) return;
    try {
      await navigator.clipboard.writeText(examUrl);
      toast.success(PIPELINE_MESSAGES.LINK_COPIED);
    } catch {
      toast.error("Could not copy the link.");
    }
  };

  return (
    <div className={styles.page}>
      <Link to={ROUTES.ADMIN.PIPELINES} className={styles.back}>
        <IconChevronLeft size={16} /> All pipelines
      </Link>
      <Header
        title={run.jd_title ?? "AI Hiring Pipeline"}
        subtitle={`${run.candidates.length} candidates`}
        actions={
          <div className={styles.headerActions}>
            <Badge variant={STATUS_VARIANT[run.status] ?? "default"}>
              {run.status.replaceAll("_", " ")}
            </Badge>
            {examUrl && (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<IconCopy size={14} />}
                onClick={copyLink}
              >
                Copy exam link
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<IconMail size={14} />}
              isLoading={resendingAll}
              disabled={active || invitable.length === 0 || !run.assessment_id}
              onClick={handleResendAll}
            >
              Resend pending invites
            </Button>
            {run.status === "failed" || run.status === "done_with_errors" ? (
              <Button
                size="sm"
                isLoading={retrying}
                onClick={() => handleRetry(run.failed_step ?? undefined)}
              >
                Re-run failed step
              </Button>
            ) : null}
          </div>
        }
      />

      {error && (
        <p className={styles.pageError} role="alert">
          {error} (retrying)
        </p>
      )}
      {run.error && (
        <div className={styles.runError} role="alert">
          <strong>Pipeline error{run.failed_step ? ` in "${run.failed_step}"` : ""}</strong>
          <pre>{run.error}</pre>
        </div>
      )}
      {needsEmailCount > 0 && (
        <p className={styles.warn}>
          {needsEmailCount} candidate(s) have no email and were not invited. Add the email in the
          candidate description and start a new pipeline for them.
        </p>
      )}

      <div className={styles.grid}>
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Agent steps {active && <Spinner size="sm" />}</h2>
          <StepTracker
            steps={run.steps}
            canRetry={!active}
            retrying={retrying}
            onRetry={handleRetry}
          />
        </section>
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Live activity</h2>
          <EventLog events={run.events} />
        </section>
      </div>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Candidates</h2>
        <PipelineCandidatesTable
          candidates={run.candidates}
          workspaceId={run.workspace_id}
          assessmentId={run.assessment_id}
          busyId={busyId}
          onResend={handleResendOne}
          onResendReport={handleResendReport}
        />
      </section>
    </div>
  );
}
