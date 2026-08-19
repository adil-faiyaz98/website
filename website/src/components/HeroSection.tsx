"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { GradientMesh } from "@/components/ui/GradientMesh";
import { StaggeredText } from "@/components/ui/StaggeredText";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ArrowRight, Sparkles, Zap, Shield, Play, ChevronDown, MousePointer } from "lucide-react";

const ParticleCanvas = dynamic(
  () => import("@/components/ui/ParticleCanvas").then((m) => m.ParticleCanvas),
  { ssr: false, loading: () => null }
);

const CursorGlow = dynamic(
  () => import("@/components/ui/CursorGlow").then((m) => m.CursorGlow),
  { ssr: false, loading: () => null }
);

/* ─────────────────────────────────────────────
   LangChain-style Particle Tree Background
   Fine pale-blue dots converging into patterns
   ───────────────────────────────────────────── */

function ParticleTree() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const animationFrameRef = useRef<number>(0);

  useEffect(() => {
    if (prefersReducedMotion) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Particle configuration - LangChain style
    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      alpha: number;
      targetAlpha: number;
    }

    const particles: Particle[] = [];
    const particleCount = 80;

    // Create particles
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 2 + 1,
        alpha: Math.random() * 0.5 + 0.2,
        targetAlpha: Math.random() * 0.5 + 0.2,
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw particles and connections
      particles.forEach((p, i) => {
        // Update position
        p.x += p.vx;
        p.y += p.vy;

        // Bounce off edges
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        // Pulse alpha
        p.alpha += (p.targetAlpha - p.alpha) * 0.02;
        if (Math.random() < 0.01) {
          p.targetAlpha = Math.random() * 0.5 + 0.2;
        }

        // Draw particle - LangChain cyan-blue
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(127, 200, 255, ${p.alpha})`;
        ctx.fill();

        // Draw connections to nearby particles
        particles.slice(i + 1).forEach((p2) => {
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 150) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(127, 200, 255, ${0.1 * (1 - distance / 150)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [prefersReducedMotion]);

  if (prefersReducedMotion) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ opacity: 0.6 }}
    />
  );
}

/* ─────────────────────────────────────────────
   Floating Gradient Orbs - Enhanced
   ───────────────────────────────────────────── */

function FloatingOrbs() {
  const prefersReducedMotion = useReducedMotion();
  
  if (prefersReducedMotion) return null;
  
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Deep blue orb - LangChain #006ddd */}
      <motion.div
        className="absolute w-[700px] h-[700px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(0, 109, 221, 0.25) 0%, transparent 70%)",
          top: "-15%",
          right: "-10%",
          filter: "blur(80px)",
        }}
        animate={{
          x: [0, 40, 0],
          y: [0, 30, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      
      {/* Cyan orb - #00d4ff */}
      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(0, 212, 255, 0.2) 0%, transparent 70%)",
          bottom: "5%",
          left: "-10%",
          filter: "blur(80px)",
        }}
        animate={{
          x: [0, -30, 0],
          y: [0, -40, 0],
          scale: [1, 1.15, 1],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2,
        }}
      />
      
      {/* Subtle purple accent */}
      <motion.div
        className="absolute w-[400px] h-[400px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(124, 58, 237, 0.15) 0%, transparent 70%)",
          top: "50%",
          left: "40%",
          filter: "blur(100px)",
        }}
        animate={{
          x: [0, 50, 0],
          y: [0, -30, 0],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1,
        }}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────
   Feature Pills - LangChain Style
   ───────────────────────────────────────────── */

const featurePills = [
  { icon: Zap, label: "Automated Migration" },
  { icon: Shield, label: "Enterprise Security" },
  { icon: Sparkles, label: "AI-Powered" },
];

function FeaturePills() {
  const prefersReducedMotion = useReducedMotion();
  
  return (
    <motion.div
      className="flex flex-wrap gap-3 mt-6"
      initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1, duration: 0.5 }}
    >
      {featurePills.map((pill, index) => (
        <motion.div
          key={pill.label}
          className="group flex items-center gap-2 px-4 py-2 rounded-md bg-[#006ddd]/10 border border-[#7fc8ff]/20 text-sm text-[#cce9ff] cursor-default"
          initial={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.1 + index * 0.1, duration: 0.3 }}
          whileHover={{ 
            scale: 1.05, 
            borderColor: "rgba(127, 200, 255, 0.5)",
            backgroundColor: "rgba(0, 109, 221, 0.2)"
          }}
        >
          <pill.icon className="w-4 h-4 text-[#7fc8ff]" />
          <span className="font-light">{pill.label}</span>
        </motion.div>
      ))}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   Stats Bar - LangChain Typography
   ───────────────────────────────────────────── */

const heroStats = [
  { value: "500+", label: "Migrations" },
  { value: "45K+", label: "Interfaces" },
  { value: "99.9%", label: "Uptime" },
  { value: "24/7", label: "Support" },
];

function StatsBar() {
  const prefersReducedMotion = useReducedMotion();
  
  return (
    <motion.div
      className="flex items-center gap-8 mt-10 pt-8 border-t border-[#7fc8ff]/10"
      initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.3, duration: 0.5 }}
    >
      {heroStats.map((stat, index) => (
        <motion.div
          key={stat.label}
          className="text-center group"
          initial={prefersReducedMotion ? undefined : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 + index * 0.1 }}
        >
          <div className="text-2xl md:text-3xl font-light text-[#cce9ff] group-hover:text-white transition-colors">
            {stat.value}
          </div>
          <div className="text-xs text-[#7fc8ff]/60 uppercase tracking-wider mt-1 font-medium">
            {stat.label}
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   Enhanced Migration Diagram - Modern Style
   ───────────────────────────────────────────── */

function AnimatedMigrationDiagram() {
  const prefersReducedMotion = useReducedMotion();

  const nodeVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: 0.7 + i * 0.15, duration: 0.5, ease: "easeOut" },
    }),
  };

  const pathVariants = {
    hidden: { pathLength: 0, opacity: 0 },
    visible: (i: number) => ({
      pathLength: 1,
      opacity: 1,
      transition: { delay: 0.9 + i * 0.12, duration: 0.6, ease: "easeInOut" },
    }),
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, ease: "easeOut", delay: 0.5 }}
      className="w-full max-w-lg mx-auto relative"
    >
      {/* Glow effect behind */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#006ddd]/20 via-[#00d4ff]/10 to-[#006ddd]/20 blur-3xl rounded-3xl" />
      
      <svg
        viewBox="0 0 480 360"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto relative z-10"
        role="img"
        aria-label="Migration workflow diagram"
      >
        <defs>
          <linearGradient id="heroArrowNew" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#006ddd" />
            <stop offset="100%" stopColor="#00d4ff" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Animated flow paths */}
        <motion.path
          d="M155 180 C185 180 195 120 225 110"
          stroke="url(#heroArrowNew)"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          variants={pathVariants}
          initial="hidden"
          animate="visible"
          custom={0}
        />
        <motion.path
          d="M155 180 C185 180 195 180 225 180"
          stroke="url(#heroArrowNew)"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          variants={pathVariants}
          initial="hidden"
          animate="visible"
          custom={1}
        />
        <motion.path
          d="M155 180 C185 180 195 240 225 250"
          stroke="url(#heroArrowNew)"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          variants={pathVariants}
          initial="hidden"
          animate="visible"
          custom={2}
        />

        {/* Source node: SAP PI/PO */}
        <motion.g variants={nodeVariants} initial="hidden" animate="visible" custom={0}>
          <rect
            x="25" y="140" width="130" height="80" rx="12"
            fill="#030710" stroke="#006ddd" strokeWidth="1.5"
          />
          <text x="90" y="173" textAnchor="middle" fill="#cce9ff" fontSize="13" fontWeight="300">
            SAP PI/PO
          </text>
          <text x="90" y="195" textAnchor="middle" fill="#7fc8ff" fontSize="10" opacity="0.7">
            Legacy System
          </text>
        </motion.g>

        {/* Center transformation badge */}
        <motion.g variants={nodeVariants} initial="hidden" animate="visible" custom={1}>
          <circle cx="190" cy="180" r="20" fill="#030710" stroke="#00d4ff" strokeWidth="1.5" />
          <text x="190" y="185" textAnchor="middle" fill="#00d4ff" fontSize="16">⚡</text>
        </motion.g>

        {/* Target platforms */}
        {[
          { y: 80, label: "Dell Boomi", sub: "iPaaS" },
          { y: 150, label: "Informatica", sub: "IICS" },
          { y: 220, label: "MuleSoft", sub: "Anypoint" },
        ].map((item, i) => (
          <motion.g key={item.label} variants={nodeVariants} initial="hidden" animate="visible" custom={i + 2}>
            <rect
              x="230" y={item.y} width="140" height="60" rx="10"
              fill="#030710" stroke="#00d4ff" strokeWidth="1.5"
            />
            <text x="300" y={item.y + 27} textAnchor="middle" fill="#cce9ff" fontSize="12" fontWeight="300">
              {item.label}
            </text>
            <text x="300" y={item.y + 45} textAnchor="middle" fill="#7fc8ff" fontSize="10" opacity="0.7">
              {item.sub}
            </text>
          </motion.g>
        ))}

        {/* Success indicators */}
        {[110, 180, 250].map((cy, i) => (
          <motion.g key={cy} variants={nodeVariants} initial="hidden" animate="visible" custom={5 + i}>
            <circle cx="395" cy={cy} r="14" fill="#030710" stroke="#10B981" strokeWidth="1.5" />
            <text x="395" y={cy + 5} textAnchor="middle" fill="#10B981" fontSize="12">✓</text>
          </motion.g>
        ))}

        {/* Decorative particles */}
        {!prefersReducedMotion && (
          <>
            <motion.circle
              cx="430" cy="80" r="2" fill="#7fc8ff"
              animate={{ opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 3, repeat: Infinity }}
            />
            <motion.circle
              cx="450" cy="150" r="2" fill="#00d4ff"
              animate={{ opacity: [0.4, 0.9, 0.4] }}
              transition={{ duration: 4, repeat: Infinity, delay: 1 }}
            />
            <motion.circle
              cx="440" cy="290" r="2" fill="#7fc8ff"
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 3.5, repeat: Infinity, delay: 0.5 }}
            />
          </>
        )}
      </svg>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   Smooth Scroll Indicator
   ───────────────────────────────────────────── */

function ScrollIndicator() {
  const prefersReducedMotion = useReducedMotion();
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY < 100);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToContent = () => {
    const target = document.getElementById("platforms") || document.getElementById("capabilities");
    if (target) {
      target.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ delay: 2, duration: 0.5 }}
          onClick={scrollToContent}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-[#7fc8ff]/60 hover:text-[#cce9ff] transition-colors cursor-pointer group"
          aria-label="Scroll to content"
        >
          <span className="text-xs uppercase tracking-widest font-medium">Scroll</span>
          <motion.div
            className="w-6 h-10 rounded-full border-2 border-current flex items-start justify-center p-2"
            animate={prefersReducedMotion ? {} : { y: [0, 5, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <motion.div 
              className="w-1.5 h-1.5 rounded-full bg-[#00d4ff]"
              animate={prefersReducedMotion ? {} : { y: [0, 8, 0], opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          </motion.div>
        </motion.button>
      )}
    </AnimatePresence>
  );
}

/* ─────────────────────────────────────────────
   Hero Section - LangChain Inspired
   ───────────────────────────────────────────── */

export function HeroSection() {
  const prefersReducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLElement>(null);
  
  // Parallax effect
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });
  
  const y = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  return (
    <section
      ref={containerRef}
      id="hero"
      className="relative min-h-screen flex items-center overflow-hidden pt-24 pb-20 px-6"
      style={{ backgroundColor: "#030710" }}
    >
      {/* Background layers */}
      <ErrorBoundary>
        <FloatingOrbs />
      </ErrorBoundary>
      
      <ErrorBoundary>
        <ParticleTree />
      </ErrorBoundary>
      
      <ErrorBoundary>
        <GradientMesh
          colors={["#006ddd", "#00d4ff", "#7c3aed"]}
          opacity={6}
          animated={!prefersReducedMotion}
        />
      </ErrorBoundary>

      {/* Grid pattern overlay - LangChain style */}
      <div 
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `linear-gradient(rgba(127, 200, 255, 0.3) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(127, 200, 255, 0.3) 1px, transparent 1px)`,
          backgroundSize: '80px 80px',
        }}
      />

      {/* Cursor-following glow */}
      <ErrorBoundary>
        <CursorGlow radius={400} color="#006ddd" className="absolute inset-0 z-0" />
      </ErrorBoundary>

      {/* Main content with parallax */}
      <motion.div 
        className="relative z-10 mx-auto w-full max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-20 items-center"
        style={prefersReducedMotion ? {} : { y, opacity }}
      >
        {/* Text Content */}
        <div className="flex flex-col gap-6">
          {/* Animated Badge - LangChain style */}
          <motion.div
            className="inline-flex items-center gap-2 w-fit"
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <span className="relative inline-flex items-center gap-2 rounded-md bg-[#006ddd]/15 px-4 py-2 text-sm text-[#7fc8ff] font-medium border border-[#7fc8ff]/20">
              <Sparkles className="w-4 h-4" />
              SAP PI/PO Migration Experts
              {/* Shimmer */}
              <span className="absolute inset-0 overflow-hidden rounded-md">
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_3s_infinite]" />
              </span>
            </span>
          </motion.div>

          {/* Headline - LangChain weight-300 typography */}
          <div className="space-y-2">
            <motion.h1
              className="text-5xl sm:text-6xl lg:text-7xl font-light text-[#cce9ff] leading-[1.1] tracking-tight"
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              Transform Your
            </motion.h1>
            <motion.span
              className="block text-5xl sm:text-6xl lg:text-7xl font-light leading-[1.1] tracking-tight bg-gradient-to-r from-[#006ddd] via-[#00d4ff] to-[#7fc8ff] bg-clip-text text-transparent"
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
            >
              Integration Platform
            </motion.span>
          </div>

          {/* Sub-headline */}
          <motion.p
            className="text-lg md:text-xl text-[#99d3ff]/80 max-w-xl leading-relaxed font-light"
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5, ease: "easeOut" }}
          >
            Migrate from legacy SAP PI/PO to cloud-native platforms with 
            <span className="text-[#cce9ff] font-normal"> AI-powered automation</span>, 
            comprehensive testing, and zero-downtime deployment.
          </motion.p>

          {/* Feature Pills */}
          <FeaturePills />

          {/* CTA Buttons - LangChain 6px radius */}
          <motion.div
            className="flex flex-wrap items-center gap-4 mt-4"
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.5, ease: "easeOut" }}
          >
            {/* Primary CTA */}
            <Link
              href="/demo"
              className="group relative inline-flex items-center gap-2 px-7 py-3.5 rounded-md bg-gradient-to-r from-[#006ddd] to-[#00d4ff] text-white font-medium overflow-hidden transition-all duration-300 hover:shadow-[0_0_40px_rgba(0,212,255,0.3)] hover:scale-105"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <span className="relative flex items-center gap-2">
                Start Free Assessment
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>
            
            {/* Secondary CTA */}
            <Link
              href="#platforms"
              className="group inline-flex items-center gap-2 px-6 py-3.5 rounded-md border border-[#7fc8ff]/20 text-[#cce9ff] font-medium hover:bg-[#006ddd]/10 hover:border-[#7fc8ff]/40 transition-all duration-300"
            >
              <Play className="w-4 h-4" />
              Watch Demo
            </Link>
          </motion.div>

          {/* Stats Bar */}
          <StatsBar />
        </div>

        {/* Visual Element — animated migration diagram */}
        <motion.div
          className="flex items-center justify-center relative"
          initial={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, duration: 0.8, ease: "easeOut" }}
        >
          <AnimatedMigrationDiagram />
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <ScrollIndicator />
    </section>
  );
}
