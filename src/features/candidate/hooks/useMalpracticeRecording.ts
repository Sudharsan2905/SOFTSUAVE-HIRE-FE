import { useCallback, useEffect, useRef } from "react";
import api from "../../../utils/api";

// ─── Constants ────────────────────────────────────────────────────────────────

const RING_BUFFER_MS = 5_000; // rolling pre-event window
const FORWARD_RECORD_MS = 20_000; // post-event capture window per event
const TIMESLICE_MS = 250; // MediaRecorder chunk interval

// ─── Types ────────────────────────────────────────────────────────────────────

// Listeners are keyed by a unique Symbol (pending phase) or by eventIndex
// (active phase). Using a union avoids two separate Maps while still allowing
// the key to be re-typed from symbol → number at commit time.
type ListenerKey = symbol | number;

interface CaptureState {
  preBlobs: Blob[];
  postBlobs: Blob[]; // same array reference held by the listener
  isVideo: boolean;
  mimeType: string;
}

interface ActiveEvent extends CaptureState {
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
   * Immediately snapshots the ring buffer (pre-event footage) and registers a
   * forward listener on the main recorder. Returns an opaque capture ID.
   */
  prepareCapture: () => symbol;
  /**
   * Call AFTER the POST returns successfully with an eventIndex.
   * Re-keys the listener from the opaque ID to eventIndex and starts the 20-second
   * forward countdown.
   */
  commitCapture: (id: symbol, eventIndex: number) => void;
  /**
   * Call if the POST fails or eventIndex is invalid.
   * Cleans up the listener and discards buffered data.
   */
  abortCapture: (id: symbol) => void;
}

// ─── MIME selection ───────────────────────────────────────────────────────────

