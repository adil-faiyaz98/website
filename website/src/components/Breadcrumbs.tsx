"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronRight, Home } from "lucide-react";

// Route name mappings
const routeNames: Record<string, string> = {
  "": "Home",
  "products": "Products",
  "company": "Company",
  "learn": "Learn",
  "legal": "Legal",
  "pricing": "Pricing",
  "demo": "Book a Demo",
  "quebec-tax-calculator": "Quebec Tax Calculator",
  "dell-boomi": "Dell Boomi",
  "informatica": "Informatica",
  "mulesoft": "MuleSoft",
  "assessment": "Assessment",
  "about": "About Us",
  "careers": "Careers",
  "partners": "Partners",
  "contact": "Contact",
  "blog": "Blog",
  "case-studies": "Case Studies",
  "documentation": "Documentation",
  "webinars": "Webinars",
  "privacy": "Privacy Policy",
  "terms": "Terms of Service",
  "cookies": "Cookie Policy",
};

interface BreadcrumbsProps {
  className?: string;
}

export function Breadcrumbs({ className = "" }: BreadcrumbsProps) {
  const pathname = usePathname();
  
  // Don't show breadcrumbs on home page
  if (pathname === "/") return null;
  
  const pathSegments = pathname.split("/").filter(Boolean);
  
  // Build breadcrumb items
  const breadcrumbs = pathSegments.map((segment, index) => {
    const path = "/" + pathSegments.slice(0, index + 1).join("/");
    const name = routeNames[segment] || segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");
    const isLast = index === pathSegments.length - 1;
    
    return { path, name, isLast };
  });

  return (
    <motion.nav
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      aria-label="Breadcrumb"
      className={`py-4 ${className}`}
    >
      <ol className="flex items-center flex-wrap gap-1 text-sm">
        {/* Home link */}
        <li>
          <Link
            href="/"
            className="flex items-center gap-1 text-[#7fc8ff]/60 hover:text-[#cce9ff] transition-colors"
          >
            <Home className="w-4 h-4" />
            <span className="sr-only">Home</span>
          </Link>
        </li>
        
        {breadcrumbs.map((crumb, index) => (
          <li key={crumb.path} className="flex items-center">
            <ChevronRight className="w-4 h-4 text-[#7fc8ff]/30 mx-1" />
            {crumb.isLast ? (
              <span className="text-[#cce9ff] font-medium" aria-current="page">
                {crumb.name}
              </span>
            ) : (
              <Link
                href={crumb.path}
                className="text-[#7fc8ff]/60 hover:text-[#cce9ff] transition-colors"
              >
                {crumb.name}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </motion.nav>
  );
}

// Sticky page header with breadcrumbs
interface PageHeaderProps {
  title: string;
  description?: string;
  badge?: string;
  children?: React.ReactNode;
}

export function PageHeader({ title, description, badge, children }: PageHeaderProps) {
  return (
    <div className="relative pt-24 pb-12 px-6 bg-[#030710]">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `linear-gradient(rgba(127, 200, 255, 0.3) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(127, 200, 255, 0.3) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-[#006ddd]/10 blur-[120px]" />
      </div>
      
      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Breadcrumbs */}
        <Breadcrumbs />
        
        {/* Header content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          {badge && (
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#006ddd]/15 border border-[#7fc8ff]/20 text-xs font-medium text-[#7fc8ff] uppercase tracking-wider mb-4">
              {badge}
            </span>
          )}
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-light text-[#cce9ff] tracking-tight">
            {title}
          </h1>
          
          {description && (
            <p className="mt-4 text-lg text-[#99d3ff]/80 max-w-2xl font-light">
              {description}
            </p>
          )}
          
          {children && (
            <div className="mt-6">
              {children}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

// Progress indicator for long pages
interface ScrollProgressProps {
  className?: string;
}

export function ScrollProgress({ className = "" }: ScrollProgressProps) {
  return (
    <motion.div
      className={`fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#006ddd] to-[#00d4ff] origin-left z-[60] ${className}`}
      style={{ scaleX: 0 }}
      initial={{ scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
    />
  );
}
