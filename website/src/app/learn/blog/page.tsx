import type { Metadata } from "next";
import { blogPosts } from "@/data/blog";
import { GlassCard } from "@/components/ui";

export const metadata: Metadata = {
  title: "Blog | SDA Migration WorkBench",
  description:
    "Insights, guides, and best practices for SAP PI/PO migration. Stay up to date with the latest strategies for migrating to Dell Boomi, Informatica, and MuleSoft.",
  openGraph: {
    title: "Blog | SDA Migration WorkBench",
    description:
      "Insights, guides, and best practices for SAP PI/PO migration. Stay up to date with the latest strategies for migrating to Dell Boomi, Informatica, and MuleSoft.",
    type: "website",
    siteName: "SDA Migration WorkBench",
  },
  twitter: {
    card: "summary_large_image",
    title: "Blog | SDA Migration WorkBench",
    description:
      "Insights, guides, and best practices for SAP PI/PO migration.",
  },
};

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BlogPage() {
  return (
    <main id="main-content" className="min-h-screen bg-background py-20 px-6">
      <div className="max-w-[1280px] mx-auto">
        {/* Page Header */}
        <div className="text-center mb-16">
          <h1 className="text-h1 text-text-primary mb-4">Blog</h1>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            Insights, guides, and best practices for SAP PI/PO migration to
            modern integration platforms.
          </p>
        </div>

        {/* Blog Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {blogPosts.map((post) => (
            <GlassCard
              key={post.slug}
              interactive={true}
              as="article"
              className="p-6 flex flex-col"
            >
              {/* Category & Read Time */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-medium text-accent-primary bg-accent-primary/10 px-3 py-1 rounded-full">
                  {post.category}
                </span>
                <span className="text-xs text-text-muted">
                  {post.readTimeMinutes} min read
                </span>
              </div>

              {/* Title */}
              <h2 className="text-xl font-semibold text-text-primary mb-3 line-clamp-2">
                {post.title}
              </h2>

              {/* Excerpt */}
              <p className="text-sm text-text-secondary mb-4 line-clamp-3 flex-1">
                {post.excerpt}
              </p>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-4">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs text-text-muted border border-border rounded px-2 py-0.5"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Date */}
              <time
                dateTime={post.publishedDate}
                className="text-xs text-text-muted mt-auto"
              >
                {formatDate(post.publishedDate)}
              </time>
            </GlassCard>
          ))}
        </div>
      </div>
    </main>
  );
}
