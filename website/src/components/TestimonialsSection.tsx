"use client";

import Image from "next/image";
import { Quote } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { testimonials } from "@/data/testimonials";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

export function TestimonialsSection() {
  const prefersReducedMotion = useReducedMotion();
  
  return (
    <section id="testimonials" className="relative py-24 px-6 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[#030710]" />
      
      {/* Subtle gradient */}
      <motion.div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse at top, rgba(0, 109, 221, 0.06) 0%, transparent 50%)" }}
        animate={prefersReducedMotion ? {} : { opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 10, repeat: Infinity }}
      />
      
      {/* Grid pattern */}
      <div 
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `linear-gradient(rgba(127, 200, 255, 0.3) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(127, 200, 255, 0.3) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />
      
      <div className="relative z-10 mx-auto w-full max-w-7xl">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#006ddd]/15 border border-[#7fc8ff]/20 text-sm text-[#7fc8ff] mb-6">
            <Quote className="w-4 h-4" />
            Customer Stories
          </span>
          <h2 className="text-4xl md:text-5xl font-light text-[#cce9ff] mb-4 tracking-tight">
            What Our <span className="bg-gradient-to-r from-[#006ddd] to-[#00d4ff] bg-clip-text text-transparent">Clients</span> Say
          </h2>
          <p className="text-xl text-[#99d3ff]/80 max-w-2xl mx-auto font-light">
            Hear from enterprise teams who transformed their integration landscape
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <ScrollReveal key={testimonial.id} delay={index * 0.1}>
              <div className="group relative h-full">
                {/* Glow effect on hover */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#006ddd]/20 to-[#00d4ff]/10 blur-xl opacity-0 group-hover:opacity-60 transition-opacity duration-500" />
                
                <div className="relative p-6 rounded-2xl bg-[#0a0a1a]/80 backdrop-blur-sm border border-[#7fc8ff]/10 hover:border-[#7fc8ff]/25 transition-all duration-500 h-full flex flex-col">
                  {/* Quote icon */}
                  <div className="w-10 h-10 rounded-xl bg-[#006ddd]/10 flex items-center justify-center mb-4">
                    <Quote
                      className="w-5 h-5 text-[#7fc8ff]"
                      aria-hidden="true"
                    />
                  </div>

                  {/* Quote text */}
                  <blockquote className="text-[#99d3ff]/80 text-sm leading-relaxed mb-6 flex-1 font-light">
                    &ldquo;{testimonial.quote}&rdquo;
                  </blockquote>

                  {/* Author info */}
                  <div className="flex items-center gap-3 mt-auto pt-4 border-t border-[#7fc8ff]/10">
                    {testimonial.companyLogo && (
                      <div className="w-10 h-10 rounded-full bg-[#0a0a1a] border border-[#7fc8ff]/10 flex items-center justify-center shrink-0 overflow-hidden">
                        <Image
                          src={testimonial.companyLogo}
                          alt={`${testimonial.company} logo`}
                          width={24}
                          height={24}
                          className="object-contain brightness-0 invert opacity-70"
                        />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#cce9ff] truncate">
                        {testimonial.authorName}
                      </p>
                      <p className="text-xs text-[#7fc8ff]/60 truncate">
                        {testimonial.authorTitle}, {testimonial.company}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
