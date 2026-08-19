import type { Metadata } from "next";
import { pricingTiers, pricingFAQs } from "@/data/pricing";
import { PricingCards } from "./PricingCards";
import { PricingFAQ } from "./PricingFAQ";

export const metadata: Metadata = {
  title: "Pricing | SDA Migration WorkBench",
  description:
    "Explore transparent pricing tiers for SAP PI/PO migration projects. From starter to enterprise, find the right plan for your integration migration needs.",
  openGraph: {
    title: "Pricing | SDA Migration WorkBench",
    description:
      "Explore transparent pricing tiers for SAP PI/PO migration projects. From starter to enterprise, find the right plan for your integration migration needs.",
    type: "website",
    siteName: "SDA Migration WorkBench",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing | SDA Migration WorkBench",
    description:
      "Transparent pricing for SAP PI/PO migration. Find the right plan for your needs.",
  },
};

export default function PricingPage() {
  return (
    <main id="main-content" className="min-h-screen bg-background py-20 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="text-center mb-16">
          <h1 className="text-h1 text-text-primary mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-body text-text-secondary max-w-2xl mx-auto">
            Choose the plan that fits your migration scope. All plans include
            our proven migration methodology and dedicated support.
          </p>
        </div>

        {/* Pricing Tier Cards */}
        <PricingCards tiers={pricingTiers} />

        {/* FAQ Section */}
        <PricingFAQ faqs={pricingFAQs} />
      </div>
    </main>
  );
}
