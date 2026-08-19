"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Search, Zap, TestTube, Rocket } from "lucide-react";
import { capabilities } from "@/data/capabilities";
import { SectionHeader } from "@/components/ui";

const capabilityIcons: Record<string, React.ReactNode> = {
  assessment: <Search className="w-8 h-8" />,
  migration: <Zap className="w-8 h-8" />,
  testing: <TestTube className="w-8 h-8" />,
  deployment: <Rocket className="w-8 h-8" />,
};

/* ─────────────────────────────────────────────
   Animated Background Component
   ───────────────────────────────────────────── */

function SectionBackground() {
  const prefersReducedMotion = useReducedMotion();
  
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Gradient orb - top right */}
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full opacity-20"
        style={{
          background: "radial-gradient(circle, rgba(124, 58, 237, 0.4) 0%, transparent 70%)",
          top: "-10%",
          right: "-10%",
          filter: "blur(80px)",
        }}
        animate={prefersReducedMotion ? {} : {
          scale: [1, 1.2, 1],
          x: [0, 30, 0],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      
      {/* Gradient orb - bottom left */}
      <motion.div
        className="absolute w-[400px] h-[400px] rounded-full opacity-15"
        style={{
          background: "radial-gradient(circle, rgba(6, 182, 212, 0.4) 0%, transparent 70%)",
          bottom: "-5%",
          left: "-5%",
          filter: "blur(80px)",
        }}
        animate={prefersReducedMotion ? {} : {
          scale: [1, 1.15, 1],
          y: [0, -20, 0],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2,
        }}
      />
      
      {/* Grid pattern */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '80px 80px',
        }}
      />
    </div>
  );
}

function CapabilityVisual({ capabilityId }: { capabilityId: string }) {
  const visuals: Record<string, React.ReactNode> = {
    assessment: (
      <svg viewBox="0 0 280 200" fill="none" className="w-full h-auto">
        <rect width="280" height="200" rx="12" fill="#0a0a1a" />
        {/* Magnifying glass */}
        <circle cx="120" cy="90" r="35" stroke="#7c3aed" strokeWidth="2" fill="none" />
        <line x1="145" y1="115" x2="170" y2="140" stroke="#7c3aed" strokeWidth="3" strokeLinecap="round" />
        {/* Document lines */}
        <rect x="160" y="50" width="80" height="8" rx="4" fill="#94A3B8" opacity="0.4" />
        <rect x="160" y="68" width="60" height="8" rx="4" fill="#94A3B8" opacity="0.3" />
        <rect x="160" y="86" width="70" height="8" rx="4" fill="#94A3B8" opacity="0.3" />
        {/* Nodes inside magnifier */}
        <circle cx="108" cy="80" r="4" fill="#06B6D4" />
        <circle cx="130" cy="95" r="4" fill="#06B6D4" />
        <circle cx="115" cy="100" r="4" fill="#7c3aed" />
        <line x1="108" y1="80" x2="130" y2="95" stroke="#06B6D4" strokeWidth="1" opacity="0.6" />
        <line x1="115" y1="100" x2="130" y2="95" stroke="#7c3aed" strokeWidth="1" opacity="0.6" />
      </svg>
    ),
    migration: (
      <svg viewBox="0 0 280 200" fill="none" className="w-full h-auto">
        <rect width="280" height="200" rx="12" fill="#0a0a1a" />
        {/* Source box */}
        <rect x="30" y="70" width="70" height="60" rx="8" stroke="#7c3aed" strokeWidth="1.5" fill="#7c3aed" fillOpacity="0.1" />
        <text x="65" y="100" textAnchor="middle" fill="#7c3aed" fontSize="10" fontWeight="600">PI/PO</text>
        <text x="65" y="115" textAnchor="middle" fill="#94A3B8" fontSize="8">Source</text>
        {/* Arrow with lightning */}
        <path d="M110 100 L170 100" stroke="url(#migGradient)" strokeWidth="2" strokeDasharray="4 3" />
        <polygon points="168,95 178,100 168,105" fill="#06B6D4" />
        <circle cx="140" cy="100" r="12" fill="#0a0a1a" stroke="#7c3aed" strokeWidth="1" />
        <text x="140" y="104" textAnchor="middle" fill="#7c3aed" fontSize="10">⚡</text>
        {/* Target box */}
        <rect x="180" y="70" width="70" height="60" rx="8" stroke="#06B6D4" strokeWidth="1.5" fill="#06B6D4" fillOpacity="0.1" />
        <text x="215" y="100" textAnchor="middle" fill="#06B6D4" fontSize="10" fontWeight="600">Target</text>
        <text x="215" y="115" textAnchor="middle" fill="#94A3B8" fontSize="8">Platform</text>
        <defs>
          <linearGradient id="migGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
        </defs>
      </svg>
    ),
    testing: (
      <svg viewBox="0 0 280 200" fill="none" className="w-full h-auto">
        <rect width="280" height="200" rx="12" fill="#0a0a1a" />
        {/* Checkmarks */}
        <rect x="50" y="50" width="180" height="30" rx="6" fill="#7c3aed" fillOpacity="0.08" stroke="#1E293B" strokeWidth="1" />
        <path d="M65 65 L72 72 L82 58" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="95" y="61" width="80" height="8" rx="4" fill="#94A3B8" opacity="0.4" />
        <rect x="50" y="90" width="180" height="30" rx="6" fill="#7c3aed" fillOpacity="0.08" stroke="#1E293B" strokeWidth="1" />
        <path d="M65 105 L72 112 L82 98" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="95" y="101" width="60" height="8" rx="4" fill="#94A3B8" opacity="0.4" />
        <rect x="50" y="130" width="180" height="30" rx="6" fill="#7c3aed" fillOpacity="0.08" stroke="#1E293B" strokeWidth="1" />
        <path d="M65 145 L72 152 L82 138" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="95" y="141" width="70" height="8" rx="4" fill="#94A3B8" opacity="0.4" />
      </svg>
    ),
    deployment: (
      <svg viewBox="0 0 280 200" fill="none" className="w-full h-auto">
        <rect width="280" height="200" rx="12" fill="#0a0a1a" />
        {/* Cloud shape */}
        <path d="M100 90 Q110 65 135 75 Q155 60 170 75 Q190 65 195 85 Q210 85 205 100 Q212 115 195 115 L105 115 Q85 115 88 100 Q82 85 100 90 Z" fill="#7c3aed" fillOpacity="0.1" stroke="#7c3aed" strokeWidth="1.5" />
        {/* Upload arrow */}
        <path d="M140 140 L140 120" stroke="#06B6D4" strokeWidth="2" strokeLinecap="round" />
        <polygon points="133,124 140,115 147,124" fill="#06B6D4" />
        {/* Server bars */}
        <rect x="90" y="155" width="100" height="10" rx="3" fill="#13132a" stroke="#7c3aed" strokeWidth="0.5" />
        <circle cx="100" cy="160" r="2" fill="#10b981" />
        <rect x="90" y="170" width="100" height="10" rx="3" fill="#13132a" stroke="#7c3aed" strokeWidth="0.5" />
        <circle cx="100" cy="175" r="2" fill="#10b981" />
      </svg>
    ),
  };

  return (
    <div className="flex items-center justify-center p-4" aria-hidden="true">
      {visuals[capabilityId] ?? visuals.assessment}
    </div>
  );
}

