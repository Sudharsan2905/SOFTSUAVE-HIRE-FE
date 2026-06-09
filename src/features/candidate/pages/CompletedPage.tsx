import React, { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import logoUrl from "@/assets/favicon.svg";
import styles from "./CompletedPage.module.css";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { IconCheck } from "@/assets/icons";
import { isAssessmentDone } from "@/utils/assessmentSession";
import { ROUTES } from "@/constants/routes";
import CandidateHeader from "@/features/candidate/components/CandidateHeader";
import { useAppSelector } from "@/store/hooks";

type ValidationState = "checking" | "valid" | "invalid";

export default function CompletedPage() {
  const { shareLink } = useParams<{ shareLink: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<ValidationState>("checking");

  const user = useAppSelector((s) => s.auth.user);
  const candidateName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(" ")
    : undefined;

  useEffect(() => {
    // isAssessmentDone reads sessionStorage — synchronous, no API call needed.
    // The session flag is written by InterviewPage (finish-round) and
    // InstructionsPage (already-completed backend error), so it is only present
    // when the candidate legitimately reached this screen.
    if (shareLink && isAssessmentDone(shareLink)) {
      setState("valid");
    } else {
      // No evidence of completion → redirect to the assessment entry page.
      setState("invalid");
    }
  }, [shareLink]);

  if (state === "checking") {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
        }}
      >
        <Spinner size="lg" />
      </div>
    );
  }

  // Redirect invalid access (direct URL, browser history abuse) to entry page.
  if (state === "invalid") {
    return (
      <Navigate
        to={shareLink ? ROUTES.ASSESSMENT.entry(shareLink) : ROUTES.CANDIDATE.LOGIN}
        replace
      />
    );
  }

  return (
    <div className={styles.page}>
      <CandidateHeader candidateName={candidateName} />
      <div className={styles.card}>
        <div className={styles.iconWrap}>
          <IconCheck size={32} color="#fff" />
        </div>

        <h1 className={styles.title}>Assessment Submitted!</h1>

        <p className={styles.subtitle}>
          Thank you for completing the assessment. Your responses have been recorded and will be
          reviewed by the hiring team.
        </p>

        <p className={styles.note}>
          You will be contacted if you are shortlisted for the next stage. You may now close this
          window.
        </p>

        {/* Prevent going back into the interview by navigating away explicitly. */}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate(ROUTES.CANDIDATE.LOGIN, { replace: true })}
          style={{ marginTop: 8 }}
        >
          Exit
        </Button>

        <div className={styles.logo}>
          <img src={logoUrl} width={28} height={28} alt="SoftSuave Hire" />
          <span className={styles.logoText}>SoftSuave Hire</span>
        </div>
      </div>
    </div>
  );
}
