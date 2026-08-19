"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";

export interface CTAButtonProps {
  label: string;
  variant: "primary" | "secondary" | "ghost";
  size: "sm" | "md" | "lg";
  href?: string;
  onClick?: () => void;
  className?: string;
}

const sizeStyles: Record<CTAButtonProps["size"], string> = {
  sm: "px-4 py-2 text-sm",
  md: "px-6 py-3 text-base",
  lg: "px-8 py-4 text-lg",
};

export function CTAButton({
  label,
  variant,
  size,
  href,
  onClick,
  className = "",
}: CTAButtonProps) {
  const prefersReducedMotion = useReducedMotion();
  
  const getVariantStyles = () => {
    switch (variant) {
      case "primary":
        return "bg-gradient-to-r from-accent-primary to-purple-500 text-white shadow-lg shadow-accent-primary/20 hover:shadow-xl hover:shadow-accent-primary/30 hover:scale-105";
      case "secondary":
        return "border border-white/[0.1] text-text-primary bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/[0.2] hover:scale-105";
      case "ghost":
        return "text-text-secondary hover:text-text-primary hover:bg-white/[0.05]";
      default:
        return "";
    }
  };
  
  const baseStyles =
    "group relative inline-flex items-center justify-center rounded-full font-medium transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background overflow-hidden";

  const classes = `${baseStyles} ${getVariantStyles()} ${sizeStyles[size]} ${className}`.trim();

  const content = (
    <>
      {/* Shimmer effect for primary */}
      {variant === "primary" && (
        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
      )}
      <span className="relative">{label}</span>
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
