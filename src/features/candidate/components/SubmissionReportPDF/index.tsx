import { Document, Page, View, Text, StyleSheet, Svg, Polygon, pdf } from "@react-pdf/renderer";
import type { CandidateSubmissionDetail, QuestionAnswer, RoundResult } from "@/types";
import { downloadBlob } from "@/utils/helpers";

// ── helpers ───────────────────────────────────────────────────────────────────

function maskEmail(email: string): string {
  if (!email.includes("@")) return email;
  const [local, domain] = email.split("@");
  return `${local.slice(0, Math.min(3, local.length))}***@${domain}`;
}

function maskPhone(phone: string | null): string {
  if (!phone) return "";
  const digits = phone.replaceAll(/\D/g, "");
  if (digits.length < 6) return phone;
  return `${digits.slice(0, 4)}****${digits.slice(-2)}`;
}

function getInitials(first: string, last: string): string {
  return ((first[0] ?? "") + (last[0] ?? "")).toUpperCase() || "?";
}

function qTypeLabel(type: string): string {
  if (type === "mcq_single") return "Single Choice";
  if (type === "mcq_multi") return "Multiple Select";
  return "Essay";
}

function qStatus(qa: QuestionAnswer): string {
  if (qa.question_type === "essay") return "Reviewed";
  const ca = toAnswerArray(qa.candidate_answer);
  if (ca.length === 0) return "Skipped";
  return qa.is_correct ? "Correct" : "Incorrect";
}

function toAnswerArray(v: string | string[]): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => Boolean(x));
  return v ? [v] : [];
}

function getCandidateAnswerText(qa: QuestionAnswer): string {
  const ca = toAnswerArray(qa.candidate_answer);
  if (ca.length === 0) return "No Answer";
  if (qa.question_type === "essay") return ca.join("\n");
  const optMap = Object.fromEntries(qa.options.map((o) => [o.id, o.text]));
  const texts = ca.map((id) => optMap[id] ?? id).filter(Boolean);
  return texts.join(", ") || "No Answer";
}

function titleCase(s: string): string {
  return s.replaceAll("_", " ").replaceAll(/\b\w/g, (c: string) => c.toUpperCase());
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// ── styles ────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    backgroundColor: "#ffffff",
    paddingTop: 30,
    paddingBottom: 30,
    paddingLeft: 34,
    paddingRight: 34,
    fontSize: 11,
    color: "#1f2937",
  },

  // Card shell
  card: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderStyle: "solid",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    backgroundColor: "#ffffff",
  },

  // Candidate card
  candidateRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#f7e3d7",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: "#c76c1d",
  },
  candidateInfo: {
    flex: 1,
  },
  candidateName: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    marginBottom: 8,
    color: "#111827",
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  metaItem: {
    marginRight: 14,
    marginBottom: 3,
    color: "#6b7280",
    fontSize: 10,
  },

  // Overall summary
  sectionTitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    marginBottom: 12,
    color: "#111827",
  },
  statsRow: {
    flexDirection: "row",
    marginBottom: 10,
  },
  statBox: {
    flex: 1,
  },
  statLabel: {
    color: "#8b93a7",
    fontSize: 9,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 17,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
  },
  statusPill: {
    backgroundColor: "#e8efff",
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 10,
    alignSelf: "flex-start",
  },
  statusPillText: {
    color: "#3b5ccc",
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
  },

  // Round title
  roundTitle: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#ff5a3c",
    marginTop: 18,
    marginBottom: 12,
  },

  // Question card
  questionCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderStyle: "solid",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  questionTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  questionMeta: {
    color: "#6b7280",
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
  },
  qsCorrect: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#166534" },
  qsIncorrect: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#dc2626" },
  qsReviewed: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#1d4ed8" },
  qsSkipped: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#6b7280" },
  questionText: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginBottom: 10,
    lineHeight: 1.5,
    color: "#111827",
  },

  // Options
  optionDefault: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderStyle: "solid",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 6,
    fontSize: 10,
    backgroundColor: "#fafafa",
    color: "#1f2937",
  },
  optionCorrect: {
    borderWidth: 1,
    borderColor: "#74c788",
    borderStyle: "solid",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 6,
    fontSize: 10,
    backgroundColor: "#edf9f0",
    color: "#176b2c",
    fontFamily: "Helvetica-Bold",
  },
  optionWrongSelected: {
    borderWidth: 2,
    borderColor: "#3b82f6",
    borderStyle: "solid",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 6,
    fontSize: 10,
    backgroundColor: "#eff6ff",
    color: "#1e3a8a",
  },

  // Answer blocks
  answerSection: { marginTop: 10 },
  answerLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
    color: "#374151",
  },
  answerCandidateBox: {
    backgroundColor: "#fff4f4",
    borderWidth: 1,
    borderColor: "#efb4b4",
    borderStyle: "solid",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 10,
    color: "#991b1b",
    lineHeight: 1.6,
  },

  // Footer
  footerContainer: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  footer: {
    color: "#9ca3af",
    fontSize: 11,
    marginLeft: 4,
  },
});

