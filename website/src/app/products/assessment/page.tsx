import type { Metadata } from "next";
import { GlassCard, BentoGrid, BentoItem, GlowButton } from "@/components/ui";

export const metadata: Metadata = {
  title: "PI/PO Landscape Assessment | SDA Migration WorkBench",
  description:
    "Assess your SAP PI/PO landscape with automated interface inventory, complexity analysis, and migration roadmap generation. Get a clear picture of your migration journey.",
  openGraph: {
    title: "PI/PO Landscape Assessment | SDA Migration WorkBench",
    description:
      "Assess your SAP PI/PO landscape with automated interface inventory, complexity analysis, and migration roadmap generation.",
    type: "website",
    siteName: "SDA Migration WorkBench",
  },
  twitter: {
    card: "summary_large_image",
    title: "PI/PO Landscape Assessment | SDA Migration WorkBench",
    description:
      "Assess your SAP PI/PO landscape with automated interface inventory, complexity analysis, and migration roadmap generation.",
  },
};

const assessmentTools = [
  {
    title: "Interface Inventory",
    description:
      "Automatically catalog every integration interface in your PI/PO landscape. Identify sender/receiver systems, message mappings, adapters, and communication channels across all environments.",
    highlights: [
      "Automated discovery of all ICOs and ICAs",
      "Sender and receiver system mapping",
      "Adapter and protocol classification",
      "Environment-level segmentation (DEV, QA, PRD)",
    ],
  },
  {
    title: "Complexity Analysis",
    description:
      "Evaluate the technical complexity of each interface to prioritize migration efforts. Score interfaces based on mapping complexity, custom modules, and dependency chains.",
    highlights: [
      "Multi-factor complexity scoring",
      "Custom module and UDF detection",
      "Cross-interface dependency mapping",
      "Risk classification (low, medium, high)",
    ],
  },
  {
    title: "Migration Roadmap Generation",
    description:
      "Generate a phased migration roadmap tailored to your landscape. Group interfaces by complexity, dependencies, and business criticality for an optimized migration sequence.",
    highlights: [
      "Phased migration wave planning",
      "Dependency-aware sequencing",
      "Effort estimation per interface",
      "Timeline and resource allocation",
    ],
  },
];

const processSteps = [
  {
    step: "1",
    title: "Connect",
    description:
      "Securely connect to your SAP PI/PO system using read-only access. We extract metadata without impacting running integrations.",
  },
  {
    step: "2",
    title: "Analyze",
    description:
      "Our engine scans your entire landscape, cataloging interfaces, scoring complexity, and identifying dependencies between objects.",
  },
  {
    step: "3",
    title: "Plan",
    description:
      "Receive a comprehensive assessment report with a prioritized migration roadmap, effort estimates, and recommended target platform mapping.",
  },
];

