"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ReactNode } from "react";

export interface ScrollRevealProps {
  children: ReactNode;
  /** Delay before animation starts (seconds) */
  delay?: number;
  /** Animation direction */
  direction?: "up" | "down" | "left" | "right";
  /** Custom className for the wrapper */
  className?: string;
}

const directionOffsets = {
  up: { y: 40, x: 0 },
  down: { y: -40, x: 0 },
  left: { x: 40, y: 0 },
  right: { x: -40, y: 0 },
};

export function ScrollReveal({
  children,
  delay = 0,
  direction = "up",
  className,
}: Readonly<ScrollRevealProps>) {
  const prefersReducedMotion = useReducedMotion();
  const offset = directionOffsets[direction];

  // If user prefers reduced motion, render without animation
  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, ...offset }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{
        duration: 0.6,
        delay,
        ease: "easeOut",
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
