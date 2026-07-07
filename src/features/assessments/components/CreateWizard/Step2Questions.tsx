import React, { useState, useEffect, useCallback } from "react";
import styles from "./Step2Questions.module.css";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ComplexityBadge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { Tooltip } from "@/components/ui/Tooltip";
import { IconSearch, IconDrag, IconCheck, IconDelete } from "@/assets/icons";
import { api } from "@/utils/api";
import { API_ENDPOINTS } from "@/constants/api";
import { useDebounce } from "@/hooks/useDebounce";
import { Question, QuestionCategory } from "@/types";
import { COMPLEXITY_OPTIONS, QUESTION_TYPE_OPTIONS } from "@/constants/app";
import { AssessmentDraft } from "./WizardContainer";

interface Props {
  draft: AssessmentDraft;
  currentRound: number;
  onUpdateQuestions: (ids: string[]) => void;
}

export function Step2Questions({ draft, currentRound, onUpdateQuestions }: Readonly<Props>) {
  const round = draft.rounds[currentRound];
  const selectedIds = round.question_ids;

  const [categories, setCategories] = useState<QuestionCategory[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [search, setSearch] = useState("");
  const [complexity, setComplexity] = useState("");
  const [questionType, setQuestionType] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  const selectedQuestions = questions.filter((q) => selectedIds.includes(q.id));
  const availableQuestions = questions.filter((q) => !selectedIds.includes(q.id));

  const fetchCategories = async () => {
    const { data } = await api.get(`${API_ENDPOINTS.CATEGORIES.ROOT}?page_size=100`);
    setCategories(data.data?.categories || []);
    if (data.data?.categories?.[0]) setSelectedCategory(data.data.categories[0].id);
  };

  const fetchQuestions = useCallback(async () => {
    if (!selectedCategory) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page_size: "100",
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(complexity && { complexity }),
        ...(questionType && { question_type: questionType }),
      });
      const { data } = await api.get(
        `${API_ENDPOINTS.CATEGORIES.QUESTIONS(selectedCategory)}?${params}`
      );
      setQuestions(data.data?.questions || []);
    } catch {
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory, debouncedSearch, complexity, questionType]);

  useEffect(() => {
    fetchCategories();
  }, []);
  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const toggle = (q: Question) => {
    if (selectedIds.includes(q.id)) {
      onUpdateQuestions(selectedIds.filter((id) => id !== q.id));
    } else {
      onUpdateQuestions([...selectedIds, q.id]);
    }
  };

  const removeSelected = (id: string) => {
    onUpdateQuestions(selectedIds.filter((sid) => sid !== id));
  };

  const handleSelectAll = () => {
    onUpdateQuestions([...selectedIds, ...availableQuestions.map((q) => q.id)]);
  };

  const handleUnselectAll = () => {
    onUpdateQuestions([]);
  };

  let browserContent: React.ReactNode;
  if (isLoading) {
    browserContent = (
      <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
        <Spinner />
      </div>
    );
  } else if (availableQuestions.length === 0) {
    browserContent = (
      <div className={styles.dropHint}>
        <p>No questions available</p>
      </div>
    );
  } else {
    browserContent = (
      <div className={styles.questionList}>
        {availableQuestions.map((q) => (
          <button
            key={q.id}
            type="button"
            className={styles.questionItem}
            onClick={() => toggle(q)}
          >
            <div className={styles.questionItemLeft}>
              <IconDrag size={16} color="var(--text-tertiary)" />
              <div>
                <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                  <ComplexityBadge complexity={q.complexity} />
                </div>
                <p className={styles.qText}>{q.question_text}</p>
              </div>
            </div>
            <Tooltip content="Add to round">
              <button className={styles.addBtn} aria-label="Add to round">
                <IconCheck size={13} />
              </button>
            </Tooltip>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Left — selected drop zone */}
      <div className={styles.selectedPane}>
        <div className={styles.paneHeader}>
          <h3 className={styles.paneTitle}>Selected Questions</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className={styles.paneCount}>
              {selectedIds.length} / {round.question_count} required
            </span>
            {availableQuestions.length > 0 && (
              <button
                type="button"
                className={styles.paneAction}
                onClick={handleSelectAll}
              >
                Select All
              </button>
            )}
          </div>
        </div>
        {selectedQuestions.length === 0 ? (
          <div className={styles.dropHint}>
            <p>Drag or click questions from the right to add them here</p>
          </div>
        ) : (
          <div className={styles.selectedList}>
            {selectedQuestions.map((q) => (
              <div key={q.id} className={styles.selectedItem}>
                <div className={styles.selectedInfo}>
                  <ComplexityBadge complexity={q.complexity} />
                  <p className={styles.qText}>{q.question_text}</p>
                </div>
                <button className={styles.removeBtn} onClick={() => removeSelected(q.id)}>
                  <IconDelete size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right — question browser */}
      <div className={styles.browserPane}>
        <div className={styles.paneHeader}>
          <h3 className={styles.paneTitle}>Knowledge Vault</h3>
          {selectedIds.length > 0 && (
            <button
              type="button"
              className={styles.paneAction}
              onClick={handleUnselectAll}
            >
              Unselect All
            </button>
          )}
        </div>
        <div style={{ overflow: "scroll" }}>
          <div className={styles.filters}>
            <Select
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              value={selectedCategory}
              onChange={setSelectedCategory}
              placeholder="Category"
              fullWidth={false}
              style={{ flex: 1 }}
            />
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftElement={<IconSearch size={13} />}
              fullWidth={false}
              style={{ flex: 1 }}
            />
            <div style={{ width: "100%", display: "flex", gap: 8, marginTop: 8 }}>
              <Select
                options={COMPLEXITY_OPTIONS}
                value={complexity}
                onChange={setComplexity}
                placeholder="Complexity"
                fullWidth={false}
                style={{ width: "50%" }}
              />
              <Select
                options={QUESTION_TYPE_OPTIONS}
                value={questionType}
                onChange={setQuestionType}
                placeholder="Type"
                fullWidth={false}
                style={{ width: "50%" }}
              />
            </div>
          </div>

          {browserContent}
        </div>
      </div>
    </div>
  );
}
