import type { Metadata } from "next";
import Link from "next/link";
import { GlassCard } from "@/components/ui";

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
  links: DocLink[];
}

const categories: DocCategory[] = [
  {
    title: "Getting Started",
    description:
      "New to SDA Migration WorkBench? Start here with setup guides and introductory tutorials.",
    icon: "🚀",
    links: [
      {
        title: "Quick Start Guide",
        description: "Set up your first migration project in under 10 minutes",
        href: "/docs",
      },
      {
        title: "Platform Overview",
        description: "Understand the core concepts and architecture",
        href: "/docs",
      },
      {
        title: "Installation & Setup",
        description: "System requirements and environment configuration",
        href: "/docs",
      },
      {
        title: "Your First Migration",
        description: "Step-by-step walkthrough of a basic migration",
        href: "/docs",
      },
    ],
  },
  {
    title: "API Reference",
    description:
      "Complete reference documentation for the Migration WorkBench REST APIs and SDKs.",
    icon: "📡",
    links: [
      {
        title: "REST API Overview",
        description: "Authentication, endpoints, and response formats",
        href: "/docs",
      },
      {
        title: "Migration API",
        description: "Programmatically create and manage migration jobs",
        href: "/docs",
      },
      {
        title: "Assessment API",
        description: "Run landscape assessments and retrieve complexity scores",
        href: "/docs",
      },
      {
        title: "Webhooks & Events",
        description: "Subscribe to real-time migration lifecycle events",
        href: "/docs",
      },
    ],
  },
  {
    title: "Migration Guides",
    description:
      "Platform-specific guides for migrating from SAP PI/PO to your target platform.",
    icon: "📋",
    links: [
      {
        title: "Migrate to Dell Boomi",
        description: "Complete guide for Dell Boomi migration scenarios",
        href: "/docs",
      },
      {
        title: "Migrate to Informatica",
        description: "End-to-end Informatica IICS migration walkthrough",
        href: "/docs",
      },
      {
        title: "Migrate to MuleSoft",
        description: "MuleSoft Anypoint migration patterns and best practices",
        href: "/docs",
      },
      {
        title: "Interface Mapping Strategies",
        description: "Techniques for mapping PI/PO interfaces to modern formats",
        href: "/docs",
      },
    ],
  },
  {
    title: "Configuration",
    description:
      "Detailed configuration options for customizing migration behavior and environment settings.",
    icon: "⚙️",
    links: [
      {
        title: "Environment Configuration",
        description: "Configure connections to source and target systems",
        href: "/docs",
      },
      {
        title: "Transformation Rules",
        description: "Define custom mapping and transformation logic",
        href: "/docs",
      },
      {
        title: "Security & Authentication",
        description: "Set up SSO, OAuth, and certificate-based auth",
        href: "/docs",
      },
      {
        title: "Performance Tuning",
        description: "Optimize batch sizes, parallelism, and memory usage",
        href: "/docs",
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
              className="p-8"
              interactive
              as="article"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl" role="img" aria-hidden="true">
                  {category.icon}
                </span>
                <h2 className="text-h3 text-text-primary">{category.title}</h2>
              </div>
              <p className="text-body text-text-secondary mb-6">
                {category.description}
              </p>
              <ul className="space-y-3">
                {category.links.map((link) => (
                  <li key={link.title}>
                    <Link
                      href={link.href}
                      className="group block p-3 rounded-lg hover:bg-white/5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:rounded-lg"
                    >
                      <span className="text-text-primary font-medium group-hover:text-accent-primary transition-colors duration-200">
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
