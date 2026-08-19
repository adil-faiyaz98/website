import type { Metadata } from "next";
import { GlassCard, AnimatedCounter } from "@/components/ui";

export const metadata: Metadata = {
  title: "About Us | SDA Migration WorkBench",
  description:
    "Learn about SDA Migration WorkBench — our mission to simplify enterprise integration migration, our history, team, and the core values that drive us.",
  openGraph: {
    title: "About Us | SDA Migration WorkBench",
    description:
      "Learn about SDA Migration WorkBench — our mission to simplify enterprise integration migration, our history, team, and the core values that drive us.",
    type: "website",
    siteName: "SDA Migration WorkBench",
  },
  twitter: {
    card: "summary_large_image",
    title: "About Us | SDA Migration WorkBench",
    description:
      "Simplifying enterprise integration migration from SAP PI/PO to modern platforms.",
  },
};

const stats = [
  { label: "Migrations Delivered", value: 500, suffix: "+" },
  { label: "Interfaces Converted", value: 45000, suffix: "+" },
  { label: "Enterprise Customers", value: 120, suffix: "+" },
  { label: "Years of Experience", value: 12, suffix: "+" },
];

const timeline = [
  {
    year: "2012",
    title: "Founded",
    description:
      "SDA was founded with a singular vision — make enterprise integration migration painless, predictable, and cost-effective.",
  },
  {
    year: "2015",
    title: "First Automated Migration Engine",
    description:
      "Launched our proprietary pattern-recognition engine capable of analyzing SAP PI/PO interfaces and generating target platform artifacts automatically.",
  },
  {
    year: "2017",
    title: "Multi-Platform Support",
    description:
      "Expanded migration capabilities to support Dell Boomi, Informatica IICS, and MuleSoft Anypoint as target platforms.",
  },
  {
    year: "2019",
    title: "Assessment Toolkit Launch",
    description:
      "Released the PI/PO Landscape Assessment toolkit — enabling enterprises to inventory, score complexity, and build migration roadmaps before writing a single line of code.",
  },
  {
    year: "2021",
    title: "500+ Migrations Milestone",
    description:
      "Crossed 500 successful migration projects across financial services, manufacturing, logistics, and healthcare industries.",
  },
  {
    year: "2024",
    title: "Migration WorkBench 2.0",
    description:
      "Launched the next-generation Migration WorkBench with AI-assisted conversion, real-time validation, and end-to-end observability for migration projects.",
  },
];

const team = [
  {
    name: "Adil Faiyaz",
    role: "CEO & Co-Founder",
    company: "SDA",
    phone: "514-443-7486",
    bio: "15+ years in enterprise integration. Former SAP PI/PO architect at a Fortune 100 company.",
  },
  {
    name: "Ayman Kabalan",
    role: "CTO & Co-Founder",
    company: "SDA",
    phone: "514-329-8152",
    bio: "Integration middleware expert with deep expertise in Dell Boomi, Informatica, and MuleSoft platforms.",
  },
  {
    name: "Sai Lebaka",
    role: "VP of Engineering",
    company: "SDA",
    phone: "514-672-3941",
    bio: "Leads the Migration WorkBench product team. Passionate about automation and developer experience.",
  },
];

const coreValues = [
  {
    title: "Precision",
    description:
      "Every interface, every mapping, every test case matters. We obsess over accuracy so our customers don't have to.",
    icon: "🎯",
  },
  {
    title: "Transparency",
    description:
      "No black boxes. Our customers see real-time progress, detailed assessments, and honest timelines at every step.",
    icon: "🔍",
  },
  {
    title: "Speed Without Compromise",
    description:
      "Automation accelerates delivery, but never at the cost of quality. We ship fast and ship right.",
    icon: "⚡",
  },
  {
    title: "Customer Partnership",
    description:
      "We don't just deliver migrations — we partner with teams to build lasting integration capability and confidence.",
    icon: "🤝",
  },
];

