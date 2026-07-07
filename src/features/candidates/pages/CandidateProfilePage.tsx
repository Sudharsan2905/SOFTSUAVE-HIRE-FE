import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Spinner } from "@/components/ui/Spinner";
import { StatusBadge } from "@/components/ui/Badge";
import { IconChevronLeft, IconMail, IconPhone, IconMapPin, IconGender } from "@/assets/icons";
import { api } from "@/utils/api";
import { API_ENDPOINTS } from "@/constants/api";
import { ROUTES } from "@/constants/routes";
import { getAvatarColor, getInitials, getFullName, formatDateTime } from "@/utils/helpers";
import toast from "react-hot-toast";

interface CandidateDetail {
  id: string;
  first_name: string;
  last_name?: string;
  email: string;
  phone?: string;
  gender?: string;
  location?: string;
  institution?: string;
  dob?: string;
  is_active?: boolean;
  created_at: string;
}

interface SubmissionHistory {
  id: string;
  assessment_name?: string;
  status: string;
  percentage?: number;
  started_at?: string;
  completed_at?: string;
}

export default function CandidateProfilePage() {
  const { candidateId } = useParams<{ candidateId: string }>();
  const navigate = useNavigate();

  const [candidate, setCandidate] = useState<CandidateDetail | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionHistory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!candidateId) return;
    setLoading(true);
    try {
      const [profileRes, historyRes] = await Promise.all([
        api.get(API_ENDPOINTS.CANDIDATES.BY_ID(candidateId)),
        api.get(API_ENDPOINTS.CANDIDATES.SUBMISSIONS(candidateId)),
      ]);
      setCandidate(profileRes.data.data);
      setSubmissions(historyRes.data.data ?? []);
    } catch {
      toast.error("Failed to load candidate profile");
    } finally {
      setLoading(false);
    }
  }, [candidateId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (!candidate) {
    return (
      <div style={{ padding: 40, color: "var(--text-tertiary)", textAlign: "center" }}>
        Candidate not found
      </div>
    );
  }

  const fullName = getFullName(candidate);
  const avatarColor = getAvatarColor(fullName);
  const isActive = candidate.is_active !== false;

  return (
    <div>
      <Header
        title="Candidate Profile"
        subtitle="Profile information and assessment history"
      />

      <button
        onClick={() => navigate(ROUTES.ADMIN.CANDIDATES)}
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
        <IconChevronLeft size={14} /> Back to Candidates
      </button>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Profile card */}
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1.5px solid var(--border-default)",
            borderRadius: "var(--radius-lg)",
            padding: "24px",
            display: "flex",
            gap: 20,
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: `${avatarColor}1f`,
              color: avatarColor,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {getInitials(fullName)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
                {fullName}
              </h2>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 99,
                  background: isActive ? "var(--success-100)" : "var(--bg-muted)",
                  color: isActive ? "var(--success-700)" : "var(--text-tertiary)",
                }}
              >
                {isActive ? "Active" : "Inactive"}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px 20px",
                fontSize: 13,
                color: "var(--text-secondary)",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <IconMail size={13} /> {candidate.email}
              </span>
              {candidate.phone && (
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <IconPhone size={13} /> {candidate.phone}
                </span>
              )}
              {candidate.gender && (
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <IconGender size={13} />
                  {candidate.gender.charAt(0).toUpperCase() + candidate.gender.slice(1)}
                </span>
              )}
              {candidate.location && (
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <IconMapPin size={13} /> {candidate.location}
                </span>
              )}
              {candidate.institution && (
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  🎓 {candidate.institution}
                </span>
              )}
              {candidate.dob && (
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  📅 {candidate.dob}
                </span>
              )}
            </div>
            <p
              style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 8 }}
            >
              Member since {formatDateTime(candidate.created_at)}
            </p>
          </div>
        </div>

        {/* Assessment history */}
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1.5px solid var(--border-default)",
            borderRadius: "var(--radius-lg)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "14px 20px",
              borderBottom: "1px solid var(--border-default)",
              background: "var(--bg-muted)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
              Assessment History
            </h3>
            <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
              {submissions.length} {submissions.length === 1 ? "attempt" : "attempts"}
            </span>
          </div>
          {submissions.length === 0 ? (
            <div
              style={{
                padding: "48px 24px",
                textAlign: "center",
                color: "var(--text-tertiary)",
                fontSize: 14,
              }}
            >
              No assessments taken yet
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--bg-muted)" }}>
                  {["Assessment", "Status", "Score", "Started", "Completed"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px 16px",
                        textAlign: "left",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--text-secondary)",
                        borderBottom: "1px solid var(--border-default)",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <tr
                    key={s.id}
                    style={{ borderBottom: "1px solid var(--border-default)" }}
                  >
                    <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
                      {s.assessment_name ?? "—"}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <StatusBadge status={s.status} />
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--text-secondary)" }}>
                      {s.percentage !== null && s.percentage !== undefined ? `${s.percentage}%` : "—"}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--text-secondary)" }}>
                      {s.started_at ? formatDateTime(s.started_at) : "—"}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--text-secondary)" }}>
                      {s.completed_at ? formatDateTime(s.completed_at) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
