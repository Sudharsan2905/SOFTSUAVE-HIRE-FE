import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";
import MDEditor, { commands } from "@uiw/react-md-editor";
import styles from "./MarkdownEditor.module.css";

interface MarkdownEditorProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  error?: string;
  hint?: string;
  /** When provided, the toolbar's image button calls this instead of inserting placeholder text. */
  onImageButtonClick?: () => void;
}

export function MarkdownEditor({
  label,
  value,
  onChange,
  placeholder,
  rows = 5,
  error,
  hint,
  onImageButtonClick,
}: Readonly<MarkdownEditorProps>) {
  const toolbarCommands = onImageButtonClick
    ? commands
        .getCommands()
        .map((c) => (c.keyCommand === "image" ? { ...c, execute: onImageButtonClick } : c))
    : undefined;

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
          commands={toolbarCommands}
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
