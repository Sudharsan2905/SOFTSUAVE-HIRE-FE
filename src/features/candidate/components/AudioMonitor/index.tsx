import React, { RefObject, useEffect, useRef } from "react";
import styles from "./AudioMonitor.module.css";
import { IconMic } from "@/assets/icons";

interface AudioMonitorProps {
  analyserRef: RefObject<AnalyserNode | null>;
  active: boolean;
}

const CANVAS_WIDTH = 200;
const CANVAS_HEIGHT = 48;
const BAR_COUNT = 32;
const BAR_GAP = 2;

export function AudioMonitor({ analyserRef, active }: Readonly<AudioMonitorProps>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const analyser = analyserRef.current;
      const width = CANVAS_WIDTH;
      const height = CANVAS_HEIGHT;

      ctx.clearRect(0, 0, width, height);

      if (!analyser || !active) {
        // Draw a flat idle line centred vertically
        ctx.beginPath();
        ctx.strokeStyle = "rgba(148, 163, 184, 0.5)";
        ctx.lineWidth = 1.5;
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(dataArray);

      // Sample BAR_COUNT evenly-spaced bins
      const step = Math.floor(bufferLength / BAR_COUNT);
      const totalBarWidth = (width - BAR_GAP * (BAR_COUNT - 1)) / BAR_COUNT;
      const barWidth = Math.max(1, Math.floor(totalBarWidth));
      const midY = height / 2;

      for (let i = 0; i < BAR_COUNT; i++) {
        const value = dataArray[i * step] / 255; // 0–1
        const halfBarH = Math.max(1.5, value * midY);

        const x = i * (barWidth + BAR_GAP);

        // Symmetrical: draw bar above and below midY
        ctx.fillStyle = `rgba(37, 99, 255, ${0.4 + value * 0.6})`;
        ctx.beginPath();
        ctx.roundRect(x, midY - halfBarH, barWidth, halfBarH * 2, 2);
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [analyserRef, active]);

  return (
    <div className={styles.container}>
      <div className={styles.sectionTitle}>
        <IconMic size={15} color="var(--text-tertiary)" />
        <span>Audio</span>
        {active && <span className={styles.activeDot} aria-label="Microphone active" />}
      </div>

      <div className={styles.waveWrapper}>
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className={styles.canvas}
        />
      </div>
    </div>
  );
}
