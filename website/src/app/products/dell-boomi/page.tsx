import { Metadata } from "next";
import { platformDetails } from "@/data/platforms";
import { GlassCard, BentoGrid, BentoItem, GlowButton } from "@/components/ui";

const boomi = platformDetails.find((p) => p.id === "boomi")!;

export const metadata: Metadata = {
  title: "Dell Boomi Migration | SDA Migration WorkBench",
  description:
    "Migrate your SAP PI/PO integrations to Dell Boomi's cloud-native iPaaS platform. Automated pattern conversion, connector mapping, and zero-downtime deployment.",
  openGraph: {
    title: "Dell Boomi Migration | SDA Migration WorkBench",
    description:
      "Migrate your SAP PI/PO integrations to Dell Boomi's cloud-native iPaaS platform. Automated pattern conversion, connector mapping, and zero-downtime deployment.",
    siteName: "SDA Migration WorkBench",
    type: "website",
    url: "https://sda-int.com/products/dell-boomi",
  },
  twitter: {
    card: "summary_large_image",
    title: "Dell Boomi Migration | SDA Migration WorkBench",
    description:
      "Migrate your SAP PI/PO integrations to Dell Boomi's cloud-native iPaaS platform. Automated pattern conversion, connector mapping, and zero-downtime deployment.",
  },
};

export default function DellBoomiPage() {
  return (
    <div className="space-y-16 pb-16">
      {/* Hero Banner */}
      <section className="relative py-12 md:py-20">
        <div className="absolute inset-0 bg-gradient-to-br from-accent-primary/5 via-transparent to-accent-secondary/5 rounded-3xl" />
        <div className="relative text-center max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
            {boomi.name} Migration
          </h1>
          <p className="text-lg md:text-xl text-white/70 max-w-3xl mx-auto">
            {boomi.heroTagline}
          </p>
        </div>
      </section>

      {/* Platform Capabilities - BentoGrid with GlassCards */}
      <section>
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-8 text-center">
          Migration Capabilities
        </h2>
        <BentoGrid columns={3} className="max-w-6xl mx-auto">
          {boomi.capabilities.map((capability, index) => (
            <BentoItem
              key={capability.title}
              colSpan={index === 0 || index === 3 ? 2 : 1}
            >
              <GlassCard interactive className="p-6 h-full">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-accent-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-accent-primary text-lg" aria-hidden="true">
                      ✦
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">
                      {capability.title}
                    </h3>
                    <p className="text-white/60 text-sm leading-relaxed">
                      {capability.description}
                    </p>
                  </div>
                </div>
              </GlassCard>
            </BentoItem>
          ))}
        </BentoGrid>
      </section>

      {/* Feature Comparison Table */}
      <section>
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-8 text-center">
          Before vs After Migration
        </h2>
        <div className="max-w-5xl mx-auto overflow-x-auto">
          <GlassCard className="p-0">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-6 py-4 text-sm font-semibold text-white/80 uppercase tracking-wider">
                    Feature
                  </th>
                  <th className="px-6 py-4 text-sm font-semibold text-white/80 uppercase tracking-wider">
                    Before (SAP PI/PO)
                  </th>
                  <th className="px-6 py-4 text-sm font-semibold text-white/80 uppercase tracking-wider">
                    After (Dell Boomi)
                  </th>
                </tr>
              </thead>
              <tbody>
                {boomi.comparisonFeatures.map((row, index) => (
                  <tr
                    key={row.feature}
                    className={
                      index < boomi.comparisonFeatures.length - 1
                        ? "border-b border-white/5"
                        : ""
                    }
                  >
                    <td className="px-6 py-4 text-white font-medium">
                      {row.feature}
                    </td>
                    <td className="px-6 py-4 text-white/50 text-sm">
                      {row.before}
                    </td>
                    <td className="px-6 py-4 text-accent-secondary text-sm">
                      {row.after}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </GlassCard>
        </div>
      </section>

      {/* CTA Section */}
      <section className="text-center py-12">
        <GlassCard className="max-w-3xl mx-auto p-10 md:p-14">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            Ready to Migrate to Dell Boomi?
          </h2>
          <p className="text-white/60 mb-8 max-w-xl mx-auto">
            Book a free assessment with our migration experts and get a
            detailed roadmap for your SAP PI/PO to Dell Boomi transition.
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
        </GlassCard>
      </section>
    </div>
  );
}
