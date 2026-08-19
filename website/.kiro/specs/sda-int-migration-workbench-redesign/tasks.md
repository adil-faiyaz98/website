# Implementation Plan: SDA-INT Migration WorkBench Redesign

## Overview

This implementation plan transforms the existing single-page IntegrationMigrate website into a premium multi-page "SDA-INT Migration WorkBench" experience. The work is organized into incremental phases: foundational infrastructure (brand rename, Tailwind config, visual primitives), then page-level implementation (homepage redesign, product pages, learn pages, company pages, pricing, docs, legal), and finally integration wiring (footer, SEO, performance, accessibility).

All code uses TypeScript with Next.js 14 App Router, Tailwind CSS, and Framer Motion.

## Tasks

- [x] 1. Brand rename and foundational configuration
  - [x] 1.1 Update brand name across root layout and metadata
    - Replace "IntegrationMigrate" / "Integration Migration" with "SDA-INT Migration WorkBench" in `src/app/layout.tsx` metadata (title, description, OG, Twitter, JSON-LD organization schema)
    - Update `siteName` and `url` in Open Graph metadata
    - Update organization structured data `name` field
    - _Requirements: 1.1, 1.2, 1.3, 19.1, 19.2, 19.5_

  - [x] 1.2 Extend Tailwind configuration with new animations and utilities
    - Add `gradient-shift` keyframe and animation for animated gradient borders
    - Add `float` keyframe and animation for decorative elements
    - Verify existing color tokens, font, and spacing configuration remain intact
    - _Requirements: 4.1, 5.2, 6.1, 6.4_

  - [x] 1.3 Create the PageTemplate (page transition wrapper)
    - Create `src/app/template.tsx` with Framer Motion `motion.div` wrapping children
    - Implement fade + vertical slide (20px, 400ms) page transitions
    - Respect `prefers-reduced-motion` by skipping animation and rendering children directly
    - _Requirements: 3.1, 3.2, 3.3, 3.5_

  - [x] 1.4 Update root layout to include Navbar and Footer globally
    - Move Navbar and Footer from `page.tsx` into `src/app/layout.tsx` so they persist across routes
    - Ensure Navbar remains stationary during page transitions (outside `template.tsx`)
    - Add skip-to-content link as first focusable element
    - _Requirements: 3.4, 18.5_

- [~] 2. Checkpoint - Ensure build passes and brand rename is verified
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Visual effect primitives (UI component library)
  - [x] 3.1 Create GlassCard component
    - Create `src/components/ui/GlassCard.tsx` with configurable blur (8-20px), opacity (60-80%), and 1px border at 10-20% opacity
    - Implement interactive mode with hover scale (1.02x) and animated gradient border (2-3s shift)
    - Respect reduced-motion preference by disabling hover animations
    - _Requirements: 4.2, 4.3, 5.2_

  - [x] 3.2 Create GradientMesh component
    - Create `src/components/ui/GradientMesh.tsx` with configurable color stops, opacity (5-15%), and animated orbs (drift/pulse over 8-15s cycle)
    - Render as absolute-positioned, pointer-events-none decorative layer
    - Respect reduced-motion preference
    - _Requirements: 4.4, 7.2_

  - [x] 3.3 Create NoiseTexture component
    - Create `src/components/ui/NoiseTexture.tsx` with SVG-based fractal noise at configurable opacity (2-5%)
    - Apply as absolute-positioned overlay with aria-hidden
    - _Requirements: 4.5_

  - [x] 3.4 Create ParticleCanvas component
    - Create `src/components/ui/ParticleCanvas.tsx` with configurable particle count, color, and cursor interaction
    - Use requestAnimationFrame for 60fps rendering
    - Return null when reduced-motion is preferred
    - Lazy-load with `dynamic()` and `ssr: false`
    - _Requirements: 5.5, 7.3, 17.3_

  - [x] 3.5 Create CursorGlow component
    - Create `src/components/ui/CursorGlow.tsx` with radial gradient following mouse position using Framer Motion useMotionValue
    - Return null when reduced-motion is preferred
    - _Requirements: 5.5, 7.3_

  - [x] 3.6 Create AnimatedCounter component
    - Create `src/components/ui/AnimatedCounter.tsx` using useInView and requestAnimationFrame
    - Count from 0 to target over 1.5-2.5s with ease-out cubic easing
    - Support prefix/suffix and show final value immediately for reduced-motion
    - _Requirements: 5.3, 14.5_

  - [x] 3.7 Create StaggeredText component
    - Create `src/components/ui/StaggeredText.tsx` with word-by-word or line-by-line fade-up reveal
    - Total animation duration 800-1200ms with staggered delays
    - Render plain text for reduced-motion users
    - _Requirements: 7.4_

  - [x] 3.8 Create ParallaxElement component
    - Create `src/components/ui/ParallaxElement.tsx` using Framer Motion useScroll and useTransform
    - Configurable offset (10-30% of scroll distance)
    - Render static children for reduced-motion users
    - _Requirements: 5.4_

  - [x] 3.9 Create BentoGrid and BentoItem layout components
    - Create `src/components/ui/BentoGrid.tsx` with configurable columns (2-4) and responsive single-column on mobile
    - BentoItem supports colSpan (1-3) and rowSpan (1-2)
    - _Requirements: 6.3, 16.2_

  - [x] 3.10 Create GlowButton component
    - Create `src/components/ui/GlowButton.tsx` extending CTAButton with colored box-shadow glow on hover (200-300ms transition)
    - Support primary/secondary variants and link/button modes
    - _Requirements: 5.1_

