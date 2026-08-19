/**
 * Webinars data for the Learn/Webinars page.
 * Defines upcoming and recorded webinar sessions related to SAP PI/PO migration.
 */

export interface Webinar {
  id: string;
  title: string;
  date: string;
  duration: string;
  status: "upcoming" | "recorded";
  registrationUrl?: string;
  playbackUrl?: string;
  description: string;
}

export const webinars: Webinar[] = [
  {
    id: "migrating-to-dell-boomi",
    title: "Migrating SAP PI/PO to Dell Boomi: A Step-by-Step Walkthrough",
    date: "2025-02-20T14:00:00Z",
    duration: "60 min",
    status: "upcoming",
    registrationUrl: "/demo",
    description:
      "Join our integration architects as they demonstrate a live migration from SAP PI/PO to Dell Boomi, covering interface discovery, automated conversion, and deployment validation.",
  },
  {
    id: "assessment-deep-dive",
    title: "Deep Dive: PI/PO Landscape Assessment and Complexity Scoring",
    date: "2025-03-06T16:00:00Z",
    duration: "45 min",
    status: "upcoming",
    registrationUrl: "/demo",
    description:
      "Learn how SDA Migration WorkBench analyzes your SAP PI/PO landscape, scores interface complexity, and generates a prioritized migration roadmap tailored to your business needs.",
  },
  {
    id: "mulesoft-migration-patterns",
    title: "Migration Patterns for MuleSoft Anypoint Platform",
    date: "2025-03-20T15:00:00Z",
    duration: "50 min",
    status: "upcoming",
    registrationUrl: "/demo",
    description:
      "Explore proven patterns for converting PI/PO interfaces to MuleSoft Anypoint APIs, including adapter mapping strategies and DataWeave transformation generation.",
  },
  {
    id: "informatica-iics-strategies",
    title: "SAP PI/PO to Informatica IICS: Migration Strategies That Work",
    date: "2024-12-10T14:00:00Z",
    duration: "55 min",
    status: "recorded",
    playbackUrl: "/learn/webinars",
    description:
      "Recorded session covering end-to-end migration strategies from SAP PI/PO to Informatica Intelligent Cloud Services, with real customer examples and lessons learned.",
  },
  {
    id: "testing-validation-best-practices",
    title: "Post-Migration Testing and Validation Best Practices",
    date: "2024-11-15T16:00:00Z",
    duration: "45 min",
    status: "recorded",
    playbackUrl: "/learn/webinars",
    description:
      "Learn how to build comprehensive regression test suites, validate data integrity, and benchmark performance after migrating integrations from SAP PI/PO.",
  },
  {
    id: "zero-downtime-cutover",
    title: "Achieving Zero-Downtime Cutover in Enterprise Migrations",
    date: "2024-10-22T15:00:00Z",
    duration: "50 min",
    status: "recorded",
    playbackUrl: "/learn/webinars",
    description:
      "This session covers deployment strategies, rollback procedures, and monitoring setup to ensure zero-downtime transitions during large-scale PI/PO migration projects.",
  },
];
