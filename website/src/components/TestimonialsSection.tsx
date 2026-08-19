"use client";

import Image from "next/image";
import { Quote } from "lucide-react";
import { testimonials } from "@/data/testimonials";
import { GlassCard } from "@/components/ui/GlassCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

export function TestimonialsSection() {
  return (
    <section id="testimonials" className="py-20 px-6">
      <div className="mx-auto w-full max-w-7xl">
        <SectionHeader
          title="What Our Clients Say"
          subtitle="Hear from enterprise teams who transformed their integration landscape"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <ScrollReveal key={testimonial.id} delay={index * 0.1}>
              <GlassCard interactive={true} className="p-6 h-full flex flex-col">
                {/* Quote icon */}
                <Quote
                  className="w-8 h-8 text-accent-primary/40 mb-4 shrink-0"
                  aria-hidden="true"
                />

                {/* Quote text */}
                <blockquote className="text-text-secondary text-sm leading-relaxed mb-6 flex-1">
                  &ldquo;{testimonial.quote}&rdquo;
                </blockquote>

                {/* Author info */}
                <div className="flex items-center gap-3 mt-auto pt-4 border-t border-white/5">
                  {testimonial.companyLogo && (
                    <div className="w-10 h-10 rounded-full bg-surface-elevated flex items-center justify-center shrink-0 overflow-hidden">
                      <Image
                        src={testimonial.companyLogo}
                        alt={`${testimonial.company} logo`}
                        width={24}
                        height={24}
                        className="object-contain"
                      />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {testimonial.authorName}
                    </p>
                    <p className="text-xs text-text-secondary truncate">
                      {testimonial.authorTitle}, {testimonial.company}
                    </p>
                  </div>
                </div>
              </GlassCard>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
