import { useCallback, useEffect, useRef } from "react";
import api from "../../../utils/api";
import { API_ENDPOINTS } from "@/constants/api";
import { LOCAL_STORAGE_KEYS } from "@/constants/storage";

// ─── Constants ────────────────────────────────────────────────────────────────

const FORWARD_RECORD_MS = 20_000; // post-event capture window per event
const TIMESLICE_MS = 250; // MediaRecorder chunk interval
const UPLOAD_ATTEMPTS = 3;
const UPLOAD_RETRY_BASE_MS = 1_000;
const KEEPALIVE_MAX_BYTES = 60_000; // browsers cap keepalive request bodies at 64 KiB

// ─── Types ────────────────────────────────────────────────────────────────────

interface CaptureSession {
  recorder: MediaRecorder | null;
  blobs: Blob[];
  isVideo: boolean;
  mimeType: string;
}

interface ActiveEvent extends CaptureSession {
  eventIndex: number;
  timeoutId: ReturnType<typeof setTimeout>;
}

export interface UseMalpracticeRecordingOptions {
  submissionId: string;
  /** Live screen-capture stream, or null when screen monitoring is not active. */
  screenStream: MediaStream | null;
  /** Live microphone stream, or null when audio monitoring is not active. */
  audioStream: MediaStream | null;
  /** True when tab_monitoring or screenshot_enabled is on. */
  hasScreenMonitoring: boolean;
  /** True when audio_monitoring is on. */
  hasAudioMonitoring: boolean;
}

