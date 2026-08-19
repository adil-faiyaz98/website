"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { navigationItems } from "@/data/navigation";
import { MobileMenu } from "@/components/ui";
import { useScrollPosition } from "@/hooks";
import { LAYOUT } from "@/lib/constants";
import { 
  Sparkles, 
  ChevronDown, 
  ArrowRight,
  Zap,
  Shield,
  Calculator,
  FileCode,
  Users,
  BookOpen,
  Mail,
  Building2,
  Briefcase,
  FileText,
} from "lucide-react";

// Icon mapping for menu items
const iconMap: Record<string, React.ElementType> = {
  "Quebec Tax Calculator": Calculator,
  "Dell Boomi": Zap,
  "Informatica": FileCode,
  "MuleSoft": Shield,
  "Assessment": FileText,
  "About": Building2,
  "Careers": Briefcase,
  "Partners": Users,
  "Contact": Mail,
  "Blog": BookOpen,
  "Case Studies": FileText,
  "Documentation": FileCode,
  "Webinars": Users,
};

export function Navbar() {
  const pathname = usePathname();
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const scrollY = useScrollPosition();
  const isScrolled = scrollY >= LAYOUT.navbarScrollThreshold;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setActiveDropdown(null);
    if (activeDropdown) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [activeDropdown]);

  // Check if a path is active
  const isActivePath = useCallback((href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }, [pathname]);

  // Check if any dropdown item is active
  const isDropdownActive = useCallback((items: { href: string }[]) => {
    return items.some(item => isActivePath(item.href));
  }, [isActivePath]);

  return (
    <>
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className={`fixed top-0 w-full z-50 transition-all duration-500 ${
          isScrolled ? "py-2" : "py-4"
        }`}
      >
        {/* LangChain-style glassmorphism background */}
        <div 
          className={`absolute inset-0 transition-all duration-500 ${
            isScrolled
              ? "bg-[#030710]/80 backdrop-blur-2xl border-b border-[#cce9ff]/10 shadow-[0_4px_30px_rgba(0,0,0,0.3)]"
              : "bg-transparent border-b border-transparent"
          }`}
        />
        
        <nav aria-label="Main navigation" className="relative h-full">
          <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-4 sm:px-6 lg:px-8">
            {/* Animated Logo - LangChain inspired */}
            <Link 
              href="/" 
              className="group relative flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7fc8ff] focus-visible:rounded-lg"
            >
              {/* Logo icon with particle effect */}
              <motion.div
                className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-[#006ddd] to-[#00d4ff]"
                whileHover={{ scale: 1.08, rotate: 3 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
              >
                <Sparkles className="w-5 h-5 text-white" />
                {/* Particle glow */}
                <motion.div 
                  className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#006ddd] to-[#00d4ff] blur-xl"
                  initial={{ opacity: 0 }}
                  whileHover={{ opacity: 0.6 }}
                  transition={{ duration: 0.3 }}
                />
                {/* Ring animation on hover */}
                <motion.div
                  className="absolute inset-0 rounded-xl border-2 border-[#7fc8ff]"
                  initial={{ scale: 1, opacity: 0 }}
                  whileHover={{ scale: 1.2, opacity: 0.5 }}
                  transition={{ duration: 0.4 }}
                />
              </motion.div>
              
              {/* Logo text - Weight 300 like LangChain */}
              <div className="hidden sm:flex flex-col">
                <span className="text-xl font-light text-[#cce9ff] tracking-tight group-hover:text-white transition-colors duration-300">
                  SDA
                </span>
                <span className="text-[10px] text-[#7fc8ff]/70 uppercase tracking-[0.15em] font-medium -mt-0.5">
                  Migration WorkBench
                </span>
              </div>
            </Link>

            {/* Desktop Menu - LangChain style */}
            <ul className="hidden lg:flex items-center gap-1" role="menubar">
              {navigationItems.map((item, index) => (
                <motion.li 
                  key={item.label} 
                  className="relative"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + index * 0.05, duration: 0.4 }}
                >
                  {item.href ? (
                    <Link
                      href={item.href}
                      className={`relative px-4 py-2.5 text-sm font-normal tracking-wide transition-all duration-300 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7fc8ff] ${
                        isActivePath(item.href)
                          ? "text-[#cce9ff] bg-[#006ddd]/20"
                          : "text-[#99d3ff]/80 hover:text-[#cce9ff] hover:bg-white/[0.03]"
                      }`}
                    >
                      {item.label}
                      {/* Active indicator */}
                      {isActivePath(item.href) && (
                        <motion.div
                          layoutId="activeIndicator"
                          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#00d4ff]"
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        />
                      )}
                    </Link>
                  ) : item.dropdown ? (
                    <MegaDropdown
                      label={item.label}
                      items={item.dropdown}
                      isOpen={activeDropdown === item.label}
                      isActive={isDropdownActive(item.dropdown)}
                      onToggle={(e) => {
                        e.stopPropagation();
                        setActiveDropdown(activeDropdown === item.label ? null : item.label);
                      }}
                      onClose={() => setActiveDropdown(null)}
                    />
                  ) : null}
                </motion.li>
              ))}
            </ul>

            {/* Right side: CTA + Mobile toggle */}
            <div className="flex items-center gap-4">
              {/* Book a Demo CTA - LangChain 6px radius style */}
              <motion.div 
                className="hidden lg:block"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 }}
              >
                <Link
                  href="/demo"
                  className="group relative inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-gradient-to-r from-[#006ddd] to-[#00d4ff] text-white text-sm font-medium overflow-hidden transition-all duration-300 hover:shadow-[0_0_30px_rgba(0,212,255,0.3)] hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7fc8ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#030710]"
                >
                  {/* Shimmer effect */}
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                  <span className="relative flex items-center gap-2">
                    Book a Demo
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </Link>
              </motion.div>

              {/* Mobile hamburger toggle */}
              <motion.button
                type="button"
                className="lg:hidden relative inline-flex items-center justify-center w-10 h-10 rounded-lg text-[#99d3ff] hover:text-[#cce9ff] hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7fc8ff] transition-colors"
                aria-label="Open menu"
                aria-expanded={isMobileMenuOpen}
                onClick={() => setIsMobileMenuOpen(true)}
                whileTap={{ scale: 0.95 }}
              >
                <svg
                  className="h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                  />
                </svg>
              </motion.button>
            </div>
          </div>
        </nav>
      </motion.header>

      {/* Mobile Menu */}
      <MobileMenu
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />
    </>
  );
}

