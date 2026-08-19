"use client";

import { motion, useReducedMotion } from "framer-motion";

export interface StaggeredTextProps {
  text: string;
  /** Split by "word" or "line" */
  splitBy?: "word" | "line";
  /** Element tag to render */
  as?: "h1" | "h2" | "h3" | "p" | "span";
  className?: string;
  /** Total animation duration in ms (800-1200) */
  duration?: number;
}

export function StaggeredText({
  text,
  splitBy = "word",
  as: Tag = "h1",
  className = "",
  duration = 1000,
}: StaggeredTextProps) {
  const prefersReducedMotion = useReducedMotion();
  const segments = splitBy === "word" ? text.split(" ") : text.split("\n");
  const staggerDelay = (duration / 1000) / segments.length;

  if (prefersReducedMotion) {
    return <Tag className={className}>{text}</Tag>;
  }

  return (
    <Tag className={className} aria-label={text}>
      {segments.map((segment, i) => (
        <motion.span
          key={i}
          className="inline-block"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * staggerDelay, duration: 0.4, ease: "easeOut" }}
          aria-hidden="true"
        >
          {segment}{splitBy === "word" && i < segments.length - 1 ? "\u00A0" : ""}
        </motion.span>
      ))}
    </Tag>
  );
}
