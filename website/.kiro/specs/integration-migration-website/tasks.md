# Implementation Tasks

## Task 1: Project Setup and Configuration

- [x] 1.1 Initialize Next.js 14 project with TypeScript and App Router
- [x] 1.2 Install and configure Tailwind CSS 3 with custom dark theme (colors, spacing, typography)
- [x] 1.3 Install Framer Motion and Lucide React dependencies
- [x] 1.4 Configure Inter font via next/font with display swap
- [x] 1.5 Create globals.css with Tailwind directives and CSS custom properties for the theme
- [x] 1.6 Create root layout.tsx with dark theme class, font configuration, and meta tags
- [x] 1.7 Set up file structure (components/, data/, hooks/, lib/ directories)
- [x] 1.8 Create lib/constants.ts with theme constants and breakpoint values

## Task 2: Shared UI Components

- [x] 2.1 Create CTAButton component with primary, secondary, and ghost variants and sm/md/lg sizes
- [x] 2.2 Create SectionHeader component with title, subtitle, and centered props
- [x] 2.3 Create custom hooks: useScrollPosition and useMediaQuery
- [x] 2.4 Create PlatformCard component with logo, title, description, and hover effects

## Task 3: Navigation Bar

- [x] 3.1 Create navigation data file (data/navigation.ts) with menu items and dropdown content
- [x] 3.2 Build Navbar component with logo, desktop menu items, and Book a Demo CTA button
- [x] 3.3 Implement DropdownMenu component with hover/click trigger and sub-items
- [x] 3.4 Implement scroll-aware background transition (transparent to surface on scroll)
- [x] 3.5 Build MobileMenu component with hamburger toggle and slide-in panel
- [x] 3.6 Add keyboard navigation support for dropdown menus (arrow keys, Escape to close)
- [x] 3.7 Add ARIA attributes (aria-expanded, aria-haspopup) to navigation elements

## Task 4: Hero Section

- [x] 4.1 Build HeroSection component with two-column grid layout (text left, visual right)
- [x] 4.2 Create headline, sub-headline, and badge text content
- [x] 4.3 Add primary "Book a Demo" and secondary "View Platforms" CTA buttons
- [x] 4.4 Create or integrate migration diagram visual element (SVG illustration)
- [x] 4.5 Add Framer Motion entrance animations (fade-in from left for text, right for visual)
- [x] 4.6 Implement responsive stacking for mobile (text above visual)

## Task 5: Capabilities Section

- [x] 5.1 Create capabilities data file (data/capabilities.ts) with all four capability entries
- [x] 5.2 Build CapabilitiesSection component with left vertical navigation and right content panel
- [x] 5.3 Implement tab switching with activeCapability state and content transition animations
- [x] 5.4 Create visual elements for each capability tab (diagrams or illustrations)
- [x] 5.5 Add active state styling to vertical nav (accent border highlight)
- [x] 5.6 Implement responsive behavior (horizontal scrollable pills on mobile)

## Task 6: Migration Platforms Section

- [x] 6.1 Create platforms data file (data/platforms.ts) with Dell Boomi, Informatica, MuleSoft, and others
- [x] 6.2 Build PlatformsSection component with grid layout and section header
- [x] 6.3 Style PlatformCard with surface-elevated background, border, hover glow, and scale effect
- [x] 6.4 Add platform logos (SVG) and configure consistent sizing
- [x] 6.5 Implement click navigation to detailed platform pages or sections

## Task 7: CTA Banner and Additional Sections

- [x] 7.1 Build CTABanner component with gradient background, headline, description, and CTA button
- [x] 7.2 Style gradient background with low-opacity accent colors
- [x] 7.3 Create the demo booking page (app/demo/page.tsx) with form or embedded booking widget

## Task 8: Footer

- [x] 8.1 Build Footer component with multi-column grid layout
- [x] 8.2 Create link groups for Products, Resources, Company, and Legal
- [x] 8.3 Add company logo, description, and social media icons (LinkedIn, Twitter/X)
- [x] 8.4 Add copyright notice with dynamic year
- [x] 8.5 Implement responsive layout (stacked columns on mobile)

## Task 9: Page Assembly and Scroll Behavior

- [x] 9.1 Assemble all sections in app/page.tsx in correct order
- [x] 9.2 Add smooth scroll behavior for internal navigation links
- [x] 9.3 Implement scroll-triggered animations for sections entering viewport
- [x] 9.4 Add skip-to-content link as first focusable element

## Task 10: Performance Optimization

- [x] 10.1 Configure Next.js Image component for all images with WebP/AVIF and blur placeholders
- [x] 10.2 Implement dynamic imports for below-fold sections (code splitting)
- [x] 10.3 Configure next-sitemap for SEO sitemap generation
- [x] 10.4 Add meta tags, Open Graph tags, and structured data to layout
- [x] 10.5 Test and verify Lighthouse scores (LCP ≤ 2.5s, CLS ≤ 0.1)

## Task 11: Accessibility and Final Polish

- [x] 11.1 Verify semantic HTML structure and heading hierarchy across all sections
- [x] 11.2 Add alt text to all images and decorative aria-hidden where needed
- [x] 11.3 Test keyboard navigation flow through all interactive elements
- [x] 11.4 Add visible focus indicators (ring-2 ring-accent-primary) to all focusable elements
- [x] 11.5 Implement prefers-reduced-motion support for all animations
- [x] 11.6 Run WCAG AA contrast checks on all text/background combinations
- [x] 11.7 Test responsive layout across breakpoints (320px, 768px, 1024px, 1440px, 2560px)