// Mega Dropdown Component - AWS/LangChain inspired
interface MegaDropdownProps {
  label: string;
  items: { label: string; href: string; description?: string }[];
  isOpen: boolean;
  isActive: boolean;
  onToggle: (e: React.MouseEvent) => void;
  onClose: () => void;
}

function MegaDropdown({ label, items, isOpen, isActive, onToggle, onClose }: MegaDropdownProps) {
  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={onToggle}
        className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-normal tracking-wide transition-all duration-300 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7fc8ff] ${
          isOpen || isActive
            ? "text-[#cce9ff] bg-[#006ddd]/20"
            : "text-[#99d3ff]/80 hover:text-[#cce9ff] hover:bg-white/[0.03]"
        }`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {label}
        <ChevronDown 
          className={`w-4 h-4 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} 
        />
      </button>

      {/* Mega dropdown panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 top-16 bg-black/20 backdrop-blur-sm z-40"
              onClick={onClose}
            />
            
            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-[400px] z-50"
            >
              {/* Glow effect */}
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-[#006ddd]/30 via-[#00d4ff]/20 to-[#006ddd]/30 blur-xl opacity-60" />
              
              <div className="relative rounded-xl border border-[#cce9ff]/10 bg-[#030710]/95 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden">
                {/* Header */}
                <div className="px-5 py-3 border-b border-[#cce9ff]/10 bg-gradient-to-r from-[#006ddd]/10 to-transparent">
                  <h3 className="text-xs font-medium text-[#7fc8ff] uppercase tracking-wider">
                    {label}
                  </h3>
                </div>
                
                {/* Items */}
                <div className="p-2">
                  {items.map((item, index) => {
                    const Icon = iconMap[item.label] || FileText;
                    return (
                      <motion.div
                        key={item.href}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Link
                          href={item.href}
                          onClick={onClose}
                          className="group flex items-start gap-3 p-3 rounded-lg transition-all duration-200 hover:bg-[#006ddd]/10"
                        >
                          <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-[#006ddd]/20 flex items-center justify-center group-hover:bg-[#006ddd]/30 transition-colors">
                            <Icon className="w-4 h-4 text-[#7fc8ff] group-hover:text-[#cce9ff] transition-colors" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="block text-sm font-medium text-[#cce9ff] group-hover:text-white transition-colors">
                              {item.label}
                            </span>
                            {item.description && (
                              <span className="block mt-0.5 text-xs text-[#99d3ff]/60 leading-relaxed line-clamp-2">
                                {item.description}
                              </span>
                            )}
                          </div>
                          <ArrowRight className="w-4 h-4 text-[#7fc8ff]/0 group-hover:text-[#7fc8ff] transition-all duration-200 group-hover:translate-x-1 mt-1" />
                        </Link>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
