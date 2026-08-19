/**
 * Theme constants and breakpoint values for the integration migration website.
 * These values align with the Tailwind CSS configuration in tailwind.config.ts.
 */

// ─── Theme Colors ────────────────────────────────────────────────────────────

export const COLORS = {
  background: "#0A0A0F",
  surface: "#12121A",
  surfaceElevated: "#1A1A2E",
  accentPrimary: "#6366F1",
  accentSecondary: "#06B6D4",
  textPrimary: "#F8FAFC",
  textSecondary: "#94A3B8",
  textMuted: "#64748B",
  border: "#1E293B",
} as const;

export type ThemeColor = keyof typeof COLORS;

// ─── Responsive Breakpoints (px) ────────────────────────────────────────────

export const BREAKPOINTS = {
  mobile: 768,
  tablet: 1024,
  desktop: 1440,
  large: 2560,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

// ─── Spacing Grid (8px base) ────────────────────────────────────────────────

export const SPACING = {
  1: 8,
  2: 16,
  3: 24,
  4: 32,
  5: 40,
  6: 48,
  7: 56,
  8: 64,
  9: 72,
  10: 80,
} as const;

export type SpacingScale = keyof typeof SPACING;

// ─── Layout Constants ───────────────────────────────────────────────────────

export const LAYOUT = {
  maxContainerWidth: 1280,
  navbarHeight: 64,
  navbarScrollThreshold: 50,
  sectionMinHeight: "60vh",
} as const;

// ─── Animation Durations (ms) ───────────────────────────────────────────────

export const ANIMATION = {
  fast: 150,
  normal: 300,
  slow: 500,
  pageTransition: 700,
} as const;

export type AnimationSpeed = keyof typeof ANIMATION;

// ─── Typography ─────────────────────────────────────────────────────────────

export const TYPOGRAPHY = {
  h1: { size: 56, lineHeight: 64, weight: 700 },
  h2: { size: 40, lineHeight: 48, weight: 600 },
  h3: { size: 24, lineHeight: 32, weight: 600 },
  body: { size: 16, lineHeight: 24, weight: 400 },
  caption: { size: 14, lineHeight: 20, weight: 400 },
} as const;

export type TypographyVariant = keyof typeof TYPOGRAPHY;
