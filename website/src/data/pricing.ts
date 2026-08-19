/**
 * Pricing data for the Pricing page.
 * Defines pricing tiers displayed as Glassmorphism cards and FAQ items.
 */

export interface PricingTier {
  id: string;
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  highlighted: boolean;
  ctaLabel: string;
  ctaHref: string;
}

export interface FAQ {
  question: string;
  answer: string;
}

export const pricingTiers: PricingTier[] = [
  {
    id: "starter",
    name: "Starter",
    price: "$4,500",
    period: "per project",
    description:
      "Ideal for small-scale migrations with fewer than 50 interfaces and straightforward mapping patterns.",
    features: [
      "Up to 50 interface migrations",
      "Basic complexity analysis",
      "Standard mapping conversion",
      "Email support",
      "Migration report & documentation",
    ],
    highlighted: false,
    ctaLabel: "Get Started",
    ctaHref: "/demo",
  },
  {
    id: "professional",
    name: "Professional",
    price: "$12,000",
    period: "per project",
    description:
      "For mid-size enterprises migrating complex integration landscapes with custom adapters and advanced mappings.",
    features: [
      "Up to 200 interface migrations",
      "Advanced complexity & dependency analysis",
      "Custom adapter migration",
      "Priority support with dedicated engineer",
      "Regression testing suite",
      "Performance benchmarking",
      "Migration roadmap & timeline",
    ],
    highlighted: true,
    ctaLabel: "Book a Demo",
    ctaHref: "/demo",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    period: "per engagement",
    description:
      "Tailored for large-scale enterprise migrations with hundreds of interfaces, multi-platform targets, and dedicated support.",
    features: [
      "Unlimited interface migrations",
      "Full landscape assessment",
      "Multi-platform target support",
      "Dedicated migration architect",
      "24/7 priority support",
      "Custom CI/CD pipeline setup",
      "Ongoing monitoring & optimization",
      "SLA-backed delivery guarantees",
    ],
    highlighted: false,
    ctaLabel: "Contact Sales",
    ctaHref: "/company/contact",
  },
];

export const pricingFAQs: FAQ[] = [
  {
    question: "How is pricing determined for my project?",
    answer:
      "Pricing is based on the number of interfaces to migrate, the complexity of mappings and adapters, and your target platform. We provide a detailed quote after an initial assessment of your SAP PI/PO landscape.",
  },
  {
    question: "Can I upgrade my plan mid-project?",
    answer:
      "Yes. If your migration scope expands beyond the original estimate, we can adjust your plan and pricing accordingly without restarting the engagement.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "We accept bank transfers, credit cards, and purchase orders for enterprise accounts. Payment terms are net-30 for Professional and Enterprise tiers.",
  },
  {
    question: "Is there a free trial or assessment available?",
    answer:
      "We offer a complimentary initial assessment for up to 10 interfaces so you can evaluate migration quality and tooling before committing to a full project.",
  },
  {
    question: "What level of support is included?",
    answer:
      "Starter includes email support during business hours. Professional includes priority support with a dedicated engineer. Enterprise includes 24/7 support with SLA-backed response times.",
  },
  {
    question: "Do you offer ongoing maintenance after migration?",
    answer:
      "Yes. We provide post-migration monitoring and optimization packages to ensure your integrations run smoothly on the new platform. Contact us for details.",
  },
];
