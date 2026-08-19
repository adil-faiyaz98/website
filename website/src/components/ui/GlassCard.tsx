"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ReactNode, useState } from "react";

export interface GlassCardProps {
  children: ReactNode;
  className?: string;
  /** Backdrop blur intensity in px (8-20) */
  blur?: number;
  /** Background opacity percentage (60-80) */
  opacity?: number;
  /** Enable hover scale and glow animation */
  interactive?: boolean;
  /** Render as a specific HTML element */
  as?: "div" | "article" | "section";
  /** Enable gradient border effect */
  gradientBorder?: boolean;
}

export function GlassCard({
  children,
  className = "",
  blur = 16,
  opacity = 60,
  interactive = false,
  as: Component = "div",
  gradientBorder = false,
}: GlassCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive || prefersReducedMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  // Convert opacity (60-80) to hex for the background color
  const opacityHex = Math.round((opacity / 100) * 255)
    .toString(16)
    .padStart(2, "0");

  const baseClasses = "relative rounded-2xl overflow-hidden";

  const baseStyle = {
    backgroundColor: `rgba(10, 10, 26, ${opacity / 100})`,
    backdropFilter: `blur(${blur}px)`,
    WebkitBackdropFilter: `blur(${blur}px)`,
  };

  if (!interactive || prefersReducedMotion) {
    return (
      <Component
        className={`${baseClasses} border border-white/[0.08] ${className}`}
        style={baseStyle}
      >
        {gradientBorder && (
          <div 
            className="absolute inset-0 rounded-2xl p-[1px] pointer-events-none"
            style={{
              background: "linear-gradient(135deg, rgba(124, 58, 237, 0.3), rgba(6, 182, 212, 0.3), rgba(244, 114, 182, 0.3))",
              mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              maskComposite: "xor",
              WebkitMaskComposite: "xor",
            }}
          />
        )}
        {children}
      </Component>
    );
  }

  return (
    <motion.div
      className={`${baseClasses} group cursor-pointer ${className}`}
      style={baseStyle}
      onMouseMove={handleMouseMove}
      whileHover={{ scale: 1.02, y: -4 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {/* Subtle border */}
      <div className="absolute inset-0 rounded-2xl border border-white/[0.08] group-hover:border-white/[0.15] transition-colors duration-300 pointer-events-none" />
      
      {/* Spotlight effect following cursor */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl"
        style={{
          background: `radial-gradient(400px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(124, 58, 237, 0.15), transparent 40%)`,
        }}
      />
      
      {/* Top shine effect */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      
      {/* Gradient border on hover */}
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          padding: "1px",
          background: "linear-gradient(135deg, rgba(124, 58, 237, 0.5), rgba(6, 182, 212, 0.5), rgba(244, 114, 182, 0.5))",
          mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          maskComposite: "xor",
          WebkitMaskComposite: "xor",
        }}
      />
      
      {/* Glow effect */}
      <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-accent-primary/20 via-accent-secondary/20 to-accent-tertiary/20 opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500 pointer-events-none -z-10" />
      
      <div className="relative z-10">
        {children}
      </div>
    </motion.div>
  );
}
