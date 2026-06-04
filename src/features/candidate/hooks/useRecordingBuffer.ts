import { useRef, useEffect, useCallback } from 'react';

const BUFFER_SECONDS = 10;
const CHUNK_MS = 1000; // 1-second chunks

interface UseRecordingBufferOptions {
  stream: MediaStream | null; // combined screen+audio or webcam stream
  enabled: boolean;
}

export function useRecordingBuffer({ stream, enabled }: UseRecordingBufferOptions) {
  const chunksRef = useRef<{ blob: Blob; ts: number }[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);

  const startBuffer = useCallback(() => {
    if (!stream || recorderRef.current) return;

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';

    try {
      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          const now = performance.now();
          chunksRef.current.push({ blob: e.data, ts: now });
          // Drop chunks older than BUFFER_SECONDS
          const cutoff = now - BUFFER_SECONDS * 1000;
          chunksRef.current = chunksRef.current.filter(c => c.ts >= cutoff);
        }
      };

      recorder.start(CHUNK_MS);
    } catch { /* MediaRecorder not supported */ }
  }, [stream]);

  const stopBuffer = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
  }, []);

  // Capture evidence: last 10s (buffer) + next 10s live recording
  const captureEvidence = useCallback((): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      if (!stream) { reject(new Error('No stream')); return; }

      const prevChunks = [...chunksRef.current]; // snapshot of last 10s
      const afterChunks: Blob[] = [];

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';

      try {
        const afterRecorder = new MediaRecorder(stream, { mimeType });
        afterRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) afterChunks.push(e.data);
        };
        afterRecorder.onstop = () => {
          const allBlobs = [...prevChunks.map(c => c.blob), ...afterChunks];
          if (allBlobs.length === 0) { reject(new Error('No data')); return; }
          resolve(new Blob(allBlobs, { type: mimeType }));
        };
        afterRecorder.start(500);
        setTimeout(() => afterRecorder.stop(), BUFFER_SECONDS * 1000); // record 10s after
      } catch (err) { reject(err); }
    });
  }, [stream]);

  useEffect(() => {
    if (enabled && stream) startBuffer();
    return () => stopBuffer();
  }, [enabled, stream, startBuffer, stopBuffer]);

  return { captureEvidence };
}
