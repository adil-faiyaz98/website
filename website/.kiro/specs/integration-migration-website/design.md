# Design Document

## Introduction

This document describes the technical design for the integration migration marketing website. The website is a single-page application (SPA) built with modern frontend technologies, featuring a dark enterprise theme inspired by LangChain's design. It serves as the primary marketing presence for SAP PI/PO migration services targeting Dell Boomi, Informatica, MuleSoft, and other modern integration platforms.

## Architecture Overview

The website follows a component-based architecture using React with Next.js for server-side rendering and optimal performance. Styling is handled through Tailwind CSS with a custom dark theme configuration. The application is structured as a multi-section landing page with smooth scroll navigation between sections.

```
┌─────────────────────────────────────────────────┐
│                  Next.js App                      │
├─────────────────────────────────────────────────┤
│  Layout (Dark Theme + Global Styles)             │
│  ┌─────────────────────────────────────────────┐│
│  │  Navigation Bar (fixed, sticky)             ││
│  ├─────────────────────────────────────────────┤│
│  │  Hero Section                               ││
│  ├─────────────────────────────────────────────┤│
│  │  Capabilities Section (tabbed)              ││
│  ├─────────────────────────────────────────────┤│
│  │  Migration Platforms Section                ││
│  ├─────────────────────────────────────────────┤│
│  │  Social Proof / Testimonials                ││
│  ├─────────────────────────────────────────────┤│
│  │  CTA Banner Section                         ││
│  ├─────────────────────────────────────────────┤│
│  │  Footer                                     ││
│  └─────────────────────────────────────────────┘│
└─────────────────────────────────────────────────┘
```

## Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | Next.js 14 (App Router) | SSR/SSG for performance, SEO, and file-based routing |
| Language | TypeScript | Type safety and developer experience |
| Styling | Tailwind CSS 3 | Utility-first, rapid styling, easy dark theme |
| Animation | Framer Motion | Smooth scroll animations and transitions |
| Icons | Lucide React | Consistent, customizable icon set |
| Fonts | Inter (Google Fonts) | Clean professional sans-serif |
| Deployment | Vercel | Optimized for Next.js, edge CDN |
| Image Format | WebP/AVIF with fallbacks | Performance optimization |

## Component Design

### 1. Layout and Theme System

**File:** `src/app/layout.tsx`

The root layout applies the dark theme globally through Tailwind's `dark` class and CSS custom properties.

**Theme Configuration (tailwind.config.ts):**
```
colors:
  background: #0A0A0F
  surface: #12121A
  surface-elevated: #1A1A2E
  accent-primary: #6366F1 (indigo)
  accent-secondary: #06B6D4 (cyan)
  text-primary: #F8FAFC
  text-secondary: #94A3B8
  text-muted: #64748B
  border: #1E293B

spacing: 8px grid system
typography:
  h1: 56px/64px, font-weight 700
  h2: 40px/48px, font-weight 600
  h3: 24px/32px, font-weight 600
  body: 16px/24px, font-weight 400
  caption: 14px/20px, font-weight 400
```

### 2. Navigation Bar Component

**File:** `src/components/Navbar.tsx`

```
Props: none (self-contained)
State:
  - isScrolled: boolean (toggles background opacity on scroll)
  - isMobileMenuOpen: boolean (hamburger menu state)
  - activeDropdown: string | null (which dropdown is open)

Structure:
  <nav> (fixed, top-0, z-50)
    <Logo />
    <DesktopMenu>
      <NavItem label="Products" dropdown={productsItems} />
      <NavItem label="Learn" dropdown={learnItems} />
      <NavItem label="Docs" href="/docs" />
      <NavItem label="Company" dropdown={companyItems} />
      <NavItem label="Pricing" href="/pricing" />
    </DesktopMenu>
    <CTAButton label="Book a Demo" variant="primary" />
    <MobileMenuToggle /> (visible < 768px)
  </nav>

Behavior:
  - Background transitions from transparent to surface color after 50px scroll
  - Dropdowns open on hover (desktop) or click (mobile)
  - Mobile menu slides in from right with overlay
```

### 3. Hero Section Component

