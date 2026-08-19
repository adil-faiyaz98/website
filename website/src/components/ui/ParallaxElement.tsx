"use client";

import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { useRef, ReactNode } from "react";

export interface ParallaxElementProps {
  children: ReactNode;
  /** Parallax offset as percentage of scroll (10-30) */
  offset?: number;
  className?: string;
}

export function ParallaxElement({
  children,
  offset = 20,
  className = "",
}: ParallaxElementProps) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], [`-${offset}%`, `${offset}%`]);

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div ref={ref} style={{ y }} className={className}>
      {children}
    </motion.div>
  );
}
