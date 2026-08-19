import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Navbar, Footer } from "@/components";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const viewport: Viewport = {
  themeColor: "#030014",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "SDA Migration WorkBench | SAP PI/PO Migration Services",
  description:
    "Modernize your integration platform with expert SAP PI/PO migration services. Migrate seamlessly to Dell Boomi, Informatica, MuleSoft, and other modern integration suites.",
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "SDA Migration WorkBench | SAP PI/PO Migration Services",
    description:
      "Modernize your integration platform with expert SAP PI/PO migration services. Migrate seamlessly to Dell Boomi, Informatica, MuleSoft, and other modern integration suites.",
    type: "website",
    url: "https://sda-migration-workbench.com",
    siteName: "SDA Migration WorkBench",
  },
  twitter: {
    card: "summary_large_image",
    title: "SDA Migration WorkBench | SAP PI/PO Migration Services",
    description:
      "Modernize your integration platform with expert SAP PI/PO migration services.",
  },
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "SDA Migration WorkBench",
  url: "https://sda-migration-workbench.com",
  description:
    "Expert SAP PI/PO migration services to modern integration platforms including Dell Boomi, Informatica, and MuleSoft.",
  sameAs: [
    "https://www.linkedin.com/company/integrationmigration",
    "https://twitter.com/integrationmig",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationSchema),
          }}
        />
      </head>
      <body className={inter.className}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-md focus:bg-accent-primary focus:text-white focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-2 focus:ring-offset-background"
        >
          Skip to content
        </a>
        <Navbar />
        {children}
        <Footer />
      </body>
    </html>
  );
}
