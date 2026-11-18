import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { IconPlus } from "@/assets/icons";
import { useAppSelector } from "@/store";
import { extractApiErrorMessage } from "@/utils/api";
import { formatDateTime } from "@/utils/helpers";
import { ROUTES } from "@/constants/routes";
import { listPipelines } from "../api/pipelineApi";
import { PIPELINE_MESSAGES } from "../constants";
import type { PipelineSummary } from "../types";
import styles from "./PipelineListPage.module.css";

export const STATUS_VARIANT: Record<string, "default" | "success" | "error" | "info" | "warning"> =
  {
    queued: "default",
    running: "info",
    done: "success",
    done_with_errors: "warning",
    failed: "error",
  };

export default function PipelineListPage() {
  const navigate = useNavigate();
  const workspaceId = useAppSelector((s) => s.workspace.activeWorkspace?.id);
  const [items, setItems] = useState<PipelineSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    listPipelines(workspaceId)
      .then((res) => {
        if (!cancelled) {
          setItems(res.pipelines);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(extractApiErrorMessage(err, PIPELINE_MESSAGES.LIST_FAILED));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  return (
    <div className={styles.page}>
      <Header
        title="AI Hiring Pipeline"
        subtitle="Analyse resumes against a JD, build the exam, and invite candidates automatically"
        actions={
          <Button
            leftIcon={<IconPlus size={16} />}
            onClick={() => navigate(ROUTES.ADMIN.PIPELINE_NEW)}
          >
            New pipeline
          </Button>
        }
      />
      {isLoading && (
        <div className={styles.centered}>
          <Spinner size="lg" />
        </div>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {!isLoading && !error && items.length === 0 && (
        <div className={styles.empty}>
          <p>No pipelines yet.</p>
          <Button onClick={() => navigate(ROUTES.ADMIN.PIPELINE_NEW)}>Create the first one</Button>
        </div>
      )}
      <ul className={styles.list}>
        {items.map((p) => (
          <li key={p.id}>
            <Link to={ROUTES.ADMIN.pipelineDetail(p.id)} className={styles.card}>
              <div className={styles.cardMain}>
                <span className={styles.title}>{p.jd_title ?? "Untitled pipeline"}</span>
                <span className={styles.meta}>
                  {p.counts?.total ?? 0} candidates
                  {p.counts
                    ? ` · ${p.counts.invited} invited · ${p.counts.submitted} submitted`
                    : ""}
                  {p.created_at ? ` · ${formatDateTime(p.created_at)}` : ""}
                </span>
                {p.error && <span className={styles.err}>{p.error}</span>}
              </div>
              <Badge variant={STATUS_VARIANT[p.status] ?? "default"}>
                {p.status.replaceAll("_", " ")}
              </Badge>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