const contentVariants = {
  enter: { opacity: 0, y: 10 },
  center: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.2, ease: "easeIn" as const } },
} as const;

export function CapabilitiesSection() {
  const [activeCapability, setActiveCapability] = useState("assessment");
  const prefersReducedMotion = useReducedMotion();

  const active = capabilities.find((c) => c.id === activeCapability) ?? capabilities[0];

  return (
    <section id="capabilities" className="relative py-24 px-6 overflow-hidden">
      <SectionBackground />
      
      <div className="relative z-10 mx-auto w-full max-w-7xl">
        <SectionHeader
          title="Capabilities"
          subtitle="End-to-end migration services from assessment through deployment"
        />

        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_300px] gap-8 mt-12">
          {/* Vertical Nav (desktop) / Horizontal Pills (mobile) */}
          <nav
            className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 -mx-2 px-2 lg:mx-0 lg:px-0"
            aria-label="Capabilities navigation"
          >
            {capabilities.map((cap) => (
              <motion.button
                key={cap.id}
                onClick={() => setActiveCapability(cap.id)}
                className={`relative flex items-center gap-3 px-5 py-4 rounded-xl text-left whitespace-nowrap lg:whitespace-normal transition-all duration-300 shrink-0 lg:shrink focus:outline-none focus:ring-2 focus:ring-accent-primary ${
                  activeCapability === cap.id
                    ? "text-text-primary"
                    : "text-text-secondary hover:text-text-primary"
                }`}
                aria-pressed={activeCapability === cap.id}
                whileHover={{ x: prefersReducedMotion ? 0 : 4 }}
                whileTap={{ scale: 0.98 }}
              >
                {/* Active background */}
                {activeCapability === cap.id && (
                  <motion.div
                    layoutId="activeCapability"
                    className="absolute inset-0 rounded-xl bg-white/[0.05] border border-white/[0.1]"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                
                {/* Active indicator bar */}
                {activeCapability === cap.id && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-gradient-to-b from-accent-primary to-accent-secondary"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                
                <span className={`relative z-10 hidden lg:inline-flex transition-colors duration-300 ${
                  activeCapability === cap.id ? "text-accent-primary" : ""
                }`}>
                  {capabilityIcons[cap.id]}
                </span>
                <span className="relative z-10 text-sm font-medium">{cap.title}</span>
              </motion.button>
            ))}
          </nav>

          {/* Content Panel */}
          <div className="min-h-[300px] relative glass rounded-2xl p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={active.id}
                variants={prefersReducedMotion ? undefined : contentVariants}
                initial={prefersReducedMotion ? false : "enter"}
                animate={prefersReducedMotion ? undefined : "center"}
                exit={prefersReducedMotion ? undefined : "exit"}
                className="flex flex-col gap-5"
              >
                <h3 className="text-2xl font-bold text-text-primary">{active.title}</h3>
                <p className="text-text-secondary leading-relaxed">
                  {active.description}
                </p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                  {active.features.map((feature, index) => (
                    <motion.li
                      key={feature}
                      initial={prefersReducedMotion ? false : { opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center gap-3 text-sm text-text-secondary"
                    >
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent-primary/10 flex items-center justify-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent-primary" />
                      </span>
                      {feature}
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Visual Panel */}
          <div className="hidden lg:flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={active.id}
                initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.95, rotateY: -10 }}
                animate={prefersReducedMotion ? undefined : { opacity: 1, scale: 1, rotateY: 0, transition: { duration: 0.4 } }}
                exit={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.95, rotateY: 10, transition: { duration: 0.2 } }}
                className="w-full"
              >
                <div className="rounded-2xl overflow-hidden border border-white/[0.08] shadow-2xl shadow-black/20">
                  <CapabilityVisual capabilityId={active.id} />
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
