import { useCallback, useEffect, useRef, useState } from "react";
import { takeScreenStream } from "../services/screenCaptureStore";

const MAX_WIDTH = 1280;
const JPEG_QUALITY = 0.6;

interface UseScreenCaptureReturn {
  isCapturing: boolean;
  startScreenCapture: () => Promise<boolean>;
  captureFrame: () => Promise<Blob | null>;
  stopScreenCapture: () => void;
}

export function useScreenCapture(): UseScreenCaptureReturn {
  const streamRef = useRef<MediaStream | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const stopScreenCapture = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoElRef.current) {
      videoElRef.current.srcObject = null;
      videoElRef.current = null;
    }
    setIsCapturing(false);
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
      void setupStream(stored);
    }
  }, [setupStream]);

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

  return { isCapturing, startScreenCapture, captureFrame, stopScreenCapture };
}
