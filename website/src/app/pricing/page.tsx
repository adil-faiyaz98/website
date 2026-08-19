import type { Metadata } from "next";
import { productPricing } from "@/data/pricing";
import { PricingPageClient } from "./PricingPageClient";

export const metadata: Metadata = {
  title: "Pricing | SDA Solutions",
  description:
    "Explore transparent pricing for SAP PI/PO migration and Quebec Tax Calculator. From starter to enterprise, find the right plan for your needs.",
  openGraph: {
    title: "Pricing | SDA Solutions",
    description:
      "Explore transparent pricing for SAP PI/PO migration and Quebec Tax Calculator. Find the right plan for your needs.",
    type: "website",
    siteName: "SDA Solutions",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing | SDA Solutions",
    description:
      "Transparent pricing for SAP PI/PO migration and Quebec Tax Calculator.",
  },
};

export default function PricingPage() {
  return <PricingPageClient products={productPricing} />;
}
