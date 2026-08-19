"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";

export interface GlowButtonProps {
  label: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  href?: string;
  onClick?: () => void;
  className?: string;
  icon?: boolean;
}

const sizeStyles: Record<NonNullable<GlowButtonProps["size"]>, string> = {
  sm: "px-4 py-2 text-sm gap-1.5",
  md: "px-6 py-3 text-base gap-2",
  lg: "px-8 py-4 text-lg gap-2.5",
};

export function GlowButton({
  label,
  variant = "primary",
  size = "md",
  href,
  onClick,
  className = "",
  icon = false,
}: GlowButtonProps) {
  const prefersReducedMotion = useReducedMotion();
  
  const baseStyles =
    "group relative inline-flex items-center justify-center rounded-full font-semibold transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background overflow-hidden";

  const getVariantStyles = () => {
    switch (variant) {
      case "primary":
        return "bg-gradient-to-r from-accent-primary to-purple-500 text-white shadow-lg shadow-accent-primary/25 hover:shadow-xl hover:shadow-accent-primary/40 hover:scale-105";
      case "secondary":
        return "bg-white/[0.05] border border-white/[0.1] text-text-primary hover:bg-white/[0.1] hover:border-white/[0.2] hover:scale-105";
      case "ghost":
        return "text-text-secondary hover:text-text-primary hover:bg-white/[0.05]";
      default:
        return "";
    }
  };

  const classes = `${baseStyles} ${getVariantStyles()} ${sizeStyles[size]} ${className}`.trim();

  const content = (
    <>
      {/* Shimmer effect for primary */}
      {variant === "primary" && (
        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out" />
      )}
      
      {/* Glow pulse for primary */}
      {variant === "primary" && !prefersReducedMotion && (
        <span className="absolute inset-0 rounded-full bg-accent-primary/50 blur-xl opacity-0 group-hover:opacity-50 transition-opacity duration-300 -z-10" />
      )}
      
      <span className="relative z-10">{label}</span>
      
      {icon && (
        <ArrowRight className="relative z-10 w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
      )}
    </>
  );

  if (href) {
    if (prefersReducedMotion) {
      return (
        <Link href={href} className={classes}>
          {content}
        </Link>
      );
    }
    
    return (
      <motion.div whileTap={{ scale: 0.98 }}>
        <Link href={href} className={classes}>
          {content}
        </Link>
      </motion.div>
    );
  }

  if (prefersReducedMotion) {
    return (
      <button type="button" onClick={onClick} className={classes}>
        {content}
      </button>
    );
  }

  return (
    <motion.button 
      type="button" 
      onClick={onClick} 
      className={classes}
      whileTap={{ scale: 0.98 }}
    >
      {content}
    </motion.button>
  );
}