export default function AboutPage() {
  return (
    <main id="main-content" className="min-h-screen bg-background py-20 px-6">
      <div className="max-w-[1280px] mx-auto">
        {/* Page Header & Mission */}
        <section className="text-center mb-20">
          <h1 className="text-h1 text-text-primary mb-6">About SDA</h1>
          <p className="text-xl text-text-secondary max-w-3xl mx-auto leading-relaxed">
            We exist to eliminate the complexity of enterprise integration
            migration. Our mission is to help organizations move from legacy SAP
            PI/PO to modern platforms — faster, safer, and with complete
            confidence.
          </p>
        </section>

        {/* Stats Section - Social Proof */}
        <section className="mb-24">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat) => (
              <GlassCard
                key={stat.label}
                className="p-6 text-center"
              >
                <div className="text-4xl md:text-5xl font-bold text-accent-primary mb-2">
                  <AnimatedCounter
                    target={stat.value}
                    suffix={stat.suffix}
                    duration={2000}
                  />
                </div>
                <p className="text-sm text-text-secondary">{stat.label}</p>
              </GlassCard>
            ))}
          </div>
        </section>

        {/* History Timeline */}
        <section className="mb-24">
          <h2 className="text-h2 text-text-primary text-center mb-12">
            Our Journey
          </h2>
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 md:left-1/2 md:-translate-x-px top-0 bottom-0 w-0.5 bg-border" />

            <div className="space-y-12">
              {timeline.map((item, index) => (
                <div
                  key={item.year}
                  className={`relative flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-8 ${
                    index % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
                  }`}
                >
                  {/* Timeline dot */}
                  <div className="absolute left-4 md:left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-accent-primary border-2 border-background z-10" />

                  {/* Content card */}
                  <div
                    className={`ml-10 md:ml-0 md:w-[calc(50%-2rem)] ${
                      index % 2 === 0 ? "md:text-right md:pr-8" : "md:pl-8"
                    }`}
                  >
                    <GlassCard className="p-6">
                      <span className="text-sm font-medium text-accent-primary">
                        {item.year}
                      </span>
                      <h3 className="text-lg font-semibold text-text-primary mt-1 mb-2">
                        {item.title}
                      </h3>
                      <p className="text-sm text-text-secondary">
                        {item.description}
                      </p>
                    </GlassCard>
                  </div>

                  {/* Spacer for the other side */}
                  <div className="hidden md:block md:w-[calc(50%-2rem)]" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Core Values */}
        <section className="mb-24">
          <h2 className="text-h2 text-text-primary text-center mb-12">
            Core Values
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {coreValues.map((value) => (
              <GlassCard
                key={value.title}
                interactive={true}
                className="p-8"
              >
                <div className="text-4xl mb-4">{value.icon}</div>
                <h3 className="text-xl font-semibold text-text-primary mb-3">
                  {value.title}
                </h3>
                <p className="text-text-secondary">{value.description}</p>
              </GlassCard>
            ))}
          </div>
        </section>

        {/* Team Section */}
        <section className="mb-24">
          <h2 className="text-h2 text-text-primary text-center mb-4">
            Leadership Team
          </h2>
          <p className="text-text-secondary text-center max-w-2xl mx-auto mb-12">
            Integration veterans with decades of combined experience in SAP
            middleware, cloud platforms, and enterprise architecture.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {team.map((member) => (
              <GlassCard
                key={member.name}
                interactive={true}
                className="p-6 text-center"
              >
                {/* Avatar placeholder */}
                <div className="w-20 h-20 rounded-full bg-accent-primary/20 mx-auto mb-4 flex items-center justify-center">
                  <span className="text-2xl font-bold text-accent-primary">
                    {member.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-text-primary mb-1">
                  {member.name}
                </h3>
                <p className="text-sm text-accent-primary mb-1">
                  {member.role}
                </p>
                <p className="text-xs text-text-muted mb-1">
                  {member.company}
                </p>
                <p className="text-xs text-text-secondary mb-3">
                  {member.phone}
                </p>
                <p className="text-sm text-text-secondary">{member.bio}</p>
              </GlassCard>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
