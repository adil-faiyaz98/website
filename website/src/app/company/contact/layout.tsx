import type { Metadata } from "next";
import { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Contact Us | SDA Migration WorkBench",
  description:
    "Get in touch with the SDA Migration WorkBench team. Reach out for sales inquiries, technical support, or partnership opportunities.",
  openGraph: {
    title: "Contact Us | SDA Migration WorkBench",
    description:
      "Get in touch with the SDA Migration WorkBench team. Reach out for sales inquiries, technical support, or partnership opportunities.",
    type: "website",
    siteName: "SDA Migration WorkBench",
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact Us | SDA Migration WorkBench",
    description:
      "Get in touch with the SDA Migration WorkBench team for sales, support, or partnerships.",
  },
};

export default function ContactLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
