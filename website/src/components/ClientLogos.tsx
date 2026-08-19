"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { clientLogos } from "@/data/testimonials";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" as const },
  },
};

export function ClientLogos() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section className="py-16 px-6">
      <div className="mx-auto w-full max-w-7xl">
        <p className="text-center text-sm font-medium uppercase tracking-wider text-text-secondary mb-8">
          Trusted by leading enterprises
        </p>

        <motion.div
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-8 items-center justify-items-center"
          variants={prefersReducedMotion ? undefined : containerVariants}
          initial={prefersReducedMotion ? false : "hidden"}
          whileInView={prefersReducedMotion ? undefined : "visible"}
          viewport={{ once: true, margin: "-50px" }}
        >
          {clientLogos.map((logo) => (
            <motion.div
              key={logo.name}
              className="flex items-center justify-center grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all duration-300"
              variants={prefersReducedMotion ? undefined : itemVariants}
            >
              <Image
                src={logo.src}
                alt={logo.name}
                width={120}
                height={40}
                className="h-8 w-auto object-contain"
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