function pickMimeType(isVideo: boolean): string {
  if (isVideo) {
    const candidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
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
  // Main recorder state
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<{ blob: Blob; ts: number }[]>([]);
  // Kept permanently — prepended to any event snapshot so the WebM container
  // header is always present, even after old chunks age out of the ring.
  const initChunkRef = useRef<Blob | null>(null);
  const isVideoRef = useRef(false);
  const resolvedMimeRef = useRef<string>("");

  // Captures that have been prepared but not yet committed (POST in-flight)
  const pendingRef = useRef<Map<symbol, CaptureState>>(new Map());
  // Captures that have been committed and are accumulating forward footage
  const activeEventsRef = useRef<Map<number, ActiveEvent>>(new Map());
  // All active chunk listeners, keyed by symbol (pending) or eventIndex (active)
  const listenersRef = useRef<Map<ListenerKey, (blob: Blob) => void>>(new Map());

  // ── Upload ────────────────────────────────────────────────────────────────
  const uploadCapture = useCallback(
    async (
      eventIndex: number,
      preBlobs: Blob[],
      postBlobs: Blob[],
      isVideo: boolean,
      mimeType: string
    ): Promise<void> => {
      const allBlobs = [...preBlobs, ...postBlobs];
      if (allBlobs.length === 0) return;

      const blob = new Blob(allBlobs, {
        type: mimeType || (isVideo ? "video/webm" : "audio/webm"),
      });
      const fd = new FormData();
      fd.append(isVideo ? "video_chunk" : "audio_clip", blob, isVideo ? "clip.webm" : "audio.webm");

      await api.post(
        `/api/candidate/submission/${submissionId}/malpractice/${eventIndex}/media`,
        fd,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
    },
    [submissionId]
  );

  // ── Finalize active event (on 20 s timeout or early flush) ───────────────
  const finalizeActive = useCallback(
    async (eventIndex: number): Promise<void> => {
      const ev = activeEventsRef.current.get(eventIndex);
      if (!ev) return; // already finalized (idempotent)

      clearTimeout(ev.timeoutId);
      listenersRef.current.delete(eventIndex);
      activeEventsRef.current.delete(eventIndex);

      try {
        await uploadCapture(eventIndex, ev.preBlobs, ev.postBlobs, ev.isVideo, ev.mimeType);
      } catch (err) {
        console.warn(`Malpractice media upload failed for event ${eventIndex}:`, err);
      }
    },
    [uploadCapture]
  );

  // ── Main recorder: unified stream + ring buffer ───────────────────────────
  useEffect(() => {
    const wantsScreen = hasScreenMonitoring && !!screenStream;
    const wantsAudio = hasAudioMonitoring && !!audioStream;
    if (!wantsScreen && !wantsAudio) return;

    const tracks: MediaStreamTrack[] = [];
    if (wantsScreen) {
      screenStream!
        .getVideoTracks()
        .filter((t) => t.readyState === "live")
        .forEach((t) => tracks.push(t));
    }
    if (wantsAudio) {
      audioStream!
        .getAudioTracks()
        .filter((t) => t.readyState === "live")
        .forEach((t) => tracks.push(t));
    }
    if (tracks.length === 0) return;

    const isVideo = wantsScreen;
    isVideoRef.current = isVideo;
    const mimeType = pickMimeType(isVideo);
    resolvedMimeRef.current = mimeType;

    // Reset ring state for this recorder session
    chunksRef.current = [];
    initChunkRef.current = null;

    const combined = new MediaStream(tracks);
    const opts: MediaRecorderOptions = {};
    if (mimeType) opts.mimeType = mimeType;
    if (isVideo) opts.videoBitsPerSecond = 1_500_000;
    if (wantsAudio) opts.audioBitsPerSecond = 128_000;

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(combined, opts);
    } catch {
      return;
    }
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size === 0) return;
      const ts = Date.now();

      // Keep the very first chunk so WebM container headers are always available
      if (!initChunkRef.current) initChunkRef.current = e.data;

      // Rolling ring: prune chunks older than RING_BUFFER_MS
      chunksRef.current.push({ blob: e.data, ts });
      const cutoff = ts - RING_BUFFER_MS;
      chunksRef.current = chunksRef.current.filter((c) => c.ts >= cutoff);

      // Fan out to all active event listeners (pending + active events)
      for (const listener of listenersRef.current.values()) {
        listener(e.data);
      }
    };

    recorder.start(TIMESLICE_MS);

    return () => {
      if (recorder.state !== "inactive") recorder.stop();
      recorderRef.current = null;
    };
  }, [screenStream, audioStream, hasScreenMonitoring, hasAudioMonitoring]);

  // ── Public API ────────────────────────────────────────────────────────────

  const prepareCapture = useCallback((): symbol => {
    const id = Symbol();

    // Build pre-event snapshot from ring buffer.
    // Always prepend initChunkRef so the WebM container header is present —
    // skip if initChunk is already the first ring entry (within first 5 s).
    const recentBlobs = chunksRef.current.map((c) => c.blob);
    const initChunk = initChunkRef.current;
    const preBlobs: Blob[] =
      initChunk && (recentBlobs.length === 0 || recentBlobs[0] !== initChunk)
        ? [initChunk, ...recentBlobs]
        : [...recentBlobs];

    const postBlobs: Blob[] = [];
    // Share postBlobs array by reference with the listener so chunks
    // accumulated during the POST are captured without a second copy step.
    const listener = (blob: Blob) => {
      postBlobs.push(blob);
    };

    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      listenersRef.current.set(id, listener);
    }

    pendingRef.current.set(id, {
      preBlobs,
      postBlobs,
      isVideo: isVideoRef.current,
      mimeType: resolvedMimeRef.current,
    });

    return id;
  }, []);

  const commitCapture = useCallback(
    (id: symbol, eventIndex: number): void => {
      const pending = pendingRef.current.get(id);
      if (!pending) return;
      pendingRef.current.delete(id);

      // Re-key the listener: symbol → eventIndex, keeping the shared postBlobs array
      const existingListener = listenersRef.current.get(id);
      if (existingListener) {
        listenersRef.current.delete(id);
        listenersRef.current.set(eventIndex, existingListener);
      }

      const timeoutId = setTimeout(() => {
        void finalizeActive(eventIndex);
      }, FORWARD_RECORD_MS);

      activeEventsRef.current.set(eventIndex, {
        ...pending,
        eventIndex,
        timeoutId,
      });
    },
    [finalizeActive]
  );

  const abortCapture = useCallback((id: symbol): void => {
    pendingRef.current.delete(id);
    listenersRef.current.delete(id);
  }, []);

  // ── Flush all in-flight captures on unmount / page unload ─────────────────
  // Active events are uploaded immediately with whatever footage has been
  // collected — partial uploads are accepted as best-effort evidence.
  // Pending captures (POST in-flight) are discarded since we have no eventIndex.
  useEffect(() => {
    const flushAll = () => {
      // Drop pending (no eventIndex — cannot upload)
      for (const id of pendingRef.current.keys()) {
        listenersRef.current.delete(id);
      }
      pendingRef.current.clear();

      // Upload active events immediately
      const events = [...activeEventsRef.current.values()];
      activeEventsRef.current.clear();
      listenersRef.current.clear();

      for (const ev of events) {
        clearTimeout(ev.timeoutId);
        void uploadCapture(ev.eventIndex, ev.preBlobs, ev.postBlobs, ev.isVideo, ev.mimeType).catch(
          () => {}
        );
      }
    };

    window.addEventListener("beforeunload", flushAll);
    return () => {
      window.removeEventListener("beforeunload", flushAll);
      flushAll();
    };
  }, [uploadCapture]);

  return { prepareCapture, commitCapture, abortCapture };
}
