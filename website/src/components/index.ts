// Barrel export for components
// Individual component exports will be added as they are created

export { Navbar } from "./Navbar";
export { HeroSection } from "./HeroSection";
export { CapabilitiesSection } from "./CapabilitiesSection";
export { PlatformsSection } from "./PlatformsSection";
export { TestimonialsSection } from "./TestimonialsSection";
export { CTABanner } from "./CTABanner";
export { Footer } from "./Footer";
export { StatsSection } from "./StatsSection";
export { ClientLogos } from "./ClientLogos";

// UI Components
export { ScrollReveal } from "./ui/ScrollReveal";
export type { ScrollRevealProps } from "./ui/ScrollReveal";
export { ErrorBoundary } from "./ErrorBoundary";

// Page Transitions and Animations
export {
  PageTransition,
  ScrollReveal as AnimatedScrollReveal,
  StaggerContainer,
  staggerChildVariants,
  FadeIn,
  ScaleIn,
  Parallax,
} from "./PageTransition";

// Navigation UX Components
export { Breadcrumbs, PageHeader, ScrollProgress } from "./Breadcrumbs";

// SAP UI5 Icons
export { SapIcon } from "./SapIcon";
export type { SapIconProps } from "./SapIcon";
