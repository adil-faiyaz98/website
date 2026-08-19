import type { Metadata } from "next";
import { privacyPolicy } from "@/data/legal";

export const metadata: Metadata = {
  title: "Privacy Policy | SDA Migration WorkBench",
  description:
    "Learn how SDA Migration WorkBench collects, uses, stores, and protects your personal data. Review our data handling practices and your privacy rights.",
  openGraph: {
    title: "Privacy Policy | SDA Migration WorkBench",
    description:
      "Learn how SDA Migration WorkBench collects, uses, stores, and protects your personal data.",
    type: "website",
    siteName: "SDA Migration WorkBench",
  },
  twitter: {
    card: "summary",
    title: "Privacy Policy | SDA Migration WorkBench",
    description:
      "Learn how SDA Migration WorkBench collects, uses, stores, and protects your personal data.",
  },
};

export default function PrivacyPolicyPage() {
  return (
    <main id="main-content" className="min-h-screen bg-background py-20 px-6">
      <div className="max-w-[800px] mx-auto">
        {/* Page Header */}
        <header className="mb-12">
          <h1 className="text-h1 text-text-primary mb-4">
            {privacyPolicy.title}
          </h1>
          <p className="text-sm text-text-secondary">
            Last updated:{" "}
            <time dateTime={privacyPolicy.lastUpdated}>
              {new Date(privacyPolicy.lastUpdated).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
          </p>
        </header>

        {/* Policy Sections */}
        <article className="space-y-10">
          {privacyPolicy.sections.map((section) => {
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