export interface UseMalpracticeRecordingReturn {
  /**
   * Call BEFORE posting the malpractice violation to the server.
   * Starts a dedicated fresh MediaRecorder for this event so the resulting
   * clip has sequential timestamps from T=0 and is always playable.
   * Returns an opaque capture ID.
   */
  prepareCapture: () => symbol;
  /**
   * Call AFTER the POST returns successfully with an eventIndex.
   * Associates the capture with the event and starts the 20-second forward countdown.
   */
  commitCapture: (id: symbol, eventIndex: number) => void;
  /**
   * Call if the POST fails or eventIndex is invalid.
   * Stops the dedicated recorder and discards buffered data.
   */
  abortCapture: (id: symbol) => void;
  /** True while any committed clip is still recording/uploading. */
  hasActiveCaptures: () => boolean;
  /**
   * Finalise every in-flight clip NOW and wait (bounded by `maxMs`) for the uploads.
   * Used before navigating away on a terminating violation so the most important
   * evidence is not lost with the unmounting page.
   */
  flushActiveCaptures: (maxMs?: number) => Promise<void>;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Fire-and-forget upload that survives page unload (fetch keepalive). */
function uploadKeepalive(url: string, fd: FormData, token: string | null, bodyBytes: number): void {
  if (bodyBytes > KEEPALIVE_MAX_BYTES) return; // would be rejected; the retry path covers unmount
  try {
    void fetch(url, {
      method: "POST",
      body: fd,
      keepalive: true,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }).catch(() => undefined);
  } catch {
    /* best effort */
  }
}

// ─── MIME selection ───────────────────────────────────────────────────────────

function pickMimeType(isVideo: boolean, hasAudio: boolean): string {
  if (isVideo) {
    // Only declare the Opus codec when audio tracks are actually present.
    // Using codecs=vp9,opus on a video-only stream produces a WebM where the
    // Tracks header declares an audio track but no audio blocks exist —
    // strict players reject this as malformed and refuse to play the file.
    const candidates = hasAudio
      ? ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
      : ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
    return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
  }
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg"];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMalpracticeRecording({
  submissionId,
  screenStream,
  audioStream,
  hasScreenMonitoring,
  hasAudioMonitoring,
}: UseMalpracticeRecordingOptions): UseMalpracticeRecordingReturn {
  // Current stream configuration — updated whenever streams change
  const currentTracksRef = useRef<MediaStreamTrack[]>([]);
  const isVideoRef = useRef(false);
  const wantsAudioRef = useRef(false);
  const resolvedMimeRef = useRef<string>("");

  // Captures pending a POST response (opaque symbol → session)
  const pendingRef = useRef<Map<symbol, CaptureSession>>(new Map());
  // Captures committed and accumulating footage (captureId symbol → session + timer).
  // Keyed by the capture symbol (not eventIndex) so two rapid violations can never
  // overwrite each other even if the server somehow returns the same event_index.
  const activeEventsRef = useRef<Map<symbol, ActiveEvent>>(new Map());

  // ── Track current stream configuration ───────────────────────────────────
  useEffect(() => {
    const wantsScreen = hasScreenMonitoring && !!screenStream;
    const wantsAudio = hasAudioMonitoring && !!audioStream;

    const tracks: MediaStreamTrack[] = [];
    if (wantsScreen && screenStream) {
      screenStream
        .getVideoTracks()
        .filter((t) => t.readyState === "live")
        .forEach((t) => tracks.push(t));
    }
    if (wantsAudio && audioStream) {
      audioStream
        .getAudioTracks()
        .filter((t) => t.readyState === "live")
        .forEach((t) => tracks.push(t));
    }

    const isVideo = wantsScreen;
    const mimeType = pickMimeType(isVideo, wantsAudio);

    currentTracksRef.current = tracks;
    isVideoRef.current = isVideo;
    wantsAudioRef.current = wantsAudio;
    resolvedMimeRef.current = mimeType;

    return () => {
      currentTracksRef.current = [];
    };
  }, [screenStream, audioStream, hasScreenMonitoring, hasAudioMonitoring]);

  // ── Upload ────────────────────────────────────────────────────────────────
  const uploadCapture = useCallback(
    async (
      eventIndex: number,
      blobs: Blob[],
      isVideo: boolean,
      mimeType: string
    ): Promise<void> => {
      if (blobs.length === 0) return;

      const blob = new Blob(blobs, {
        type: mimeType || (isVideo ? "video/webm" : "audio/webm"),
      });
      const fd = new FormData();
      fd.append(isVideo ? "video_chunk" : "audio_clip", blob, isVideo ? "clip.webm" : "audio.webm");

      const url = API_ENDPOINTS.CANDIDATE.SUBMISSION_MALPRACTICE_MEDIA(submissionId, eventIndex);
      let lastErr: unknown;
      for (let attempt = 0; attempt < UPLOAD_ATTEMPTS; attempt += 1) {
        try {
          await api.post(url, fd, { headers: { "Content-Type": "multipart/form-data" } });
          return;
        } catch (err) {
          lastErr = err;
          const status = (err as { response?: { status?: number } })?.response?.status;
          if (status !== undefined && status < 500 && status !== 408 && status !== 429) break;
          if (attempt < UPLOAD_ATTEMPTS - 1) await sleep(UPLOAD_RETRY_BASE_MS * 2 ** attempt);
        }
      }
      throw lastErr;
    },
    [submissionId]
  );

  // ── Finalize an active event (20 s timeout or early flush) ────────────────
  const finalizeActive = useCallback(
    async (captureId: symbol): Promise<void> => {
      const ev = activeEventsRef.current.get(captureId);
      if (!ev) return; // already finalized (idempotent)

      clearTimeout(ev.timeoutId);
      activeEventsRef.current.delete(captureId);

      // Stop the dedicated recorder and wait for its final ondataavailable
      if (ev.recorder && ev.recorder.state !== "inactive") {
        const rec = ev.recorder;
        await new Promise<void>((resolve) => {
          rec.addEventListener("stop", () => resolve(), { once: true });
          rec.stop();
        });
      }

      try {
        await uploadCapture(ev.eventIndex, ev.blobs, ev.isVideo, ev.mimeType);
      } catch (err) {
        console.warn(`Malpractice media upload failed for event ${ev.eventIndex}:`, err);
      }
    },
    [uploadCapture]
  );

  // ── Start a dedicated recorder for one violation clip ─────────────────────
  // Each violation gets its OWN MediaRecorder starting fresh at T=0.
  // This produces a sequential WebM with no timestamp gaps — reliably playable
  // by all players. The ring-buffer/listener approach produced clips where an
  // old initChunk (T=0) was prepended to ring chunks (T=now-5s), creating a
  // ~5-second gap that strict decoders reject as malformed.
  const startCaptureSession = useCallback((): CaptureSession => {
    const isVideo = isVideoRef.current;
    const mimeType = resolvedMimeRef.current;
    const blobs: Blob[] = [];

    const liveTracks = currentTracksRef.current.filter((t) => t.readyState === "live");
    if (liveTracks.length === 0) {
      return { recorder: null, blobs, isVideo, mimeType };
    }

    const captureStream = new MediaStream(liveTracks);
    const opts: MediaRecorderOptions = {};
    if (mimeType) opts.mimeType = mimeType;
    if (isVideo) opts.videoBitsPerSecond = 1_500_000;
    if (wantsAudioRef.current) opts.audioBitsPerSecond = 128_000;

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(captureStream, opts);
    } catch {
      return { recorder: null, blobs, isVideo, mimeType };
    }

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) blobs.push(e.data);
    };
    recorder.start(TIMESLICE_MS);

    return { recorder, blobs, isVideo, mimeType };
  }, []);

  // ── Public API ────────────────────────────────────────────────────────────

  const prepareCapture = useCallback((): symbol => {
    const id = Symbol();
    const session = startCaptureSession();
    pendingRef.current.set(id, session);
    return id;
  }, [startCaptureSession]);

  const commitCapture = useCallback(
    (id: symbol, eventIndex: number): void => {
      const pending = pendingRef.current.get(id);
      if (!pending) return;
      pendingRef.current.delete(id);

      const timeoutId = setTimeout(() => {
        void finalizeActive(id);
      }, FORWARD_RECORD_MS);

      // Use the capture symbol (id) as the map key so each violation always
      // gets its own slot, even when multiple events fire within 20 seconds.
      activeEventsRef.current.set(id, {
        ...pending,
        eventIndex,
        timeoutId,
      });
    },
    [finalizeActive]
  );

  const abortCapture = useCallback((id: symbol): void => {
    const session = pendingRef.current.get(id);
    if (session?.recorder && session.recorder.state !== "inactive") {
      session.recorder.stop();
    }
    pendingRef.current.delete(id);
  }, []);

  // ── Flush all in-flight captures on unmount / page unload ─────────────────
  useEffect(() => {
    const flushAll = () => {
      // Stop and discard pending sessions (no eventIndex → cannot upload)
      for (const session of pendingRef.current.values()) {
        if (session.recorder && session.recorder.state !== "inactive") {
          session.recorder.stop();
        }
      }
      pendingRef.current.clear();

      // Upload active events with whatever footage has accumulated
      const events = [...activeEventsRef.current.values()];
      activeEventsRef.current.clear();

      for (const ev of events) {
        clearTimeout(ev.timeoutId);
        // Stop the recorder (best-effort; upload whatever blobs were collected so far)
        if (ev.recorder && ev.recorder.state !== "inactive") ev.recorder.stop();
        void uploadCapture(ev.eventIndex, ev.blobs, ev.isVideo, ev.mimeType).catch(() => undefined);
      }
    };

    // On a real page unload an axios request is cancelled with the page; use a keepalive
    // fetch for whatever has been recorded so far.
    const onBeforeUnload = () => {
      for (const session of pendingRef.current.values()) {
        if (session.recorder && session.recorder.state !== "inactive") session.recorder.stop();
      }
      pendingRef.current.clear();
      const events = [...activeEventsRef.current.values()];
      activeEventsRef.current.clear();
      const token = sessionStorage.getItem(LOCAL_STORAGE_KEYS.ACCESS_TOKEN);
      for (const ev of events) {
        clearTimeout(ev.timeoutId);
        if (ev.recorder && ev.recorder.state !== "inactive") ev.recorder.stop();
        if (ev.blobs.length === 0) continue;
        const blob = new Blob(ev.blobs, {
          type: ev.mimeType || (ev.isVideo ? "video/webm" : "audio/webm"),
        });
        const fd = new FormData();
        fd.append(
          ev.isVideo ? "video_chunk" : "audio_clip",
          blob,
          ev.isVideo ? "clip.webm" : "audio.webm"
        );
        uploadKeepalive(
          API_ENDPOINTS.CANDIDATE.SUBMISSION_MALPRACTICE_MEDIA(submissionId, ev.eventIndex),
          fd,
          token,
          blob.size
        );
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      flushAll();
    };
  }, [uploadCapture, submissionId]);

  const hasActiveCaptures = useCallback(
    () => activeEventsRef.current.size > 0 || pendingRef.current.size > 0,
    []
  );

  const flushActiveCaptures = useCallback(
    async (maxMs = 8_000): Promise<void> => {
      const ids = [...activeEventsRef.current.keys()];
      if (ids.length === 0) return;
      await Promise.race([Promise.all(ids.map((id) => finalizeActive(id))), sleep(maxMs)]);
    },
    [finalizeActive]
  );

  return { prepareCapture, commitCapture, abortCapture, hasActiveCaptures, flushActiveCaptures };
}
