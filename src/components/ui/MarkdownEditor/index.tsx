import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";
import MDEditor from "@uiw/react-md-editor";
import styles from "./MarkdownEditor.module.css";

interface MarkdownEditorProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  error?: string;
  hint?: string;
}

export function MarkdownEditor({
  label,
  value,
  onChange,
  placeholder,
  rows = 5,
  error,
  hint,
}: Readonly<MarkdownEditorProps>) {
  return (
    <div className={styles.wrapper}>
      {label && <span className={styles.label}>{label}</span>}
      <div
        className={`${styles.container} ${error ? styles.hasError : ""}`}
        data-color-mode="light"
      >
        <MDEditor
          value={value}
          onChange={(v) => onChange(v ?? "")}
          height={rows * 24 + 80}
          textareaProps={{ placeholder }}
          visibleDragbar={false}
        />
      </div>
      {error && (
        <p className={styles.error} role="alert" aria-live="polite">
          {error}
        </p>
      )}
      {!error && hint && <p className={styles.hint}>{hint}</p>}
    </div>
  );
}
