"use client";

import { GlassCard, GlowButton } from "@/components/ui";
import type { PricingTier } from "@/data/pricing";

interface PricingCardsProps {
  tiers: PricingTier[];
}

export function PricingCards({ tiers }: PricingCardsProps) {
  return (
    <section
      aria-label="Pricing tiers"
      className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch"
    >
      {tiers.map((tier) => (
        <GlassCard
          key={tier.id}
          interactive
          className={`relative flex flex-col p-8 ${
            tier.highlighted
              ? "border-accent-primary/50 ring-2 ring-accent-primary/30 md:scale-105"
              : ""
          }`}
        >
          {/* Popular Badge */}
          {tier.highlighted && (
            <div className="absolute top-0 right-0 bg-accent-primary text-white text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-bl-lg rounded-tr-2xl">
              Popular
            </div>
          )}

          {/* Tier Name */}
          <h2 className="text-h3 text-text-primary mb-2">{tier.name}</h2>

          {/* Price */}
          <div className="mb-4">
            <span className="text-4xl font-bold text-text-primary">
              {tier.price}
            </span>
            <span className="text-text-muted ml-2 text-sm">{tier.period}</span>
          </div>

          {/* Description */}
          <p className="text-text-secondary text-sm mb-6">{tier.description}</p>

          {/* Features List */}
          <ul className="space-y-3 mb-8 flex-1">
            {tier.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2">
                <svg
                  className="w-5 h-5 text-accent-secondary flex-shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="text-text-secondary text-sm">{feature}</span>
              </li>
            ))}
          </ul>

          {/* CTA Button */}
          <GlowButton
            label={tier.ctaLabel}
            href={tier.ctaHref}
            variant={tier.highlighted ? "primary" : "secondary"}
            size="lg"
            className="w-full"
          />
        </GlassCard>
      ))}
    </section>
  );
}
