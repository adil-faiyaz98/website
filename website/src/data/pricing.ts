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

export interface ProductPricing {
  id: string;
  name: string;
  description: string;
  tiers: PricingTier[];
  faqs: FAQ[];
}

// Migration WorkBench Pricing
export const migrationPricingTiers: PricingTier[] = [
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

// Quebec Tax Calculator Pricing (based on market research)
export const taxCalculatorPricingTiers: PricingTier[] = [
  {
    id: "essentials",
    name: "Essentials",
    price: "$395",
    period: "per month",
    description:
      "For small businesses with under $500K in R&D expenditure. Covers basic CRIC and SR&ED claim preparation.",
    features: [
      "Up to $500K R&D expenditure tracking",
      "CRIC eligibility assessment",
      "SR&ED basic calculation",
      "Single user access",
      "Email support",
      "Standard documentation export",
      "Annual claim cycle",
    ],
    highlighted: false,
    ctaLabel: "Start Free Trial",
    ctaHref: "/products/quebec-tax-calculator#contact-adil",
  },
  {
    id: "professional",
    name: "Professional",
    price: "$995",
    period: "per month",
    description:
      "For mid-size companies with $500K-$2M R&D spend. Full multi-program support with optimization.",
    features: [
      "Up to $2M R&D expenditure tracking",
      "CRIC + SR&ED + CDAE-IA support",
      "Multi-program optimization",
      "Up to 5 user seats",
      "Priority support",
      "Audit-ready documentation",
      "Quarterly claim cycles",
      "SAP integration (OData APIs)",
    ],
    highlighted: true,
    ctaLabel: "Book a Demo",
    ctaHref: "/products/quebec-tax-calculator#contact-adil",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    period: "per year",
    description:
      "For large enterprises with $2M+ R&D spend. Full automation with dedicated support and custom integrations.",
    features: [
      "Unlimited R&D expenditure tracking",
      "All Quebec programs (CRIC, SR&ED, CDAE-IA, C3i)",
      "Pre-commercialization tracking (new in CRIC)",
      "Equipment cost optimization",
      "Unlimited users",
      "Dedicated account manager",
      "Custom SAP/ERP integration",
      "24/7 priority support",
      "Audit defense assistance",
      "SLA-backed guarantees",
    ],
    highlighted: false,
    ctaLabel: "Contact Sales",
    ctaHref: "/company/contact",
  },
];

export const taxCalculatorFAQs: FAQ[] = [
  {
    question:
      "How does Quebec Tax Calculator pricing compare to traditional consultants?",
    answer:
      "Traditional R&D tax credit consultants typically charge 15-25% of claimed credits on contingency, or $25,000-$75,000 for fixed-fee engagements. Our SaaS model starts at $395/month, offering significant cost savings especially for companies with larger claims. For a $500K credit claim, you'd pay ~$4,740/year vs. $75,000-$125,000 with traditional consultants.",
  },
  {
    question: "What tax programs does Quebec Tax Calculator support?",
    answer:
      "We support all major Quebec and federal R&D incentive programs: CRIC (Quebec's new unified credit effective March 2025), SR&ED (Federal), CDAE-IA (E-Business with AI), C3i (Investment & Innovation), and IDCI (IP income deduction). The system automatically identifies which programs apply to your expenditures.",
  },
  {
    question: "How does the CRIC support differ from old Quebec SR&ED credits?",
    answer:
      "CRIC replaced 8+ previous Quebec credits in March 2025. Our system is fully updated for CRIC rates (30% on first $1M, 20% above), new pre-commercialization eligibility, and equipment cost inclusion. These are significant changes that can increase your credits substantially.",
  },
  {
    question:
      "Can I use Quebec Tax Calculator alongside my existing accountant?",
    answer:
      "Absolutely. Many clients use our platform for tracking, eligibility assessment, and documentation, then share the outputs with their accountants for final filing. We export all standard forms (RD-1029.8.CR-T, T661) and audit-ready documentation.",
  },
  {
    question: "What happens if my claim is audited?",
    answer:
      "Our Enterprise tier includes audit defense assistance. All tiers generate comprehensive documentation with complete audit trails, time tracking, and technical narratives that meet CRA and Revenu Québec standards. This contemporaneous documentation is your best defense.",
  },
  {
    question: "Is there a free trial available?",
    answer:
      "Yes. We offer a complimentary eligibility assessment to estimate your potential credits across all programs. Contact us to schedule a demo and see a preliminary calculation based on your R&D expenditure profile.",
  },
];

// Combined products for dropdown selector
export const productPricing: ProductPricing[] = [
  {
    id: "migration",
    name: "Migration WorkBench",
    description: "SAP PI/PO migration to cloud-native platforms",
    tiers: migrationPricingTiers,
    faqs: pricingFAQs,
  },
  {
    id: "tax-calculator",
    name: "Quebec Tax Calculator",
    description: "R&D tax credit automation and optimization",
    tiers: taxCalculatorPricingTiers,
    faqs: taxCalculatorFAQs,
  },
];

// Legacy export for backward compatibility
export const pricingTiers = migrationPricingTiers;
