/**
 * Blog posts data for the Learn/Blog section.
 * Defines sample blog articles for the blog listing page.
 */

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  publishedDate: string; // ISO date string
  category: string;
  tags: string[];
  readTimeMinutes: number;
}

export const blogPosts: BlogPost[] = [
  {
    slug: "sap-pi-po-end-of-life-what-you-need-to-know",
    title: "SAP PI/PO End of Life: What You Need to Know",
    excerpt:
      "With SAP PI/PO reaching end of mainstream maintenance, enterprises must plan their migration strategy now. Learn about timelines, risks, and recommended next steps.",
    publishedDate: "2024-11-15",
    category: "Migration Strategy",
    tags: ["SAP PI/PO", "End of Life", "Planning"],
    readTimeMinutes: 8,
  },
  {
    slug: "comparing-dell-boomi-informatica-mulesoft-for-sap-migration",
    title: "Comparing Dell Boomi, Informatica, and MuleSoft for SAP Migration",
    excerpt:
      "A detailed comparison of the three leading iPaaS platforms for SAP PI/PO migration, covering strengths, trade-offs, and ideal use cases for each.",
    publishedDate: "2024-10-28",
    category: "Platform Comparison",
    tags: ["Dell Boomi", "Informatica", "MuleSoft", "Comparison"],
    readTimeMinutes: 12,
  },
  {
    slug: "automated-interface-conversion-patterns",
    title: "Automated Interface Conversion: Patterns and Best Practices",
    excerpt:
      "Discover how pattern-based automation can accelerate your SAP PI/PO migration by converting interfaces, mappings, and adapters with minimal manual intervention.",
    publishedDate: "2024-10-10",
    category: "Technical Deep Dive",
    tags: ["Automation", "Interface Conversion", "Best Practices"],
    readTimeMinutes: 10,
  },
  {
    slug: "reducing-migration-risk-with-comprehensive-testing",
    title: "Reducing Migration Risk with Comprehensive Testing",
    excerpt:
      "Learn how regression testing, data validation, and end-to-end verification ensure your migrated integrations perform correctly in production.",
    publishedDate: "2024-09-22",
    category: "Testing & Quality",
    tags: ["Testing", "Regression", "Data Validation", "Quality"],
    readTimeMinutes: 7,
  },
  {
    slug: "building-a-migration-roadmap-for-enterprise-integration",
    title: "Building a Migration Roadmap for Enterprise Integration",
    excerpt:
      "Step-by-step guidance on creating a phased migration roadmap that minimizes disruption, prioritizes high-value interfaces, and aligns with business timelines.",
    publishedDate: "2024-09-05",
    category: "Migration Strategy",
    tags: ["Roadmap", "Planning", "Enterprise", "Phased Migration"],
    readTimeMinutes: 9,
  },
  {
    slug: "api-led-connectivity-after-sap-pi-po",
    title: "API-Led Connectivity After SAP PI/PO",
    excerpt:
      "How modern API-led architecture transforms legacy point-to-point integrations into reusable, composable services on platforms like MuleSoft Anypoint.",
    publishedDate: "2024-08-18",
    category: "Architecture",
    tags: ["API", "MuleSoft", "Architecture", "Modernization"],
    readTimeMinutes: 11,
  },
];
