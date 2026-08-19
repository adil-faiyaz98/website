import { Metadata } from "next";
import { platformDetails } from "@/data/platforms";
import { GlassCard, BentoGrid, BentoItem, GlowButton, SectionHeader } from "@/components/ui";

const mulesoft = platformDetails.find((p) => p.id === "mulesoft")!;

export const metadata: Metadata = {
  title: "MuleSoft Anypoint Migration | SDA Migration WorkBench",
  description:
    "Transform SAP PI/PO integrations into API-led connectivity on MuleSoft Anypoint Platform. Automated pattern conversion with full DataWeave transformation support.",
  openGraph: {
    title: "MuleSoft Anypoint Migration | SDA Migration WorkBench",
    description:
      "Transform SAP PI/PO integrations into API-led connectivity on MuleSoft Anypoint Platform.",
    siteName: "SDA Migration WorkBench",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MuleSoft Anypoint Migration | SDA Migration WorkBench",
    description:
      "Transform SAP PI/PO integrations into API-led connectivity on MuleSoft Anypoint Platform.",
  },
};

export default function MuleSoftPage() {
  return (
    <div className="space-y-20">
      {/* Hero Banner */}
      <section className="relative py-12 md:py-20">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-3 mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mulesoft.logo}
              alt={`${mulesoft.name} logo`}
              className="w-12 h-12"
              width={48}
              height={48}
            />
            <span className="text-accent-secondary font-medium text-lg">
              {mulesoft.name}
            </span>
          </div>
          <h1 className="text-h1 text-text-primary mb-6">
            {mulesoft.heroTagline}
          </h1>
          <p className="text-lg text-text-secondary mb-8 max-w-2xl mx-auto">
            {mulesoft.description}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
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
        <SectionHeader
          title="Anypoint Platform Capabilities"
          subtitle="Leverage API-led connectivity and DataWeave transformations for a modern integration architecture"
        />
        <BentoGrid columns={3}>
          {mulesoft.capabilities.map((capability, index) => (
            <BentoItem key={index} colSpan={1} rowSpan={1}>
              <GlassCard interactive className="p-6 h-full">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-accent-primary/10 flex items-center justify-center">
                    <span className="text-accent-primary text-lg font-bold">
                      {capability.icon.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-h3 text-text-primary mb-2">
                      {capability.title}
                    </h3>
                    <p className="text-body text-text-secondary">
                      {capability.description}
                    </p>
                  </div>
                </div>
              </GlassCard>
            </BentoItem>
          ))}
        </BentoGrid>
      </section>

      {/* Feature Comparison Section */}
      <section>
        <SectionHeader
          title="Before & After Migration"
          subtitle="See how your integration landscape transforms with MuleSoft Anypoint Platform"
        />
        <GlassCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-6 py-4 text-sm font-semibold text-text-primary">
                    Feature
                  </th>
                  <th className="px-6 py-4 text-sm font-semibold text-red-400">
                    Before (SAP PI/PO)
                  </th>
                  <th className="px-6 py-4 text-sm font-semibold text-accent-secondary">
                    After (MuleSoft Anypoint)
                  </th>
                </tr>
              </thead>
              <tbody>
                {mulesoft.comparisonFeatures.map((item, index) => (
                  <tr
                    key={index}
                    className="border-b border-white/5 last:border-b-0"
                  >
                    <td className="px-6 py-4 text-sm font-medium text-text-primary">
                      {item.feature}
                    </td>
                    <td className="px-6 py-4 text-sm text-text-muted">
                      {item.before}
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">
                      {item.after}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </section>

      {/* CTA Section */}
      <section className="text-center py-12">
        <GlassCard className="p-10 md:p-16">
          <h2 className="text-h2 text-text-primary mb-4">
            Ready to Modernize with MuleSoft?
          </h2>
          <p className="text-lg text-text-secondary mb-8 max-w-2xl mx-auto">
            Start your API-led connectivity journey today. Our experts will guide
            you through a seamless migration from SAP PI/PO to MuleSoft Anypoint
            Platform.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
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
