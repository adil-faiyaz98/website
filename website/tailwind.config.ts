import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#030014",
        surface: "#0a0a1a",
        "surface-elevated": "#13132a",
        "accent-primary": "#7c3aed",
        "accent-secondary": "#06b6d4",
        "accent-tertiary": "#f472b6",
        "accent-success": "#10b981",
        "text-primary": "#fafafa",
        "text-secondary": "#a1a1aa",
        "text-muted": "#71717a",
        border: "rgba(255, 255, 255, 0.08)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        // Modern fluid typography scale
        "display-xl": [
          "clamp(3rem, 8vw, 5rem)",
          { lineHeight: "1.1", fontWeight: "800", letterSpacing: "-0.02em" },
        ],
        display: [
          "clamp(2.5rem, 6vw, 4rem)",
          { lineHeight: "1.15", fontWeight: "700", letterSpacing: "-0.02em" },
        ],
        h1: [
          "clamp(2rem, 5vw, 3.5rem)",
          { lineHeight: "1.2", fontWeight: "700", letterSpacing: "-0.01em" },
        ],
        h2: [
          "clamp(1.75rem, 4vw, 2.5rem)",
          { lineHeight: "1.25", fontWeight: "600", letterSpacing: "-0.01em" },
        ],
        h3: [
          "clamp(1.25rem, 2.5vw, 1.75rem)",
          { lineHeight: "1.3", fontWeight: "600" },
        ],
        h4: ["1.25rem", { lineHeight: "1.4", fontWeight: "600" }],
        body: ["1rem", { lineHeight: "1.6", fontWeight: "400" }],
        "body-lg": ["1.125rem", { lineHeight: "1.7", fontWeight: "400" }],
        caption: ["0.875rem", { lineHeight: "1.5", fontWeight: "400" }],
        "caption-sm": [
          "0.75rem",
          { lineHeight: "1.4", fontWeight: "500", letterSpacing: "0.02em" },
        ],
      },
      spacing: {
        "grid-1": "8px",
        "grid-2": "16px",
        "grid-3": "24px",
        "grid-4": "32px",
        "grid-5": "40px",
        "grid-6": "48px",
        "grid-7": "56px",
        "grid-8": "64px",
        "grid-9": "72px",
        "grid-10": "80px",
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem",
      },
      boxShadow: {
        "glow-sm": "0 0 20px rgba(124, 58, 237, 0.3)",
        "glow-md": "0 0 40px rgba(124, 58, 237, 0.4)",
        "glow-lg": "0 0 60px rgba(124, 58, 237, 0.5)",
        "glow-cyan": "0 0 40px rgba(6, 182, 212, 0.4)",
        "glow-pink": "0 0 40px rgba(244, 114, 182, 0.4)",
        "inner-glow": "inset 0 0 20px rgba(124, 58, 237, 0.1)",
      },
      backgroundImage: {
        "gradient-radial":
          "radial-gradient(ellipse at center, var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "gradient-shine":
          "linear-gradient(135deg, rgba(255,255,255,0.1), transparent, rgba(255,255,255,0.05))",
      },
      keyframes: {
        "dropdown-in": {
          "0%": { opacity: "0", transform: "translateY(-8px) scale(0.96)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "gradient-shift": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-20px)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(124, 58, 237, 0.4)" },
          "50%": { boxShadow: "0 0 40px rgba(124, 58, 237, 0.6)" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "spin-slow": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "dropdown-in": "dropdown-in 0.2s ease-out",
        "gradient-shift": "gradient-shift 8s ease infinite",
        float: "float 6s ease-in-out infinite",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        shimmer: "shimmer 2s ease-in-out infinite",
        "spin-slow": "spin-slow 20s linear infinite",
        "fade-in-up": "fade-in-up 0.5s ease-out",
      },
      transitionDuration: {
        "400": "400ms",
      },
      transitionTimingFunction: {
        "bounce-in": "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
        smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
