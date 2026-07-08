import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import readXlsxFile from "read-excel-file/browser";
import styles from "./QuestionsPage.module.css";
import { Header } from "@/components/layout/Header";
import { FilterBar } from "@/components/shared/FilterBar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Pagination } from "@/components/ui/Pagination";
import { Badge, ComplexityBadge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { RichText } from "@/components/ui/RichText";
import { Tooltip } from "@/components/ui/Tooltip";
import { MarkdownEditor } from "@/components/ui/MarkdownEditor";
import {
  IconPlus,
  IconEdit,
  IconDelete,
  IconSparkles,
  IconFileExcel,
  IconChevronLeft,
  IconChevronRight,
  IconAlertTriangle,
} from "@/assets/icons";
import { api } from "@/utils/api";
import { useDebounce } from "@/hooks/useDebounce";
import { usePagination } from "@/hooks/usePagination";
import {
  Question,
  QuestionCategory,
  PaginationMeta,
  Complexity,
  QuestionType,
  ViewMode,
  SortOrder,
} from "@/types";
import { COMPLEXITY_OPTIONS, QUESTION_TYPE_OPTIONS } from "@/constants/app";
import toast from "react-hot-toast";
import { API_ENDPOINTS } from "@/constants/api";
import { ROUTES } from "@/constants/routes";
import { QUESTION_BANK_SUCCESS, QUESTION_BANK_ERRORS } from "@/features/questionBank/constants";
import type { QuestionForm } from "@/features/questionBank/types";

const SORT_OPTIONS = [
  { value: "created_at", label: "Created Date" },
  { value: "updated_at", label: "Updated Date" },
  { value: "complexity", label: "Complexity" },
];

let _uidCounter = 0;
const uid = () => `id_${Date.now()}_${++_uidCounter}`;

const newBlankForm = (): QuestionForm => ({
  _key: uid(),
  question_text: "",
  question_type: "mcq_single",
  complexity: "medium",
  options: Array.from({ length: 4 }, () => ({
    id: uid(),
    text: "",
    is_correct: false,
  })),
  correct_answer: "",
});

// S2004: extracted from the nested map inside updateOption's setForms callback
function patchOptionInForm(
  f: QuestionForm,
  formIdx: number,
  i: number,
  optIdx: number,
  patch: Partial<{ text: string; is_correct: boolean }>
): QuestionForm {
  if (i !== formIdx) return f;
  return {
    ...f,
    options: f.options.map((o, j) => (j === optIdx ? { ...o, ...patch } : o)),
  };
}

// S3776: helper extracted from handleFileSelect to reduce cognitive complexity
function autoMapColumns(headers: string[]): {
  question: string;
  options: string;
  answer: string;
  complexity: string;
} {
  const auto = { question: "", options: "", answer: "", complexity: "" };
  for (const h of headers) {
    const l = h.toLowerCase();
    if (!auto.question && l.includes("question")) auto.question = h;
    if (!auto.options && (l === "options" || l.includes("option"))) auto.options = h;
    if (!auto.answer && l.includes("answer")) auto.answer = h;
    if (!auto.complexity && l.includes("complex")) auto.complexity = h;
  }
  return auto;
}

export default function QuestionsPage() {
  const { categoryId } = useParams<{ categoryId: string }>();
  const navigate = useNavigate();
  const [category, setCategory] = useState<QuestionCategory | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [complexity, setComplexity] = useState("");
  const [questionType, setQuestionType] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [showCreate, setShowCreate] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showExcel, setShowExcel] = useState(false);
  const [showColumnMap, setShowColumnMap] = useState(false);
  const [selected, setSelected] = useState<Question | null>(null);
  const [saving, setSaving] = useState(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [columnMap, setColumnMap] = useState({
    question: "",
    options: "",
    answer: "",
    complexity: "",
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const { page, pageSize, goToPage, reset, changePageSize } = usePagination();
  const debouncedSearch = useDebounce(search, 300);

  const [forms, setForms] = useState<QuestionForm[]>(() => [newBlankForm()]);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(
    () => new Set([forms[0]?._key ?? ""])
  );

  const [aiForm, setAiForm] = useState({
    topic: "",
    count: 5,
    complexity: "medium" as Complexity,
    question_type: "mcq_single" as QuestionType,
  });

  const fetchCategory = useCallback(async () => {
    try {
      const { data } = await api.get(API_ENDPOINTS.CATEGORIES.ROOT);
      const cats = data.data?.categories ?? [];
      const cat = cats.find((c: QuestionCategory) => c.id === categoryId);
      if (cat) setCategory(cat);
    } catch {}
  }, [categoryId]);

  const fetchQuestions = useCallback(async () => {
    if (!categoryId) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
        sort_by: sortBy,
        sort_order: sortOrder,
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(complexity && { complexity }),
        ...(questionType && { question_type: questionType }),
      });
      const { data } = await api.get(`${API_ENDPOINTS.CATEGORIES.QUESTIONS(categoryId)}?${params}`);
      setQuestions(data.data?.questions ?? []);
      setMeta(data.data?.pagination ?? null);
    } catch {
      toast.error(QUESTION_BANK_ERRORS.QUESTIONS_LOAD_FAILED);
    } finally {
      setIsLoading(false);
    }
  }, [categoryId, page, pageSize, sortBy, sortOrder, debouncedSearch, complexity, questionType]);

  useEffect(() => {
    fetchCategory();
  }, [fetchCategory]);
  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);
  useEffect(() => {
    reset();
  }, [debouncedSearch, complexity, questionType, sortBy, sortOrder]);

  const resetForms = () => {
    const f = newBlankForm();
    setForms([f]);
    setExpandedKeys(new Set([f._key]));
  };

  const toggleAccordion = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const getAccordionTitle = (f: QuestionForm, idx: number): string => {
    const text = f.question_text.trim();
    if (!text) return `Question ${idx + 1}`;
    const truncated = text.length > 55 ? `${text.slice(0, 55)}…` : text;
    return `${idx + 1}. ${truncated}`;
  };

  const updateForm = (idx: number, patch: Partial<QuestionForm>) => {
    setForms((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };

  // S2004: uses extracted patchOptionInForm to avoid deeply nested function
  const updateOption = (
    formIdx: number,
    optIdx: number,
    patch: Partial<{ text: string; is_correct: boolean }>
  ) => {
    setForms((prev) => prev.map((f, i) => patchOptionInForm(f, formIdx, i, optIdx, patch)));
  };

  const handleSaveQuestions = async () => {
    setSaving(true);
    try {
      if (selected) {
        const f = forms[0];
        const payload = {
          question_text: f.question_text,
          question_type: f.question_type,
          complexity: f.complexity,
          options: f.question_type === "essay" ? [] : f.options.filter((o) => o.text),
          correct_answer: f.question_type === "essay" ? f.correct_answer : undefined,
        };
        await api.put(API_ENDPOINTS.QUESTIONS.BY_ID(selected.id), payload);
        toast.success(QUESTION_BANK_SUCCESS.QUESTION_UPDATED);
      } else {
        const questions = forms.map((f) => ({
          question_text: f.question_text,
          question_type: f.question_type,
          complexity: f.complexity,
          options: f.question_type === "essay" ? [] : f.options.filter((o) => o.text),
          correct_answer: f.question_type === "essay" ? f.correct_answer : undefined,
        }));
        const { data } = await api.post(API_ENDPOINTS.CATEGORIES.BULK_CREATE(categoryId!), {
          questions,
        });
        toast.success(QUESTION_BANK_SUCCESS.BULK_CREATED(data.data?.created ?? 0));
      }
      setShowCreate(false);
      resetForms();
      setSelected(null);
      fetchQuestions();
    } catch {
      toast.error(QUESTION_BANK_ERRORS.QUESTION_CREATE_FAILED);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api.delete(API_ENDPOINTS.QUESTIONS.BY_ID(selected.id));
      toast.success(QUESTION_BANK_SUCCESS.QUESTION_DELETED);
      setShowDelete(false);
      fetchQuestions();
    } catch {
      toast.error(QUESTION_BANK_ERRORS.QUESTION_DELETE_FAILED);
    } finally {
      setSaving(false);
    }
  };

  const handleAIGenerate = async () => {
    setSaving(true);
    try {
      const { data } = await api.post(API_ENDPOINTS.CATEGORIES.AI_GENERATE(categoryId!), aiForm);
      toast.success(QUESTION_BANK_SUCCESS.AI_GENERATED(data.data?.created ?? 0));
      setShowAI(false);
      fetchQuestions();
    } catch {
      toast.error(QUESTION_BANK_ERRORS.AI_GENERATE_FAILED);
    } finally {
      setSaving(false);
    }
  };

  // S3776: auto-mapping logic extracted to autoMapColumns helper above
  const handleFileSelect = async (file: File) => {
    setExcelFile(file);
    try {
      let headers: string[];
      if (file.name.toLowerCase().endsWith(".csv")) {
        const text = await file.text();
        const firstLine = text.split("\n")[0] ?? "";
        headers = firstLine
          .split(",")
          .map((h) => h.trim().replace(/^"|"$/g, ""))
          .filter(Boolean);
      } else {
        const rows = await readXlsxFile(file);
        headers = (rows[0].data[0] ?? []).filter(Boolean).map(String);
      }
      setExcelHeaders(headers);
      setColumnMap(autoMapColumns(headers));
    } catch {
      toast.error(QUESTION_BANK_ERRORS.EXCEL_HEADERS_FAILED);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const { data } = await api.get(API_ENDPOINTS.CATEGORIES.IMPORT_TEMPLATE(categoryId!));
      const b64 = data.data?.template as string;
      const bytes = Uint8Array.from(atob(b64), (c) => c.codePointAt(0)!);
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "import_template.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download template");
    }
  };

  const handleExcelImport = async () => {
    if (!excelFile || !columnMap.question || !columnMap.answer) return;
    setSaving(true);
    const formData = new FormData();
    formData.append("file", excelFile);
    formData.append("column_map", JSON.stringify(columnMap));
    try {
      const { data } = await api.post(
        API_ENDPOINTS.CATEGORIES.EXCEL_IMPORT(categoryId!),
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      toast.success(QUESTION_BANK_SUCCESS.BULK_IMPORTED(data.data?.created ?? 0));
      setShowColumnMap(false);
      setExcelFile(null);
      setExcelHeaders([]);
      setColumnMap({ question: "", options: "", answer: "", complexity: "" });
      fetchQuestions();
    } catch {
      toast.error(QUESTION_BANK_ERRORS.BULK_IMPORT_FAILED);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (q: Question) => {
    const key = uid();
    setSelected(q);
    setForms([
      {
        _key: key,
        question_text: q.question_text,
        question_type: q.question_type,
        complexity: q.complexity,
        options:
          q.options.length > 0
            ? q.options
            : Array.from({ length: 4 }, () => ({
                id: uid(),
                text: "",
                is_correct: false,
              })),
        correct_answer: q.correct_answer ?? "",
      },
    ]);
    setExpandedKeys(new Set([key]));
    setShowCreate(true);
  };

  // S2004: extracted from accordion remove button onClick (was 5+ levels deep)
  const handleRemoveForm = (idx: number, key: string) => {
    setForms((prev) => prev.filter((_, i) => i !== idx));
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  // S2004: extracted from option input onChange (was 5+ levels deep)
  const handleOptionCorrectChange = (f: QuestionForm, formIdx: number, optIdx: number) => {
    const options = f.options.map((o, i) => {
      let is_correct: boolean;
      if (f.question_type === "mcq_single") {
        is_correct = i === optIdx;
      } else if (i === optIdx) {
        is_correct = !o.is_correct;
      } else {
        is_correct = o.is_correct;
      }
      return { ...o, is_correct };
    });
    updateForm(formIdx, { options });
  };

  const canSave = forms.every((f) => f.question_text.trim());

  // S3358: extract nested ternary for the main content area
  const mainContent = (() => {
    if (isLoading) {
      return (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <Spinner size="lg" />
        </div>
      );
    }
    if (questions.length === 0) {
      return (
        <div className={styles.empty}>
          <p>No questions found</p>
          <Button
            leftIcon={<IconPlus size={15} />}
            onClick={() => {
              resetForms();
              setShowCreate(true);
            }}
          >
            Add Questions
          </Button>
        </div>
      );
    }
    return (
      <>
        <div className={viewMode === "grid" ? styles.grid : styles.list}>
          {questions.map((q) => (
            <div key={q.id} className={styles.questionCard}>
              <div className={styles.questionTop}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <ComplexityBadge complexity={q.complexity} />
                  <Badge variant="info">
                    {QUESTION_TYPE_OPTIONS.find((o) => o.value === q.question_type)?.label ??
                      q.question_type}
                  </Badge>
                </div>
                <div className={styles.cardActions}>
                  <Tooltip content="Edit" placement="top">
                    <button
                      className={styles.iconBtn}
                      onClick={() => openEdit(q)}
                      aria-label="Edit question"
                    >
                      <IconEdit size={14} />
                    </button>
                  </Tooltip>
                  <Tooltip content="Delete" placement="top">
                    <button
                      className={`${styles.iconBtn} ${styles.danger}`}
                      onClick={() => {
                        setSelected(q);
                        setShowDelete(true);
                      }}
                      aria-label="Delete question"
                    >
                      <IconDelete size={14} />
                    </button>
                  </Tooltip>
                </div>
              </div>
              <div className={styles.questionText}>
                <RichText>{q.question_text}</RichText>
              </div>
              {q.options.length > 0 && (
                <div className={styles.options}>
                  {q.options.map((o) => (
                    <div
                      key={o.id}
                      className={`${styles.option} ${o.is_correct ? styles.correctOption : ""}`}
                    >
                      {o.is_correct && <span className={styles.correctDot} />}
                      <span>{o.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        {meta && (
          <Pagination
            meta={meta}
            onPageChange={goToPage}
            pageSize={pageSize}
            onPageSizeChange={changePageSize}
          />
        )}
      </>
    );
  })();

  // S3358 + S4624: extract nested ternary and inner template literal for Save button label
  const saveCountSuffix = forms.length > 1 ? ` (${forms.length})` : "";
  const saveButtonLabel = selected ? "Save Changes" : `Save${saveCountSuffix}`;

  return (
    <div>
      <Header
        title={category?.name ?? "Questions"}
        subtitle={`${meta?.total ?? 0} questions`}
        actions={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<IconSparkles size={15} />}
              onClick={() => setShowAI(true)}
            >
              AI Generate
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<IconFileExcel size={15} />}
              onClick={() => setShowExcel(true)}
            >
              Excel Import
            </Button>
            <Button
              size="sm"
              leftIcon={<IconPlus size={15} />}
              onClick={() => {
                resetForms();
                setSelected(null);
                setShowCreate(true);
              }}
            >
              Add
            </Button>
          </div>
        }
      />

      <button
        onClick={() => navigate(ROUTES.ADMIN.QUESTION_BANK)}
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
        <IconChevronLeft size={14} /> Back to Categories
      </button>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        sortByOptions={SORT_OPTIONS}
        sortOrder={sortOrder}
        onSortOrderToggle={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        complexity={complexity}
        onComplexityChange={setComplexity}
        questionType={questionType}
        onQuestionTypeChange={setQuestionType}
        showComplexity
        showQuestionType
        onRefresh={fetchQuestions}
      />

      {mainContent}

      {/* Create / Edit Question Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => {
          setShowCreate(false);
          setSelected(null);
          resetForms();
        }}
        title={selected ? "Edit Question" : "Add Questions"}
        size="lg"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setShowCreate(false);
                setSelected(null);
                resetForms();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveQuestions} isLoading={saving} disabled={!canSave}>
              {saveButtonLabel}
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {forms.map((f, idx) => (
            <div key={f._key} className={styles.accordionItem}>
              {/* Accordion header */}
              <div className={styles.accordionHeader}>
                <button
                  type="button"
                  className={styles.accordionTrigger}
                  onClick={() => toggleAccordion(f._key)}
                  aria-expanded={expandedKeys.has(f._key)}
                >
                  <IconChevronRight
                    size={15}
                    className={`${styles.accordionChevron} ${expandedKeys.has(f._key) ? styles.accordionChevronOpen : ""}`}
                  />
                  <span className={styles.accordionTitle}>{getAccordionTitle(f, idx)}</span>
                </button>
                {!selected && forms.length > 1 && (
                  <Tooltip content="Remove question">
                    <button
                      type="button"
                      className={`${styles.iconBtn} ${styles.danger}`}
                      onClick={() => handleRemoveForm(idx, f._key)}
                      aria-label="Remove question"
                    >
                      <IconDelete size={14} />
                    </button>
                  </Tooltip>
                )}
              </div>

              {/* Accordion body (animated) */}
              <div
                className={`${styles.accordionContent} ${expandedKeys.has(f._key) ? styles.accordionOpen : ""}`}
              >
                <div className={styles.accordionInner}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <MarkdownEditor
                      label="Question Text"
                      placeholder="Enter the question..."
                      value={f.question_text}
                      onChange={(value) => updateForm(idx, { question_text: value })}
                      rows={5}
                      hint="Markdown supported — wrap code in ``` code fences ```"
                    />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <Select
                        label="Question Type"
                        options={QUESTION_TYPE_OPTIONS}
                        value={f.question_type}
                        onChange={(v) => updateForm(idx, { question_type: v as QuestionType })}
                      />
                      <Select
                        label="Complexity"
                        options={COMPLEXITY_OPTIONS}
                        value={f.complexity}
                        onChange={(v) => updateForm(idx, { complexity: v as Complexity })}
                      />
                    </div>

                    {f.question_type === "essay" ? (
                      <Textarea
                        label="Model Answer (optional)"
                        placeholder="Provide a model answer for reference..."
                        value={f.correct_answer}
                        onChange={(e) => updateForm(idx, { correct_answer: e.target.value })}
                        rows={3}
                      />
                    ) : (
                      <div>
                        <p
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            color: "var(--text-secondary)",
                            margin: "0 0 8px",
                          }}
                        >
                          Options{" "}
                          {f.question_type === "mcq_multi"
                            ? "(check all correct)"
                            : "(check one correct)"}
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {f.options.map((opt, optIdx) => (
                            <div
                              key={opt.id}
                              style={{ display: "flex", alignItems: "center", gap: 8 }}
                            >
                              <input
                                type={f.question_type === "mcq_single" ? "radio" : "checkbox"}
                                checked={opt.is_correct}
                                onChange={() => handleOptionCorrectChange(f, idx, optIdx)}
                                style={{ flexShrink: 0 }}
                              />
                              <Input
                                placeholder={`Option ${optIdx + 1}`}
                                value={opt.text}
                                onChange={(e) =>
                                  updateOption(idx, optIdx, { text: e.target.value })
                                }
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {!selected && (
            <Button
              variant="secondary"
              leftIcon={<IconPlus size={15} />}
              onClick={() => {
                const newForm = newBlankForm();
                setForms((prev) => [...prev, newForm]);
                setExpandedKeys((prev) => new Set([...prev, newForm._key]));
              }}
            >
              Add Another Question
            </Button>
          )}
        </div>
      </Modal>

      {/* AI Generate Modal */}
      <Modal
        isOpen={showAI}
        onClose={() => setShowAI(false)}
        title="AI Question Generator"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowAI(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAIGenerate}
              isLoading={saving}
              leftIcon={<IconSparkles size={15} />}
            >
              Generate
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Input
            label="Topic"
            placeholder="e.g., Python decorators, SQL joins..."
            value={aiForm.topic}
            onChange={(e) => setAiForm((p) => ({ ...p, topic: e.target.value }))}
          />
          <Input
            label="Number of Questions (1-20)"
            type="number"
            min={1}
            max={20}
            value={aiForm.count}
            onChange={(e) => setAiForm((p) => ({ ...p, count: Number(e.target.value) }))}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Select
              label="Complexity"
              options={COMPLEXITY_OPTIONS}
              value={aiForm.complexity}
              onChange={(v) => setAiForm((p) => ({ ...p, complexity: v as Complexity }))}
            />
            <Select
              label="Question Type"
              options={QUESTION_TYPE_OPTIONS}
              value={aiForm.question_type}
              onChange={(v) => setAiForm((p) => ({ ...p, question_type: v as QuestionType }))}
            />
          </div>
        </div>
      </Modal>

      {/* Import — Step 1: File Upload */}
      <Modal
        isOpen={showExcel}
        onClose={() => {
          setShowExcel(false);
          setExcelFile(null);
          setExcelHeaders([]);
        }}
        title="Import Questions"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setShowExcel(false);
                setExcelFile(null);
                setExcelHeaders([]);
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={!excelFile}
              onClick={() => {
                setShowExcel(false);
                setShowColumnMap(true);
              }}
            >
              Next: Map Columns
            </Button>
          </>
        }
      >
        <div className={styles.uploadArea}>
          <IconFileExcel size={40} color="var(--text-tertiary)" />
          <p style={{ fontSize: 14, fontWeight: 500 }}>
            {excelFile ? excelFile.name : "Upload an Excel or CSV file"}
          </p>
          <p
            style={{
              fontSize: 12,
              color: "var(--text-tertiary)",
              textAlign: "center",
            }}
          >
            You'll map your columns to Question, Options, Answer, and Complexity in the next step.
          </p>
          <button
            type="button"
            style={{
              fontSize: 12,
              color: "var(--primary-600)",
              textDecoration: "underline",
              cursor: "pointer",
            }}
            onClick={handleDownloadTemplate}
          >
            Download import template
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
            }}
          />
          <Button
            variant={excelFile ? "secondary" : "primary"}
            onClick={() => fileRef.current?.click()}
            leftIcon={<IconFileExcel size={15} />}
          >
            {excelFile ? "Change File" : "Choose File"}
          </Button>
        </div>
      </Modal>

      {/* Excel Import — Step 2: Column Mapping */}
      <Modal
        isOpen={showColumnMap}
        onClose={() => {
          setShowColumnMap(false);
          setExcelFile(null);
          setExcelHeaders([]);
        }}
        title="Map Columns"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setShowColumnMap(false);
                setShowExcel(true);
              }}
            >
              Back
            </Button>
            <Button
              onClick={handleExcelImport}
              isLoading={saving}
              disabled={!columnMap.question || !columnMap.answer}
            >
              Import
            </Button>
          </>
        }
      >
        <p
          style={{
            fontSize: 13,
            color: "var(--text-secondary)",
            marginBottom: 16,
          }}
        >
          Map your Excel columns to the required fields.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {(
            [
              { field: "question", label: "Question", required: true },
              { field: "options", label: "Options", required: false },
              {
                field: "answer",
                label: "Answer (1-based index, e.g. 2 or 1,3)",
                required: true,
              },
              {
                field: "complexity",
                label: "Complexity (defaults to medium)",
                required: false,
              },
            ] as {
              field: keyof typeof columnMap;
              label: string;
              required: boolean;
            }[]
          ).map(({ field, label, required }) => (
            <Select
              key={field}
              label={label}
              showRequired={required}
              value={columnMap[field]}
              onChange={(v) => setColumnMap((p) => ({ ...p, [field]: v }))}
              options={[
                {
                  value: "",
                  label: required ? "— Select column —" : "— None —",
                },
                ...excelHeaders.map((h) => ({ value: h, label: h })),
              ]}
            />
          ))}
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        title="Delete Question"
        icon={<IconAlertTriangle size={34} />}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowDelete(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={saving}>
              Delete
            </Button>
          </>
        }
      >
        <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          Are you sure you want to delete this question? This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
