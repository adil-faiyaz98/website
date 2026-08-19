import type { Metadata } from "next";
import { termsOfService } from "@/data/legal";

export const metadata: Metadata = {
  title: "Terms of Service | SDA Migration WorkBench",
  description:
    "Review the Terms of Service for SDA Migration WorkBench. Understand service description, user responsibilities, limitations of liability, and governing law.",
  openGraph: {
    title: "Terms of Service | SDA Migration WorkBench",
    description:
      "Review the Terms of Service for SDA Migration WorkBench. Understand service description, user responsibilities, limitations of liability, and governing law.",
    type: "website",
    siteName: "SDA Migration WorkBench",
  },
  twitter: {
    card: "summary",
    title: "Terms of Service | SDA Migration WorkBench",
    description:
      "Review the Terms of Service for SDA Migration WorkBench covering service usage, responsibilities, and legal terms.",
  },
};

export default function TermsOfServicePage() {
  return (
    <main id="main-content" className="min-h-screen bg-background py-20 px-6">
      <div className="max-w-[800px] mx-auto">
        {/* Page Header */}
        <header className="mb-12">
          <h1 className="text-h1 text-text-primary mb-4">
            {termsOfService.title}
          </h1>
          <p className="text-sm text-text-secondary">
            Last updated:{" "}
            <time dateTime={termsOfService.lastUpdated}>
              {new Date(termsOfService.lastUpdated).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
          </p>
        </header>

        {/* Terms Sections */}
        <article className="space-y-10">
          {termsOfService.sections.map((section) => {
            const sectionId = section.heading
              .toLowerCase()
              .replace(/\s+/g, "-");
            return (
              <section key={sectionId} aria-labelledby={sectionId}>
                <h2
                  id={sectionId}
                  className="text-h3 text-text-primary mb-4"
                >
                  {section.heading}
                </h2>
                <p className="text-base text-text-secondary leading-relaxed">
                  {section.content}
                </p>
              </section>
            );
          })}
        </article>
      </div>
    </main>
  );
}
