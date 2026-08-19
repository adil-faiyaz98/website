/**
 * Platform data for the Migration Platforms Section.
 * Defines the supported target platforms for SAP PI/PO migration.
 */

export interface Platform {
  id: string;
  name: string;
  logo: string;
  description: string;
  href: string;
}

export interface PlatformDetail extends Platform {
  heroTagline: string;
  capabilities: {
    title: string;
    description: string;
    icon: string;
  }[];
  comparisonFeatures: {
    feature: string;
    before: string;
    after: string;
  }[];
}

export const platforms: Platform[] = [
  {
    id: "quebec-tax-calculator",
    name: "Quebec Tax Calculator",
    logo: "/logos/generic.svg",
    description:
      "Enterprise-grade SAP CAP solution for Quebec corporate tax calculations and incentive program eligibility assessment.",
    href: "/products/quebec-tax-calculator",
  },
  {
    id: "boomi",
    name: "Dell Boomi",
    logo: "/logos/boomi.svg",
    description:
      "Migrate your SAP PI/PO integrations to Dell Boomi's cloud-native iPaaS platform with automated pattern conversion and connector mapping.",
    href: "/products/dell-boomi",
  },
  {
    id: "informatica",
    name: "Informatica",
    logo: "/logos/informatica.svg",
    description:
      "Transform your integration landscape with Informatica IICS, leveraging intelligent automation for seamless SAP PI/PO migration.",
    href: "/products/informatica",
  },
  {
    id: "mulesoft",
    name: "MuleSoft",
    logo: "/logos/mulesoft.svg",
    description:
      "Move to MuleSoft Anypoint Platform with full API-led connectivity, preserving your integration logic and business rules.",
    href: "/products/mulesoft",
  },
];

