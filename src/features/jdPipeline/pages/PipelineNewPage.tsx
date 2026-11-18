import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { IconChevronLeft, IconDelete, IconPlus, IconSparkles } from "@/assets/icons";
import { useAppSelector } from "@/store";
import { extractApiErrorMessage } from "@/utils/api";
import { ROUTES } from "@/constants/routes";
import { createPipeline } from "../api/pipelineApi";
import { useNewPipelineForm, validateNewPipeline } from "../hooks/useNewPipelineForm";
import {
  EMAIL_HINT,
  MAX_CANDIDATES,
  PHOTO_ACCEPT,
  PIPELINE_MESSAGES,
  RECOMMENDED_MIN_CANDIDATES,
  RESUME_ACCEPT,
} from "../constants";
import styles from "./PipelineNewPage.module.css";

export default function PipelineNewPage() {
  const navigate = useNavigate();
  const workspace = useAppSelector((s) => s.workspace.activeWorkspace);
  const { rows, addRow, removeRow, updateRow, belowRecommended } = useNewPipelineForm();
  const [title, setTitle] = useState("");
  const [jdText, setJdText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validateNewPipeline({ title, jdText, rows, workspaceId: workspace?.id });
    setError(problem);
    if (problem || !workspace) return;
    setSubmitting(true);
    try {
      const res = await createPipeline({ workspaceId: workspace.id, title, jdText, rows });
      toast.success(PIPELINE_MESSAGES.CREATED);
      navigate(ROUTES.ADMIN.pipelineDetail(res.id));
    } catch (err) {
      setError(extractApiErrorMessage(err, PIPELINE_MESSAGES.CREATE_FAILED));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className={styles.page} onSubmit={submit}>
      <Link to={ROUTES.ADMIN.PIPELINES} className={styles.back}>
        <IconChevronLeft size={16} /> All pipelines
      </Link>
      <Header
        title="New AI hiring pipeline"
        subtitle={`Workspace: ${workspace?.name ?? "none selected"}`}
        actions={
          <Button type="submit" isLoading={submitting} leftIcon={<IconSparkles size={16} />}>
            Start pipeline
          </Button>
        }
      />

      <section className={styles.card}>
        <Input
          label="JD title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Senior Python Engineer"
          maxLength={120}
        />
        <Textarea
          label="Job description"
          value={jdText}
          onChange={(e) => setJdText(e.target.value)}
          rows={10}
          placeholder="Paste the job description here"
        />
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>
            Candidates{" "}
            <span className={styles.count}>
              {rows.length}/{MAX_CANDIDATES}
            </span>
          </h2>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            leftIcon={<IconPlus size={14} />}
            disabled={rows.length >= MAX_CANDIDATES}
            onClick={addRow}
          >
            Add candidate
          </Button>
        </div>
        {belowRecommended && (
          <p className={styles.hint}>
            Pipelines are tuned for {RECOMMENDED_MIN_CANDIDATES}-{MAX_CANDIDATES} candidates; you
            can start with fewer.
          </p>
        )}
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>Resume (PDF / DOCX)</th>
                <th>Photo</th>
                <th>Description</th>
                <th aria-label="Remove" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.key}>
                  <td>{i + 1}</td>
                  <td>
                    <input
                      type="file"
                      accept={RESUME_ACCEPT}
                      aria-label={`Resume for candidate ${i + 1}`}
                      onChange={(e) => updateRow(r.key, { resume: e.target.files?.[0] ?? null })}
                    />
                  </td>
                  <td>
                    <input
                      type="file"
                      accept={PHOTO_ACCEPT}
                      aria-label={`Photo for candidate ${i + 1}`}
                      onChange={(e) => updateRow(r.key, { photo: e.target.files?.[0] ?? null })}
                    />
                  </td>
                  <td className={styles.descCell}>
                    <textarea
                      className={styles.desc}
                      rows={2}
                      value={r.description}
                      placeholder={EMAIL_HINT}
                      aria-label={`Description for candidate ${i + 1}`}
                      onChange={(e) => updateRow(r.key, { description: e.target.value })}
                    />
                    <span className={styles.hint}>{EMAIL_HINT}</span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={styles.remove}
                      aria-label={`Remove candidate ${i + 1}`}
                      disabled={rows.length <= 1}
                      onClick={() => removeRow(r.key)}
                    >
                      <IconDelete size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
