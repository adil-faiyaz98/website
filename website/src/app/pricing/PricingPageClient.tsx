"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PricingCards } from "./PricingCards";
import { PricingFAQ } from "./PricingFAQ";
import type { ProductPricing } from "@/data/pricing";
import { SapIcon } from "@/components";

interface PricingPageClientProps {
  products: ProductPricing[];
}

export function PricingPageClient({ products }: PricingPageClientProps) {
  const [selectedProduct, setSelectedProduct] = useState(products[0]?.id || "migration");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const activeProduct = products.find((p) => p.id === selectedProduct) || products[0];

  return (
    <main id="main-content" className="min-h-screen bg-[#030710] py-20 px-6">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#006ddd]/10 via-transparent to-transparent" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-light text-[#cce9ff] mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-[#99d3ff]/80 max-w-2xl mx-auto font-light">
            Choose the product and plan that fits your needs. All plans include dedicated support.
          </p>
        </motion.div>


        {/* Product Selector */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex justify-center mb-12"
        >
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-3 px-6 py-3 rounded-xl bg-[#006ddd]/10 border border-[#7fc8ff]/20 hover:border-[#7fc8ff]/40 transition-all min-w-[300px]"
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                selectedProduct === "tax-calculator" 
                  ? "bg-gradient-to-br from-[#006ddd] to-[#10b981]" 
                  : "bg-gradient-to-br from-[#7c3aed] to-[#06B6D4]"
              }`}>
                <SapIcon 
                  name={selectedProduct === "tax-calculator" ? "money-bills" : "workflow-tasks"} 
                  size={20} 
                  className="text-white" 
                />
              </div>
              <div className="flex-1 text-left">
                <div className="text-[#cce9ff] font-medium">{activeProduct.name}</div>
                <div className="text-xs text-[#7fc8ff]/60">{activeProduct.description}</div>
              </div>
              <SapIcon 
                name={isDropdownOpen ? "navigation-up-arrow" : "navigation-down-arrow"} 
                size={16} 
                className="text-[#7fc8ff]" 
              />
            </button>

            <AnimatePresence>
              {isDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full left-0 right-0 mt-2 rounded-xl bg-[#0a0a1a] border border-[#7fc8ff]/20 overflow-hidden z-50"
                >
                  {products.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => {
                        setSelectedProduct(product.id);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-[#006ddd]/10 transition-colors ${
                        selectedProduct === product.id ? "bg-[#006ddd]/20" : ""
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        product.id === "tax-calculator" 
                          ? "bg-gradient-to-br from-[#006ddd] to-[#10b981]" 
                          : "bg-gradient-to-br from-[#7c3aed] to-[#06B6D4]"
                      }`}>
                        <SapIcon 
                          name={product.id === "tax-calculator" ? "money-bills" : "workflow-tasks"} 
                          size={16} 
                          className="text-white" 
                        />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="text-[#cce9ff] text-sm font-medium">{product.name}</div>
                        <div className="text-xs text-[#7fc8ff]/60">{product.description}</div>
                      </div>
                      {selectedProduct === product.id && (
                        <SapIcon name="accept" size={16} className="text-[#00d4ff]" />
                      )}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Product Badge */}
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedProduct}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex justify-center mb-8"
          >
            {selectedProduct === "tax-calculator" && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#10b981]/10 border border-[#10b981]/30">
                <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
                <span className="text-sm text-[#10b981]">New: 2026 CRIC Support</span>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Pricing Tier Cards */}
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedProduct}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <PricingCards tiers={activeProduct.tiers} />
          </motion.div>
        </AnimatePresence>

        {/* FAQ Section */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`faq-${selectedProduct}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <PricingFAQ faqs={activeProduct.faqs} />
          </motion.div>
        </AnimatePresence>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-16 text-center"
        >
          <div className="inline-flex flex-col sm:flex-row items-center gap-4 p-6 rounded-2xl bg-gradient-to-r from-[#006ddd]/10 to-[#10b981]/10 border border-[#7fc8ff]/20">
            <div className="text-left">
              <h3 className="text-lg font-medium text-[#cce9ff]">Need a custom solution?</h3>
              <p className="text-sm text-[#7fc8ff]/70">Contact us for enterprise pricing and custom integrations.</p>
            </div>
            <a
              href="/company/contact"
              className="px-6 py-3 rounded-lg bg-[#006ddd] hover:bg-[#006ddd]/80 text-white font-medium transition-colors whitespace-nowrap"
            >
              Talk to Sales
            </a>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
