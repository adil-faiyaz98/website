"use client";

import { motion, useReducedMotion } from "framer-motion";
import { platforms } from "@/data/platforms";
import { SectionHeader, PlatformCard } from "@/components/ui";

export function PlatformsSection() {
  const prefersReducedMotion = useReducedMotion();
  
  return (
    <section id="platforms" className="relative py-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Gradient orb */}
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full opacity-15"
          style={{
            background: "radial-gradient(circle, rgba(6, 182, 212, 0.4) 0%, transparent 70%)",
            top: "20%",
            right: "-15%",
            filter: "blur(100px)",
          }}
          animate={prefersReducedMotion ? {} : {
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        
        {/* Subtle grid */}
        <div 
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)`,
            backgroundSize: '40px 40px',
          }}
        />
      </div>
      
      <div className="relative z-10 max-w-7xl mx-auto">
        <SectionHeader
          title="Target Platforms"
          subtitle="Migrate to the integration platform that best fits your enterprise needs"
        />
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
          {platforms.map((platform, index) => (
            <motion.div
              key={platform.id}
              initial={prefersReducedMotion ? {} : { opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <PlatformCard
                id={platform.id}
                name={platform.name}
                logo={platform.logo}
                description={platform.description}
                href={platform.href}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