- [~] 4. Checkpoint - Ensure all visual primitives build correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Update Navbar with brand rename and glassmorphism
  - [x] 5.1 Update Navbar component with new brand and glassmorphism
    - Replace "IntegrationMigrate" with "SDA-INT Migration WorkBench" (full on desktop, "SDA-INT" on mobile via hidden/shown spans)
    - Update glassmorphism scroll style: `bg-surface/70 backdrop-blur-[16px] border-b border-white/10` when scrolled past 50px
    - Preserve existing keyboard navigation, focus indicators, and mobile menu functionality
    - _Requirements: 1.1, 1.4, 4.1, 16.1_

- [x] 6. Update Footer with complete navigation and brand
  - [x] 6.1 Redesign Footer component with full site navigation
    - Replace "IntegrationMigrate" with "SDA-INT Migration WorkBench" in brand area and copyright
    - Organize link groups: Products, Learn, Company, Legal with all sub-links
    - Include LinkedIn and Twitter/X social icons
    - Display dynamic copyright year
    - Apply glassmorphism or subtle top border styling
    - _Requirements: 1.3, 15.1, 15.2, 15.3, 15.4, 15.5_

- [x] 7. Data layer for new pages
  - [x] 7.1 Create pricing data module
    - Create `src/data/pricing.ts` with PricingTier interface (id, name, price, period, description, features, highlighted, ctaLabel, ctaHref) and FAQ interface
    - Export at least 3 pricing tiers and 5+ FAQ items
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [x] 7.2 Create testimonials and stats data module
    - Create `src/data/testimonials.ts` with Testimonial interface (quote, authorName, authorTitle, company, companyLogo) and Stat interface (label, value, suffix, prefix)
    - Export at least 3 testimonials, 4 stats, and client logo list
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

  - [x] 7.3 Create blog posts data module
    - Create `src/data/blog.ts` with BlogPost interface (slug, title, excerpt, publishedDate, category, tags, readTimeMinutes)
    - Export sample blog posts array
    - _Requirements: 9.1_

  - [x] 7.4 Create case studies data module
    - Create `src/data/case-studies.ts` with CaseStudy interface (slug, company, industry, platform, metrics, excerpt, logoSrc)
    - Export sample case studies array
    - _Requirements: 9.2_

  - [x] 7.5 Create webinars data module
    - Create `src/data/webinars.ts` with Webinar interface (id, title, date, duration, status, registrationUrl, playbackUrl, description)
    - Export sample webinars with both upcoming and recorded sessions
    - _Requirements: 9.3_

  - [x] 7.6 Create careers data module
    - Create `src/data/careers.ts` with JobPosting interface (id, title, department, location, type, description, applyUrl) and Benefit interface
    - Export sample job postings and benefits
    - _Requirements: 10.2_

  - [x] 7.7 Create legal content data module
    - Create `src/data/legal.ts` with LegalPage interface (slug, title, lastUpdated, sections array with heading/content)
    - Export privacy, terms, and cookies page content
    - _Requirements: 13.1, 13.2, 13.3, 13.4_

  - [x] 7.8 Extend platforms data with platform detail information
    - Extend `src/data/platforms.ts` with heroTagline, capabilities array, and comparisonFeatures for each platform (Dell Boomi, Informatica, MuleSoft)
    - _Requirements: 8.1, 8.2, 8.3, 8.5_

  - [x] 7.9 Update data barrel export
    - Update `src/data/index.ts` to export all new data modules
    - _Requirements: 2.7_

