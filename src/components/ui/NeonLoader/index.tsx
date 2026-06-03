import React from "react";

export interface NeonLoaderProps {
  /**
   * The size of the loader (width and height in pixels)
   * @default 120
   */
  size?: number;
  /**
   * The text displayed below the loader
   * @default "Loading..."
   */
  text?: string;
  /**
   * The total duration of one animation cycle in seconds
   * @default 3
   */
  speed?: number;
  /**
   * Optional custom class names for the outer container
   */
  className?: string;
}

export const NeonLoader: React.FC<NeonLoaderProps> = ({
  size = 120,
  text = "Loading...",
  speed = 3,
  className = "",
}) => {
  // SVG paths outlining a perfect isometric cube structure
  const centerNode = { cx: 50, cy: 50 };

  // Base structural paths (the wireframe)
  const baseOuterHexagon = "M 50 10 L 84.64 30 L 84.64 70 L 50 90 L 15.36 70 L 15.36 30 Z";
  const baseInnerY = "M 50 50 L 50 90 M 50 50 L 15.36 30 M 50 50 L 84.64 30";

  // Symmetrical routes starting from the center and flowing through the structure
  // Route 1: Center -> Top Left -> Top -> Top Right
  const route1 = "M 50 50 L 15.36 30 L 50 10 L 84.64 30";
  // Route 2: Center -> Bottom -> Bottom Left -> Top Left
  const route2 = "M 50 50 L 50 90 L 15.36 70 L 15.36 30";
  // Route 3: Center -> Top Right -> Bottom Right -> Bottom
  const route3 = "M 50 50 L 84.64 30 L 84.64 70 L 50 90";

  return (
    <div
      className={`flex flex-col items-center justify-center gap-6 ${className}`}
      style={{ "--anim-speed": `${speed}s` } as React.CSSProperties}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          viewBox="0 0 100 100"
          width="100%"
          height="100%"
          className="overflow-visible"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Premium Orange-to-Pink Neon Gradient */}
            <linearGradient id="neonGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ff512f" />
              <stop offset="100%" stopColor="#dd2476" />
            </linearGradient>

            {/* Layered Glow Filter for Soft Realistic Bloom */}
            <filter id="neonGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur1" />
              <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur2" />
              <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur3" />
              <feMerge>
                <feMergeNode in="blur3" />
                <feMergeNode in="blur2" />
                <feMergeNode in="blur1" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Embedded Styles for Self-Contained Animation */}
          <style>
            {`
              .base-structure {
                stroke: currentColor;
                opacity: 0.1;
                stroke-width: 1.5;
                stroke-linejoin: round;
                stroke-linecap: round;
              }
              
              .neon-route {
                stroke: url(#neonGradient);
                stroke-width: 2.5;
                stroke-linecap: round;
                stroke-linejoin: round;
                filter: url(#neonGlow);
                stroke-dasharray: 100;
                /* Starts hidden out of frame */
                stroke-dashoffset: 100; 
                animation: trace var(--anim-speed) cubic-bezier(0.4, 0, 0.2, 1) infinite;
              }

              .route-1 { animation-delay: 0s; }
              .route-2 { animation-delay: calc(var(--anim-speed) * 0.333); }
              .route-3 { animation-delay: calc(var(--anim-speed) * 0.666); }

              .center-node {
                fill: #ff512f;
                filter: url(#neonGlow);
                transform-origin: 50px 50px;
                animation: pulseNode calc(var(--anim-speed) * 0.333) ease-in-out infinite;
              }

              @keyframes trace {
                0% {
                  stroke-dashoffset: 100;
                  opacity: 0;
                }
                10% {
                  opacity: 1;
                }
                50% {
                  stroke-dashoffset: 0;
                  opacity: 1;
                }
                80% {
                  stroke-dashoffset: -100;
                  opacity: 1;
                }
                90% {
                  stroke-dashoffset: -100;
                  opacity: 0;
                }
                100% {
                  stroke-dashoffset: -100;
                  opacity: 0;
                }
              }

              @keyframes pulseNode {
                0%, 100% {
                  transform: scale(0.8);
                  opacity: 0.6;
                }
                50% {
                  transform: scale(1.3);
                  opacity: 1;
                }
              }

              .text-pulse {
                animation: textFade calc(var(--anim-speed) * 0.333) ease-in-out infinite;
              }

              @keyframes textFade {
                0%, 100% { opacity: 0.5; }
                50% { opacity: 1; }
              }
            `}
          </style>

          {/* Faint Background Structure */}
          <g className="base-structure text-gray-800 dark:text-gray-200">
            <path d={baseOuterHexagon} />
            <path d={baseInnerY} />
          </g>

          {/* Animated Neon Routes */}
          {/* Note: pathLength="100" maps the physical path geometry perfectly to our 0-100 dasharray logic */}
          <path d={route1} pathLength="100" className="neon-route route-1" />
          <path d={route2} pathLength="100" className="neon-route route-2" />
          <path d={route3} pathLength="100" className="neon-route route-3" />

          {/* Glowing Center Node */}
          <circle cx={centerNode.cx} cy={centerNode.cy} r="2.5" className="center-node" />
        </svg>
      </div>

      {/* Typography */}
      {text && (
        <span className="text-pulse font-sans font-medium tracking-[0.2em] text-sm text-gray-800 dark:text-gray-200">
          {text}
        </span>
      )}
    </div>
  );
};

export default NeonLoader;
