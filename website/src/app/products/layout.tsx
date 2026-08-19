import { ReactNode } from "react";

export default function ProductsLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <div className="min-h-screen">
      {/* Optional breadcrumb navigation area */}
      <nav
        aria-label="Breadcrumb"
        className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 pt-6"
      >
        <ol className="flex items-center gap-2 text-sm text-white/50">
          <li>
            <a href="/" className="hover:text-white/80 transition-colors">
              Home
            </a>
          </li>
          <li aria-hidden="true" className="text-white/30">
            /
          </li>
          <li>
            <span className="text-white/70">Products</span>
          </li>
        </ol>
      </nav>

      {/* Page content container */}
      <main
        id="main-content"
        className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8"
      >
        {children}
      </main>
    </div>
  );
}
