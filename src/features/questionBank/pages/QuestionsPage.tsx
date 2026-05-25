import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styles from './QuestionsPage.module.css';
import { Header } from '@/components/layout/Header';
import { FilterBar } from '@/components/shared/FilterBar';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Toggle } from '@/components/ui/Toggle';
import { Pagination } from '@/components/ui/Pagination';
import { Badge } from '@/components/ui/Badge';
import { ComplexityBadge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import {
  IconPlus, IconEdit, IconDelete, IconBrain, IconFileExcel,
  IconChevronLeft, IconChevronRight,
} from '@/assets/icons';
import { api } from '@/utils/api';
import { useDebounce } from '@/hooks/useDebounce';
import { usePagination } from '@/hooks/usePagination';
import { Question, QuestionCategory, PaginationMeta, Complexity, QuestionType, ViewMode, SortOrder } from '@/types';
import { COMPLEXITY_OPTIONS, QUESTION_TYPE_OPTIONS } from '@/constants/app';
import toast from 'react-hot-toast';

const SORT_OPTIONS = [
  { value: 'created_at', label: 'Created Date' },
  { value: 'updated_at', label: 'Updated Date' },
  { value: 'complexity', label: 'Complexity' },
];

type CreationMode = 'manual' | 'bulk' | 'ai' | 'excel';

export default function QuestionsPage() {
  const { categoryId } = useParams<{ categoryId: string }>();
  const navigate = useNavigate();
  const [category, setCategory] = useState<QuestionCategory | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [complexity, setComplexity] = useState('');
  const [questionType, setQuestionType] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showCreate, setShowCreate] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showExcel, setShowExcel] = useState(false);
  const [selected, setSelected] = useState<Question | null>(null);
  const [saving, setSaving] = useState(false);
  const [excelColumns, setExcelColumns] = useState<string[]>([]);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelMapping, setExcelMapping] = useState<Record<string, string>>({});
  const [excelStep, setExcelStep] = useState<'upload' | 'map'>('upload');
  const fileRef = useRef<HTMLInputElement>(null);
  const { page, pageSize, goToPage, reset } = usePagination();
  const debouncedSearch = useDebounce(search, 300);

  const [form, setForm] = useState({
    question_text: '',
    question_type: 'mcq_single' as QuestionType,
    complexity: 'medium' as Complexity,
    options: [
      { id: crypto.randomUUID(), text: '', is_correct: false },
      { id: crypto.randomUUID(), text: '', is_correct: false },
      { id: crypto.randomUUID(), text: '', is_correct: false },
      { id: crypto.randomUUID(), text: '', is_correct: false },
    ],
    correct_answer: '',
  });

  const [aiForm, setAiForm] = useState({
    topic: '',
    count: 5,
    complexity: 'medium' as Complexity,
    question_type: 'mcq_single' as QuestionType,
  });

  const fetchCategory = useCallback(async () => {
    try {
      const { data } = await api.get(`/api/questions/categories`);
      const cats = data.data?.categories || [];
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
      const { data } = await api.get(`/api/questions/categories/${categoryId}/questions?${params}`);
      setQuestions(data.data?.questions || []);
      setMeta(data.data?.pagination || null);
    } catch { toast.error('Failed to load questions'); }
    finally { setIsLoading(false); }
  }, [categoryId, page, pageSize, sortBy, sortOrder, debouncedSearch, complexity, questionType]);

  useEffect(() => { fetchCategory(); }, [fetchCategory]);
  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);
  useEffect(() => { reset(); }, [debouncedSearch, complexity, questionType, sortBy, sortOrder]);

  const resetForm = () => setForm({
    question_text: '',
    question_type: 'mcq_single',
    complexity: 'medium',
    options: Array.from({ length: 4 }, () => ({ id: crypto.randomUUID(), text: '', is_correct: false })),
    correct_answer: '',
  });

  const handleSaveQuestion = async () => {
    setSaving(true);
    try {
      const payload = {
        question_text: form.question_text,
        question_type: form.question_type,
        complexity: form.complexity,
        options: form.question_type !== 'essay' ? form.options.filter(o => o.text) : [],
        correct_answer: form.question_type === 'essay' ? form.correct_answer : undefined,
      };

      if (selected) {
        await api.put(`/api/questions/${selected.id}`, payload);
        toast.success('Question updated');
      } else {
        await api.post(`/api/questions/categories/${categoryId}/questions`, payload);
        toast.success('Question created');
      }
      setShowCreate(false);
      resetForm();
      setSelected(null);
      fetchQuestions();
    } catch { toast.error('Failed to save question'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api.delete(`/api/questions/${selected.id}`);
      toast.success('Question deleted');
      setShowDelete(false);
      fetchQuestions();
    } catch { toast.error('Failed to delete'); }
    finally { setSaving(false); }
  };

  const handleAIGenerate = async () => {
    setSaving(true);
    try {
      const { data } = await api.post(`/api/questions/categories/${categoryId}/ai-generate`, aiForm);
      toast.success(`${data.data?.created || 0} questions generated`);
      setShowAI(false);
      fetchQuestions();
    } catch { toast.error('AI generation failed'); }
    finally { setSaving(false); }
  };

  const handleExcelUpload = async (file: File) => {
    setExcelFile(file);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const { data } = await api.post(
        `/api/questions/categories/${categoryId}/excel-columns`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      setExcelColumns(data.data?.columns || []);
      setExcelStep('map');
    } catch { toast.error('Failed to read Excel file'); }
  };

  const handleExcelImport = async () => {
    if (!excelFile) return;
    setSaving(true);
    const formData = new FormData();
    formData.append('file', excelFile);
    formData.append('mapping', JSON.stringify(excelMapping));
    try {
      const { data } = await api.post(
        `/api/questions/categories/${categoryId}/excel-import`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      toast.success(`${data.data?.created || 0} questions imported`);
      setShowExcel(false);
      setExcelStep('upload');
      setExcelColumns([]);
      setExcelMapping({});
      setExcelFile(null);
      fetchQuestions();
    } catch { toast.error('Import failed'); }
    finally { setSaving(false); }
  };

  const openEdit = (q: Question) => {
    setSelected(q);
    setForm({
      question_text: q.question_text,
      question_type: q.question_type,
      complexity: q.complexity,
      options: q.options.length > 0 ? q.options : Array.from({ length: 4 }, () => ({ id: crypto.randomUUID(), text: '', is_correct: false })),
      correct_answer: q.correct_answer || '',
    });
    setShowCreate(true);
  };

  return (
    <div>
      <Header
        title={category?.name || 'Questions'}
        subtitle={`${meta?.total ?? 0} questions`}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" size="sm" leftIcon={<IconBrain size={15} />} onClick={() => setShowAI(true)}>
              AI Generate
            </Button>
            <Button variant="secondary" size="sm" leftIcon={<IconFileExcel size={15} />} onClick={() => setShowExcel(true)}>
              Excel Import
            </Button>
            <Button leftIcon={<IconPlus size={15} />} onClick={() => { resetForm(); setSelected(null); setShowCreate(true); }}>
              Add Question
            </Button>
          </div>
        }
      />

      <button
        onClick={() => navigate('/question-bank')}
        style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16, cursor: 'pointer' }}
      >
        <IconChevronLeft size={14} /> Back to Categories
      </button>

      <FilterBar
        search={search} onSearchChange={setSearch}
        sortBy={sortBy} onSortByChange={setSortBy} sortByOptions={SORT_OPTIONS}
        sortOrder={sortOrder} onSortOrderToggle={() => setSortOrder((o) => o === 'asc' ? 'desc' : 'asc')}
        viewMode={viewMode} onViewModeChange={setViewMode}
        complexity={complexity} onComplexityChange={setComplexity}
        questionType={questionType} onQuestionTypeChange={setQuestionType}
        showComplexity showQuestionType
      />

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size="lg" /></div>
      ) : questions.length === 0 ? (
        <div className={styles.empty}>
          <p>No questions found</p>
          <Button leftIcon={<IconPlus size={15} />} onClick={() => { resetForm(); setShowCreate(true); }}>
            Add Question
          </Button>
        </div>
      ) : (
        <>
          <div className={viewMode === 'grid' ? styles.grid : styles.list}>
            {questions.map((q) => (
              <div key={q.id} className={styles.questionCard}>
                <div className={styles.questionTop}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <ComplexityBadge complexity={q.complexity} />
                    <Badge variant="info">
                      {QUESTION_TYPE_OPTIONS.find(o => o.value === q.question_type)?.label || q.question_type}
                    </Badge>
                  </div>
                  <div className={styles.cardActions}>
                    <button className={styles.iconBtn} onClick={() => openEdit(q)}><IconEdit size={14} /></button>
                    <button className={`${styles.iconBtn} ${styles.danger}`} onClick={() => { setSelected(q); setShowDelete(true); }}><IconDelete size={14} /></button>
                  </div>
                </div>
                <p className={styles.questionText}>{q.question_text}</p>
                {q.options.length > 0 && (
                  <div className={styles.options}>
                    {q.options.map((o) => (
                      <div key={o.id} className={`${styles.option} ${o.is_correct ? styles.correctOption : ''}`}>
                        {o.is_correct && <span className={styles.correctDot} />}
                        <span>{o.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          {meta && <Pagination meta={meta} onPageChange={goToPage} />}
        </>
      )}

      {/* Create/Edit Question Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => { setShowCreate(false); setSelected(null); resetForm(); }}
        title={selected ? 'Edit Question' : 'Add Question'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setShowCreate(false); setSelected(null); }}>Cancel</Button>
            <Button onClick={handleSaveQuestion} isLoading={saving} disabled={!form.question_text.trim()}>
              {selected ? 'Save Changes' : 'Create Question'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Textarea label="Question Text" placeholder="Enter the question..." value={form.question_text}
            onChange={(e) => setForm((p) => ({ ...p, question_text: e.target.value }))} rows={3} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Select label="Question Type" options={QUESTION_TYPE_OPTIONS} value={form.question_type}
              onChange={(v) => setForm((p) => ({ ...p, question_type: v as QuestionType }))} />
            <Select label="Complexity" options={COMPLEXITY_OPTIONS} value={form.complexity}
              onChange={(v) => setForm((p) => ({ ...p, complexity: v as Complexity }))} />
          </div>
          {form.question_type === 'essay' ? (
            <Textarea label="Model Answer (optional)" placeholder="Provide a model answer for reference..." value={form.correct_answer}
              onChange={(e) => setForm((p) => ({ ...p, correct_answer: e.target.value }))} rows={4} />
          ) : (
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
                Options {form.question_type === 'mcq_multi' ? '(check all correct)' : '(check one correct)'}
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {form.options.map((opt, idx) => (
                  <div key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type={form.question_type === 'mcq_single' ? 'radio' : 'checkbox'}
                      checked={opt.is_correct}
                      onChange={() => {
                        setForm((p) => ({
                          ...p,
                          options: p.options.map((o, i) => ({
                            ...o,
                            is_correct: form.question_type === 'mcq_single'
                              ? i === idx
                              : i === idx ? !o.is_correct : o.is_correct,
                          })),
                        }));
                      }}
                      style={{ flexShrink: 0 }}
                    />
                    <Input
                      placeholder={`Option ${idx + 1}`}
                      value={opt.text}
                      onChange={(e) => setForm((p) => ({
                        ...p,
                        options: p.options.map((o, i) => i === idx ? { ...o, text: e.target.value } : o),
                      }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* AI Generate Modal */}
      <Modal isOpen={showAI} onClose={() => setShowAI(false)} title="AI Question Generator"
        footer={<><Button variant="secondary" onClick={() => setShowAI(false)}>Cancel</Button><Button onClick={handleAIGenerate} isLoading={saving} leftIcon={<IconBrain size={15} />}>Generate</Button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input label="Topic" placeholder="e.g., Python decorators, SQL joins..." value={aiForm.topic}
            onChange={(e) => setAiForm((p) => ({ ...p, topic: e.target.value }))} />
          <Input label="Number of Questions (1-20)" type="number" min={1} max={20} value={aiForm.count}
            onChange={(e) => setAiForm((p) => ({ ...p, count: Number(e.target.value) }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Select label="Complexity" options={COMPLEXITY_OPTIONS} value={aiForm.complexity}
              onChange={(v) => setAiForm((p) => ({ ...p, complexity: v as Complexity }))} />
            <Select label="Question Type" options={QUESTION_TYPE_OPTIONS} value={aiForm.question_type}
              onChange={(v) => setAiForm((p) => ({ ...p, question_type: v as QuestionType }))} />
          </div>
        </div>
      </Modal>

      {/* Excel Import Modal */}
      <Modal isOpen={showExcel} onClose={() => { setShowExcel(false); setExcelStep('upload'); setExcelColumns([]); }} title="Excel Import"
        size="lg"
        footer={excelStep === 'map' ? (
          <><Button variant="secondary" onClick={() => setExcelStep('upload')}>Back</Button><Button onClick={handleExcelImport} isLoading={saving}>Import</Button></>
        ) : undefined}>
        {excelStep === 'upload' ? (
          <div className={styles.uploadArea}>
            <IconFileExcel size={40} color="var(--text-tertiary)" />
            <p>Upload an Excel (.xlsx) file</p>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Supported columns: Question, Answer, Complexity, Question Type</p>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
              onChange={(e) => e.target.files?.[0] && handleExcelUpload(e.target.files[0])} />
            <Button onClick={() => fileRef.current?.click()} leftIcon={<IconFileExcel size={15} />}>
              Choose File
            </Button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Map your Excel columns to the required fields:
            </p>
            {[
              { key: 'question_column', label: 'Question Column', required: true },
              { key: 'answer_column', label: 'Answer Column (optional)' },
              { key: 'complexity_column', label: 'Complexity Column' },
              { key: 'question_type_column', label: 'Question Type Column' },
            ].map((field) => (
              <Select
                key={field.key}
                label={field.label}
                options={excelColumns.map((c) => ({ value: c, label: c }))}
                placeholder="Select column"
                value={excelMapping[field.key] || ''}
                onChange={(v) => setExcelMapping((p) => ({ ...p, [field.key]: v }))}
              />
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Select label="Default Complexity" options={COMPLEXITY_OPTIONS} value={excelMapping.default_complexity || 'medium'}
                onChange={(v) => setExcelMapping((p) => ({ ...p, default_complexity: v }))} />
              <Select label="Default Question Type" options={QUESTION_TYPE_OPTIONS} value={excelMapping.default_question_type || 'essay'}
                onChange={(v) => setExcelMapping((p) => ({ ...p, default_question_type: v }))} />
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={showDelete} onClose={() => setShowDelete(false)} title="Delete Question"
        footer={<><Button variant="secondary" onClick={() => setShowDelete(false)}>Cancel</Button><Button variant="danger" onClick={handleDelete} isLoading={saving}>Delete</Button></>}>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          Are you sure you want to delete this question? This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
