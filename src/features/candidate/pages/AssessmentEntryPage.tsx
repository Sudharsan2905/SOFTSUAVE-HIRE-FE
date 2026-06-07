import { useState, useEffect } from "react";
import { useParams, Navigate } from "react-router-dom";
import { Spinner } from "@/components/ui/Spinner";
import { NoAccessPage } from "@/components/shared/NoAccessPage";
import { IconExternalLink } from "@/assets/icons";
import { LinkStatusScreen, LinkStatus } from "@/features/candidate/components/LinkStatusScreen";
import { useAppSelector } from "@/store";
import { UserRole } from "@/types";
import { api } from "@/utils/api";
import { isAssessmentDone } from "@/utils/assessmentSession";

function Loading() {
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

export function CandidateDashboard() {
  return (
    <NoAccessPage
      icon={IconExternalLink}
      title="No Assessment Linked"
      description="Please use your assessment link to access your assessment."
      showBackButton={false}
    />
  );
}

export default function AssessmentEntry() {
  const { shareLink } = useParams<{ shareLink: string }>();
  const { isAuthenticated, user } = useAppSelector((s) => s.auth);
  const isCandidate = isAuthenticated && user?.role === UserRole.CANDIDATE;

  const [checking, setChecking] = useState(true);
  const [linkStatus, setLinkStatus] = useState<LinkStatus | "valid" | null>(null);
  const [linkMessage, setLinkMessage] = useState("");
  const [linkStartTime, setLinkStartTime] = useState("");

  useEffect(() => {
    if (!shareLink) {
      setLinkStatus("invalid");
      setChecking(false);
      return;
    }
    api
      .get(`/api/assessments/share/validate?link=${shareLink}`)
      .then((res) => {
        const v = res.data.data;
        if (v.can_allow) {
          setLinkStatus("valid");
        } else {
          if (v.is_expirable) setLinkStatus(v.is_expired ? "expired" : "not_started");
          else setLinkStatus("invalid");
          setLinkMessage(v.message || "");
          if (v.start_time) setLinkStartTime(v.start_time);
        }
      })
      .catch(() => {
        // Network error — don't block the candidate
        setLinkStatus("valid");
      })
      .finally(() => setChecking(false));
  }, [shareLink]);

  if (checking) return <Loading />;

  if (linkStatus === "not_started" || linkStatus === "expired" || linkStatus === "invalid") {
    return <LinkStatusScreen status={linkStatus} message={linkMessage} startTime={linkStartTime} />;
  }

  if (!isCandidate) {
    return <Navigate to={`/candidate/login?share=${shareLink}`} replace />;
  }

  if (shareLink && isAssessmentDone(shareLink)) {
    return <Navigate to={`/assessment/${shareLink}/completed`} replace />;
  }

  return <Navigate to={`/assessment/${shareLink}/instructions`} replace />;
}
