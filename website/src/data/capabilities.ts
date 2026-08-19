/**
 * Capabilities data for the Capabilities Section.
 * Defines the four core migration service capabilities with features.
 */

export interface Capability {
  id: string;
  title: string;
  description: string;
  features: string[];
}

export const capabilities: Capability[] = [
  {
    id: "assessment",
    title: "Assessment & Discovery",
    description:
      "Analyze and inventory your existing SAP PI/PO interfaces to understand complexity, dependencies, and the optimal migration path for each integration scenario.",
    features: [
      "Interface inventory",
      "Complexity analysis",
      "Dependency mapping",
      "Migration roadmap",
    ],
  },
  {
    id: "migration",
    title: "Automated Migration",
    description:
      "Automatically convert interfaces, mappings, and adapters from SAP PI/PO to your target platform using intelligent pattern-based transformation engines.",
    features: [
      "Pattern-based conversion",
      "Mapping transformation",
      "Adapter migration",
      "Configuration transfer",
    ],
  },
  {
    id: "testing",
    title: "Testing & Validation",
    description:
      "Ensure quality and correctness after migration with comprehensive testing suites that validate data integrity, performance, and end-to-end business process flows.",
    features: [
      "Regression testing",
      "Data validation",
      "Performance benchmarks",
      "End-to-end verification",
    ],
  },
  {
    id: "deployment",
    title: "Platform Deployment",
    description:
      "Deploy migrated integrations to your target platform with production-ready CI/CD pipelines, monitoring, and rollback capabilities for zero-downtime transitions.",
    features: [
      "Environment setup",
      "CI/CD pipelines",
      "Monitoring integration",
      "Rollback procedures",
    ],
  },
];
