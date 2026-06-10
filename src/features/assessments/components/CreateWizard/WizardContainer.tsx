import React, { useState, memo } from "react";
import styles from "./WizardContainer.module.css";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Step1BasicInfo } from "./Step1BasicInfo";
import { Step2Questions } from "./Step2Questions";
import { api } from "@/utils/api";
import { API_ENDPOINTS } from "@/constants/api";
import {
  ASSESSMENT_SUCCESS,
  ASSESSMENT_ERRORS,
  DEFAULT_MONITORING_CONFIG,
  DEFAULT_ROUND,
} from "@/features/assessments/constants";
import toast from "react-hot-toast";

export type { RoundSetup, AssessmentDraft } from "@/features/assessments/types";
import type { AssessmentDraft } from "@/features/assessments/types";

interface RoundNavFooterProps {
  roundSelected: number;
  roundRequired: number;
  isLastRound: boolean;
  saving: boolean;
  finishLabel: string;
  onPrev: () => void;
  onNext: () => void;
  onFinish: () => void;
}

function RoundNavigationFooter({
  roundSelected,
  roundRequired,
  isLastRound,
  saving,
  finishLabel,
  onPrev,
  onNext,
  onFinish,
}: Readonly<RoundNavFooterProps>) {
  const selectedColor =
    roundSelected >= roundRequired ? "var(--success-600)" : "var(--primary-600)";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        flexWrap: "wrap",
        width: "100%",
      }}
    >
      <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
        Selected: <strong style={{ color: selectedColor }}>{roundSelected}</strong> /{" "}
        <strong>{roundRequired}</strong> required (can select more for randomization)
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button variant="secondary" onClick={onPrev}>
          Back
        </Button>
        {isLastRound ? (
          <Button onClick={onFinish} isLoading={saving} disabled={roundSelected < roundRequired}>
            {finishLabel}
          </Button>
        ) : (
          <Button onClick={onNext} disabled={roundSelected < roundRequired}>
            Next Round
          </Button>
        )}
      </div>
    </div>
  );
}

interface Props {
  workspaceId: string;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: Partial<AssessmentDraft>;
  editMode?: boolean;
  assessmentId?: string;
  availableWorkspaces?: { id: string; name: string }[];
}

export const CreateAssessmentWizard = memo(function CreateAssessmentWizard({
  workspaceId,
  onClose,
  onSuccess,
  initialData,
  editMode = false,
  assessmentId,
  availableWorkspaces,
}: Readonly<Props>) {
  const [step, setStep] = useState(1);
  const [currentRound, setCurrentRound] = useState(0);
  const [saving, setSaving] = useState(false);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(workspaceId);

  const [draft, setDraft] = useState<AssessmentDraft>({
    name: initialData?.name ?? "",
    description: initialData?.description ?? "",
    rounds: initialData?.rounds || [{ ...DEFAULT_ROUND }],
    accessibility: initialData?.accessibility ?? "normal",
    monitoring_config: initialData?.monitoring_config || { ...DEFAULT_MONITORING_CONFIG },
  });

  const updateDraft = (updates: Partial<AssessmentDraft>) => {
    setDraft((prev) => ({ ...prev, ...updates }));
  };

  const handleStep1Next = (info: Partial<AssessmentDraft>) => {
    updateDraft(info);
    setStep(2);
    setCurrentRound(0);
  };

  const handleRoundNext = () => {
    if (currentRound < draft.rounds.length - 1) {
      setCurrentRound((r) => r + 1);
    }
  };

  const handleRoundPrev = () => {
    if (currentRound > 0) setCurrentRound((r) => r - 1);
    else setStep(1);
  };

  const updateRoundQuestions = (roundIdx: number, questionIds: string[]) => {
    setDraft((prev) => ({
      ...prev,
      rounds: prev.rounds.map((r, i) => (i === roundIdx ? { ...r, question_ids: questionIds } : r)),
    }));
  };

  const isLastRound = currentRound === draft.rounds.length - 1;

  const handleFinish = async () => {
    setSaving(true);
    try {
      if (editMode && assessmentId) {
        await api.put(API_ENDPOINTS.ASSESSMENTS.BY_ID(selectedWorkspaceId, assessmentId), draft);
        toast.success(ASSESSMENT_SUCCESS.UPDATED);
      } else {
        await api.post(API_ENDPOINTS.ASSESSMENTS.ROOT(selectedWorkspaceId), draft);
        toast.success(ASSESSMENT_SUCCESS.CREATED);
      }
      onSuccess();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(
        msg ?? (editMode ? ASSESSMENT_ERRORS.UPDATE_FAILED : ASSESSMENT_ERRORS.CREATE_FAILED)
      );
    } finally {
      setSaving(false);
    }
  };

  const roundRequired = draft.rounds[currentRound]?.question_count ?? 0;
  const roundSelected = draft.rounds[currentRound]?.question_ids.length ?? 0;
  const questionsTitle = `Select Questions — Round ${currentRound + 1} of ${draft.rounds.length}`;
  const step1Title = editMode ? "Edit Assessment" : "Create Assessment";
  const modalTitle = step === 1 ? step1Title : questionsTitle;

  const finishLabel = editMode ? "Save Changes" : "Finish & Create";

  const showWorkspaceSelector = availableWorkspaces !== undefined && availableWorkspaces.length > 1;
  const workspaceSelectorEmpty = showWorkspaceSelector && !selectedWorkspaceId;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={modalTitle}
      size="xl"
      disableBackdropClose
      className={step === 2 ? styles.questionStepModal : undefined}
      footer={
        step === 1 ? undefined : (
          <RoundNavigationFooter
            roundSelected={roundSelected}
            roundRequired={roundRequired}
            isLastRound={isLastRound}
            saving={saving}
            finishLabel={finishLabel}
            onPrev={handleRoundPrev}
            onNext={handleRoundNext}
            onFinish={handleFinish}
          />
        )
      }
    >
      <div className={styles.wizard}>
        {/* Step indicator */}
        <div className={styles.steps}>
          <div className={`${styles.step} ${step >= 1 ? styles.stepActive : ""}`}>
            <div className={styles.stepDot}>1</div>
            <span>Basic Info</span>
          </div>
          <div className={styles.stepLine} />
          <div className={`${styles.step} ${step >= 2 ? styles.stepActive : ""}`}>
            <div className={styles.stepDot}>2</div>
            <span>Select Questions</span>
          </div>
        </div>

        {step === 1 ? (
          <>
            {showWorkspaceSelector && (
              <div style={{ marginBottom: 20 }}>
                <Select
                  label="Target Workspace"
                  showRequired
                  value={selectedWorkspaceId}
                  onChange={setSelectedWorkspaceId}
                  options={availableWorkspaces.map((ws) => ({
                    value: ws.id,
                    label: ws.name,
                  }))}
                />
              </div>
            )}
            <Step1BasicInfo
              draft={draft}
              onNext={handleStep1Next}
              disableNext={workspaceSelectorEmpty}
            />
          </>
        ) : (
          <Step2Questions
            draft={draft}
            currentRound={currentRound}
            onUpdateQuestions={(ids) => updateRoundQuestions(currentRound, ids)}
          />
        )}
      </div>
    </Modal>
  );
});
