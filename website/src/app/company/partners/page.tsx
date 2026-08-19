import type { Metadata } from "next";
import { GlassCard, AnimatedCounter } from "@/components/ui";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Partners | SDA Migration WorkBench",
  description:
    "Explore our technology and consulting partner ecosystem. Join the SDA Migration WorkBench partner program to deliver world-class SAP PI/PO migration solutions.",
  openGraph: {
    title: "Partners | SDA Migration WorkBench",
    description:
      "Explore our technology and consulting partner ecosystem. Join the SDA Migration WorkBench partner program.",
    type: "website",
    siteName: "SDA Migration WorkBench",
  },
  twitter: {
    card: "summary_large_image",
    title: "Partners | SDA Migration WorkBench",
    description:
      "Explore our technology and consulting partner ecosystem. Join the SDA partner program.",
  },
};

interface Partner {
  name: string;
  description: string;
  logo: string;
  category: "technology" | "consulting";
}

const technologyPartners: Partner[] = [
  {
    name: "Dell Boomi",
    description:
      "Strategic integration platform partner enabling seamless SAP PI/PO to Boomi AtomSphere migrations with certified connectors.",
    logo: "/logos/boomi.svg",
    category: "technology",
  },
  {
    name: "Informatica",
    description:
      "Cloud data integration partner powering enterprise-grade migrations to Informatica IICS with intelligent mapping automation.",
    logo: "/logos/informatica.svg",
    category: "technology",
  },
  {
    name: "MuleSoft",
    description:
      "API-led connectivity partner delivering SAP PI/PO to Anypoint Platform migrations with full lifecycle management.",
    logo: "/logos/mulesoft.svg",
    category: "technology",
  },
  {
    name: "SAP",
    description:
      "Source platform partner providing deep expertise in SAP PI/PO architecture, interface extraction, and migration readiness.",
    logo: "/logos/generic.svg",
    category: "technology",
  },
];

const consultingPartners: Partner[] = [
  {
    name: "Deloitte Digital",
    description:
      "Global systems integrator delivering end-to-end SAP migration strategy, execution, and change management for Fortune 500 enterprises.",
    logo: "/logos/generic.svg",
    category: "consulting",
  },
  {
    name: "Accenture",
    description:
      "Technology consulting partner specializing in large-scale integration modernization programs across hybrid cloud environments.",
    logo: "/logos/generic.svg",
    category: "consulting",
  },
  {
    name: "Capgemini",
    description:
      "Digital transformation partner with deep SAP expertise, helping enterprises plan and execute complex integration migrations.",
    logo: "/logos/generic.svg",
    category: "consulting",
  },
  {
    name: "Wipro",
    description:
      "IT services partner providing managed migration services, testing automation, and post-migration support for integration landscapes.",
    logo: "/logos/generic.svg",
    category: "consulting",
  },
];

const partnerStats = [
  { label: "Partner Organizations", target: 45, suffix: "+" },
  { label: "Joint Migrations Delivered", target: 320, suffix: "+" },
  { label: "Countries Covered", target: 28, suffix: "" },
  { label: "Certified Consultants", target: 150, suffix: "+" },
];

export default function PartnersPage() {
  return (
    <main id="main-content" className="min-h-screen bg-background py-20 px-6">
      <div className="max-w-[1280px] mx-auto">
        {/* Page Header */}
        <div className="text-center mb-16">
          <h1 className="text-h1 text-text-primary mb-4">Our Partners</h1>
          <p className="text-body text-text-secondary max-w-2xl mx-auto">
            We collaborate with industry-leading technology and consulting
            partners to deliver world-class SAP PI/PO migration solutions for
            enterprises worldwide.
          </p>
        </div>

        {/* Partner Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-20">
          {partnerStats.map((stat) => (
            <GlassCard key={stat.label} className="p-6 text-center">
              <div className="text-3xl md:text-4xl font-bold text-accent-primary mb-2">
                <AnimatedCounter
                  target={stat.target}
                  suffix={stat.suffix}
                  duration={2000}
                />
              </div>
              <p className="text-sm text-text-muted">{stat.label}</p>
            </GlassCard>
          ))}
        </div>

        {/* Technology Partners */}
        <section className="mb-20">
          <h2 className="text-h2 text-text-primary mb-3">
            Technology Partners
          </h2>
          <p className="text-body text-text-secondary mb-8 max-w-3xl">
            Our technology partners provide the platforms and tools that power
            successful migrations. Together, we ensure seamless connectivity
            between SAP PI/PO and modern integration platforms.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {technologyPartners.map((partner) => (
              <GlassCard
                key={partner.name}
                interactive
                as="article"
                className="p-6 flex items-start gap-4"
              >
                <div className="w-12 h-12 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={partner.logo}
                    alt={`${partner.name} logo`}
                    className="w-8 h-8 object-contain"
                  />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-text-primary mb-2">
                    {partner.name}
                  </h3>
                  <p className="text-sm text-text-secondary">
                    {partner.description}
                  </p>
                </div>
              </GlassCard>
            ))}
          </div>
        </section>

        {/* Consulting Partners */}
        <section className="mb-20">
          <h2 className="text-h2 text-text-primary mb-3">
            Consulting Partners
          </h2>
          <p className="text-body text-text-secondary mb-8 max-w-3xl">
            Our consulting partners bring deep industry expertise and proven
            methodologies to help enterprises plan, execute, and optimize their
            integration migrations.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {consultingPartners.map((partner) => (
              <GlassCard
                key={partner.name}
                interactive
                as="article"
                className="p-6 flex items-start gap-4"
              >
                <div className="w-12 h-12 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={partner.logo}
                    alt={`${partner.name} logo`}
                    className="w-8 h-8 object-contain"
                  />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-text-primary mb-2">
                    {partner.name}
                  </h3>
                  <p className="text-sm text-text-secondary">
                    {partner.description}
                  </p>
                </div>
              </GlassCard>
            ))}
          </div>
        </section>

        {/* Partner Program Application */}
        <section>
          <GlassCard className="p-8 md:p-12 text-center">
            <h2 className="text-h2 text-text-primary mb-4">
              Become a Partner
            </h2>
            <p className="text-body text-text-secondary max-w-2xl mx-auto mb-6">
              Join the SDA Migration WorkBench partner program to expand your
              service offerings, access exclusive resources, and deliver
              best-in-class migration solutions to your clients.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 text-left">
              <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                <h3 className="text-base font-semibold text-text-primary mb-2">
                  🎓 Training & Certification
                </h3>
                <p className="text-sm text-text-secondary">
                  Access comprehensive training programs and earn SDA
                  certified partner status.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                <h3 className="text-base font-semibold text-text-primary mb-2">
                  🤝 Co-Marketing
                </h3>
                <p className="text-sm text-text-secondary">
                  Joint go-to-market initiatives, case study features, and event
                  sponsorship opportunities.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                <h3 className="text-base font-semibold text-text-primary mb-2">
                  💼 Deal Registration
                </h3>
                <p className="text-sm text-text-secondary">
                  Priority deal support, competitive pricing, and dedicated
                  partner success management.
                </p>
              </div>
            </div>
            <Link
              href="/company/contact"
              className="inline-flex items-center justify-center rounded-lg font-medium transition-all duration-300 ease-in-out bg-accent-primary text-white hover:shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:scale-105 px-8 py-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Apply to Partner Program
            </Link>
          </GlassCard>
        </section>
      </div>
    </main>
  );
}
