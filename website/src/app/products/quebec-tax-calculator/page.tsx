"use client";

import { motion, AnimatePresence, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react"; // Keep Loader2 for spinner animation
import { SapIcon } from "@/components";


/* ═══════════════════════════════════════════════════════════════════════════
   ANIMATED BACKGROUND COMPONENT - LangChain Style
   ═══════════════════════════════════════════════════════════════════════════ */

function AnimatedBackground({ variant = "hero" }: { variant?: "hero" | "section" }) {
  const prefersReducedMotion = useReducedMotion();
  
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Deep navy base */}
      <div className="absolute inset-0 bg-[#030710]" />
      
      {/* Gradient mesh */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#006ddd]/20 via-transparent to-transparent" />
      
      {/* Animated orbs */}
      <motion.div
        className="absolute w-[800px] h-[800px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(0, 109, 221, 0.25) 0%, transparent 70%)",
          top: variant === "hero" ? "-20%" : "10%",
          right: "-15%",
          filter: "blur(100px)",
        }}
        animate={prefersReducedMotion ? {} : {
          scale: [1, 1.2, 1],
          x: [0, 50, 0],
          y: [0, 30, 0],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
      
      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(0, 212, 255, 0.2) 0%, transparent 70%)",
          bottom: "-10%",
          left: "-5%",
          filter: "blur(100px)",
        }}
        animate={prefersReducedMotion ? {} : {
          scale: [1, 1.15, 1],
          x: [0, -30, 0],
          y: [0, -40, 0],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 3 }}
      />
      
      {/* Grid pattern - LangChain style */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(rgba(127, 200, 255, 0.3) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(127, 200, 255, 0.3) 1px, transparent 1px)`,
          backgroundSize: '80px 80px',
        }}
      />
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════════════
   HERO SECTION - Enterprise Grade
   ═══════════════════════════════════════════════════════════════════════════ */

function HeroSection() {
  const prefersReducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });
  
  const y = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  return (
    <section ref={containerRef} className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <AnimatedBackground variant="hero" />
      
      {/* Floating particles */}
      {!prefersReducedMotion && [...Array(30)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-[#7fc8ff]/40"
          style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%` }}
          animate={{ y: [0, -30, 0], opacity: [0.2, 0.8, 0.2] }}
          transition={{ duration: 3 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 2 }}
        />
      ))}

      {/* Content */}
      <motion.div style={prefersReducedMotion ? {} : { y, opacity }} className="relative z-10 max-w-7xl mx-auto px-6 text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#006ddd]/15 border border-[#7fc8ff]/20 mb-8"
        >
          <motion.div animate={prefersReducedMotion ? {} : { rotate: 360 }} transition={{ duration: 8, repeat: Infinity, ease: "linear" }}>
            <SapIcon name="lightbulb" className="w-4 h-4 text-[#7fc8ff]" size={16} />
          </motion.div>
          <span className="text-sm font-medium text-[#cce9ff]">Enterprise-Grade SAP CAP Solution</span>
        </motion.div>
        
        {/* Main heading - LangChain weight-300 style */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-light mb-6 leading-[1.1] tracking-tight"
        >
          <span className="text-[#cce9ff]">Quebec</span>
          <br />
          <span className="bg-gradient-to-r from-[#006ddd] via-[#00d4ff] to-[#7fc8ff] bg-clip-text text-transparent">
            Tax Calculator
          </span>
        </motion.h1>

        {/* Subheading */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-xl md:text-2xl text-[#99d3ff]/80 max-w-3xl mx-auto mb-10 leading-relaxed font-light"
        >
          Automate Quebec corporate tax calculations & maximize your tax credits 
          with <span className="text-[#00d4ff] font-medium">AI-powered</span> incentive program eligibility assessment
        </motion.p>
        
        {/* CTA Buttons - LangChain 6px radius */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
        >
          <Link
            href="#contact-adil"
            className="group relative inline-flex items-center gap-2 px-8 py-4 rounded-md bg-gradient-to-r from-[#006ddd] to-[#00d4ff] text-white font-medium text-lg overflow-hidden transition-all duration-300 hover:shadow-[0_0_40px_rgba(0,212,255,0.4)] hover:scale-105"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            <SapIcon name="calculator" size={20} />
            <span className="relative">Get Started</span>
          </Link>
          
          <Link
            href="#features"
            className="group inline-flex items-center gap-2 px-8 py-4 rounded-md border border-[#7fc8ff]/20 text-[#cce9ff] font-medium text-lg hover:bg-[#006ddd]/10 hover:border-[#7fc8ff]/40 transition-all duration-300"
          >
            <SapIcon name="play" size={20} />
            Watch Demo
          </Link>
        </motion.div>

        {/* Key stats preview */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto"
        >
          {[
            { value: "80%", label: "Time Savings", icon: "history" },
            { value: "95%", label: "Error Reduction", icon: "shield" },
            { value: "15%", label: "More Credits", icon: "trend-up" },
            { value: "2-3 Days", label: "vs 2-3 Weeks", icon: "accelerated" },
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 1 + index * 0.1 }}
              className="group relative p-4 rounded-xl bg-[#006ddd]/5 border border-[#7fc8ff]/10 hover:border-[#00d4ff]/30 hover:bg-[#006ddd]/10 transition-all duration-300"
            >
              <SapIcon name={stat.icon} className="text-[#7fc8ff] mx-auto mb-2" size={20} />
              <div className="text-2xl md:text-3xl font-light text-[#cce9ff]">{stat.value}</div>
              <div className="text-xs text-[#7fc8ff]/60">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
      
      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.button
          onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="flex flex-col items-center gap-2 text-[#7fc8ff]/60 hover:text-[#cce9ff] transition-colors cursor-pointer"
        >
          <span className="text-xs uppercase tracking-wider font-medium">Scroll</span>
          <SapIcon name="slim-arrow-down" size={20} />
        </motion.button>
      </motion.div>
    </section>
  );
}


/* ═══════════════════════════════════════════════════════════════════════════
   TRUSTED BY SECTION - Social Proof
   ═══════════════════════════════════════════════════════════════════════════ */

function TrustedBySection() {
  return (
    <section className="relative py-16 border-y border-[#7fc8ff]/10">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <p className="text-sm text-[#7fc8ff]/60 uppercase tracking-wider mb-8">Trusted by Quebec&apos;s Leading Enterprises</p>
          <div className="flex flex-wrap items-center justify-center gap-12 opacity-60">
            {["Manufacturing", "Technology", "R&D Labs", "Professional Services", "Healthcare"].map((industry) => (
              <div key={industry} className="flex items-center gap-2 text-[#cce9ff]/60">
                <SapIcon name="factory" size={20} />
                <span className="text-sm font-medium">{industry}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PAIN POINTS SECTION - Before/After
   ═══════════════════════════════════════════════════════════════════════════ */

const painPointsBefore = [
  "Manual calculation of complex Quebec/Federal tax obligations",
  "Hours spent researching 10+ incentive programs",
  "Spreadsheet-based tracking prone to errors",
  "Missed tax credit opportunities",
  "No audit trail for compliance",
  "Siloed information between departments",
];

const painPointsAfter = [
  "Automated tax calculations with real-time updates",
  "Intelligent eligibility wizard in seconds",
  "Centralized document management with audit logging",
  "Proactive credit recommendations",
  "Full compliance documentation",
  "Bilingual support (English/French)",
];

function PainPointsSection() {
  return (
    <section id="features" className="relative py-32 overflow-hidden">
      <AnimatedBackground variant="section" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium uppercase tracking-wider bg-[#006ddd]/15 text-[#7fc8ff] border border-[#7fc8ff]/20 mb-4">
            Transformation
          </span>
          <h2 className="text-4xl md:text-5xl font-light text-[#cce9ff] mb-4 tracking-tight">
            From <span className="text-red-400">Chaos</span> to{" "}
            <span className="bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">Clarity</span>
          </h2>
          <p className="text-xl text-[#99d3ff]/80 max-w-2xl mx-auto font-light">
            See how Quebec Tax Calculator transforms your tax workflow
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Before Card */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative group h-full"
          >
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/10 blur-xl opacity-50 group-hover:opacity-70 transition-opacity" />
            <div className="relative p-8 rounded-2xl bg-[#030710]/80 backdrop-blur-xl border border-red-500/20 h-full flex flex-col">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
                  <SapIcon name="warning" className="text-red-400" size={24} />
                </div>
                <div>
                  <h3 className="text-2xl font-light text-red-400">Before</h3>
                  <p className="text-[#7fc8ff]/60 text-sm">The Old Way</p>
                </div>
              </div>
              <ul className="space-y-4 flex-1">
                {painPointsBefore.map((point, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                    className="flex items-start gap-3"
                  >
                    <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center mt-0.5 flex-shrink-0">
                      <SapIcon name="decline" className="text-red-400" size={12} />
                    </div>
                    <span className="text-[#99d3ff]/80">{point}</span>
                  </motion.li>
                ))}
              </ul>
            </div>
          </motion.div>

          {/* After Card */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative group h-full"
          >
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/10 blur-xl opacity-50 group-hover:opacity-70 transition-opacity" />
            <div className="relative p-8 rounded-2xl bg-[#030710]/80 backdrop-blur-xl border border-green-500/20 h-full flex flex-col">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <SapIcon name="accelerated" className="text-green-400" size={24} />
                </div>
                <div>
                  <h3 className="text-2xl font-light text-green-400">After</h3>
                  <p className="text-[#7fc8ff]/60 text-sm">With Quebec Tax Calculator</p>
                </div>
              </div>
              <ul className="space-y-4 flex-1">
                {painPointsAfter.map((point, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.2 + index * 0.1 }}
                    className="flex items-start gap-3"
                  >
                    <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center mt-0.5 flex-shrink-0">
                      <SapIcon name="accept" className="text-green-400" size={12} />
                    </div>
                    <span className="text-[#99d3ff]/80">{point}</span>
                  </motion.li>
                ))}
              </ul>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}


/* ═══════════════════════════════════════════════════════════════════════════
   STATISTICS SECTION - Big Impact Numbers
   ═══════════════════════════════════════════════════════════════════════════ */

const impactStats = [
  { value: "80%", label: "Time Savings", description: "Reduction in tax assessment preparation time", icon: "history", color: "from-[#006ddd] to-[#00d4ff]" },
  { value: "3-5", label: "Extra Programs", description: "Additional eligible programs identified on average", icon: "target-group", color: "from-[#00d4ff] to-[#7fc8ff]" },
  { value: "95%", label: "Error Reduction", description: "Fewer calculation errors vs. manual methods", icon: "shield", color: "from-green-500 to-emerald-500" },
  { value: "10-15%", label: "More Credits", description: "Typical increase in claimed tax credits", icon: "trend-up", color: "from-[#7fc8ff] to-[#cce9ff]" },
];

function StatsSection() {
  const prefersReducedMotion = useReducedMotion();
  
  return (
    <section className="relative py-32 overflow-hidden">
      <div className="absolute inset-0 bg-[#030710]" />
      <motion.div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, rgba(0, 109, 221, 0.1) 0%, transparent 70%)" }}
        animate={prefersReducedMotion ? {} : { scale: [1, 1.1, 1] }}
        transition={{ duration: 10, repeat: Infinity }}
      />
      
      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium uppercase tracking-wider bg-[#006ddd]/15 text-[#7fc8ff] border border-[#7fc8ff]/20 mb-4">
            <SapIcon name="bar-chart" size={12} /> Impact Metrics
          </span>
          <h2 className="text-4xl md:text-5xl font-light text-[#cce9ff] mb-4 tracking-tight">
            Measurable <span className="bg-gradient-to-r from-[#006ddd] to-[#00d4ff] bg-clip-text text-transparent">Results</span>
          </h2>
          <p className="text-xl text-[#99d3ff]/80 max-w-2xl mx-auto font-light">Real impact from real implementations</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {impactStats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group relative"
            >
              <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${stat.color} opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-500`} />
              <div className="relative p-8 rounded-2xl bg-[#006ddd]/5 border border-[#7fc8ff]/10 hover:border-[#7fc8ff]/20 transition-all duration-300 h-full">
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  <SapIcon name={stat.icon} className="text-white" size={28} />
                </div>
                <div className={`text-5xl font-light mb-2 bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>{stat.value}</div>
                <h3 className="text-xl font-medium text-[#cce9ff] mb-2">{stat.label}</h3>
                <p className="text-[#7fc8ff]/60 text-sm">{stat.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
        
        {/* Processing time highlight */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-12 p-8 rounded-2xl bg-gradient-to-r from-[#006ddd]/10 via-[#00d4ff]/10 to-[#7fc8ff]/10 border border-[#7fc8ff]/10"
        >
          <div className="flex flex-col md:flex-row items-center justify-center gap-8 text-center">
            <div className="flex items-center gap-4">
              <div className="text-4xl font-light text-red-400 line-through opacity-60">2-3 Weeks</div>
              <SapIcon name="arrow-right" className="text-[#7fc8ff]/40 hidden md:block" size={32} />
            </div>
            <div className="flex items-center gap-4">
              <div className="text-5xl font-light bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">2-3 Days</div>
              <SapIcon name="accelerated" className="text-yellow-400" size={32} />
            </div>
            <p className="text-[#99d3ff]/80 md:ml-4 font-light">For complete tax assessment</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}


/* ═══════════════════════════════════════════════════════════════════════════
   TAX CREDITS SECTION
   ═══════════════════════════════════════════════════════════════════════════ */

const taxCredits = [
  { program: "CRIC", description: "Quebec R&D Tax Credit", benefit: "30% on first $1M R&D", maxCredit: "$300K", color: "[#006ddd]" },
  { program: "SR&ED", description: "Scientific Research & Experimental Development", benefit: "35% for CCPCs on first $6M", maxCredit: "$2.1M", color: "[#00d4ff]" },
  { program: "IDCI", description: "Innovation Development Credit", benefit: "Reduces effective tax on IP income", maxCredit: "11.5% → 2%", color: "[#7fc8ff]" },
  { program: "Combined R&D", description: "Stacked Federal + Provincial Credits", benefit: "Effective benefit rate", maxCredit: "40-50%", color: "green-400" },
];

function TaxCreditsSection() {
  return (
    <section className="relative py-32 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-[#030710] via-[#006ddd]/5 to-[#030710]" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium uppercase tracking-wider bg-green-500/10 text-green-400 border border-green-500/20 mb-4">
            <SapIcon name="money-bills" size={12} /> Credit Values
          </span>
          <h2 className="text-4xl md:text-5xl font-light text-[#cce9ff] mb-4 tracking-tight">
            Unlock <span className="bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">Millions</span> in Tax Credits
          </h2>
          <p className="text-xl text-[#99d3ff]/80 max-w-2xl mx-auto font-light">Discover and claim every credit you&apos;re entitled to</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {taxCredits.map((credit, index) => (
            <motion.div
              key={credit.program}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group relative p-6 rounded-2xl bg-[#006ddd]/5 border border-[#7fc8ff]/10 hover:border-[#7fc8ff]/20 hover:scale-[1.02] transition-all duration-300"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className={`text-2xl font-light text-${credit.color}`}>{credit.program}</h3>
                  <p className="text-[#7fc8ff]/60 text-sm">{credit.description}</p>
                </div>
                <div className={`px-4 py-2 rounded-md bg-${credit.color}/20 text-${credit.color} font-medium text-lg`}>
                  {credit.maxCredit}
                </div>
              </div>
              <p className="text-[#99d3ff]/80">{credit.benefit}</p>
            </motion.div>
          ))}
        </div>
        
        {/* Value proposition callout */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="relative p-8 md:p-12 rounded-2xl overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-[#006ddd]/20 via-[#00d4ff]/20 to-[#7fc8ff]/20" />
          <div className="absolute inset-0 backdrop-blur-xl" />
          <div className="absolute inset-[1px] rounded-2xl bg-[#030710]/90" />
          
          <div className="relative z-10 text-center">
            <blockquote className="text-xl md:text-2xl text-[#cce9ff] font-light mb-6 leading-relaxed">
              &ldquo;For a mid-sized Quebec company with <span className="text-[#00d4ff] font-medium">$2M in R&D expenditure</span>, 
              this solution can identify and help claim an additional 
              <span className="bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent font-medium"> $200K-$400K </span> 
              in tax credits annually while reducing compliance risk and administrative burden by 
              <span className="text-[#7fc8ff] font-medium"> 80%</span>.&rdquo;
            </blockquote>
            <p className="text-[#7fc8ff]/60">Real-world impact from Quebec Tax Calculator</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}


/* ═══════════════════════════════════════════════════════════════════════════
   TECHNICAL HIGHLIGHTS SECTION
   ═══════════════════════════════════════════════════════════════════════════ */

const techFeatures = [
  { icon: "database", title: "SAP CAP Framework", description: "Enterprise-ready with OData v4 APIs for seamless SAP integration", gradient: "from-[#006ddd] to-[#00d4ff]" },
  { icon: "detail-view", title: "Fiori Elements UI", description: "Consistent, accessible user experience with SAP design language", gradient: "from-[#00d4ff] to-[#7fc8ff]" },
  { icon: "calculator", title: "Real-time Calculations", description: "Decimal.js precision for financial accuracy down to the cent", gradient: "from-[#7fc8ff] to-[#cce9ff]" },
  { icon: "workflow-tasks", title: "Workflow Management", description: "Draft → Submit → Review → Approve lifecycle with full tracking", gradient: "from-green-500 to-emerald-500" },
  { icon: "locked", title: "Audit Compliance", description: "Complete change history with user tracking for regulatory compliance", gradient: "from-orange-500 to-amber-500" },
  { icon: "accelerated", title: "Extensible Architecture", description: "Ready for additional provinces and tax programs as needed", gradient: "from-yellow-500 to-orange-500" },
];

function TechSection() {
  const prefersReducedMotion = useReducedMotion();
  
  return (
    <section className="relative py-32 overflow-hidden">
      <div className="absolute inset-0 bg-[#030710]" />
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, rgba(127, 200, 255, 0.3) 1px, transparent 0)`,
        backgroundSize: '40px 40px',
      }} />
      
      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium uppercase tracking-wider bg-[#006ddd]/15 text-[#7fc8ff] border border-[#7fc8ff]/20 mb-4">
            <SapIcon name="detail-view" size={12} /> Technology
          </span>
          <h2 className="text-4xl md:text-5xl font-light text-[#cce9ff] mb-4 tracking-tight">
            Built with <span className="bg-gradient-to-r from-[#006ddd] to-[#00d4ff] bg-clip-text text-transparent">Enterprise</span> in Mind
          </h2>
          <p className="text-xl text-[#99d3ff]/80 max-w-2xl mx-auto font-light">Powered by cutting-edge SAP technologies and modern architecture</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {techFeatures.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={prefersReducedMotion ? {} : { y: -8, scale: 1.02 }}
              className="group relative p-6 rounded-2xl bg-[#006ddd]/5 border border-[#7fc8ff]/10 hover:border-[#7fc8ff]/20 transition-all duration-300"
            >
              <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                <SapIcon name={feature.icon} className="text-white" size={24} />
              </div>
              <h3 className="text-lg font-medium text-[#cce9ff] mb-2">{feature.title}</h3>
              <p className="text-[#7fc8ff]/60 text-sm">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}


/* ═══════════════════════════════════════════════════════════════════════════
   TARGET AUDIENCE & COMPLIANCE SECTION
   ═══════════════════════════════════════════════════════════════════════════ */

const targetAudience = [
  { icon: "factory", title: "Quebec R&D Companies" },
  { icon: "group", title: "Manufacturing & Processing" },
  { icon: "accelerated", title: "Tech Startups" },
  { icon: "official-service", title: "Accounting Firms" },
  { icon: "building", title: "Enterprise Finance" },
];

const complianceItems = [
  { label: "Quebec Taxation Act", icon: "shield" },
  { label: "Federal Income Tax Act", icon: "official-service" },
  { label: "CCPC Eligibility", icon: "accept" },
  { label: "Bilingual (EN/FR)", icon: "world" },
  { label: "WCAG 2.1 Accessible", icon: "globe" },
];

function AudienceComplianceSection() {
  return (
    <section className="relative py-32 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-[#030710] via-[#006ddd]/5 to-[#030710]" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-6">
        {/* Target Audience */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium uppercase tracking-wider bg-[#006ddd]/15 text-[#7fc8ff] border border-[#7fc8ff]/20 mb-4">
            <SapIcon name="group" size={12} /> Who It&apos;s For
          </span>
          <h2 className="text-4xl md:text-5xl font-light text-[#cce9ff] mb-4 tracking-tight">
            Built for <span className="bg-gradient-to-r from-[#006ddd] to-[#00d4ff] bg-clip-text text-transparent">Every</span> Quebec Business
          </h2>
        </motion.div>
        
        <div className="flex flex-wrap justify-center gap-4 mb-20">
          {targetAudience.map((audience, index) => (
            <motion.div
              key={audience.title}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="group flex items-center gap-3 px-6 py-4 rounded-md bg-[#006ddd]/5 border border-[#7fc8ff]/10 hover:border-[#7fc8ff]/30 hover:bg-[#006ddd]/10 transition-all duration-300"
            >
              <SapIcon name={audience.icon} className="text-[#7fc8ff]" size={20} />
              <span className="text-[#cce9ff] font-medium">{audience.title}</span>
            </motion.div>
          ))}
        </div>

        {/* Compliance */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h3 className="text-2xl font-light text-[#cce9ff] mb-2">Compliance & Standards</h3>
          <p className="text-[#7fc8ff]/60">Built to meet rigorous regulatory requirements</p>
        </motion.div>
        
        <div className="flex flex-wrap justify-center gap-4">
          {complianceItems.map((item, index) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-green-500/10 border border-green-500/20"
            >
              <SapIcon name={item.icon} className="text-green-400" size={16} />
              <span className="text-[#99d3ff]/80 text-sm">{item.label}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}


/* ═══════════════════════════════════════════════════════════════════════════
   CONTACT ADIL FAIYAZ SECTION - Enterprise Contact Form
   ═══════════════════════════════════════════════════════════════════════════ */

function ContactAdilSection() {
  const prefersReducedMotion = useReducedMotion();
  const [contactMethod, setContactMethod] = useState<"email" | "booking">("email");
  const [formData, setFormData] = useState({ name: "", email: "", company: "", message: "" });
  const [formState, setFormState] = useState<"idle" | "submitting" | "success">("idle");
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormState("submitting");
    
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Also open mailto as fallback to ensure email is sent
        if (data.mailtoLink) {
          window.open(data.mailtoLink, "_blank");
        }
        setFormState("success");
        setFormData({ name: "", email: "", company: "", message: "" });
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error("Form submission error:", error);
      // Fallback: open mailto directly
      const subject = `Quebec Tax Calculator Inquiry from ${formData.name} at ${formData.company}`;
      const body = `Name: ${formData.name}\nEmail: ${formData.email}\nCompany: ${formData.company}\n\nMessage:\n${formData.message}`;
      window.open(`mailto:adil.faiyaz@consultsda.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_blank");
      setFormState("success");
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <section id="contact-adil" className="relative py-32 overflow-hidden">
      <AnimatedBackground variant="section" />
      
      {/* Floating particles */}
      {!prefersReducedMotion && [...Array(15)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-[#00d4ff]/30"
          style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%` }}
          animate={{ y: [0, -20, 0], opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 4 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 2 }}
        />
      ))}
      
      <div className="relative z-10 max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          
          {/* Left Column - Info */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#006ddd]/15 border border-[#7fc8ff]/20 mb-6"
            >
              <SapIcon name="employee" className="text-[#7fc8ff]" size={16} />
              <span className="text-sm font-medium text-[#cce9ff]">Get in Touch</span>
            </motion.div>

            <h2 className="text-4xl md:text-5xl font-light text-[#cce9ff] mb-6 tracking-tight">
              Ready to <span className="bg-gradient-to-r from-[#006ddd] to-[#00d4ff] bg-clip-text text-transparent">Transform</span> Your Tax Process?
            </h2>

            <p className="text-lg text-[#99d3ff]/80 mb-8 font-light leading-relaxed">
              Connect with our team to learn how Quebec Tax Calculator can help your business maximize tax credits and streamline compliance.
            </p>

            {/* Contact Card - Adil Faiyaz */}
            <div className="relative p-6 rounded-2xl bg-gradient-to-br from-[#006ddd]/10 to-[#00d4ff]/5 border border-[#7fc8ff]/20 mb-8">
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-[#006ddd]/20 to-[#00d4ff]/20 blur-xl opacity-50" />
              <div className="relative">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#006ddd] to-[#00d4ff] flex items-center justify-center text-white text-xl font-light">
                    AF
                  </div>
                  <div>
                    <h3 className="text-xl font-medium text-[#cce9ff]">Adil Faiyaz</h3>
                    <p className="text-[#7fc8ff]/80 text-sm">Solutions Architect</p>
                    <p className="text-[#00d4ff] text-sm font-medium">SDA</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <a href="tel:+15144437486" className="flex items-center gap-3 text-[#99d3ff]/80 hover:text-[#cce9ff] transition-colors group">
                    <div className="w-10 h-10 rounded-lg bg-[#006ddd]/20 flex items-center justify-center group-hover:bg-[#006ddd]/30 transition-colors">
                      <SapIcon name="phone" className="text-[#7fc8ff]" size={20} />
                    </div>
                    <span>514-443-7486</span>
                  </a>
                  <a href="mailto:adil.faiyaz@consultsda.com" className="flex items-center gap-3 text-[#99d3ff]/80 hover:text-[#cce9ff] transition-colors group">
                    <div className="w-10 h-10 rounded-lg bg-[#006ddd]/20 flex items-center justify-center group-hover:bg-[#006ddd]/30 transition-colors">
                      <SapIcon name="email" className="text-[#7fc8ff]" size={20} />
                    </div>
                    <span>adil.faiyaz@consultsda.com</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Benefits */}
            <div className="space-y-4">
              {[
                { icon: "history", text: "Response within 24 hours" },
                { icon: "shield", text: "Free initial consultation" },
                { icon: "trophy", text: "Enterprise-grade support" },
              ].map((benefit, index) => (
                <motion.div
                  key={benefit.text}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <SapIcon name={benefit.icon} className="text-green-400" size={16} />
                  </div>
                  <span className="text-[#99d3ff]/80">{benefit.text}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right Column - Form */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            {/* Glow effect */}
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-[#006ddd]/30 via-[#00d4ff]/20 to-[#7fc8ff]/30 blur-xl opacity-50" />
            
            <div className="relative p-8 md:p-10 rounded-2xl bg-[#030710]/90 backdrop-blur-xl border border-[#7fc8ff]/10">
              {/* Method Toggle */}
              <div className="flex gap-2 p-1 rounded-lg bg-[#006ddd]/10 border border-[#7fc8ff]/10 mb-8">
                <button
                  onClick={() => setContactMethod("email")}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-md text-sm font-medium transition-all duration-300 ${
                    contactMethod === "email"
                      ? "bg-gradient-to-r from-[#006ddd] to-[#00d4ff] text-white shadow-lg"
                      : "text-[#7fc8ff]/60 hover:text-[#cce9ff]"
                  }`}
                >
                  <SapIcon name="email" size={16} />
                  Send Email
                </button>
                <button
                  onClick={() => setContactMethod("booking")}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-md text-sm font-medium transition-all duration-300 ${
                    contactMethod === "booking"
                      ? "bg-gradient-to-r from-[#006ddd] to-[#00d4ff] text-white shadow-lg"
                      : "text-[#7fc8ff]/60 hover:text-[#cce9ff]"
                  }`}
                >
                  <SapIcon name="calendar" size={16} />
                  Book a Slot
                </button>
              </div>

              <AnimatePresence mode="wait">
                {formState === "success" ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="text-center py-8"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200 }}
                      className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 flex items-center justify-center"
                    >
                      <SapIcon name="accept" className="text-green-400" size={40} />
                    </motion.div>
                    <h3 className="text-2xl font-light text-[#cce9ff] mb-3">
                      {contactMethod === "email" ? "Message Sent!" : "Booking Requested!"}
                    </h3>
                    <p className="text-[#99d3ff]/80 mb-6">
                      {contactMethod === "email" 
                        ? "Adil will get back to you within 24 hours."
                        : "We'll send you calendar options shortly."
                      }
                    </p>
                    <button
                      onClick={() => setFormState("idle")}
                      className="text-[#7fc8ff] hover:text-[#cce9ff] transition-colors text-sm"
                    >
                      Send another message
                    </button>
                  </motion.div>
                ) : contactMethod === "email" ? (
                  <motion.form
                    key="email-form"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    onSubmit={handleSubmit}
                    className="space-y-5"
                  >
                    <div>
                      <label className="block text-sm font-medium text-[#99d3ff]/80 mb-2">
                        Name <span className="text-[#00d4ff]">*</span>
                      </label>
                      <div className="relative">
                        <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${focusedField === "name" ? "text-[#00d4ff]" : "text-[#7fc8ff]/40"}`}>
                          <SapIcon name="employee" size={20} />
                        </div>
                        <input
                          type="text"
                          required
                          value={formData.name}
                          onChange={(e) => handleInputChange("name", e.target.value)}
                          onFocus={() => setFocusedField("name")}
                          onBlur={() => setFocusedField(null)}
                          placeholder="Your name"
                          className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-[#006ddd]/5 border border-[#7fc8ff]/10 text-[#cce9ff] placeholder:text-[#7fc8ff]/30 focus:outline-none focus:border-[#00d4ff]/50 focus:ring-2 focus:ring-[#00d4ff]/20 transition-all"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-[#99d3ff]/80 mb-2">
                        Email <span className="text-[#00d4ff]">*</span>
                      </label>
                      <div className="relative">
                        <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${focusedField === "email" ? "text-[#00d4ff]" : "text-[#7fc8ff]/40"}`}>
                          <SapIcon name="email" size={20} />
                        </div>
                        <input
                          type="email"
                          required
                          value={formData.email}
                          onChange={(e) => handleInputChange("email", e.target.value)}
                          onFocus={() => setFocusedField("email")}
                          onBlur={() => setFocusedField(null)}
                          placeholder="you@company.com"
                          className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-[#006ddd]/5 border border-[#7fc8ff]/10 text-[#cce9ff] placeholder:text-[#7fc8ff]/30 focus:outline-none focus:border-[#00d4ff]/50 focus:ring-2 focus:ring-[#00d4ff]/20 transition-all"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-[#99d3ff]/80 mb-2">
                        Company <span className="text-[#00d4ff]">*</span>
                      </label>
                      <div className="relative">
                        <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${focusedField === "company" ? "text-[#00d4ff]" : "text-[#7fc8ff]/40"}`}>
                          <SapIcon name="building" size={20} />
                        </div>
                        <input
                          type="text"
                          required
                          value={formData.company}
                          onChange={(e) => handleInputChange("company", e.target.value)}
                          onFocus={() => setFocusedField("company")}
                          onBlur={() => setFocusedField(null)}
                          placeholder="Your company"
                          className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-[#006ddd]/5 border border-[#7fc8ff]/10 text-[#cce9ff] placeholder:text-[#7fc8ff]/30 focus:outline-none focus:border-[#00d4ff]/50 focus:ring-2 focus:ring-[#00d4ff]/20 transition-all"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-[#99d3ff]/80 mb-2">Message</label>
                      <div className="relative">
                        <div className={`absolute left-4 top-4 transition-colors ${focusedField === "message" ? "text-[#00d4ff]" : "text-[#7fc8ff]/40"}`}>
                          <SapIcon name="comment" size={20} />
                        </div>
                        <textarea
                          rows={4}
                          value={formData.message}
                          onChange={(e) => handleInputChange("message", e.target.value)}
                          onFocus={() => setFocusedField("message")}
                          onBlur={() => setFocusedField(null)}
                          placeholder="Tell us about your needs..."
                          className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-[#006ddd]/5 border border-[#7fc8ff]/10 text-[#cce9ff] placeholder:text-[#7fc8ff]/30 focus:outline-none focus:border-[#00d4ff]/50 focus:ring-2 focus:ring-[#00d4ff]/20 transition-all resize-none"
                        />
                      </div>
                    </div>
                    
                    <button
                      type="submit"
                      disabled={formState === "submitting"}
                      className="group relative w-full inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-[#006ddd] to-[#00d4ff] text-white font-medium text-lg overflow-hidden transition-all duration-300 hover:shadow-[0_0_40px_rgba(0,212,255,0.3)] hover:scale-[1.02] disabled:opacity-70"
                    >
                      <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                      {formState === "submitting" ? (
                        <><Loader2 className="w-5 h-5 animate-spin" /> Sending...</>
                      ) : (
                        <><SapIcon name="paper-plane" size={20} /> Send Message</>
                      )}
                    </button>
                  </motion.form>
                ) : (
                  /* Booking Option */
                  <motion.div
                    key="booking-form"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-6"
                  >
                    <div className="text-center mb-6">
                      <SapIcon name="calendar" className="text-[#00d4ff] mx-auto mb-4" size={48} />
                      <h3 className="text-xl font-light text-[#cce9ff] mb-2">Schedule a Meeting</h3>
                      <p className="text-[#99d3ff]/80 text-sm">Choose a convenient time for a personalized demo</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      {["30 min - Quick Intro", "60 min - Full Demo", "45 min - Technical Deep Dive", "Custom Duration"].map((option) => (
                        <button
                          key={option}
                          className="p-4 rounded-xl bg-[#006ddd]/5 border border-[#7fc8ff]/10 hover:border-[#00d4ff]/30 hover:bg-[#006ddd]/10 transition-all duration-300 text-[#cce9ff] text-sm font-medium text-left"
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                    
                    <a
                      href="https://calendly.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative w-full inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-[#006ddd] to-[#00d4ff] text-white font-medium text-lg overflow-hidden transition-all duration-300 hover:shadow-[0_0_40px_rgba(0,212,255,0.3)] hover:scale-[1.02]"
                    >
                      <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                      <SapIcon name="calendar" size={20} />
                      Open Calendar
                      <SapIcon name="navigation-right-arrow" size={16} />
                    </a>
                    
                    <p className="text-center text-[#7fc8ff]/60 text-xs">
                      Or email <a href="mailto:adil.faiyaz@consultsda.com" className="text-[#00d4ff] hover:underline">adil.faiyaz@consultsda.com</a> directly
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}


/* ═══════════════════════════════════════════════════════════════════════════
   FINAL CTA SECTION
   ═══════════════════════════════════════════════════════════════════════════ */

function CTASection() {
  const prefersReducedMotion = useReducedMotion();
  
  return (
    <section className="relative py-32 overflow-hidden">
      <div className="absolute inset-0 bg-[#030710]" />
      <motion.div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, rgba(0, 109, 221, 0.2) 0%, transparent 60%)" }}
        animate={prefersReducedMotion ? {} : { scale: [1, 1.2, 1] }}
        transition={{ duration: 15, repeat: Infinity }}
      />
      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(0, 212, 255, 0.2) 0%, transparent 70%)",
          bottom: "-20%",
          right: "-10%",
          filter: "blur(100px)",
        }}
        animate={prefersReducedMotion ? {} : { x: [0, -50, 0], y: [0, 50, 0] }}
        transition={{ duration: 20, repeat: Infinity }}
      />
      
      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
        >
          <motion.div
            animate={prefersReducedMotion ? {} : { rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="inline-block mb-8"
          >
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#006ddd] to-[#00d4ff] flex items-center justify-center">
              <SapIcon name="calculator" className="text-white" size={40} />
            </div>
          </motion.div>
          
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-light text-[#cce9ff] mb-6 tracking-tight">
            Ready to <span className="bg-gradient-to-r from-[#006ddd] to-[#00d4ff] bg-clip-text text-transparent">Maximize</span> Your Tax Credits?
          </h2>
          
          <p className="text-xl text-[#99d3ff]/80 mb-10 max-w-2xl mx-auto font-light">
            Join Quebec businesses already saving millions with automated tax credit discovery and compliance
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="#contact-adil"
              className="group relative inline-flex items-center gap-3 px-10 py-5 rounded-md bg-gradient-to-r from-[#006ddd] to-[#00d4ff] text-white font-medium text-lg overflow-hidden transition-all duration-300 hover:shadow-[0_0_60px_rgba(0,212,255,0.5)] hover:scale-105"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <SapIcon name="calculator" size={24} />
              <span className="relative">Contact Adil Faiyaz</span>
              <SapIcon name="navigation-right-arrow" className="group-hover:translate-x-1 transition-transform" size={20} />
            </Link>
            
            <a
              href="tel:+15144437486"
              className="inline-flex items-center gap-2 px-8 py-5 text-[#99d3ff]/80 hover:text-[#cce9ff] transition-colors"
            >
              <SapIcon name="phone" size={20} />
              514-443-7486
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function QuebecTaxCalculatorPage() {
  return (
    <main className="min-h-screen bg-[#030710]">
      <HeroSection />
      <TrustedBySection />
      <PainPointsSection />
      <StatsSection />
      <TaxCreditsSection />
      <TechSection />
      <AudienceComplianceSection />
      <ContactAdilSection />
      <CTASection />
    </main>
  );
}