- [~] 8. Checkpoint - Ensure data layer compiles and exports correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Homepage redesign
  - [x] 9.1 Redesign HeroSection with premium visuals
    - Rebuild `src/components/HeroSection.tsx` with 90vh minimum height, StaggeredText headline reveal, GradientMesh animated background, ParticleCanvas/CursorGlow interaction
    - Include two GlowButton CTAs (primary: "Book a Demo", secondary: "Explore Products")
    - Add animated visual element (migration workflow diagram or code animation) on right side for desktop
    - Stack vertically (text above visual) on viewports < 768px
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 5.5, 5.6_

  - [x] 9.2 Create TestimonialsSection component
    - Create `src/components/TestimonialsSection.tsx` with 3+ testimonial GlassCards (interactive hover)
    - Display customer name, title, company, and optional company logo
    - _Requirements: 14.1, 14.2_

  - [x] 9.3 Create StatsSection component with animated counters
    - Create `src/components/StatsSection.tsx` displaying key metrics using AnimatedCounter
    - Include stats like migrations completed, interfaces converted, enterprise customers
    - _Requirements: 14.3, 14.5_

  - [x] 9.4 Create ClientLogos component
    - Create `src/components/ClientLogos.tsx` displaying enterprise brand logos in a carousel or grid
    - _Requirements: 14.4_

  - [x] 9.5 Assemble redesigned homepage
    - Update `src/app/page.tsx` to compose: HeroSection, CapabilitiesSection (with BentoGrid), PlatformsSection, TestimonialsSection, StatsSection, ClientLogos, CTABanner
    - Remove Navbar/Footer from page (now in layout)
    - Apply NoiseTexture and GradientMesh to relevant sections
    - _Requirements: 6.3, 6.5, 7.1_

- [~] 10. Checkpoint - Verify homepage renders correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Products pages
  - [x] 11.1 Create products layout with optional breadcrumbs
    - Create `src/app/products/layout.tsx` with shared page container
    - _Requirements: 2.2_

  - [x] 11.2 Create Dell Boomi product page
    - Create `src/app/products/dell-boomi/page.tsx` with hero banner, platform-specific capabilities in BentoGrid/GlassCards, feature comparison table, and CTA section
    - Include unique page metadata (title, description, OG tags)
    - _Requirements: 8.1, 8.5, 19.1, 19.2_

  - [x] 11.3 Create Informatica product page
    - Create `src/app/products/informatica/page.tsx` with hero banner, IICS-specific capabilities, feature comparison, and CTA
    - Include unique page metadata
    - _Requirements: 8.2, 8.5, 19.1, 19.2_

  - [x] 11.4 Create MuleSoft product page
    - Create `src/app/products/mulesoft/page.tsx` with hero banner, Anypoint-specific capabilities, feature comparison, and CTA
    - Include unique page metadata
    - _Requirements: 8.3, 8.5, 19.1, 19.2_

  - [x] 11.5 Create Assessment tools page
    - Create `src/app/products/assessment/page.tsx` describing PI/PO landscape assessment: interface inventory, complexity analysis, migration roadmap generation
    - Include unique page metadata
    - _Requirements: 8.4, 19.1, 19.2_

