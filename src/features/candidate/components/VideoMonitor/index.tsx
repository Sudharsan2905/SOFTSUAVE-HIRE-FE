import React, { RefObject, useEffect, useRef, useState } from "react";
import styles from "./VideoMonitor.module.css";
import { IconCamera } from "@/assets/icons";

type VideoStatus = "checking" | "live" | "no-feed";

interface VideoMonitorProps {
  videoRef: RefObject<HTMLVideoElement>;
  onWarning?: () => void;
}

export function VideoMonitor({ videoRef, onWarning }: VideoMonitorProps) {
  const [status, setStatus] = useState<VideoStatus>("checking");
  const darkFrameCountRef = useRef(0);

  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");

    const check = () => {
      const video = videoRef.current;

      if (!ctx || !video || video.readyState < 2 || video.videoWidth === 0) {
        setStatus("no-feed");
        darkFrameCountRef.current = 0;
        return;
      }

      ctx.drawImage(video, 0, 0, 32, 32);
      const { data } = ctx.getImageData(0, 0, 32, 32);

      let total = 0;
      for (let i = 0; i < data.length; i += 4) {
        // Perceived brightness: 0.299R + 0.587G + 0.114B
        total += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      }
      const avgBrightness = total / (32 * 32);

      if (avgBrightness < 10) {
        darkFrameCountRef.current += 1;
        if (darkFrameCountRef.current >= 5) {
          onWarning?.();
        }
        setStatus("no-feed");
      } else {
        darkFrameCountRef.current = 0;
        setStatus("live");
      }
    };

    // Run once immediately, then every 3 seconds
    check();
    const intervalId = setInterval(check, 3000);

    return () => clearInterval(intervalId);
  }, [videoRef, onWarning]);

  const badgeLabel =
    status === "live" ? "Live" : status === "no-feed" ? "No Feed" : "Checking";

  return (
    <div className={styles.container}>
      <div className={styles.sectionTitle}>
        <IconCamera size={15} color="var(--text-tertiary)" />
        <span>Camera</span>
      </div>

      <div className={styles.videoWrapper}>
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className={styles.video}
        />

        <span
          className={`${styles.badge} ${
            status === "live"
              ? styles.badgeLive
              : status === "no-feed"
              ? styles.badgeNoFeed
              : styles.badgeChecking
          }`}
        >
          {status === "live" && <span className={styles.badgeDot} />}
          {badgeLabel}
        </span>
      </div>
    </div>
  );
}