**File:** `src/components/HeroSection.tsx`

```
Structure:
  <section> (min-h-[80vh], flex, items-center)
    <div> (grid, 2 columns on desktop)
      <TextContent>
        <Badge text="SAP PI/PO Migration" />
        <h1>Migrate to Modern Integration</h1>
        <p>Sub-headline describing benefits</p>
        <ButtonGroup>
          <CTAButton label="Book a Demo" variant="primary" size="lg" />
          <CTAButton label="View Platforms" variant="secondary" size="lg" />
        </ButtonGroup>
      </TextContent>
      <VisualElement>
        <MigrationDiagram /> (animated SVG or illustration)
      </VisualElement>
    </div>
  </section>

Animation:
  - Text content fades in from left (staggered)
  - Visual element fades in from right
  - Subtle floating animation on the diagram
```

### 4. Capabilities Section Component

**File:** `src/components/CapabilitiesSection.tsx`

```
Props: none
State:
  - activeCapability: string (default: first item)

Data Structure:
  capabilities = [
    {
      id: "assessment",
      title: "Assessment & Discovery",
      description: "...",
      features: ["Interface inventory", "Complexity analysis", "Dependency mapping", "Migration roadmap"],
      visual: <AssessmentVisual />
    },
    {
      id: "migration",
      title: "Automated Migration",
      description: "...",
      features: ["Pattern-based conversion", "Mapping transformation", "Adapter migration", "Configuration transfer"],
      visual: <MigrationVisual />
    },
    {
      id: "testing",
      title: "Testing & Validation",
      description: "...",
      features: ["Regression testing", "Data validation", "Performance benchmarks", "End-to-end verification"],
      visual: <TestingVisual />
    },
    {
      id: "deployment",
      title: "Platform Deployment",
      description: "...",
      features: ["Environment setup", "CI/CD pipelines", "Monitoring integration", "Rollback procedures"],
      visual: <DeploymentVisual />
    }
  ]

Structure:
  <section>
    <SectionHeader title="Capabilities" />
    <div> (grid, sidebar + content)
      <VerticalNav>
        {capabilities.map(cap => <NavButton active={activeCapability === cap.id} />)}
      </VerticalNav>
      <ContentPanel>
        <h3>{active.title}</h3>
        <p>{active.description}</p>
        <ul>{active.features.map(f => <li>{f}</li>)}</ul>
      </ContentPanel>
      <VisualPanel>
        {active.visual}
      </VisualPanel>
    </div>
  </section>

Behavior:
  - Left nav highlights active item with accent border
  - Content transitions with fade animation on tab change
  - On mobile: vertical tabs become horizontal scrollable pills
```

### 5. Migration Platforms Section Component

**File:** `src/components/PlatformsSection.tsx`

```
Data Structure:
  platforms = [
    { id: "boomi", name: "Dell Boomi", logo: "/logos/boomi.svg", description: "..." },
    { id: "informatica", name: "Informatica", logo: "/logos/informatica.svg", description: "..." },
    { id: "mulesoft", name: "MuleSoft", logo: "/logos/mulesoft.svg", description: "..." },
    { id: "others", name: "Other Platforms", logo: "/logos/generic.svg", description: "..." }
  ]

Structure:
  <section>
    <SectionHeader title="Target Platforms" subtitle="..." />
    <div> (grid, 3 or 4 columns)
      {platforms.map(p => (
        <PlatformCard>
          <img src={p.logo} alt={p.name} />
          <h3>{p.name}</h3>
          <p>{p.description}</p>
          <ArrowLink label="Learn more" />
        </PlatformCard>
      ))}
    </div>
  </section>

Styling:
  - Cards use surface-elevated background with border
  - Hover: subtle glow effect and scale(1.02)
  - Logo displayed at consistent size with object-contain
```

### 6. CTA Banner Section Component

**File:** `src/components/CTABanner.tsx`

```
Structure:
  <section> (gradient background with accent colors)
    <h2>Ready to modernize your integration?</h2>
    <p>Supporting text</p>
    <CTAButton label="Book a Demo" variant="primary" size="lg" />
  </section>

Styling:
  - Background gradient from accent-primary to accent-secondary (subtle, low opacity)
  - Centered text layout
  - Maximum width constraint for readability
```

