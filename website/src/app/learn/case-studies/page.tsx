import type { Metadata } from "next";
import Link from "next/link";
import { caseStudies } from "@/data/case-studies";
import { GlassCard } from "@/components/ui";

export const metadata: Metadata = {
  title: "Case Studies | SDA Solutions",
  description:
    "Explore real-world success stories. See how enterprises achieved faster migrations, recovered tax credits, and improved performance with SDA solutions.",
  openGraph: {
    title: "Case Studies | SDA Solutions",
    description:
      "Explore real-world success stories. See how enterprises achieved faster migrations, recovered tax credits, and improved performance.",
    type: "website",
    siteName: "SDA Solutions",
  },
  twitter: {
    card: "summary_large_image",
    title: "Case Studies | SDA Solutions",
    description:
      "Explore real-world success stories from leading enterprises.",
  },
};

const platformLabels: Record<string, string> = {
  "dell-boomi": "Dell Boomi",
  informatica: "Informatica IICS",
  mulesoft: "MuleSoft Anypoint",
  "quebec-tax-calculator": "Quebec Tax Calculator",
};

export default function CaseStudiesPage() {
  return (
    <main id="main-content" className="min-h-screen bg-background py-20 px-6">
      <div className="max-w-[1280px] mx-auto">
        {/* Page Header */}
        <div className="text-center mb-16">
          <h1 className="text-h1 text-text-primary mb-4">Case Studies</h1>
          <p className="text-body text-text-secondary max-w-2xl mx-auto">
            Real-world success stories from enterprises that modernized their 
            integrations and optimized their tax strategies with SDA solutions.
          </p>
        </div>

        {/* Case Studies Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {caseStudies.map((study) => {
            const hasDetailPage = study.platform === "quebec-tax-calculator";
            
            const cardContent = (
              <GlassCard
                interactive={true}
                as="article"
                className={`p-6 flex flex-col h-full ${hasDetailPage ? "cursor-pointer" : ""}`}
              >
                {/* Platform Badge */}
                <div className="flex items-center gap-2 mb-4">
                  <span className={`inline-block text-xs font-medium px-3 py-1 rounded-full border ${
                    study.platform === "quebec-tax-calculator" 
                      ? "bg-green-500/10 text-green-400 border-green-500/20" 
                      : "bg-accent-primary/10 text-accent-primary border-accent-primary/20"
                  }`}>
                    {platformLabels[study.platform] ?? study.platform}
                  </span>
                  {study.featured && (
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                      Featured
                    </span>
                  )}
                </div>

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
                      <p className={`text-lg font-bold ${
                        study.platform === "quebec-tax-calculator" ? "text-green-400" : "text-accent-primary"
                      }`}>
                        {metric.value}
                      </p>
                      <p className="text-xs text-text-muted mt-1">
                        {metric.label}
                      </p>
                    </div>
                  ))}
                </div>
                
                {hasDetailPage && (
                  <div className="mt-4 pt-4 border-t border-white/10 text-center">
                    <span className="text-sm text-accent-primary hover:text-accent-secondary transition-colors">
                      Read Full Case Study &rarr;
                    </span>
                  </div>
                )}
              </GlassCard>
            );
            
            return hasDetailPage ? (
              <Link key={study.slug} href={`/learn/case-studies/${study.slug}`}>
                {cardContent}
              </Link>
            ) : (
              <div key={study.slug}>
                {cardContent}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
