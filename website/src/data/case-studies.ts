/**
 * Case studies data for the Learn / Case Studies page.
 * Each entry represents a customer migration success story.
 */

export interface CaseStudy {
  slug: string;
  company: string;
  industry: string;
  platform: "dell-boomi" | "informatica" | "mulesoft";
  metrics: { label: string; value: string }[];
  excerpt: string;
  logoSrc?: string;
}

export const caseStudies: CaseStudy[] = [
  {
    slug: "global-pharma-boomi-migration",
    company: "Global Pharma Corp",
    industry: "Pharmaceuticals",
    platform: "dell-boomi",
    metrics: [
      { label: "Interfaces Migrated", value: "1,200+" },
      { label: "Migration Time", value: "4 months" },
      { label: "Cost Reduction", value: "62%" },
    ],
    excerpt:
      "Global Pharma Corp migrated over 1,200 SAP PI/PO interfaces to Dell Boomi in just four months, reducing integration maintenance costs by 62% while maintaining full regulatory compliance.",
    logoSrc: "/logos/generic.svg",
  },
  {
    slug: "finserv-informatica-transformation",
    company: "Atlantic Financial Services",
    industry: "Financial Services",
    platform: "informatica",
    metrics: [
      { label: "Interfaces Migrated", value: "850" },
      { label: "Downtime", value: "Zero" },
      { label: "Processing Speed", value: "3x faster" },
    ],
    excerpt:
      "Atlantic Financial Services achieved zero-downtime migration of 850 critical payment interfaces from SAP PI/PO to Informatica IICS, tripling transaction processing speed.",
    logoSrc: "/logos/generic.svg",
  },
  {
    slug: "retail-mulesoft-modernization",
    company: "NorthStar Retail Group",
    industry: "Retail & E-Commerce",
    platform: "mulesoft",
    metrics: [
      { label: "Interfaces Migrated", value: "2,000+" },
      { label: "Time to Market", value: "50% faster" },
      { label: "API Reuse", value: "85%" },
    ],
    excerpt:
      "NorthStar Retail Group modernized their entire integration landscape by migrating 2,000+ SAP PI/PO interfaces to MuleSoft Anypoint, achieving 85% API reuse and cutting time to market in half.",
    logoSrc: "/logos/generic.svg",
  },
  {
    slug: "manufacturing-boomi-consolidation",
    company: "Precision Manufacturing Inc",
    industry: "Manufacturing",
    platform: "dell-boomi",
    metrics: [
      { label: "Interfaces Migrated", value: "600" },
      { label: "System Consolidation", value: "12 to 1" },
      { label: "Annual Savings", value: "$1.2M" },
    ],
    excerpt:
      "Precision Manufacturing consolidated 12 legacy middleware systems into a single Dell Boomi platform, migrating 600 SAP PI/PO interfaces and saving over $1.2M annually in licensing and operations.",
    logoSrc: "/logos/generic.svg",
  },
  {
    slug: "energy-informatica-cloud-migration",
    company: "Summit Energy Partners",
    industry: "Energy & Utilities",
    platform: "informatica",
    metrics: [
      { label: "Interfaces Migrated", value: "450" },
      { label: "Cloud Adoption", value: "100%" },
      { label: "Incident Reduction", value: "78%" },
    ],
    excerpt:
      "Summit Energy Partners completed a full cloud migration of 450 SAP PI/PO interfaces to Informatica IICS, eliminating on-premise infrastructure and reducing integration incidents by 78%.",
    logoSrc: "/logos/generic.svg",
  },
];
