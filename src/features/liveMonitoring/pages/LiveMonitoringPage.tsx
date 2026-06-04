import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Header } from '@/components/layout/Header';
import { FilterBar } from '@/components/shared/FilterBar';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { IconLiveInterview } from '@/assets/icons';
import api from '@/utils/api';
import { useDebounce } from '@/hooks/useDebounce';
import { STATUS_COLORS } from '@/constants/statusColors';
import { getFullName, getInitials, getAvatarColor, formatDateTime } from '@/utils/helpers';
import { useAppSelector } from '@/store/hooks';
import { useLiveKitViewer } from '@/features/candidate/hooks/useLiveKit';
import { CandidateStreamPanel } from '../components/CandidateStreamPanel';

import styles from './LiveMonitoringPage.module.css';

interface LiveSession {
  submission_id: string;
  candidate_name: string;
  assessment_name: string;
  workspace_id: string;
  status: string;
  current_round: number;
  started_at: string;
  malpractice_count: number;
}

// ─── Admin WebSocket hook (global cross-workspace events) ────────────────────

function useAdminWebSocket(onEvent: (event: Record<string, unknown>) => void) {
  const token = useAppSelector((s) => s.auth.accessToken);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!token) return;
    const wsBase = import.meta.env.VITE_WS_URL as string ?? 'ws://localhost:8000';
    const ws = new WebSocket(`${wsBase}/api/ws/admin?token=${token}`);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data as string) as Record<string, unknown>;
        onEvent(data);
      } catch {
        // ignore malformed frames
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [token, onEvent]);
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function LiveMonitoringPage() {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSession, setSelectedSession] = useState<LiveSession | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  // ── Initial data fetch ───────────────────────────────────────────────────
  const fetchSessions = useCallback(async () => {
    try {
      const { data } = await api.get('/api/candidate/live-interviews');
      setSessions((data.data?.live_interviews as LiveSession[]) ?? []);
    } catch {
      // handled gracefully — WS updates will keep list fresh
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

  // ── Admin WebSocket — real-time updates ──────────────────────────────────
  const handleWsEvent = useCallback((event: Record<string, unknown>) => {
    const type = event.type as string;

    if (type === 'candidate_connected') {
      // Re-fetch to get full session object (only submission_id arrives via WS)
      void fetchSessions();
    }

    if (type === 'candidate_disconnected') {
      const sid = event.submission_id as string;
      setSessions((prev) => prev.filter((s) => s.submission_id !== sid));
    }

    if (type === 'submission_status_change') {
      const sid = event.submission_id as string;
      const status = event.status as string;
      setSessions((prev) =>
        prev.map((s) => (s.submission_id === sid ? { ...s, status } : s)),
      );
    }

    if (type === 'malpractice_event') {
      const sid = event.submission_id as string;
      setSessions((prev) =>
        prev.map((s) =>
          s.submission_id === sid
            ? { ...s, malpractice_count: (s.malpractice_count ?? 0) + 1 }
            : s,
        ),
      );
    }
  }, [fetchSessions]);

  useAdminWebSocket(handleWsEvent);

  // ── LiveKit viewer ───────────────────────────────────────────────────────
  const { screenTrack, isConnected: lkConnected } = useLiveKitViewer({
    workspaceId: selectedSession?.workspace_id ?? null,
    targetSubmissionId: selectedSession?.submission_id ?? null,
  });

  // ── Admin actions ────────────────────────────────────────────────────────
  const handleTerminate = useCallback(async (submissionId: string) => {
    try {
      await api.post(`/api/candidate/submission/${submissionId}/terminate`, {
        reason: 'Admin terminated from live monitoring',
      });
      setSessions((prev) => prev.filter((s) => s.submission_id !== submissionId));
      if (selectedSession?.submission_id === submissionId) setSelectedSession(null);
    } catch {
      // error handled by API interceptor toast
    }
  }, [selectedSession]);

  const handleResume = useCallback(async (submissionId: string) => {
    try {
      await api.post(`/api/candidate/submission/${submissionId}/resume`);
      setSessions((prev) =>
        prev.map((s) =>
          s.submission_id === submissionId ? { ...s, status: 'in_progress' } : s,
        ),
      );
    } catch {
      // error handled by API interceptor toast
    }
  }, []);

  // ── Filtering ────────────────────────────────────────────────────────────
  const filtered = sessions.filter((s) => {
    if (!debouncedSearch) return true;
    const q = debouncedSearch.toLowerCase();
    return (
      s.candidate_name.toLowerCase().includes(q) ||
      s.assessment_name.toLowerCase().includes(q)
    );
  });

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className={styles.pageRoot}>
      <div className={`${styles.listPanel} ${selectedSession ? styles.listPanelNarrow : ''}`}>
        <Header
          title="Live Monitoring"
          subtitle={`${filtered.length} candidate${filtered.length !== 1 ? 's' : ''} currently attending`}
        />

        <FilterBar
          search={search}
          onSearchChange={setSearch}
          onRefresh={fetchSessions}
          sortBy=""
          sortOrder="asc"
          onSortOrderToggle={() => {}}
        />

        {isLoading ? (
          <div className={styles.centered}>
            <Spinner size="lg" />
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>
            <IconLiveInterview size={48} color="var(--text-tertiary)" />
            <p>No active interviews right now</p>
            <span>Updates are pushed in real time via WebSocket</span>
          </div>
        ) : (
          <div className={styles.sessionList}>
            {filtered.map((session) => {
              const statusColor = STATUS_COLORS[session.status as keyof typeof STATUS_COLORS];
              const isSelected = selectedSession?.submission_id === session.submission_id;
              const avatarBg = getAvatarColor(session.candidate_name);

              return (
                <button
                  key={session.submission_id}
                  type="button"
                  className={`${styles.sessionCard} ${isSelected ? styles.sessionCardSelected : ''}`}
                  onClick={() => setSelectedSession(isSelected ? null : session)}
                >
                  <div className={styles.cardLeft}>
                    <div className={styles.avatar} style={{ background: avatarBg }}>
                      {getInitials(session.candidate_name)}
                    </div>
                    <div className={styles.liveRing} />
                  </div>
                  <div className={styles.cardBody}>
                    <p className={styles.name}>{session.candidate_name}</p>
                    <p className={styles.assessment}>{session.assessment_name}</p>
                    <p className={styles.meta}>
                      Round {session.current_round} · Started {formatDateTime(session.started_at)}
                      {session.malpractice_count > 0 && (
                        <span className={styles.malBadge}>
                          ⚠ {session.malpractice_count} violation{session.malpractice_count !== 1 ? 's' : ''}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className={styles.cardRight}>
                    <Badge variant={statusColor?.variant ?? 'default'}>
                      {statusColor?.label ?? session.status}
                    </Badge>
                    <span className={styles.watchLabel}>
                      {isSelected ? 'Watching' : 'Watch'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedSession && (
        <div className={styles.streamPanel}>
          <CandidateStreamPanel
            session={selectedSession}
            screenTrack={screenTrack}
            isConnected={lkConnected}
            onTerminate={handleTerminate}
            onResume={handleResume}
            onClose={() => setSelectedSession(null)}
          />
        </div>
      )}
    </div>
  );
}
