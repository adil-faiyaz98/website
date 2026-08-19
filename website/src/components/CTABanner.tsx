"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CTAButton } from "./ui/CTAButton";
import { ArrowRight, Sparkles } from "lucide-react";

export function CTABanner() {
  const prefersReducedMotion = useReducedMotion();
  
  return (
    <section className="relative py-24 overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-r from-accent-primary/5 via-accent-secondary/5 to-accent-tertiary/5" />
        
        {/* Animated orbs */}
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full opacity-30"
          style={{
            background: "radial-gradient(circle, rgba(124, 58, 237, 0.3) 0%, transparent 70%)",
            top: "-20%",
            left: "-10%",
            filter: "blur(80px)",
          }}
          animate={prefersReducedMotion ? {} : {
            x: [0, 50, 0],
            y: [0, 30, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        
        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full opacity-25"
          style={{
            background: "radial-gradient(circle, rgba(6, 182, 212, 0.3) 0%, transparent 70%)",
            bottom: "-20%",
            right: "-10%",
            filter: "blur(80px)",
          }}
          animate={prefersReducedMotion ? {} : {
            x: [0, -40, 0],
            y: [0, -30, 0],
          }}
          transition={{
            duration: 18,
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
            backgroundSize: '60px 60px',
          }}
        />
        
        {/* Top and bottom borders with gradient */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent-primary/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent-secondary/30 to-transparent" />
      </div>
      
      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        {/* Badge */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-primary/10 border border-accent-primary/20 mb-6"
        >
          <Sparkles className="w-4 h-4 text-accent-primary" />
          <span className="text-sm text-accent-primary font-medium">Start Your Migration Journey</span>
        </motion.div>
        
        <motion.h2
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-4xl md:text-5xl font-bold text-text-primary mb-6"
        >
          Ready to{" "}
          <span className="gradient-text">modernize</span>
          {" "}your integration?
        </motion.h2>
        
        <motion.p
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-lg text-text-secondary mb-10 max-w-2xl mx-auto leading-relaxed"
        >
          Book a personalized demo to see how our AI-powered migration services can
          transform your SAP PI/PO integrations into modern, scalable solutions.
        </motion.p>
        
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <CTAButton label="Book a Demo" variant="primary" size="lg" href="/demo" />
          <a 
            href="/company/contact" 
            className="group inline-flex items-center gap-2 px-6 py-3 text-text-secondary hover:text-text-primary transition-colors"
          >
            Contact Sales
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </a>
        </motion.div>
      </div>
    </section>
  );
}
