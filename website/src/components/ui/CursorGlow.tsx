"use client";

import { motion, useMotionValue, useReducedMotion } from "framer-motion";
import { ReactNode, MouseEvent as ReactMouseEvent } from "react";

export interface CursorGlowProps {
  /** Content to render inside the glow container */
  children?: ReactNode;
  /** Glow radius in px */
  radius?: number;
  /** Glow color */
  color?: string;
  className?: string;
}

export function CursorGlow({
  children,
  radius = 200,
  color = "#6366F1",
  className = "",
}: CursorGlowProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) return null;

  const handleMouseMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    x.set(e.clientX - rect.left);
    y.set(e.clientY - rect.top);
  };

  return (
    <div className={`relative ${className}`} onMouseMove={handleMouseMove}>
      <motion.div
        className="absolute pointer-events-none rounded-full"
        style={{
          x,
          y,
          width: radius,
          height: radius,
          marginLeft: -radius / 2,
          marginTop: -radius / 2,
          background: `radial-gradient(circle, ${color}20 0%, transparent 70%)`,
        }}
        aria-hidden="true"
      />
      {children}
    </div>
  );
}