// ── sub-components ────────────────────────────────────────────────────────────

function TalentiaLogo({ size = 36 }: Readonly<{ size?: number }> = {}) {
  return (
    <Svg viewBox="0 0 16 16" width={size} height={size}>
      <Polygon
        points="13.6,3.8 8,7 4.1,4.8 8,2.5 10.2,3.8 11.9,2.8 8,0.5 1.5,4.2 1.5,5.2 7.1,8.5 7.1,13 3.2,10.7 3.2,8.3 1.5,7.2 1.5,11.7 8,15.5 8.9,15 8.9,8.5 12.8,6.3 12.8,10.7 10.6,12 10.6,14 14.5,11.7 14.5,4.2"
        fill="#FF5A3C"
      />
    </Svg>
  );
}

function getStatusStyle(status: string) {
  if (status === "Correct") return S.qsCorrect;
  if (status === "Incorrect") return S.qsIncorrect;
  if (status === "Reviewed") return S.qsReviewed;
  return S.qsSkipped;
}

function QuestionView({ index, qa }: Readonly<{ index: number; qa: QuestionAnswer }>) {
  const isMcq = qa.question_type === "mcq_single" || qa.question_type === "mcq_multi";
  const candidateAnswers = toAnswerArray(qa.candidate_answer);
  const status = qStatus(qa);
  const statusStyle = getStatusStyle(status);

  return (
    <View style={S.questionCard} wrap={false}>
      <View style={S.questionTop}>
        <Text style={S.questionMeta}>
          Q{index + 1} {"•"} {qTypeLabel(qa.question_type)}
        </Text>
        <Text style={statusStyle}>{status}</Text>
      </View>

      <Text style={S.questionText}>{qa.question_text}</Text>

      {isMcq &&
        qa.options.map((opt) => {
          const isChosen = candidateAnswers.includes(opt.id);
          const isCorrect = opt.is_correct === true;
          const isWrongSelected = isChosen && !isCorrect;

          if (isCorrect) {
            return (
              <View key={opt.id} style={S.optionCorrect}>
                <Text>
                  {"✓"} {opt.text}
                </Text>
              </View>
            );
          }
          if (isWrongSelected) {
            return (
              <View key={opt.id} style={S.optionWrongSelected}>
                <Text>{opt.text}</Text>
              </View>
            );
          }
          return (
            <View key={opt.id} style={S.optionDefault}>
              <Text>{opt.text}</Text>
            </View>
          );
        })}

      <View style={S.answerSection}>
        <Text style={S.answerLabel}>Candidate Answer</Text>
        <View style={S.answerCandidateBox}>
          <Text>{getCandidateAnswerText(qa)}</Text>
        </View>
      </View>
    </View>
  );
}

// ── document ──────────────────────────────────────────────────────────────────

