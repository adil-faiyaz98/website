/**
 * Careers data for the Company Careers page.
 * Defines job postings and company benefits.
 * Validates: Requirements 10.2
 */

export interface JobPosting {
  id: string;
  title: string;
  department: string;
  location: string;
  type: "full-time" | "contract";
  description: string;
  applyUrl: string;
}

export interface Benefit {
  icon: string;
  title: string;
  description: string;
}

export const jobPostings: JobPosting[] = [
  {
    id: "sre-001",
    title: "Senior Integration Engineer",
    department: "Engineering",
    location: "Remote (Global)",
    type: "full-time",
    description:
      "Design and implement migration pipelines for enterprise SAP PI/PO integrations. Work with cross-functional teams to deliver automated conversion tools targeting Dell Boomi, Informatica, and MuleSoft platforms.",
    applyUrl: "/company/careers#apply",
  },
  {
    id: "sre-002",
    title: "SAP PI/PO Migration Consultant",
    department: "Consulting",
    location: "Bangalore, India",
    type: "full-time",
    description:
      "Lead client engagements for SAP PI/PO landscape assessments, migration planning, and execution. Provide technical guidance on platform selection and integration architecture.",
    applyUrl: "/company/careers#apply",
  },
  {
    id: "sre-003",
    title: "Frontend Developer",
    department: "Engineering",
    location: "Remote (Europe)",
    type: "full-time",
    description:
      "Build and maintain the SDA Migration WorkBench web applications using Next.js, React, and Tailwind CSS. Create intuitive user interfaces for migration monitoring and reporting dashboards.",
    applyUrl: "/company/careers#apply",
  },
  {
    id: "sre-004",
    title: "QA Automation Engineer",
    department: "Quality",
    location: "Remote (US)",
    type: "contract",
    description:
      "Develop and maintain automated test suites for migration validation. Build regression testing frameworks that verify data integrity and business process continuity post-migration.",
    applyUrl: "/company/careers#apply",
  },
  {
    id: "sre-005",
    title: "Technical Writer",
    department: "Documentation",
    location: "Remote (Global)",
    type: "contract",
    description:
      "Create and maintain technical documentation including migration guides, API references, and platform-specific tutorials for the SDA Migration WorkBench product suite.",
    applyUrl: "/company/careers#apply",
  },
];

export const benefits: Benefit[] = [
  {
    icon: "Globe",
    title: "Remote-First Culture",
    description:
      "Work from anywhere in the world with flexible hours and async-friendly collaboration.",
  },
  {
    icon: "GraduationCap",
    title: "Learning & Development",
    description:
      "Annual learning budget for conferences, courses, and certifications to grow your skills.",
  },
  {
    icon: "Heart",
    title: "Health & Wellness",
    description:
      "Comprehensive health insurance, mental health support, and wellness stipend for all team members.",
  },
  {
    icon: "Briefcase",
    title: "Competitive Compensation",
    description:
      "Market-rate salaries with equity options and performance-based bonuses.",
  },
  {
    icon: "Calendar",
    title: "Generous Time Off",
    description:
      "Flexible PTO policy with minimum 25 days off plus public holidays and company-wide recharge weeks.",
  },
  {
    icon: "Users",
    title: "Team Events",
    description:
      "Quarterly team retreats, virtual social events, and an annual company offsite to build connections.",
  },
];
