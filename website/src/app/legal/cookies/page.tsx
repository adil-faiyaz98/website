import type { Metadata } from "next";
import { cookiePolicy } from "@/data/legal";

export const metadata: Metadata = {
  title: "Cookie Policy | SDA Migration WorkBench",
  description:
    "Learn about how SDA Migration WorkBench uses cookies, the types of cookies we use, their purposes, third-party cookies, and how to manage your preferences.",
  openGraph: {
    title: "Cookie Policy | SDA Migration WorkBench",
    description:
      "Learn about how SDA Migration WorkBench uses cookies, the types of cookies we use, their purposes, third-party cookies, and how to manage your preferences.",
    type: "website",
    siteName: "SDA Migration WorkBench",
  },
  twitter: {
    card: "summary",
    title: "Cookie Policy | SDA Migration WorkBench",
    description:
      "Learn about how SDA Migration WorkBench uses cookies, their purposes, and how to opt out.",
  },
};

export default function CookiePolicyPage() {
  return (
    <main id="main-content" className="min-h-screen bg-background py-20 px-6">
      <div className="max-w-[800px] mx-auto">
        {/* Page Header */}
        <header className="mb-12">
          <h1 className="text-h1 text-text-primary mb-4">
            {cookiePolicy.title}
          </h1>
          <p className="text-sm text-text-secondary">
            Last updated:{" "}
            <time dateTime={cookiePolicy.lastUpdated}>
              {new Date(cookiePolicy.lastUpdated).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
          </p>
        </header>

        {/* Policy Sections */}
        <article className="space-y-10">
          {cookiePolicy.sections.map((section) => {
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
