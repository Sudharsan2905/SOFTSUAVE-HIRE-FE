import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_MAX_DURATION_MS = 10_000;
const TIMESLICE_MS = 500;

interface UseMediaRingBufferOptions {
  stream: MediaStream | null;
  maxDurationMs?: number;
  mimeType?: string;
  videoBitsPerSecond?: number;
  audioBitsPerSecond?: number;
}

interface ForwardRecording {
  promise: Promise<Blob[]>;
  stopEarly: () => void;
}

interface UseMediaRingBufferReturn {
  snapshotRing: () => { blobs: Blob[]; mimeType: string } | null;
  startForwardRecording: (durationMs: number) => ForwardRecording;
  isRecording: boolean;
}

function pickSupportedMimeType(preferred: string): string {
  if (MediaRecorder.isTypeSupported(preferred)) return preferred;
  const isVideo = preferred.startsWith("video");
  const fallbacks = isVideo
    ? ["video/webm;codecs=vp8", "video/webm"]
    : ["audio/webm;codecs=opus", "audio/webm", "audio/ogg"];
  return fallbacks.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

export function useMediaRingBuffer({
  stream,
  maxDurationMs = DEFAULT_MAX_DURATION_MS,
  mimeType: preferredMime = "video/webm",
  videoBitsPerSecond,
  audioBitsPerSecond,
}: UseMediaRingBufferOptions): UseMediaRingBufferReturn {
  const chunksRef = useRef<{ blob: Blob; ts: number }[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const resolvedMimeRef = useRef<string>("");
  const initChunkRef = useRef<Blob | null>(null);

  // Stable refs used by startForwardRecording so it always sees the latest
  // values without those values being part of the useCallback dependency array.
  const streamRef = useRef<MediaStream | null>(null);
  const videoBitsRef = useRef(videoBitsPerSecond);
  const audioBitsRef = useRef(audioBitsPerSecond);

  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => { streamRef.current = stream; }, [stream]);
  useEffect(() => { videoBitsRef.current = videoBitsPerSecond; }, [videoBitsPerSecond]);
  useEffect(() => { audioBitsRef.current = audioBitsPerSecond; }, [audioBitsPerSecond]);

  useEffect(() => {
    if (!stream) return;

    const mime = pickSupportedMimeType(preferredMime);
    resolvedMimeRef.current = mime;

    const recorderOpts: MediaRecorderOptions = {};
    if (mime) recorderOpts.mimeType = mime;
    if (videoBitsPerSecond) recorderOpts.videoBitsPerSecond = videoBitsPerSecond;
    if (audioBitsPerSecond) recorderOpts.audioBitsPerSecond = audioBitsPerSecond;

    if (stream.getTracks().every((t) => t.readyState === "ended")) return;

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, recorderOpts);
    } catch {
      return;
    }

    recorderRef.current = recorder;
    chunksRef.current = [];
    initChunkRef.current = null;

    recorder.ondataavailable = (e) => {
      if (e.data.size === 0) return;
      const now = Date.now();
      if (!initChunkRef.current) initChunkRef.current = e.data;
      chunksRef.current.push({ blob: e.data, ts: now });
      const cutoff = now - maxDurationMs;
      while (chunksRef.current.length > 0 && chunksRef.current[0].ts < cutoff) {
        chunksRef.current.shift();
      }
    };

    try {
      recorder.start(TIMESLICE_MS);
    } catch {
      recorderRef.current = null;
      return;
    }
    setIsRecording(true);

    return () => {
      if (recorder.state !== "inactive") recorder.stop();
      recorderRef.current = null;
      chunksRef.current = [];
      initChunkRef.current = null;
      setIsRecording(false);
    };
  }, [stream, maxDurationMs, preferredMime, videoBitsPerSecond, audioBitsPerSecond]);

  const snapshotRing = useCallback((): { blobs: Blob[]; mimeType: string } | null => {
    if (!recorderRef.current) return null;
    const recentBlobs = chunksRef.current.map((c) => c.blob);
    const initChunk = initChunkRef.current;
    const blobs =
      initChunk && (recentBlobs.length === 0 || recentBlobs[0] !== initChunk)
        ? [initChunk, ...recentBlobs]
        : recentBlobs;
    return { blobs, mimeType: resolvedMimeRef.current };
  }, []);

  // Starts a FRESH MediaRecorder for the forward window so chunk[0] is always a
  // keyframe cluster. Chunks from the ongoing ring recorder are mid-stream P-frames
  // that reference keyframes the forward listener will never receive — not decodable.
  const startForwardRecording = useCallback((durationMs: number): ForwardRecording => {
    const currentStream = streamRef.current;
    if (!currentStream || currentStream.getTracks().every((t) => t.readyState === "ended")) {
      return { promise: Promise.resolve([]), stopEarly: () => {} };
    }

    const fwdChunks: Blob[] = [];
    let resolve!: (v: Blob[]) => void;
    const promise = new Promise<Blob[]>((res) => { resolve = res; });

    const opts: MediaRecorderOptions = {};
    const mime = resolvedMimeRef.current;
    if (mime) opts.mimeType = mime;
    if (videoBitsRef.current) opts.videoBitsPerSecond = videoBitsRef.current;
    if (audioBitsRef.current) opts.audioBitsPerSecond = audioBitsRef.current;

    let fwdRecorder: MediaRecorder | null = null;
    try {
      fwdRecorder = new MediaRecorder(currentStream, opts);
    } catch {
      resolve([]);
      return { promise, stopEarly: () => {} };
    }

    fwdRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) fwdChunks.push(e.data);
    };

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (fwdRecorder === null || fwdRecorder.state === "inactive") {
        resolve(fwdChunks);
      } else {
        fwdRecorder.onstop = () => resolve(fwdChunks);
        fwdRecorder.stop();
      }
    };

    const timer = setTimeout(finish, durationMs);
    fwdRecorder.start(TIMESLICE_MS);

    return {
      promise,
      stopEarly: () => {
        clearTimeout(timer);
        finish();
      },
    };
  }, []);

  return { snapshotRing, startForwardRecording, isRecording };
}
