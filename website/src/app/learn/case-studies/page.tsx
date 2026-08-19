import type { Metadata } from "next";
import { caseStudies } from "@/data/case-studies";
import { GlassCard } from "@/components/ui";

export const metadata: Metadata = {
  title: "Case Studies | SDA Migration WorkBench",
  description:
    "Explore real-world SAP PI/PO migration success stories. See how enterprises achieved faster migrations, cost savings, and improved performance with SDA Migration WorkBench.",
  openGraph: {
    title: "Case Studies | SDA Migration WorkBench",
    description:
      "Explore real-world SAP PI/PO migration success stories. See how enterprises achieved faster migrations, cost savings, and improved performance.",
    type: "website",
    siteName: "SDA Migration WorkBench",
  },
  twitter: {
    card: "summary_large_image",
    title: "Case Studies | SDA Migration WorkBench",
    description:
      "Explore real-world SAP PI/PO migration success stories from leading enterprises.",
  },
};

const platformLabels: Record<string, string> = {
  "dell-boomi": "Dell Boomi",
  informatica: "Informatica IICS",
  mulesoft: "MuleSoft Anypoint",
};

export default function CaseStudiesPage() {
  return (
    <main id="main-content" className="min-h-screen bg-background py-20 px-6">
      <div className="max-w-[1280px] mx-auto">
        {/* Page Header */}
        <div className="text-center mb-16">
          <h1 className="text-h1 text-text-primary mb-4">Case Studies</h1>
          <p className="text-body text-text-secondary max-w-2xl mx-auto">
            Real-world migration success stories from enterprises that
            modernized their SAP PI/PO integrations with SDA Migration
            WorkBench.
          </p>
        </div>

        {/* Case Studies Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {caseStudies.map((study) => (
            <GlassCard
              key={study.slug}
              interactive={true}
              as="article"
              className="p-6 flex flex-col"
            >
              {/* Platform Badge */}
              <span className="inline-block self-start text-xs font-medium px-3 py-1 rounded-full bg-accent-primary/10 text-accent-primary border border-accent-primary/20 mb-4">
                {platformLabels[study.platform] ?? study.platform}
              </span>

              {/* Company & Industry */}
              <h2 className="text-xl font-semibold text-text-primary mb-1">
                {study.company}
              </h2>
              <p className="text-caption text-text-muted mb-4">
                {study.industry}
              </p>

              {/* Excerpt */}
              <p className="text-sm text-text-secondary mb-6 flex-1">
                {study.excerpt}
              </p>

              {/* Key Metrics */}
              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/10">
                {study.metrics.map((metric) => (
                  <div key={metric.label} className="text-center">
                    <p className="text-lg font-bold text-accent-primary">
                      {metric.value}
                    </p>
                    <p className="text-xs text-text-muted mt-1">
                      {metric.label}
                    </p>
                  </div>
                ))}
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    </main>
  );
}
