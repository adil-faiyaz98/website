"use client";

import { stats } from "@/data/testimonials";
import { AnimatedCounter } from "@/components/ui";

export function StatsSection() {
  return (
    <section className="py-20 px-6">
      <div className="mx-auto w-full max-w-7xl">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {stats.map((stat) => (
            <div
              key={stat.id}
              className="flex flex-col items-center text-center gap-2"
            >
              <AnimatedCounter
                target={stat.value}
                duration={2000}
                suffix={stat.suffix}
                prefix={stat.prefix}
                className="text-4xl md:text-5xl font-bold text-accent-primary"
              />
              <span className="text-sm md:text-base text-text-secondary">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
