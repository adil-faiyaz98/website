/**
 * Navigation data for the main site navigation bar.
 * Defines top-level menu items and their dropdown sub-items.
 */

export interface DropdownItem {
  label: string;
  href: string;
  description?: string;
}

export interface NavItem {
  label: string;
  href?: string;
  dropdown?: DropdownItem[];
}

export const navigationItems: NavItem[] = [
  {
    label: "Products",
    dropdown: [
      {
        label: "Quebec Tax Calculator",
        href: "/products/quebec-tax-calculator",
        description:
          "Enterprise-grade Quebec corporate tax calculations & incentive program eligibility.",
      },
      {
        label: "Dell Boomi Migration",
        href: "/products/dell-boomi",
        description:
          "Migrate SAP PI/PO interfaces to Dell Boomi with automated pattern conversion.",
      },
      {
        label: "Informatica Migration",
        href: "/products/informatica",
        description:
          "Transform PI/PO mappings and adapters to Informatica IICS workflows.",
      },
      {
        label: "MuleSoft Migration",
        href: "/products/mulesoft",
        description:
          "Convert PI/PO integrations to MuleSoft Anypoint Platform APIs and flows.",
      },
      {
        label: "Assessment Tools",
        href: "/products/assessment",
        description:
          "Analyze your PI/PO landscape to plan and prioritize migration efforts.",
      },
    ],
  },
  {
    label: "Learn",
    dropdown: [
      {
        label: "Blog",
        href: "/learn/blog",
        description: "Insights and best practices for integration migration.",
      },
      {
        label: "Case Studies",
        href: "/learn/case-studies",
        description:
          "Real-world migration success stories from enterprise customers.",
      },
      {
        label: "Webinars",
        href: "/learn/webinars",
        description:
          "Live and recorded sessions on migration strategies and tools.",
      },
      {
        label: "Documentation",
        href: "/learn/documentation",
        description: "Technical guides and API references for migration tools.",
      },
    ],
  },
  {
    label: "Docs",
    href: "/docs",
  },
  {
    label: "Company",
    dropdown: [
      {
        label: "About Us",
        href: "/company/about",
        description:
          "Our mission, team, and approach to integration migration.",
      },
      {
        label: "Careers",
        href: "/company/careers",
        description:
          "Join our team and help modernize enterprise integrations.",
      },
      {
        label: "Contact",
        href: "/company/contact",
        description: "Get in touch with our sales and support teams.",
      },
      {
        label: "Partners",
        href: "/company/partners",
        description: "Our technology and consulting partner ecosystem.",
      },
    ],
  },
  {
    label: "Pricing",
    href: "/pricing",
  },
];
