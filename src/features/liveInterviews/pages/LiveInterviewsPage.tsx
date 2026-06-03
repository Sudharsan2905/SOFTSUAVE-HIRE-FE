import React, { useState, useEffect, useCallback, useRef } from "react";
import styles from "./LiveInterviewsPage.module.css";
import { Header } from "@/components/layout/Header";
import { FilterBar } from "@/components/shared/FilterBar";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { Spinner } from "@/components/ui/Spinner";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { IconLiveInterview, IconCamera, IconEye, IconTime } from "@/assets/icons";
import { api } from "@/utils/api";
import { useDebounce } from "@/hooks/useDebounce";
import { usePagination } from "@/hooks/usePagination";
import { PaginationMeta, Submission, ViewMode, SortOrder } from "@/types";
import { formatDateTime, getInitials, getAvatarColor, getFullName } from "@/utils/helpers";

const MONITORING_OPTIONS = [
  { value: "monitoring", label: "Monitoring Mode" },
  { value: "normal", label: "Normal Mode" },
];

export default function LiveInterviewsPage() {
  const [sessions, setSessions] = useState<Submission[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [monitoringType, setMonitoringType] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [showDetail, setShowDetail] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Submission | null>(null);
  const { page, pageSize, goToPage, changePageSize } = usePagination();
  const debouncedSearch = useDebounce(search, 300);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
        sort_order: sortOrder,
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(monitoringType && { monitoring_type: monitoringType }),
      });
      const { data } = await api.get(`/api/candidate/live-interviews?${params}`);
      setSessions(data.data?.live_interviews || []);
      setMeta(data.data?.pagination || null);
    } catch {
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, sortOrder, debouncedSearch, monitoringType]);

  useEffect(() => {
    fetchSessions();
    pollRef.current = setInterval(fetchSessions, 15000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchSessions]);

  // S3358: extract content decision to a variable before return
  let pageContent: React.ReactNode;
  if (isLoading) {
    pageContent = (
      <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
        <Spinner size="lg" />
      </div>
    );
  } else if (sessions.length === 0) {
    pageContent = (
      <div className={styles.empty}>
        <IconLiveInterview size={48} color="var(--text-tertiary)" />
        <p>No active interviews right now</p>
        <span style={{ fontSize: 12 }}>This page auto-refreshes every 15 seconds</span>
      </div>
    );
  } else {
    pageContent = (
      <>
        <div className={viewMode === "grid" ? styles.grid : styles.list}>
          {sessions.map((session) => {
            const candidate = (
              session as unknown as {
                candidate?: { first_name?: string; last_name?: string; email?: string };
              }
            ).candidate;
            const assessment = (
              session as unknown as { assessment?: { name?: string; accessibility?: string } }
            ).assessment;
            const name = candidate
              ? getFullName(candidate as { first_name: string; last_name?: string })
              : "Unknown";
            const isMonitoring = assessment?.accessibility === "monitoring";

            return (
              <button
                key={session.id}
                type="button"
                className={styles.card}
                onClick={() => {
                  setSelectedSession(session);
                  setShowDetail(true);
                }}
              >
                <div className={styles.cardTop}>
                  <div className={styles.avatarArea}>
                    {isMonitoring ? (
                      <div className={styles.cameraFeed}>
                        <IconCamera size={20} color="var(--text-tertiary)" />
                      </div>
                    ) : (
                      <div className={styles.avatar} style={{ background: getAvatarColor(name) }}>
                        {getInitials(name)}
                      </div>
                    )}
                    <div className={styles.liveIndicator} />
                  </div>
                  <div className={styles.candidateInfo}>
                    <p className={styles.candidateName}>{name}</p>
                    <p className={styles.candidateEmail}>{candidate?.email}</p>
                  </div>
                  <Badge variant={isMonitoring ? "accent" : "default"}>
                    {isMonitoring ? "Monitored" : "Normal"}
                  </Badge>
                </div>
                <div className={styles.assessmentName}>{assessment?.name}</div>
                <div className={styles.metaRow}>
                  <span>
                    <IconTime size={12} /> Round {session.current_round}
                  </span>
                  <span>
                    <IconEye size={12} /> {session.screenshots?.length || 0} screenshots
                  </span>
                  <span>Started {formatDateTime(session.started_at)}</span>
                </div>
              </button>
            );
          })}
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
  }

  return (
    <div>
      <Header
        title="Live Interviews"
        subtitle={`${meta?.total ?? 0} candidates currently attending`}
      />

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        sortBy="started_at"
        sortOrder={sortOrder}
        onSortOrderToggle={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onRefresh={fetchSessions}
      >
        <div style={{ width: 180 }}>
          <Select
            value={monitoringType}
            onChange={setMonitoringType}
            placeholder="All Modes"
            options={[{ value: "", label: "All Modes" }, ...MONITORING_OPTIONS]}
          />
        </div>
      </FilterBar>

      {pageContent}

      <Modal
        isOpen={showDetail}
        onClose={() => setShowDetail(false)}
        title="Session Details"
        size="lg"
      >
        {selectedSession && (
          <div>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 16 }}>
              Screenshots taken: {selectedSession.screenshots?.length || 0}
            </p>
            <div className={styles.screenshotGrid}>
              {/* S6479: use timestamp-based key instead of array index */}
              {(selectedSession.screenshots || []).map((s, i) => (
                <div key={s.taken_at ?? i} className={styles.screenshot}>
                  <div className={styles.screenshotPlaceholder}>Screenshot {i + 1}</div>
                  <p
                    style={{
                      fontSize: 11,
                      color: "var(--text-tertiary)",
                      textAlign: "center",
                      marginTop: 4,
                    }}
                  >
                    {formatDateTime(s.taken_at)}
                  </p>
                </div>
              ))}
              {(!selectedSession.screenshots || selectedSession.screenshots.length === 0) && (
                <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>No screenshots yet</p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
