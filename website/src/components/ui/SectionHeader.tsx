"use client";

import { motion, useReducedMotion } from "framer-motion";

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  centered?: boolean;
  gradient?: boolean;
  badge?: string;
}

export function SectionHeader({
  title,
  subtitle,
  centered = true,
  gradient = false,
  badge,
}: Readonly<SectionHeaderProps>) {
  const prefersReducedMotion = useReducedMotion();
  
  return (
    <div className={`mb-16 ${centered ? "text-center" : "text-left"}`}>
      {/* Optional badge */}
      {badge && (
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className={`mb-4 ${centered ? "flex justify-center" : ""}`}
        >
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wider bg-accent-primary/10 text-accent-primary border border-accent-primary/20">
            {badge}
          </span>
        </motion.div>
      )}
      
      {/* Title */}
      <motion.h2
        initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: badge ? 0.1 : 0 }}
        className={`text-3xl sm:text-4xl md:text-5xl font-bold mb-5 leading-tight tracking-tight ${
          gradient ? "gradient-text" : "text-text-primary"
        }`}
      >
        {title}
      </motion.h2>
      
      {/* Subtitle */}
      {subtitle && (
        <motion.p
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: badge ? 0.2 : 0.1 }}
          className={`text-lg md:text-xl text-text-secondary leading-relaxed ${
            centered ? "max-w-2xl mx-auto" : "max-w-2xl"
          }`}
        >
          {subtitle}
        </motion.p>
      )}
      
      {/* Decorative line */}
      {centered && (
        <motion.div
          initial={prefersReducedMotion ? {} : { scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-8 mx-auto w-24 h-1 rounded-full bg-gradient-to-r from-accent-primary via-accent-secondary to-accent-tertiary"
        />
      )}
    </div>
  );
}
