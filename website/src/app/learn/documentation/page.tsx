import type { Metadata } from "next";
import Link from "next/link";
import { GlassCard } from "@/components/ui";
import { SapIcon } from "@/components";

export const metadata: Metadata = {
  title: "Documentation | SDA Migration WorkBench",
  description:
    "Access technical guides, API references, migration tutorials, and configuration documentation for SDA Migration WorkBench.",
  openGraph: {
    title: "Documentation | SDA Migration WorkBench",
    description:
      "Access technical guides, API references, migration tutorials, and configuration documentation for SDA Migration WorkBench.",
    type: "website",
    siteName: "SDA Migration WorkBench",
  },
  twitter: {
    card: "summary_large_image",
    title: "Documentation | SDA Migration WorkBench",
    description:
      "Access technical guides, API references, migration tutorials, and configuration documentation.",
  },
};

interface DocLink {
  title: string;
  description: string;
  href: string;
}

interface DocCategory {
  title: string;
  description: string;
  icon: string;
  featured?: boolean;
  links: DocLink[];
}

const categories: DocCategory[] = [
  {
    title: "Getting Started",
    description:
      "New to SDA Migration WorkBench? Start here with setup guides and introductory tutorials.",
    icon: "journey-arrive",
    links: [
      {
        title: "Quick Start Guide",
        description: "Set up your first migration project in under 10 minutes",
        href: "/learn/documentation",
      },
      {
        title: "Platform Overview",
        description: "Understand the core concepts and architecture",
        href: "/learn/documentation",
      },
      {
        title: "Installation & Setup",
        description: "System requirements and environment configuration",
        href: "/learn/documentation",
      },
      {
        title: "Your First Migration",
        description: "Step-by-step walkthrough of a basic migration",
        href: "/learn/documentation",
      },
    ],
  },
  {
    title: "Quebec Tax Calculator",
    description:
      "Complete documentation for R&D tax credit automation - CRIC, SR&ED, CDAE-IA, and C3i programs.",
    icon: "money-bills",
    featured: true,
    links: [
      {
        title: "Tax Programs Overview",
        description: "Understanding CRIC, SR&ED, CDAE-IA, and C3i eligibility",
        href: "/learn/documentation/quebec-tax-calculator",
      },
      {
        title: "Critical Deadlines",
        description: "Filing deadlines and consequences of missing them",
        href: "/learn/documentation/quebec-tax-calculator#deadlines",
      },
      {
        title: "Industry Analysis",
        description: "How different industries underutilize tax credits",
        href: "/learn/documentation/quebec-tax-calculator#industries",
      },
      {
        title: "Calculator Guide",
        description: "Step-by-step guide to using the tax calculator",
        href: "/learn/documentation/quebec-tax-calculator#calculator",
      },
    ],
  },
  {
    title: "API Reference",
    description:
      "Complete reference documentation for the Migration WorkBench REST APIs and SDKs.",
    icon: "it-host",
    links: [
      {
        title: "REST API Overview",
        description: "Authentication, endpoints, and response formats",
        href: "/learn/documentation",
      },
      {
        title: "Migration API",
        description: "Programmatically create and manage migration jobs",
        href: "/learn/documentation",
      },
      {
        title: "Assessment API",
        description: "Run landscape assessments and retrieve complexity scores",
        href: "/learn/documentation",
      },
      {
        title: "Webhooks & Events",
        description: "Subscribe to real-time migration lifecycle events",
        href: "/learn/documentation",
      },
    ],
  },
  {
    title: "Migration Guides",
    description:
      "Platform-specific guides for migrating from SAP PI/PO to your target platform.",
    icon: "workflow-tasks",
    links: [
      {
        title: "Migrate to Dell Boomi",
        description: "Complete guide for Dell Boomi migration scenarios",
        href: "/learn/documentation",
      },
      {
        title: "Migrate to Informatica",
        description: "End-to-end Informatica IICS migration walkthrough",
        href: "/learn/documentation",
      },
      {
        title: "Migrate to MuleSoft",
        description: "MuleSoft Anypoint migration patterns and best practices",
        href: "/learn/documentation",
      },
      {
        title: "Interface Mapping Strategies",
        description: "Techniques for mapping PI/PO interfaces to modern formats",
        href: "/learn/documentation",
      },
    ],
  },
  {
    title: "Configuration",
    description:
      "Detailed configuration options for customizing migration behavior and environment settings.",
    icon: "action-settings",
    links: [
      {
        title: "Environment Configuration",
        description: "Configure connections to source and target systems",
        href: "/learn/documentation",
      },
      {
        title: "Transformation Rules",
        description: "Define custom mapping and transformation logic",
        href: "/learn/documentation",
      },
      {
        title: "Security & Authentication",
        description: "Set up SSO, OAuth, and certificate-based auth",
        href: "/learn/documentation",
      },
      {
        title: "Performance Tuning",
        description: "Optimize batch sizes, parallelism, and memory usage",
        href: "/learn/documentation",
      },
    ],
  },
];

export default function DocumentationPage() {
  return (
    <main id="main-content" className="min-h-screen bg-background py-20 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Page Header */}
        <div className="text-center mb-16">
          <h1 className="text-h1 text-text-primary mb-4">Documentation</h1>
          <p className="text-body text-text-secondary max-w-2xl mx-auto">
            Everything you need to get started with SDA Migration WorkBench.
            Explore guides, API references, and configuration documentation.
          </p>
          <Link
            href="/docs"
            className="inline-flex items-center mt-6 text-accent-primary hover:text-accent-secondary transition-colors duration-200 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:rounded-sm"
          >
            Go to full documentation hub →
          </Link>
        </div>

        {/* Category Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {categories.map((category) => (
            <GlassCard
              key={category.title}
              className={`p-8 ${category.featured ? "border-green-500/30 bg-green-500/5" : ""}`}
              interactive
              as="article"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  category.featured 
                    ? "bg-green-500/10" 
                    : "bg-accent-primary/10"
                }`}>
                  <SapIcon 
                    name={category.icon} 
                    size={28} 
                    className={category.featured ? "text-green-400" : "text-accent-primary"} 
                  />
                </div>
                <div>
                  <h2 className="text-h3 text-text-primary">{category.title}</h2>
                  {category.featured && (
                    <span className="text-xs text-green-400 font-medium">New</span>
                  )}
                </div>
              </div>
              <p className="text-body text-text-secondary mb-6">
                {category.description}
              </p>
              <ul className="space-y-3">
                {category.links.map((link) => (
                  <li key={link.title}>
                    <Link
                      href={link.href}
                      className={`group block p-3 rounded-lg hover:bg-white/5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:rounded-lg`}
                    >
                      <span className={`font-medium group-hover:text-accent-primary transition-colors duration-200 ${
                        category.featured ? "text-green-300" : "text-text-primary"
                      }`}>
                        {link.title}
                      </span>
                      <span className="block text-sm text-text-muted mt-0.5">
                        {link.description}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </GlassCard>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-16">
          <p className="text-text-secondary mb-4">
            Can&apos;t find what you&apos;re looking for?
          </p>
          <Link
            href="/company/contact"
            className="inline-flex items-center justify-center rounded-lg font-medium transition-all duration-300 ease-in-out bg-accent-primary text-white hover:shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:scale-105 px-6 py-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Contact Support
          </Link>
        </div>
      </div>
    </main>
  );
}