- [x] 12. Learn pages
  - [x] 12.1 Create Blog listing page
    - Create `src/app/learn/blog/page.tsx` with article cards (GlassCard) showing title, excerpt, date, category tags in a grid
    - Apply hover micro-interactions (scale and glow)
    - Include unique page metadata
    - _Requirements: 9.1, 9.5, 19.1, 19.2_

  - [x] 12.2 Create Case Studies listing page
    - Create `src/app/learn/case-studies/page.tsx` with cards showing company, industry, platform, key metrics
    - Apply GlassCard styling with hover interactions
    - Include unique page metadata
    - _Requirements: 9.2, 9.5, 19.1, 19.2_

  - [x] 12.3 Create Webinars page
    - Create `src/app/learn/webinars/page.tsx` listing upcoming and recorded sessions with title, date, duration, and registration/playback links
    - Apply GlassCard styling with hover interactions
    - Include unique page metadata
    - _Requirements: 9.3, 9.5, 19.1, 19.2_

  - [x] 12.4 Create Documentation landing page (under Learn)
    - Create `src/app/learn/documentation/page.tsx` with categorized links to technical guides, API references, and getting-started tutorials
    - Apply GlassCard styling
    - Include unique page metadata
    - _Requirements: 9.4, 9.5, 19.1, 19.2_

- [ ] 13. Company pages
  - [-] 13.1 Create About page
    - Create `src/app/company/about/page.tsx` with company mission, history timeline, team section, core values
    - Include AnimatedCounter statistics for social proof
    - Include unique page metadata
    - _Requirements: 10.1, 10.5, 19.1, 19.2_

  - [-] 13.2 Create Careers page
    - Create `src/app/company/careers/page.tsx` with open positions by department, company culture section, benefits overview using GlassCards
    - Include unique page metadata
    - _Requirements: 10.2, 19.1, 19.2_

  - [-] 13.3 Create Contact page
    - Create `src/app/company/contact/page.tsx` with contact form (name, email, company, message), office location, support email
    - Form fields should have proper labels and validation
    - Include unique page metadata
    - _Requirements: 10.3, 19.1, 19.2_

  - [-] 13.4 Create Partners page
    - Create `src/app/company/partners/page.tsx` with technology partners, consulting partners, and partner program application section
    - Include partner logos and AnimatedCounter stats
    - Include unique page metadata
    - _Requirements: 10.4, 10.5, 19.1, 19.2_

- [ ] 14. Pricing page
  - [-] 14.1 Create Pricing page with tiered cards
    - Create `src/app/pricing/page.tsx` with 3+ pricing tiers as GlassCards in horizontal row on desktop
    - Each tier: name, price, period, features list, GlowButton CTA
    - Visually distinguish recommended tier with highlighted border/"Popular" badge
    - Apply hover glow and scale micro-interaction on cards
    - Include FAQ section below pricing cards
    - Include unique page metadata
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 19.1, 19.2_

- [ ] 15. Documentation page
  - [-] 15.1 Create Docs page with sidebar navigation
    - Create `src/app/docs/page.tsx` with search input, categorized sidebar navigation, and content area
    - Organize into: Getting Started, API Reference, Migration Guides, Configuration
    - Two-column layout on desktop (sidebar + content), collapsible sidebar on mobile
    - Use syntax-highlighted code blocks with monospace font
    - Include unique page metadata
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 19.1, 19.2_

- [ ] 16. Legal pages
  - [~] 16.1 Create Privacy Policy page
    - Create `src/app/legal/privacy/page.tsx` rendering privacy content from data layer with sections on data collection, usage, storage, user rights
    - Display last-updated date at top
    - Use clear prose formatting with hierarchical headings
    - Include unique page metadata
    - _Requirements: 13.1, 13.4, 13.5, 19.1, 19.2_

  - [~] 16.2 Create Terms of Service page
    - Create `src/app/legal/terms/page.tsx` rendering terms content with sections on service description, user responsibilities, limitations, governing law
    - Display last-updated date at top
    - Include unique page metadata
    - _Requirements: 13.2, 13.4, 13.5, 19.1, 19.2_

  - [~] 16.3 Create Cookie Policy page
    - Create `src/app/legal/cookies/page.tsx` rendering cookie content with sections on types, purposes, third-party cookies, opt-out
    - Display last-updated date at top
    - Include unique page metadata
    - _Requirements: 13.3, 13.4, 13.5, 19.1, 19.2_

