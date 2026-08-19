"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { FAQ } from "@/data/pricing";

interface PricingFAQProps {
  faqs: FAQ[];
}

export function PricingFAQ({ faqs }: PricingFAQProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section aria-labelledby="faq-heading" className="mt-24 max-w-3xl mx-auto">
      <h2
        id="faq-heading"
        className="text-h2 text-text-primary text-center mb-12"
      >
        Frequently Asked Questions
      </h2>
      <dl className="space-y-4">
        {faqs.map((faq, index) => {
          const isOpen = openIndex === index;
          return (
            <div
              key={faq.question}
              className="rounded-xl border border-white/10 bg-surface/50 backdrop-blur-sm overflow-hidden"
            >
              <dt>
                <button
                  type="button"
                  onClick={() => toggle(index)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between px-6 py-5 text-left text-text-primary font-medium hover:bg-white/5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-inset"
                >
                  <span>{faq.question}</span>
                  <svg
                    className={`w-5 h-5 flex-shrink-0 text-text-muted transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
              </dt>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.dd
                    initial={
                      prefersReducedMotion
                        ? { opacity: 1 }
                        : { height: 0, opacity: 0 }
                    }
                    animate={
                      prefersReducedMotion
                        ? { opacity: 1 }
                        : { height: "auto", opacity: 1 }
                    }
                    exit={
                      prefersReducedMotion
                        ? { opacity: 0 }
                        : { height: 0, opacity: 0 }
                    }
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <p className="px-6 pb-5 text-text-secondary text-sm leading-relaxed">
                      {faq.answer}
                    </p>
                  </motion.dd>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