interface SubmissionReportDocumentProps {
  data: CandidateSubmissionDetail;
  rounds: RoundResult[];
}

export function SubmissionReportDocument({
  data,
  rounds,
}: Readonly<SubmissionReportDocumentProps>) {
  const { candidate } = data;
  const fullName = `${candidate.first_name} ${candidate.last_name}`.trim();

  return (
    <Document title={`${fullName} — Interview Report`} author="Talentia">
      <Page size="A4" style={S.page}>
        {/* Candidate card */}
        <View style={S.card}>
          <View style={S.candidateRow}>
            <View style={S.avatar}>
              <Text style={S.avatarText}>
                {getInitials(candidate.first_name, candidate.last_name)}
              </Text>
            </View>
            <View style={S.candidateInfo}>
              <Text style={S.candidateName}>{fullName || "—"}</Text>
              <View style={S.metaRow}>
                <Text style={S.metaItem}>Email: {maskEmail(candidate.email)}</Text>
                {candidate.phone ? (
                  <Text style={S.metaItem}>Phone: {maskPhone(candidate.phone)}</Text>
                ) : null}
                {candidate.gender ? (
                  <Text style={S.metaItem}>
                    Gender: {candidate.gender.charAt(0).toUpperCase() + candidate.gender.slice(1)}
                  </Text>
                ) : null}
                {candidate.location ? (
                  <Text style={S.metaItem}>Location: {candidate.location}</Text>
                ) : null}
              </View>
            </View>
          </View>
        </View>

        {/* Overall summary */}
        <View style={S.card}>
          <Text style={S.sectionTitle}>Overall Assessment Summary</Text>

          <View style={S.statsRow}>
            <View style={S.statBox}>
              <Text style={S.statLabel}>Status</Text>
              <View style={S.statusPill}>
                <Text style={S.statusPillText}>{titleCase(data.status)}</Text>
              </View>
            </View>
            <View style={S.statBox}>
              <Text style={S.statLabel}>Percentage</Text>
              <Text style={S.statValue}>{data.percentage}%</Text>
            </View>
            <View style={S.statBox}>
              <Text style={S.statLabel}>Rounds</Text>
              <Text style={S.statValue}>{data.rounds.length}</Text>
            </View>
          </View>

          <View style={S.statsRow}>
            <View style={S.statBox}>
              <Text style={S.statLabel}>Malpractice Count</Text>
              <Text style={S.statValue}>{data.malpractice_count}</Text>
            </View>
            <View style={S.statBox}>
              <Text style={S.statLabel}>Started At</Text>
              <Text style={S.statValue}>{formatDate(data.started_at)}</Text>
            </View>
            <View style={S.statBox}>
              <Text style={S.statLabel}>Completed At</Text>
              <Text style={S.statValue}>{formatDate(data.completed_at)}</Text>
            </View>
          </View>
        </View>

        {/* Rounds + questions */}
        {rounds.map((round) => (
          <View key={round.round_number}>
            <Text style={S.roundTitle}>Round {round.round_number}</Text>
            {round.question_answers.map((qa, idx) => (
              <QuestionView key={qa.question_id} index={idx} qa={qa} />
            ))}
          </View>
        ))}

        {/* Footer */}
        <View style={S.footerContainer} fixed>
          <TalentiaLogo size={12} />
          <Text style={S.footer}>Talentia</Text>
        </View>
      </Page>
    </Document>
  );
}

// ── public API ────────────────────────────────────────────────────────────────

export async function generateAndDownloadPDF(
  data: CandidateSubmissionDetail,
  rounds: RoundResult[],
  roundName: string
): Promise<void> {
  const { candidate } = data;
  const slug =
    `${candidate.first_name} ${candidate.last_name}-${roundName}`.trim().toLowerCase() ||
    `candidate-${roundName}`;
  const blob = await pdf(<SubmissionReportDocument data={data} rounds={rounds} />).toBlob();
  downloadBlob(blob, `${slug}-report.pdf`);
}
