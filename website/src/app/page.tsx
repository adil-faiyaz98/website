import dynamic from "next/dynamic";
import { HeroSection, ScrollReveal, ErrorBoundary } from "@/components";
import { NoiseTexture } from "@/components/ui/NoiseTexture";

// Dynamic imports for below-fold sections (code splitting)
const CapabilitiesSection = dynamic(
  () =>
    import("@/components/CapabilitiesSection").then(
      (mod) => mod.CapabilitiesSection
    ),
  { loading: () => null }
);

const PlatformsSection = dynamic(
  () =>
    import("@/components/PlatformsSection").then(
      (mod) => mod.PlatformsSection
    ),
  { loading: () => null }
);

const TestimonialsSection = dynamic(
  () =>
    import("@/components/TestimonialsSection").then(
      (mod) => mod.TestimonialsSection
    ),
  { loading: () => null }
);

const StatsSection = dynamic(
  () =>
    import("@/components/StatsSection").then((mod) => mod.StatsSection),
  { ssr: false, loading: () => null }
);

const ClientLogos = dynamic(
  () =>
    import("@/components/ClientLogos").then((mod) => mod.ClientLogos),
  { loading: () => null }
);

const CTABanner = dynamic(
  () => import("@/components/CTABanner").then((mod) => mod.CTABanner),
  { loading: () => null }
);

export default function Home() {
  return (
    <main id="main-content" className="relative">
      {/* Global NoiseTexture overlay for visual richness */}
      <ErrorBoundary>
        <NoiseTexture opacity={3} className="z-[1]" />
      </ErrorBoundary>

      <HeroSection />

      <ScrollReveal>
        <CapabilitiesSection />
      </ScrollReveal>

      <ScrollReveal delay={0.1}>
        <PlatformsSection />
      </ScrollReveal>

      <ScrollReveal delay={0.1}>
        <TestimonialsSection />
      </ScrollReveal>

      <ScrollReveal delay={0.1}>
        <StatsSection />
      </ScrollReveal>

      <ScrollReveal delay={0.1}>
        <ClientLogos />
      </ScrollReveal>

      <ScrollReveal delay={0.1}>
        <CTABanner />
      </ScrollReveal>
    </main>
  );
}
