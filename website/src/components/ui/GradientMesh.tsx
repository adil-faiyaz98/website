"use client";

import { motion, useReducedMotion } from "framer-motion";

export interface GradientMeshProps {
  /** Color stops for the mesh gradient */
  colors?: [string, string] | [string, string, string];
  /** Opacity of the gradient (5-15%) */
  opacity?: number;
  /** Whether orbs should animate (drift/pulse) */
  animated?: boolean;
  className?: string;
}

export function GradientMesh({
  colors = ["#6366F1", "#06B6D4"],
  opacity = 10,
  animated = true,
  className = "",
}: GradientMeshProps) {
  const prefersReducedMotion = useReducedMotion();
  const shouldAnimate = animated && !prefersReducedMotion;

  return (
    <div
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      {/* Primary orb */}
      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full"
        style={{
          background: `radial-gradient(circle, ${colors[0]}${Math.round(opacity * 2.55).toString(16).padStart(2, "0")} 0%, transparent 70%)`,
          top: "10%",
          left: "20%",
        }}
        animate={
          shouldAnimate
            ? {
                x: [0, 30, -20, 0],
                y: [0, -20, 15, 0],
                scale: [1, 1.05, 0.95, 1],
              }
            : undefined
        }
        transition={
          shouldAnimate
            ? {
                duration: 12,
                repeat: Infinity,
                ease: "easeInOut",
              }
            : undefined
        }
      />
      {/* Secondary orb */}
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full"
        style={{
          background: `radial-gradient(circle, ${colors[1]}${Math.round(opacity * 2.55).toString(16).padStart(2, "0")} 0%, transparent 70%)`,
          bottom: "10%",
          right: "15%",
        }}
        animate={
          shouldAnimate
            ? {
                x: [0, -25, 15, 0],
                y: [0, 20, -10, 0],
                scale: [1, 0.95, 1.05, 1],
              }
            : undefined
        }
        transition={
          shouldAnimate
            ? {
                duration: 10,
                repeat: Infinity,
                ease: "easeInOut",
              }
            : undefined
        }
      />
      {/* Tertiary orb (only rendered when 3 colors are provided) */}
      {colors[2] && (
        <motion.div
          className="absolute w-[400px] h-[400px] rounded-full"
          style={{
            background: `radial-gradient(circle, ${colors[2]}${Math.round(opacity * 2.55).toString(16).padStart(2, "0")} 0%, transparent 70%)`,
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
          animate={
            shouldAnimate
              ? {
                  x: [0, 20, -15, 0],
                  y: [0, -15, 20, 0],
                  scale: [1, 1.03, 0.97, 1],
                }
              : undefined
          }
          transition={
            shouldAnimate
              ? {
                  duration: 14,
                  repeat: Infinity,
                  ease: "easeInOut",
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
