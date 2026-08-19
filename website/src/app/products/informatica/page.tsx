import { Metadata } from "next";
import { platformDetails } from "@/data/platforms";
import { GlassCard, BentoGrid, BentoItem, GlowButton } from "@/components/ui";

export const metadata: Metadata = {
  title: "Informatica IICS Migration | SDA Migration WorkBench",
  description:
    "AI-powered migration from SAP PI/PO to Informatica Intelligent Cloud Services. Leverage CLAIRE AI, metadata intelligence, and hybrid connectivity for seamless integration transformation.",
  openGraph: {
    title: "Informatica IICS Migration | SDA Migration WorkBench",
    description:
      "AI-powered migration from SAP PI/PO to Informatica Intelligent Cloud Services. Leverage CLAIRE AI, metadata intelligence, and hybrid connectivity for seamless integration transformation.",
    siteName: "SDA Migration WorkBench",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Informatica IICS Migration | SDA Migration WorkBench",
    description:
      "AI-powered migration from SAP PI/PO to Informatica Intelligent Cloud Services. Leverage CLAIRE AI, metadata intelligence, and hybrid connectivity for seamless integration transformation.",
  },
};

export default function InformaticaProductPage() {
  const platform = platformDetails.find((p) => p.id === "informatica");

  if (!platform) {
    return null;
  }

  return (
    <div className="space-y-16 pb-16">
      {/* Hero Banner */}
      <section className="relative py-12 md:py-20">
        <div className="text-center max-w-4xl mx-auto">
          <div className="mb-6 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={platform.logo}
              alt={`${platform.name} logo`}
              className="h-16 w-auto"
            />
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
            {platform.heroTagline}
          </h1>
          <p className="text-lg md:text-xl text-white/70 mb-8 max-w-3xl mx-auto">
            {platform.description}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <GlowButton
              label="Book a Demo"
              variant="primary"
              size="lg"
              href="/demo"
            />
            <GlowButton
              label="View Assessment"
              variant="secondary"
              size="lg"
              href="/products/assessment"
            />
          </div>
        </div>
      </section>

      {/* Capabilities Section */}
      <section>
        <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-4">
          IICS Migration Capabilities
        </h2>
        <p className="text-white/60 text-center mb-10 max-w-2xl mx-auto">
          Comprehensive tooling to migrate your SAP PI/PO landscape to
          Informatica Intelligent Cloud Services with AI-driven automation.
        </p>
        <BentoGrid columns={3}>
          {platform.capabilities.map((capability) => (
            <BentoItem
              key={capability.title}
              colSpan={1}
              rowSpan={1}
            >
              <GlassCard interactive className="p-6 h-full">
                <div className="mb-4 w-10 h-10 rounded-lg bg-accent-primary/10 flex items-center justify-center">
                  <span className="text-accent-primary text-lg font-bold">
                    {capability.icon.charAt(0)}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {capability.title}
                </h3>
                <p className="text-white/60 text-sm leading-relaxed">
                  {capability.description}
                </p>
              </GlassCard>
            </BentoItem>
          ))}
        </BentoGrid>
      </section>

      {/* Feature Comparison Section */}
      <section>
        <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-4">
          Before &amp; After Migration
        </h2>
        <p className="text-white/60 text-center mb-10 max-w-2xl mx-auto">
          See how migrating from SAP PI/PO to Informatica IICS transforms your
          integration capabilities.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-4 px-4 text-white font-semibold text-sm uppercase tracking-wider">
                  Feature
                </th>
                <th className="text-left py-4 px-4 text-white/60 font-semibold text-sm uppercase tracking-wider">
                  SAP PI/PO (Before)
                </th>
                <th className="text-left py-4 px-4 text-accent-primary font-semibold text-sm uppercase tracking-wider">
                  Informatica IICS (After)
                </th>
              </tr>
            </thead>
            <tbody>
              {platform.comparisonFeatures.map((item) => (
                <tr
                  key={item.feature}
                  className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                >
                  <td className="py-4 px-4 text-white font-medium">
                    {item.feature}
                  </td>
                  <td className="py-4 px-4 text-white/50">{item.before}</td>
                  <td className="py-4 px-4 text-white/80">{item.after}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* CTA Section */}
      <section className="text-center py-12 md:py-16">
        <GlassCard className="p-10 md:p-16 max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            Ready to Migrate to Informatica IICS?
          </h2>
          <p className="text-white/60 mb-8 max-w-xl mx-auto">
            Book a free consultation to assess your SAP PI/PO landscape and get
            a tailored migration roadmap powered by CLAIRE AI.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <GlowButton
              label="Book a Demo"
              variant="primary"
              size="lg"
              href="/demo"
            />
            <GlowButton
              label="Contact Sales"
              variant="secondary"
              size="lg"
              href="/company/contact"
            />
          </div>
        </GlassCard>
      </section>
    </div>
  );
}
