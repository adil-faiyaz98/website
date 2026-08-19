import { Metadata } from "next";
import { webinars } from "@/data/webinars";
import { GlassCard } from "@/components/ui";

export const metadata: Metadata = {
  title: "Webinars | SDA Migration WorkBench",
  description:
    "Join upcoming live webinars or watch recorded sessions on SAP PI/PO migration strategies, best practices, and platform-specific walkthroughs.",
  openGraph: {
    title: "Webinars | SDA Migration WorkBench",
    description:
      "Join upcoming live webinars or watch recorded sessions on SAP PI/PO migration strategies, best practices, and platform-specific walkthroughs.",
  },
  twitter: {
    title: "Webinars | SDA Migration WorkBench",
    description:
      "Join upcoming live webinars or watch recorded sessions on SAP PI/PO migration strategies, best practices, and platform-specific walkthroughs.",
  },
};

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function WebinarsPage() {
  const upcomingWebinars = webinars.filter((w) => w.status === "upcoming");
  const recordedWebinars = webinars.filter((w) => w.status === "recorded");

  return (
    <main id="main-content" className="min-h-screen bg-background py-20 px-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-h1 text-text-primary mb-4 text-center">
          Webinars
        </h1>
        <p className="text-body text-text-secondary text-center mb-16 max-w-2xl mx-auto">
          Join our live sessions to learn migration strategies from experts, or
          catch up on recorded webinars at your own pace.
        </p>

        {/* Upcoming Webinars */}
        {upcomingWebinars.length > 0 && (
          <section className="mb-16">
            <h2 className="text-h2 text-text-primary mb-8">
              Upcoming Sessions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {upcomingWebinars.map((webinar) => (
                <GlassCard
                  key={webinar.id}
                  interactive={true}
                  className="p-6 flex flex-col"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-accent-primary/20 text-accent-primary">
                      Upcoming
                    </span>
                    <span className="text-caption text-text-muted">
                      {webinar.duration}
                    </span>
                  </div>
                  <h3 className="text-h3 text-text-primary mb-2 leading-tight">
                    {webinar.title}
                  </h3>
                  <p className="text-caption text-text-secondary mb-1">
                    {formatDate(webinar.date)}
                  </p>
                  <p className="text-body text-text-secondary mb-6 flex-1">
                    {webinar.description}
                  </p>
                  {webinar.registrationUrl && (
                    <a
                      href={webinar.registrationUrl}
                      className="inline-flex items-center justify-center rounded-lg font-medium transition-all duration-300 ease-in-out bg-accent-primary text-white hover:shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:scale-105 px-6 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      Register Now
                    </a>
                  )}
                </GlassCard>
              ))}
            </div>
          </section>
        )}

        {/* Recorded Webinars */}
        {recordedWebinars.length > 0 && (
          <section>
            <h2 className="text-h2 text-text-primary mb-8">
              Recorded Sessions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {recordedWebinars.map((webinar) => (
                <GlassCard
                  key={webinar.id}
                  interactive={true}
                  className="p-6 flex flex-col"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-accent-secondary/20 text-accent-secondary">
                      Recorded
                    </span>
                    <span className="text-caption text-text-muted">
                      {webinar.duration}
                    </span>
                  </div>
                  <h3 className="text-h3 text-text-primary mb-2 leading-tight">
                    {webinar.title}
                  </h3>
                  <p className="text-caption text-text-secondary mb-1">
                    {formatDate(webinar.date)}
                  </p>
                  <p className="text-body text-text-secondary mb-6 flex-1">
                    {webinar.description}
                  </p>
                  {webinar.playbackUrl && (
                    <a
                      href={webinar.playbackUrl}
                      className="inline-flex items-center justify-center rounded-lg font-medium transition-all duration-300 ease-in-out border border-accent-secondary text-accent-secondary hover:bg-accent-secondary/10 hover:scale-105 px-6 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      Watch Recording
                    </a>
                  )}
                </GlassCard>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
