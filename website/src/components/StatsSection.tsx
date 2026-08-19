"use client";

import { motion, useReducedMotion } from "framer-motion";
import { stats } from "@/data/testimonials";
import { AnimatedCounter } from "@/components/ui";

export function StatsSection() {
  const prefersReducedMotion = useReducedMotion();
  
  return (
    <section className="relative py-24 px-6 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#030710] via-[#030710] to-[#030710]" />
      
      {/* Subtle glow */}
      <motion.div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, rgba(0, 109, 221, 0.06) 0%, transparent 60%)" }}
        animate={prefersReducedMotion ? {} : { opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 8, repeat: Infinity }}
      />
      
      {/* Horizontal lines */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#7fc8ff]/20 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#7fc8ff]/20 to-transparent" />
      
      <div className="relative z-10 mx-auto w-full max-w-7xl">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-light text-[#cce9ff] mb-3">
            Trusted by <span className="bg-gradient-to-r from-[#006ddd] to-[#00d4ff] bg-clip-text text-transparent">Enterprise Teams</span>
          </h2>
          <p className="text-[#99d3ff]/70 text-lg font-light">
            Delivering measurable results across industries
          </p>
        </motion.div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="group relative"
            >
              {/* Card */}
              <div className="relative p-6 md:p-8 rounded-2xl bg-[#0a0a1a]/50 backdrop-blur-sm border border-[#7fc8ff]/10 hover:border-[#7fc8ff]/25 transition-all duration-500 text-center">
                {/* Glow on hover */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#006ddd]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                <div className="relative z-10">
                  <AnimatedCounter
                    target={stat.value}
                    duration={2000}
                    suffix={stat.suffix}
                    prefix={stat.prefix}
                    className="text-4xl md:text-5xl font-light bg-gradient-to-r from-[#cce9ff] to-[#7fc8ff] bg-clip-text text-transparent"
                  />
                  <span className="block text-sm md:text-base text-[#7fc8ff]/60 mt-2 font-light">
                    {stat.label}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
