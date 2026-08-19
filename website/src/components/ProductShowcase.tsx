"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { SapIcon } from "@/components";

/* ═══════════════════════════════════════════════════════════════════════════
   PRODUCT SHOWCASE SECTION
   Features both Migration WorkBench and Quebec Tax Calculator
   ═══════════════════════════════════════════════════════════════════════════ */

const products = [
  {
    id: "migration",
    title: "Migration WorkBench",
    tagline: "SAP PI/PO Migration",
    description: "Transform your integration landscape with AI-powered migration from legacy SAP PI/PO to cloud-native platforms.",
    stats: [
      { label: "Interfaces Migrated", value: "45K+" },
      { label: "Time Saved", value: "70%" },
      { label: "Success Rate", value: "99.9%" },
    ],
    features: ["Dell Boomi", "Informatica IICS", "MuleSoft Anypoint"],
    href: "/products/assessment",
    cta: "Explore Migration",
    gradient: "from-[#7c3aed] via-[#06B6D4] to-[#7c3aed]",
    bgGradient: "from-[#7c3aed]/20 to-[#06B6D4]/10",
    icon: "workflow-tasks",
  },

  {
    id: "tax",
    title: "Quebec Tax Calculator",
    tagline: "R&D Tax Credit Automation",
    description: "Maximize your Quebec tax credits with automated CRIC, SR&ED, and CDAE-IA eligibility assessment and claim management.",
    stats: [
      { label: "Avg. Additional Credits", value: "$200K+" },
      { label: "Processing Time", value: "3 Days" },
      { label: "Error Reduction", value: "96%" },
    ],
    features: ["CRIC (30% Rate)", "SR&ED Federal", "CDAE-IA", "C3i Equipment"],
    href: "/products/quebec-tax-calculator",
    cta: "Explore Tax Calculator",
    gradient: "from-[#006ddd] via-[#00d4ff] to-[#10b981]",
    bgGradient: "from-[#006ddd]/20 to-[#10b981]/10",
    icon: "money-bills",
    featured: true,
    badge: "New 2026 CRIC Support",
  },
];

function ProductCard({ product, index }: { product: typeof products[0]; index: number }) {
  const prefersReducedMotion = useReducedMotion();
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: index * 0.2 }}
      className="relative group"
    >
      {/* Glow effect */}
      <div className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${product.bgGradient} blur-2xl opacity-0 group-hover:opacity-60 transition-opacity duration-500`} />
      
      <div className="relative p-8 rounded-3xl bg-[#030710]/80 backdrop-blur-xl border border-[#7fc8ff]/10 hover:border-[#7fc8ff]/20 transition-all duration-500 h-full flex flex-col">
        {/* Badge */}
        {product.badge && (
          <span className="absolute -top-3 right-6 px-3 py-1 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-medium">
            {product.badge}
          </span>
        )}
        
        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${product.gradient} flex items-center justify-center flex-shrink-0`}>
            <SapIcon name={product.icon} size={28} className="text-white" />
          </div>
          <div>
            <span className="text-xs text-[#7fc8ff]/60 uppercase tracking-wider font-medium">{product.tagline}</span>
            <h3 className="text-2xl font-light text-[#cce9ff] mt-1">{product.title}</h3>
          </div>
        </div>

        
        {/* Description */}
        <p className="text-[#99d3ff]/80 mb-6 flex-1">{product.description}</p>
        
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {product.stats.map((stat) => (
            <div key={stat.label} className="text-center p-3 rounded-xl bg-[#006ddd]/5">
              <div className={`text-xl font-light bg-gradient-to-r ${product.gradient} bg-clip-text text-transparent`}>
                {stat.value}
              </div>
              <div className="text-xs text-[#7fc8ff]/60 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
        
        {/* Features */}
        <div className="flex flex-wrap gap-2 mb-6">
          {product.features.map((feature) => (
            <span 
              key={feature} 
              className="px-3 py-1 rounded-md bg-[#006ddd]/10 border border-[#7fc8ff]/10 text-xs text-[#cce9ff]"
            >
              {feature}
            </span>
          ))}
        </div>
        
        {/* CTA */}
        <Link
          href={product.href}
          className={`group/btn relative inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r ${product.gradient} text-white font-medium overflow-hidden transition-all duration-300 hover:shadow-[0_0_30px_rgba(0,212,255,0.3)] hover:scale-[1.02]`}
        >
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700" />
          <span className="relative">{product.cta}</span>
          <SapIcon name="navigation-right-arrow" size={16} className="relative group-hover/btn:translate-x-1 transition-transform" />
        </Link>
      </div>
    </motion.div>
  );
}


export function ProductShowcase() {
  const prefersReducedMotion = useReducedMotion();
  
  return (
    <section id="products" className="relative py-24 px-6 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[#030710]" />
      <motion.div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, rgba(0, 109, 221, 0.08) 0%, transparent 70%)" }}
        animate={prefersReducedMotion ? {} : { scale: [1, 1.1, 1] }}
        transition={{ duration: 15, repeat: Infinity }}
      />
      
      {/* Grid pattern */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(rgba(127, 200, 255, 0.3) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(127, 200, 255, 0.3) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />
      
      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#006ddd]/15 border border-[#7fc8ff]/20 text-sm text-[#7fc8ff] mb-6">
            <SapIcon name="lightbulb" size={16} />
            Enterprise Solutions
          </span>
          <h2 className="text-4xl md:text-5xl font-light text-[#cce9ff] mb-4 tracking-tight">
            Powerful <span className="bg-gradient-to-r from-[#006ddd] to-[#00d4ff] bg-clip-text text-transparent">Products</span>
          </h2>
          <p className="text-xl text-[#99d3ff]/80 max-w-2xl mx-auto font-light">
            Enterprise-grade solutions built on SAP CAP technology for integration migration and tax optimization
          </p>
        </motion.div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {products.map((product, index) => (
            <ProductCard key={product.id} product={product} index={index} />
          ))}
        </div>
        
        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="text-center mt-12"
        >
          <p className="text-[#7fc8ff]/60 mb-4">Need a custom solution?</p>
          <Link 
            href="/company/contact" 
            className="inline-flex items-center gap-2 text-[#00d4ff] hover:text-[#cce9ff] transition-colors"
          >
            <span>Contact our team</span>
            <SapIcon name="navigation-right-arrow" size={16} />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
