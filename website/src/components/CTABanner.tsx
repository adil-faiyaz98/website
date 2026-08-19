"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CTAButton } from "./ui/CTAButton";
import { ArrowRight, Sparkles, Play } from "lucide-react";
import Link from "next/link";

export function CTABanner() {
  const prefersReducedMotion = useReducedMotion();
  
  return (
    <section className="relative py-32 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#030710] via-[#030710] to-[#0a0a1a]" />
      
      {/* Animated gradient orbs */}
      <motion.div
        className="absolute w-[800px] h-[800px] rounded-full opacity-30"
        style={{
          background: "radial-gradient(circle, rgba(0, 109, 221, 0.4) 0%, transparent 60%)",
          top: "-40%",
          left: "50%",
          transform: "translateX(-50%)",
          filter: "blur(100px)",
        }}
        animate={prefersReducedMotion ? {} : {
          scale: [1, 1.2, 1],
          opacity: [0.2, 0.35, 0.2],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      
      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full opacity-20"
        style={{
          background: "radial-gradient(circle, rgba(0, 212, 255, 0.3) 0%, transparent 70%)",
          bottom: "-30%",
          left: "20%",
          filter: "blur(80px)",
        }}
        animate={prefersReducedMotion ? {} : {
          x: [0, 50, 0],
          y: [0, -30, 0],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full opacity-20"
        style={{
          background: "radial-gradient(circle, rgba(16, 185, 129, 0.3) 0%, transparent 70%)",
          bottom: "-20%",
          right: "10%",
          filter: "blur(80px)",
        }}
        animate={prefersReducedMotion ? {} : {
          x: [0, -40, 0],
          y: [0, 30, 0],
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
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `linear-gradient(rgba(127, 200, 255, 0.3) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(127, 200, 255, 0.3) 1px, transparent 1px)`,
          backgroundSize: '80px 80px',
        }}
      />
      
      {/* Top border */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#7fc8ff]/20 to-transparent" />
      
      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
        {/* Badge */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#006ddd]/15 border border-[#7fc8ff]/20 mb-8"
        >
          <Sparkles className="w-4 h-4 text-[#7fc8ff]" />
          <span className="text-sm text-[#7fc8ff] font-medium">Start Your Digital Transformation</span>
        </motion.div>
        
        <motion.h2
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-4xl md:text-5xl lg:text-6xl font-light text-[#cce9ff] mb-6 leading-tight"
        >
          Ready to{" "}
          <span className="bg-gradient-to-r from-[#006ddd] via-[#00d4ff] to-[#10b981] bg-clip-text text-transparent">modernize</span>
          {" "}your
          <br className="hidden md:block" />
          enterprise systems?
        </motion.h2>
        
        <motion.p
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-lg md:text-xl text-[#99d3ff]/80 mb-12 max-w-3xl mx-auto leading-relaxed font-light"
        >
          Book a personalized demo to see how our AI-powered solutions can
          transform your SAP integrations and maximize your Quebec tax credits.
        </motion.p>
        
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          {/* Primary CTA */}
          <Link
            href="/demo"
            className="group relative inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-gradient-to-r from-[#006ddd] to-[#00d4ff] text-white font-medium overflow-hidden transition-all duration-300 hover:shadow-[0_0_50px_rgba(0,212,255,0.4)] hover:scale-105"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            <span className="relative">Schedule a Demo</span>
            <ArrowRight className="w-5 h-5 relative group-hover:translate-x-1 transition-transform" />
          </Link>
          
          {/* Secondary CTA */}
          <Link
            href="/products/assessment"
            className="group inline-flex items-center gap-2 px-6 py-4 rounded-lg border border-[#7fc8ff]/20 text-[#cce9ff] font-medium hover:bg-[#006ddd]/10 hover:border-[#7fc8ff]/40 transition-all duration-300"
          >
            <Play className="w-5 h-5" />
            <span>Free Assessment</span>
          </Link>
        </motion.div>
        
        {/* Trust indicators */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-12 flex items-center justify-center gap-6 text-[#7fc8ff]/50 text-sm"
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            No credit card required
          </span>
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Free 10-interface assessment
          </span>
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Cancel anytime
          </span>
        </motion.div>
      </div>
    </section>
  );
}
