/**
 * Testimonials, stats, and client logos data for social proof sections.
 * Used on the homepage TestimonialsSection, StatsSection, and ClientLogos components.
 */

export interface Testimonial {
  id: string;
  quote: string;
  authorName: string;
  authorTitle: string;
  company: string;
  companyLogo?: string;
}

export interface Stat {
  id: string;
  label: string;
  value: number;
  suffix?: string;
  prefix?: string;
}

export interface ClientLogo {
  name: string;
  src: string;
}

export const testimonials: Testimonial[] = [
  {
    id: "testimonial-1",
    quote:
      "SDA Migration WorkBench reduced our SAP PI/PO migration timeline from 18 months to just 4 months. The automated pattern conversion handled over 80% of our interfaces without manual intervention.",
    authorName: "Marcus Chen",
    authorTitle: "VP of Enterprise Integration",
    company: "Global Logistics Corp",
    companyLogo: "/logos/generic.svg",
  },
  {
    id: "testimonial-2",
    quote:
      "The assessment tools gave us complete visibility into our 2,000+ interfaces. We could prioritize by complexity and risk, which made stakeholder buy-in straightforward.",
    authorName: "Sarah Johansson",
    authorTitle: "Director of IT Operations",
    company: "Nordic Manufacturing AG",
    companyLogo: "/logos/generic.svg",
  },
  {
    id: "testimonial-3",
    quote:
      "Moving to Dell Boomi from PI/PO felt seamless. The testing and validation framework caught integration issues before they reached production, saving us significant rework.",
    authorName: "Raj Patel",
    authorTitle: "Chief Integration Architect",
    company: "FinServ Solutions",
    companyLogo: "/logos/generic.svg",
  },
];

export const stats: Stat[] = [
  {
    id: "stat-migrations",
    label: "Migrations Completed",
    value: 500,
    suffix: "+",
  },
  {
    id: "stat-interfaces",
    label: "Interfaces Converted",
    value: 45,
    suffix: "K+",
  },
  {
    id: "stat-customers",
    label: "Enterprise Customers",
    value: 120,
    suffix: "+",
  },
  {
    id: "stat-uptime",
    label: "Migration Success Rate",
    value: 99,
    suffix: "%",
  },
];

export const clientLogos: ClientLogo[] = [
  { name: "Dell Boomi", src: "/logos/boomi.svg" },
  { name: "Informatica", src: "/logos/informatica.svg" },
  { name: "MuleSoft", src: "/logos/mulesoft.svg" },
  { name: "Global Logistics Corp", src: "/logos/generic.svg" },
  { name: "Nordic Manufacturing AG", src: "/logos/generic.svg" },
  { name: "FinServ Solutions", src: "/logos/generic.svg" },
];