export default function AssessmentPage() {
  return (
    <div className="space-y-16 pb-16">
      {/* Hero Section */}
      <section className="text-center space-y-6 pt-8">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-text-primary">
          PI/PO Landscape Assessment
        </h1>
        <p className="text-lg md:text-xl text-text-secondary max-w-3xl mx-auto">
          Get a complete picture of your SAP PI/PO integration landscape.
          Our assessment tools inventory every interface, analyze complexity,
          and generate a clear migration roadmap.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <GlowButton
            label="Start Assessment"
            variant="primary"
            size="lg"
            href="/demo"
          />
          <GlowButton
            label="View Sample Report"
            variant="secondary"
            size="lg"
            href="/docs"
          />
        </div>
      </section>

      {/* Assessment Tools Section */}
      <section className="space-y-8">
        <h2 className="text-3xl md:text-4xl font-bold text-text-primary text-center">
          Assessment Tools
        </h2>
        <p className="text-text-secondary text-center max-w-2xl mx-auto">
          Three integrated tools that work together to give you a complete
          understanding of your migration scope and effort.
        </p>

        <BentoGrid columns={3}>
          {assessmentTools.map((tool) => (
            <BentoItem key={tool.title} colSpan={1} rowSpan={1}>
              <GlassCard interactive className="h-full p-6 space-y-4">
                <h3 className="text-xl font-semibold text-text-primary">
                  {tool.title}
                </h3>
                <p className="text-text-secondary text-sm leading-relaxed">
                  {tool.description}
                </p>
                <ul className="space-y-2">
                  {tool.highlights.map((highlight) => (
                    <li
                      key={highlight}
                      className="flex items-start gap-2 text-sm text-text-secondary"
                    >
                      <span className="text-accent-primary mt-0.5">✓</span>
                      <span>{highlight}</span>
                    </li>
                  ))}
                </ul>
              </GlassCard>
            </BentoItem>
          ))}
        </BentoGrid>
      </section>

      {/* How It Works Section */}
      <section className="space-y-8">
        <h2 className="text-3xl md:text-4xl font-bold text-text-primary text-center">
          How It Works
        </h2>
        <p className="text-text-secondary text-center max-w-2xl mx-auto">
          A straightforward three-step process from connection to actionable
          migration plan.
        </p>

        <BentoGrid columns={3}>
          {processSteps.map((item) => (
            <BentoItem key={item.step} colSpan={1} rowSpan={1}>
              <GlassCard className="h-full p-6 space-y-3">
                <div className="w-10 h-10 rounded-full bg-accent-primary/20 flex items-center justify-center text-accent-primary font-bold text-lg">
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold text-text-primary">
                  {item.title}
                </h3>
                <p className="text-text-secondary text-sm leading-relaxed">
                  {item.description}
                </p>
              </GlassCard>
            </BentoItem>
          ))}
        </BentoGrid>
      </section>

      {/* Key Outcomes Section */}
      <section className="space-y-8">
        <h2 className="text-3xl md:text-4xl font-bold text-text-primary text-center">
          What You Get
        </h2>

        <BentoGrid columns={2}>
          <BentoItem colSpan={1} rowSpan={1}>
            <GlassCard className="h-full p-6 space-y-3">
              <h3 className="text-lg font-semibold text-text-primary">
                Complete Interface Catalog
              </h3>
              <p className="text-text-secondary text-sm leading-relaxed">
                A structured inventory of all integration objects including
                ICOs, value mappings, communication channels, and custom
                modules with metadata for each.
              </p>
            </GlassCard>
          </BentoItem>
          <BentoItem colSpan={1} rowSpan={1}>
            <GlassCard className="h-full p-6 space-y-3">
              <h3 className="text-lg font-semibold text-text-primary">
                Complexity Scorecard
              </h3>
              <p className="text-text-secondary text-sm leading-relaxed">
                Each interface scored and classified by migration difficulty,
                with detailed breakdowns of complexity factors including
                custom code, multi-step mappings, and third-party adapters.
              </p>
            </GlassCard>
          </BentoItem>
          <BentoItem colSpan={1} rowSpan={1}>
            <GlassCard className="h-full p-6 space-y-3">
              <h3 className="text-lg font-semibold text-text-primary">
                Dependency Graph
              </h3>
              <p className="text-text-secondary text-sm leading-relaxed">
                Visual representation of inter-interface dependencies and
                shared objects so you can plan migration waves without
                breaking downstream integrations.
              </p>
            </GlassCard>
          </BentoItem>
          <BentoItem colSpan={1} rowSpan={1}>
            <GlassCard className="h-full p-6 space-y-3">
              <h3 className="text-lg font-semibold text-text-primary">
                Phased Roadmap
              </h3>
              <p className="text-text-secondary text-sm leading-relaxed">
                A ready-to-execute migration plan with phases, timelines,
                effort estimates, and recommended target platform mappings
                for each interface group.
              </p>
            </GlassCard>
          </BentoItem>
        </BentoGrid>
      </section>

      {/* CTA Section */}
      <section className="text-center space-y-6">
        <GlassCard as="section" className="p-8 md:p-12 space-y-4">
          <h2 className="text-2xl md:text-3xl font-bold text-text-primary">
            Ready to Assess Your Landscape?
          </h2>
          <p className="text-text-secondary max-w-xl mx-auto">
            Book a free consultation to discuss your PI/PO environment and
            learn how our assessment tools can accelerate your migration
            planning.
          </p>
          <div className="pt-4">
            <GlowButton
              label="Book a Consultation"
              variant="primary"
              size="lg"
              href="/demo"
            />
          </div>
        </GlassCard>
      </section>
    </div>
  );
}
