import type { Metadata } from "next";
import { jobPostings, benefits } from "@/data/careers";
import { GlassCard } from "@/components/ui";

export const metadata: Metadata = {
  title: "Careers | SDA Migration WorkBench",
  description:
    "Join the SDA Migration WorkBench team. Explore open positions in engineering, consulting, and more. Help enterprises migrate from SAP PI/PO to modern integration platforms.",
  openGraph: {
    title: "Careers | SDA Migration WorkBench",
    description:
      "Join the SDA Migration WorkBench team. Explore open positions in engineering, consulting, and more.",
    type: "website",
    siteName: "SDA Migration WorkBench",
  },
  twitter: {
    card: "summary_large_image",
    title: "Careers | SDA Migration WorkBench",
    description:
      "Join the SDA Migration WorkBench team. Explore open positions and help shape the future of integration migration.",
  },
};

/** Group job postings by department */
function groupByDepartment(
  postings: typeof jobPostings
): Record<string, typeof jobPostings> {
  return postings.reduce(
    (groups, posting) => {
      const dept = posting.department;
      if (!groups[dept]) {
        groups[dept] = [];
      }
      groups[dept].push(posting);
      return groups;
    },
    {} as Record<string, typeof jobPostings>
  );
}

export default function CareersPage() {
  const departments = groupByDepartment(jobPostings);

  return (
    <main id="main-content" className="min-h-screen bg-background py-20 px-6">
      <div className="max-w-[1280px] mx-auto">
        {/* Page Header */}
        <div className="text-center mb-16">
          <h1 className="text-h1 text-text-primary mb-4">Careers</h1>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            Join our mission to simplify enterprise integration migration. We
            are building the tools that help organizations move from legacy SAP
            PI/PO to modern platforms — faster, safer, and smarter.
          </p>
        </div>

        {/* Company Culture Section */}
        <section className="mb-20">
          <h2 className="text-h2 text-text-primary mb-6 text-center">
            Our Culture
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <GlassCard className="p-6 text-center">
              <h3 className="text-xl font-semibold text-text-primary mb-3">
                Innovation First
              </h3>
              <p className="text-sm text-text-secondary">
                We tackle complex enterprise challenges with creative solutions.
                Every team member is encouraged to experiment, iterate, and push
                boundaries in integration technology.
              </p>
            </GlassCard>
            <GlassCard className="p-6 text-center">
              <h3 className="text-xl font-semibold text-text-primary mb-3">
                Remote & Flexible
              </h3>
              <p className="text-sm text-text-secondary">
                Our distributed team spans the globe. We value outcomes over
                hours and trust our people to deliver great work on their own
                schedule.
              </p>
            </GlassCard>
            <GlassCard className="p-6 text-center">
              <h3 className="text-xl font-semibold text-text-primary mb-3">
                Continuous Growth
              </h3>
              <p className="text-sm text-text-secondary">
                Learning is part of the job. From conference budgets to
                mentorship programs, we invest in helping every team member reach
                their potential.
              </p>
            </GlassCard>
          </div>
        </section>

        {/* Open Positions by Department */}
        <section className="mb-20">
          <h2 className="text-h2 text-text-primary mb-8 text-center">
            Open Positions
          </h2>
          {Object.entries(departments).map(([department, postings]) => (
            <div key={department} className="mb-10">
              <h3 className="text-2xl font-semibold text-text-primary mb-4">
                {department}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {postings.map((posting) => (
                  <GlassCard
                    key={posting.id}
                    interactive={true}
                    as="article"
                    className="p-6 flex flex-col"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-medium text-accent-primary bg-accent-primary/10 px-3 py-1 rounded-full">
                        {posting.type}
                      </span>
                      <span className="text-xs text-text-muted">
                        {posting.location}
                      </span>
                    </div>
                    <h4 className="text-lg font-semibold text-text-primary mb-2">
                      {posting.title}
                    </h4>
                    <p className="text-sm text-text-secondary mb-4 flex-1">
                      {posting.description}
                    </p>
                    <a
                      href={posting.applyUrl}
                      className="inline-flex items-center text-sm font-medium text-accent-primary hover:text-accent-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:rounded-sm"
                    >
                      Apply Now →
                    </a>
                  </GlassCard>
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* Benefits Overview */}
        <section id="benefits">
          <h2 className="text-h2 text-text-primary mb-8 text-center">
            Benefits & Perks
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {benefits.map((benefit) => (
              <GlassCard
                key={benefit.title}
                className="p-6 text-center"
                interactive={true}
              >
                <div className="text-3xl mb-4" aria-hidden="true">
                  {benefit.icon === "Globe" && "🌍"}
                  {benefit.icon === "GraduationCap" && "🎓"}
                  {benefit.icon === "Heart" && "❤️"}
                  {benefit.icon === "Briefcase" && "💼"}
                  {benefit.icon === "Calendar" && "📅"}
                  {benefit.icon === "Users" && "👥"}
                </div>
                <h3 className="text-lg font-semibold text-text-primary mb-2">
                  {benefit.title}
                </h3>
                <p className="text-sm text-text-secondary">
                  {benefit.description}
                </p>
              </GlassCard>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
