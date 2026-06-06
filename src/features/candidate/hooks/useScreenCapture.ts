import { useCallback, useEffect, useRef, useState } from "react";
import { takeScreenStream } from "../services/screenCaptureStore";

const MAX_WIDTH = 1280;
const JPEG_QUALITY = 0.6;

interface UseScreenCaptureReturn {
  isCapturing: boolean;
  isInitialized: boolean;
  startScreenCapture: () => Promise<boolean>;
  captureFrame: () => Promise<Blob | null>;
  stopScreenCapture: () => void;
  validateScreenStream: () => boolean;
}

export function useScreenCapture(): UseScreenCaptureReturn {
  const streamRef = useRef<MediaStream | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Stable refs so online/visibility handlers don't need to re-register
  const isCapturingRef = useRef(false);
  const isInitializedRef = useRef(false);
  useEffect(() => {
    isCapturingRef.current = isCapturing;
  }, [isCapturing]);
  useEffect(() => {
    isInitializedRef.current = isInitialized;
  }, [isInitialized]);

  const stopScreenCapture = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoElRef.current) {
      videoElRef.current.srcObject = null;
      videoElRef.current = null;
    }
    setIsCapturing(false);
    isCapturingRef.current = false;
  }, []);

  // Returns true only if the stored stream has a live "monitor" track
  const validateScreenStream = useCallback((): boolean => {
    const track = streamRef.current?.getVideoTracks?.()?.[0];
    if (!track || track.readyState !== "live") return false;
    const settings = track.getSettings() as MediaTrackSettings & { displaySurface?: string };
    // If displaySurface is unavailable the browser can't tell us the surface type — trust the track
    if (settings.displaySurface !== undefined && settings.displaySurface !== "monitor") return false;
    return true;
  }, []);

  const setupStream = useCallback(
    async (stream: MediaStream): Promise<boolean> => {
      try {
        const video = document.createElement("video");
        video.muted = true;
        video.playsInline = true;
        video.srcObject = stream;
        await video.play();
        videoElRef.current = video;
        stream.getVideoTracks()[0]?.addEventListener("ended", stopScreenCapture);
        streamRef.current = stream;
        setIsCapturing(true);
        isCapturingRef.current = true;
        return true;
      } catch {
        stream.getTracks().forEach((t) => t.stop());
        return false;
      }
    },
    [stopScreenCapture]
  );

  // Pick up a stream pre-obtained in InstructionsPage (user-gesture context)
  useEffect(() => {
    const stored = takeScreenStream();
    if (stored) {
      void setupStream(stored).then(() => {
        setIsInitialized(true);
        isInitializedRef.current = true;
      });
    } else {
      setIsInitialized(true);
      isInitializedRef.current = true;
    }
  }, [setupStream]);

  // Revalidate stream on reconnect and tab return — stop capture if stream is no longer live
  useEffect(() => {
    const revalidate = () => {
      if (!isInitializedRef.current || !isCapturingRef.current) return;
      if (!validateScreenStream()) {
        stopScreenCapture();
      }
    };

    const handleVisibility = () => {
      if (!document.hidden) revalidate();
    };

    window.addEventListener("online", revalidate);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("online", revalidate);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [validateScreenStream, stopScreenCapture]);

  const startScreenCapture = useCallback(async (): Promise<boolean> => {
    if (streamRef.current) return true;
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 5 },
        audio: false,
      });
      return setupStream(stream);
    } catch {
      return false;
    }
  }, [setupStream]);

  const captureFrame = useCallback(async (): Promise<Blob | null> => {
    const video = videoElRef.current;
    if (!video?.videoWidth) return null;

    const scale = Math.min(1, MAX_WIDTH / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", JPEG_QUALITY);
    });
  }, []);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (videoElRef.current) videoElRef.current.srcObject = null;
    };
  }, []);

  return {
    isCapturing,
    isInitialized,
    startScreenCapture,
    captureFrame,
    stopScreenCapture,
    validateScreenStream,
  };
}