### 7. Footer Component

**File:** `src/components/Footer.tsx`

```
Structure:
  <footer>
    <div> (grid, 4-5 columns)
      <CompanyInfo>
        <Logo />
        <p>Brief company description</p>
        <SocialIcons> (LinkedIn, Twitter/X, GitHub) </SocialIcons>
      </CompanyInfo>
      <LinkGroup title="Products" links=[...] />
      <LinkGroup title="Resources" links=[...] />
      <LinkGroup title="Company" links=[...] />
      <LinkGroup title="Legal" links=[Privacy, Terms, Cookies] />
    </div>
    <Divider />
    <Copyright text="© {year} Company. All rights reserved." />
  </footer>
```

### 8. Shared Components

**CTAButton Component** (`src/components/ui/CTAButton.tsx`):
```
Props:
  - label: string
  - variant: "primary" | "secondary" | "ghost"
  - size: "sm" | "md" | "lg"
  - href?: string
  - onClick?: () => void

Styling:
  primary: bg-accent-primary, hover:glow, text-white
  secondary: border-accent-primary, hover:bg-accent-primary/10, text-accent-primary
  ghost: text-text-secondary, hover:text-text-primary
```

**SectionHeader Component** (`src/components/ui/SectionHeader.tsx`):
```
Props:
  - title: string
  - subtitle?: string
  - centered?: boolean
```

## Responsive Breakpoints

| Breakpoint | Width | Layout Changes |
|-----------|-------|----------------|
| Mobile | < 768px | Hamburger nav, stacked layouts, full-width cards |
| Tablet | 768px – 1023px | Reduced grid columns, compact spacing |
| Desktop | 1024px – 1439px | Full layout, side-by-side sections |
| Large | ≥ 1440px | Max-width container (1280px), centered content |

## Performance Strategy

1. **Static Generation**: All marketing pages are statically generated at build time
2. **Image Optimization**: Next.js Image component with WebP/AVIF, responsive srcsets, and blur placeholders
3. **Font Loading**: `next/font` with `display: swap` for Inter
4. **Code Splitting**: Dynamic imports for below-fold sections
5. **CSS**: Tailwind purges unused styles in production
6. **Animations**: Framer Motion with `reducedMotion` respect

## File Structure

```
src/
├── app/
│   ├── layout.tsx          (root layout with theme)
│   ├── page.tsx            (home page assembling sections)
│   ├── globals.css         (Tailwind directives + custom properties)
│   └── demo/
│       └── page.tsx        (demo booking page)
├── components/
│   ├── Navbar.tsx
│   ├── HeroSection.tsx
│   ├── CapabilitiesSection.tsx
│   ├── PlatformsSection.tsx
│   ├── CTABanner.tsx
│   ├── Footer.tsx
│   └── ui/
│       ├── CTAButton.tsx
│       ├── SectionHeader.tsx
│       ├── PlatformCard.tsx
│       ├── DropdownMenu.tsx
│       └── MobileMenu.tsx
├── data/
│   ├── navigation.ts       (nav items and dropdowns)
│   ├── capabilities.ts     (capabilities content)
│   └── platforms.ts        (platform details)
├── hooks/
│   ├── useScrollPosition.ts
│   └── useMediaQuery.ts
└── lib/
    └── constants.ts        (theme constants, breakpoints)
```

## Accessibility Implementation

- All interactive elements have visible focus rings (ring-2 ring-accent-primary)
- Skip-to-content link as first focusable element
- ARIA landmarks: `<header>`, `<main>`, `<footer>`, `<nav>`
- Dropdown menus use `aria-expanded`, `aria-haspopup`, and keyboard arrow navigation
- Reduced motion media query respected for all animations
- Color is never the sole indicator of state (icons + text accompany color changes)

## SEO Considerations

- Semantic HTML with proper heading hierarchy
- Meta tags (title, description, OG tags) configured per page
- Structured data (Organization schema) in layout
- Sitemap generated via next-sitemap
- Canonical URLs configured