export const platformDetails: PlatformDetail[] = [
  {
    id: "boomi",
    name: "Dell Boomi",
    logo: "/logos/boomi.svg",
    description:
      "Migrate your SAP PI/PO integrations to Dell Boomi's cloud-native iPaaS platform with automated pattern conversion and connector mapping.",
    href: "/products/dell-boomi",
    heroTagline:
      "Seamless SAP PI/PO to Dell Boomi Migration with Zero Integration Downtime",
    capabilities: [
      {
        title: "Automated Pattern Conversion",
        description:
          "Automatically convert SAP PI/PO integration patterns (ICo, CC, VC) to equivalent Boomi process shapes and connectors.",
        icon: "Workflow",
      },
      {
        title: "Connector Mapping",
        description:
          "Intelligent mapping of SAP adapters (RFC, IDoc, SOAP, REST) to native Boomi connectors with pre-configured settings.",
        icon: "Plug",
      },
      {
        title: "Cloud-Native Deployment",
        description:
          "Deploy migrated integrations to Boomi AtomSphere with auto-scaling Atoms and Molecules for high availability.",
        icon: "Cloud",
      },
      {
        title: "Error Handling Preservation",
        description:
          "Migrate alert rules, exception handling, and retry logic to Boomi's built-in error management framework.",
        icon: "ShieldCheck",
      },
      {
        title: "Data Mapping Translation",
        description:
          "Convert graphical message mappings and XSLT transformations to Boomi Map components with field-level accuracy.",
        icon: "GitBranch",
      },
      {
        title: "Testing & Validation",
        description:
          "Automated regression testing comparing source PI/PO outputs with migrated Boomi process results for data integrity.",
        icon: "TestTube",
      },
    ],
    comparisonFeatures: [
      {
        feature: "Deployment Model",
        before: "On-premise Java stack with manual patching",
        after: "Cloud-native iPaaS with automatic updates",
      },
      {
        feature: "Connector Library",
        before: "Limited adapters requiring custom development",
        after: "200+ pre-built connectors with drag-and-drop configuration",
      },
      {
        feature: "Scalability",
        before: "Vertical scaling with hardware upgrades",
        after: "Horizontal auto-scaling with Atoms and Molecules",
      },
      {
        feature: "Monitoring",
        before: "SAP PI/PO monitoring with limited alerting",
        after: "Real-time dashboards with proactive anomaly detection",
      },
      {
        feature: "Development Speed",
        before: "Weeks per integration with ESR/ID tooling",
        after: "Days per integration with low-code visual builder",
      },
    ],
  },
  {
    id: "informatica",
    name: "Informatica",
    logo: "/logos/informatica.svg",
    description:
      "Transform your integration landscape with Informatica IICS, leveraging intelligent automation for seamless SAP PI/PO migration.",
    href: "/products/informatica",
    heroTagline:
      "AI-Powered Migration from SAP PI/PO to Informatica Intelligent Cloud Services",
    capabilities: [
      {
        title: "CLAIRE AI-Assisted Migration",
        description:
          "Leverage Informatica CLAIRE AI engine to recommend optimal mapping patterns and transformation logic during migration.",
        icon: "Brain",
      },
      {
        title: "Integration Hub Conversion",
        description:
          "Transform SAP PI/PO integration scenarios into Informatica IICS taskflows with publish/subscribe event handling.",
        icon: "Network",
      },
      {
        title: "Advanced Data Transformation",
        description:
          "Migrate complex XSLT, Java mappings, and UDFs to Informatica PowerCenter expressions and transformations.",
        icon: "Shuffle",
      },
      {
        title: "Hybrid Connectivity",
        description:
          "Maintain on-premise SAP connectivity via Secure Agent while enabling cloud-to-cloud integrations in IICS.",
        icon: "Link",
      },
      {
        title: "Metadata-Driven Discovery",
        description:
          "Automatically catalog all PI/PO interfaces, data flows, and dependencies using Informatica metadata intelligence.",
        icon: "Search",
      },
      {
        title: "Enterprise Data Governance",
        description:
          "Apply data quality rules, masking policies, and lineage tracking to migrated integrations from day one.",
        icon: "Lock",
      },
    ],
    comparisonFeatures: [
      {
        feature: "Intelligence Layer",
        before: "Manual mapping and routing decisions",
        after: "CLAIRE AI recommendations for optimal patterns",
      },
      {
        feature: "Data Quality",
        before: "Basic validation in mapping steps",
        after: "Built-in data quality, profiling, and cleansing",
      },
      {
        feature: "Governance",
        before: "Limited lineage and impact analysis",
        after: "End-to-end data lineage with automated cataloging",
      },
      {
        feature: "Hybrid Architecture",
        before: "Fully on-premise with no cloud option",
        after: "Hybrid deployment with Secure Agents and cloud runtime",
      },
      {
        feature: "Reusability",
        before: "Copy-paste patterns across interfaces",
        after: "Shared services, templates, and parameterized mappings",
      },
    ],
  },
  {
    id: "mulesoft",
    name: "MuleSoft",
    logo: "/logos/mulesoft.svg",
    description:
      "Move to MuleSoft Anypoint Platform with full API-led connectivity, preserving your integration logic and business rules.",
    href: "/products/mulesoft",
    heroTagline:
      "Transform SAP PI/PO Integrations into API-Led Connectivity on MuleSoft Anypoint",
    capabilities: [
      {
        title: "API-Led Decomposition",
        description:
          "Restructure monolithic PI/PO interfaces into reusable Experience, Process, and System API layers on Anypoint.",
        icon: "Layers",
      },
      {
        title: "DataWeave Transformation",
        description:
          "Convert SAP message mappings and XSLT to MuleSoft DataWeave expressions with full type safety and streaming support.",
        icon: "Code",
      },
      {
        title: "Anypoint Connector Migration",
        description:
          "Map SAP PI/PO adapters to MuleSoft Anypoint Connectors for SAP, Salesforce, databases, and 300+ systems.",
        icon: "Plug",
      },
      {
        title: "API Management & Security",
        description:
          "Apply rate limiting, OAuth 2.0, and API policies to migrated integrations via Anypoint API Manager.",
        icon: "Shield",
      },
      {
        title: "CloudHub Deployment",
        description:
          "Deploy migrated Mule applications to CloudHub with auto-scaling workers and multi-region failover.",
        icon: "Globe",
      },
      {
        title: "Anypoint Monitoring",
        description:
          "Gain full observability with distributed tracing, custom dashboards, and intelligent alerting on Anypoint Monitoring.",
        icon: "BarChart",
      },
    ],
    comparisonFeatures: [
      {
        feature: "Architecture Style",
        before: "Point-to-point and hub-spoke patterns",
        after: "API-led connectivity with reusable layers",
      },
      {
        feature: "Reusability",
        before: "Tightly coupled interfaces with limited reuse",
        after: "Discoverable APIs in Anypoint Exchange marketplace",
      },
      {
        feature: "Security Model",
        before: "Transport-level security with basic auth",
        after: "OAuth 2.0, JWT, and fine-grained API policies",
      },
      {
        feature: "Developer Experience",
        before: "Complex ESR/ID tooling with steep learning curve",
        after: "Modern IDE (Anypoint Studio) with visual and code modes",
      },
      {
        feature: "Ecosystem",
        before: "SAP-centric adapter library",
        after: "300+ connectors and 1000+ templates on Anypoint Exchange",
      },
    ],
  },
];