- [~] 17. Checkpoint - Verify all pages render and navigate correctly
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 18. SEO, performance, and accessibility finalization
  - [~] 18.1 Update sitemap configuration for all new routes
    - Update `next-sitemap.config.js` to include all navigable pages (products, learn, company, legal, pricing, docs)
    - Regenerate sitemap.xml
    - _Requirements: 19.3_

  - [~] 18.2 Ensure semantic HTML and heading hierarchy on all pages
    - Audit each page for proper h1-h6 order, landmark regions (main, nav, footer, aside)
    - Verify skip-to-content link works on every page
    - _Requirements: 18.1, 18.5, 19.4_

  - [~] 18.3 Verify accessibility requirements across site
    - Ensure visible focus indicators (2px accent ring) on all interactive elements
    - Verify WCAG AA contrast (4.5:1 normal text, 3:1 large text) on glassmorphism/dark surfaces
    - Ensure touch targets minimum 44x44px on mobile
    - Verify no flashing content > 3 flashes/second in animations
    - _Requirements: 18.2, 18.3, 18.4, 16.3_

  - [~] 18.4 Implement performance optimizations
    - Ensure lazy-loading of below-fold sections (ParticleCanvas, heavy animation components) using `dynamic()` with `ssr: false`
    - Verify Next.js static generation (SSG) for all marketing pages (no `use server` data fetching on static pages)
    - Implement graceful fallbacks for failed asset/animation loads
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

  - [~] 18.5 Add responsive design validation
    - Ensure Navbar converts to hamburger menu below 768px
    - Verify BentoGrid collapses to single-column on mobile
    - Verify GlassCards go full-width with 16px horizontal padding on mobile
    - Ensure no horizontal scroll from 320px to 2560px
    - _Requirements: 16.1, 16.2, 16.4, 16.5_

- [~] 19. Final checkpoint - Ensure full site builds and all requirements met
  - Ensure all tests pass, ask the user if questions arise.

- [ ]* 20. Write unit tests for core components
  - [ ]* 20.1 Write unit tests for brand rename verification
    - Test that "SDA-INT Migration WorkBench" appears in Navbar, Footer, and layout metadata
    - Test "SDA-INT" abbreviation renders on mobile breakpoint
    - _Requirements: 1.1, 1.3, 1.4_

  - [ ]* 20.2 Write unit tests for visual primitives
    - Test GlassCard renders with correct backdrop-blur and border styles
    - Test GradientMesh respects reduced-motion
    - Test AnimatedCounter shows final value for reduced-motion
    - Test ParticleCanvas returns null for reduced-motion
    - _Requirements: 4.2, 5.3, 5.6_

  - [ ]* 20.3 Write unit tests for page transitions
    - Test PageTemplate renders children with motion wrapper
    - Test PageTemplate renders children directly when reduced-motion preferred
    - _Requirements: 3.1, 3.5_

  - [ ]* 20.4 Write integration tests for navigation
    - Test each navbar link navigates to correct route
    - Test all footer links resolve to valid pages
    - Test mobile menu opens and displays all navigation items
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- The project uses Next.js 14 App Router with TypeScript, Tailwind CSS, and Framer Motion (already installed)
- All animations must respect `prefers-reduced-motion` media query / Framer Motion's `useReducedMotion`
- Static content for blog, case studies, webinars, careers, and legal pages uses TypeScript data files (no CMS integration at this stage)
- The existing navigation data structure (`src/data/navigation.ts`) already matches the required menu items

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "7.1", "7.2", "7.3", "7.4", "7.5", "7.6", "7.7", "7.8"] },
    { "id": 1, "tasks": ["1.3", "1.4", "3.1", "3.2", "3.3", "3.6", "3.7", "3.8", "3.9", "3.10", "7.9"] },
    { "id": 2, "tasks": ["3.4", "3.5", "5.1", "6.1"] },
    { "id": 3, "tasks": ["9.1", "9.2", "9.3", "9.4", "11.1"] },
    { "id": 4, "tasks": ["9.5", "11.2", "11.3", "11.4", "11.5", "12.1", "12.2", "12.3", "12.4"] },
    { "id": 5, "tasks": ["13.1", "13.2", "13.3", "13.4", "14.1", "15.1"] },
    { "id": 6, "tasks": ["16.1", "16.2", "16.3"] },
    { "id": 7, "tasks": ["18.1", "18.2", "18.3", "18.4", "18.5"] },
    { "id": 8, "tasks": ["20.1", "20.2", "20.3", "20.4"] }
  ]
}
```
