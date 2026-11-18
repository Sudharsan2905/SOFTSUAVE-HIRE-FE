import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { IconAlertTriangle, IconMail } from "@/assets/icons";
import { ROUTES } from "@/constants/routes";
import type { PipelineCandidate } from "../types";
import styles from "./PipelineCandidatesTable.module.css";

type Variant = "default" | "success" | "error" | "info" | "warning";

const INVITE_VARIANT: Record<string, Variant> = {
  sent: "success",
  failed: "error",
  pending: "default",
  skipped: "warning",
};
const EXAM_VARIANT: Record<string, Variant> = {
  completed: "success",
  in_progress: "info",
  pending: "default",
};
const REPORT_VARIANT: Record<string, Variant> = {
  sent: "success",
  failed: "error",
  pending: "default",
};

export function isNeedsEmail(c: PipelineCandidate): boolean {
  return c.status === "needs_email" || !c.email;
}

interface Props {
  candidates: PipelineCandidate[];
  workspaceId: string;
  assessmentId?: string | null;
  busyId: string | null;
  onResend: (candidateId: string) => void;
  onResendReport: (candidateId: string) => void;
}

export function PipelineCandidatesTable({
  candidates,
  workspaceId,
  assessmentId,
  busyId,
  onResend,
  onResendReport,
}: Readonly<Props>) {
  if (candidates.length === 0) return <p className={styles.empty}>No candidates.</p>;
  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Candidate</th>
            <th>Email</th>
            <th>Match</th>
            <th>Invite</th>
            <th>Exam</th>
            <th>Report</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {candidates.map((c) => {
            const needsEmail = isNeedsEmail(c);
            const score = c.analysis?.match_score;
            return (
              <tr key={c.id} data-testid={`candidate-${c.id}`}>
                <td>
                  <div className={styles.name}>{c.name ?? "Unnamed"}</div>
                  {c.error && (
                    <div className={styles.err} role="alert">
                      {c.failed_step ? `[${c.failed_step}] ` : ""}
                      {c.error}
                    </div>
                  )}
                </td>
                <td>
                  {needsEmail ? (
                    <Badge variant="warning" size="sm">
                      <IconAlertTriangle size={12} /> Email needed
                    </Badge>
                  ) : (
                    <>
                      <div>{c.email}</div>
                      {c.email_source && <div className={styles.sub}>from {c.email_source}</div>}
                    </>
                  )}
                </td>
                <td className={styles.analysis}>
                  {c.analysis ? (
                    <>
                      <strong>{score === null || score === undefined ? "-" : `${score}%`}</strong>
                      {c.analysis.summary && (
                        <p className={styles.summary} title={c.analysis.summary}>
                          {c.analysis.summary}
                        </p>
                      )}
                    </>
                  ) : (
                    <span className={styles.sub}>Pending</span>
                  )}
                </td>
                <td>
                  <Badge
                    variant={INVITE_VARIANT[c.invite_status ?? "pending"] ?? "default"}
                    size="sm"
                  >
                    {c.invite_status ?? "pending"}
                  </Badge>
                  {c.invite_error && (
                    <div className={styles.err} role="alert">
                      {c.invite_error}
                    </div>
                  )}
                </td>
                <td>
                  {c.exam_status ? (
                    <>
                      <Badge variant={EXAM_VARIANT[c.exam_status] ?? "default"} size="sm">
                        {c.exam_status.replace("_", " ")}
                      </Badge>
                      {c.percentage !== null && c.percentage !== undefined && (
                        <div className={styles.sub}>{Math.round(c.percentage)}%</div>
                      )}
                    </>
                  ) : (
                    <span className={styles.sub}>-</span>
                  )}
                </td>
                <td>
                  <Badge
                    variant={REPORT_VARIANT[c.report_status ?? "pending"] ?? "default"}
                    size="sm"
                  >
                    {c.report_status ?? "pending"}
                  </Badge>
                  {c.report_error && (
                    <div className={styles.err} role="alert">
                      {c.report_error}
                    </div>
                  )}
                </td>
                <td>
                  <div className={styles.actions}>
                    {!needsEmail && (
                      <Button
                        size="sm"
                        variant="secondary"
                        leftIcon={<IconMail size={14} />}
                        isLoading={busyId === c.id}
                        onClick={() => onResend(c.id)}
                      >
                        Resend invite
                      </Button>
                    )}
                    {c.report_status === "failed" && (
                      <Button size="sm" variant="secondary" onClick={() => onResendReport(c.id)}>
                        Resend report
                      </Button>
                    )}
                    {c.submission_id && c.user_id && assessmentId && (
                      <Link
                        className={styles.link}
                        to={ROUTES.ADMIN.candidateDetail(workspaceId, assessmentId, c.user_id)}
                      >
                        Review
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
