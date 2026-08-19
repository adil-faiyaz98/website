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
    <section className="relative py-20 px-6 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[#030710]" />
      
      {/* Subtle glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#006ddd]/5 to-transparent" />
      
      {/* Borders */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#7fc8ff]/10 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#7fc8ff]/10 to-transparent" />
      
      <div className="relative z-10 mx-auto w-full max-w-7xl">
        <motion.p 
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center text-sm font-medium uppercase tracking-widest text-[#7fc8ff]/50 mb-12"
        >
          Trusted by leading enterprises worldwide
        </motion.p>

        <motion.div
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-8 md:gap-12 items-center justify-items-center"
          variants={prefersReducedMotion ? undefined : containerVariants}
          initial={prefersReducedMotion ? false : "hidden"}
          whileInView={prefersReducedMotion ? undefined : "visible"}
          viewport={{ once: true, margin: "-50px" }}
        >
          {clientLogos.map((logo) => (
            <motion.div
              key={logo.name}
              className="group flex items-center justify-center px-4 py-3 rounded-lg opacity-40 hover:opacity-100 transition-all duration-500 hover:bg-[#006ddd]/5"
              variants={prefersReducedMotion ? undefined : itemVariants}
            >
              <Image
                src={logo.src}
                alt={logo.name}
                width={140}
                height={50}
                className="h-10 w-auto object-contain filter brightness-0 invert opacity-60 group-hover:opacity-100 transition-opacity duration-500"
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
