import { useRef, useEffect, useCallback } from "react";

const BUFFER_SECONDS = 10;
const CHUNK_MS = 500;
const VIDEO_BITS_PER_SECOND = 1_000_000; // 1 Mbps — medium quality for screen recording

interface UseRecordingBufferOptions {
  stream: MediaStream | null;
  enabled: boolean;
}

export function useRecordingBuffer({ stream, enabled }: UseRecordingBufferOptions) {
  const chunksRef = useRef<{ blob: Blob; ts: number }[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  // Kept permanently so captureEvidence can always prepend the init segment.
  const initChunkRef = useRef<Blob | null>(null);
  // Real-time listeners receive post-event chunks from the SAME recorder.
  // Concatenating pre-event ring chunks + post-event listener chunks yields one
  // valid WebM — no second MediaRecorder, no duplicate EBML headers.
  const forwardListenersRef = useRef<Set<(blob: Blob) => void>>(new Set());
  const resolvedMimeRef = useRef<string>("");

  const startBuffer = useCallback(() => {
    if (!stream || recorderRef.current) return;

    let mimeType = "video/webm";
    if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9")) {
      mimeType = "video/webm;codecs=vp9";
    } else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8")) {
      mimeType = "video/webm;codecs=vp8";
    }

    try {
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: VIDEO_BITS_PER_SECOND,
      });
      recorderRef.current = recorder;
      resolvedMimeRef.current = mimeType;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          const now = performance.now();
          initChunkRef.current ??= e.data;
          chunksRef.current.push({ blob: e.data, ts: now });
          const cutoff = now - BUFFER_SECONDS * 1000;
          chunksRef.current = chunksRef.current.filter((c) => c.ts >= cutoff);
          for (const listener of forwardListenersRef.current) {
            listener(e.data);
          }
        }
      };

      recorder.start(CHUNK_MS);
    } catch {
      /* MediaRecorder not supported */
    }
  }, [stream]);

  const stopBuffer = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    initChunkRef.current = null;
  }, []);

  // Capture evidence: last BUFFER_SECONDS before event + next BUFFER_SECONDS after.
  // All chunks come from the same MediaRecorder → single valid WebM container.
  const captureEvidence = useCallback((): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      if (!recorderRef.current) {
        reject(new Error("Recorder not active"));
        return;
      }

      // Pre-event: ring buffer snapshot with init segment prepended if evicted
      const recentBlobs = chunksRef.current.map((c) => c.blob);
      const initChunk = initChunkRef.current;
      const preBlobs =
        initChunk && (recentBlobs.length === 0 || recentBlobs[0] !== initChunk)
          ? [initChunk, ...recentBlobs]
          : [...recentBlobs];

      // Post-event: forward chunks from the same recorder via listener
      const fwdChunks: Blob[] = [];
      let done = false;

      const listener = (blob: Blob) => {
        if (!done) fwdChunks.push(blob);
      };
      forwardListenersRef.current.add(listener);

      setTimeout(() => {
        done = true;
        forwardListenersRef.current.delete(listener);

        const allBlobs = [...preBlobs, ...fwdChunks];
        if (allBlobs.length === 0) {
          reject(new Error("No data"));
          return;
        }
        const mime = resolvedMimeRef.current || "video/webm";
        resolve(new Blob(allBlobs, { type: mime }));
      }, BUFFER_SECONDS * 1000);
    });
  }, []);

  useEffect(() => {
    if (enabled && stream) startBuffer();
    return () => stopBuffer();
  }, [enabled, stream, startBuffer, stopBuffer]);

  return { captureEvidence };
}
