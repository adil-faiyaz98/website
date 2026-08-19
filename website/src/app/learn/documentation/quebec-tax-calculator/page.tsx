"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { SapIcon } from "@/components";

/* ═══════════════════════════════════════════════════════════════════════════
   DOCUMENTATION DATA - Quebec Tax Credit System
   Factual data from Quebec government and industry research
   ═══════════════════════════════════════════════════════════════════════════ */

const keyDeadlines = [
  { program: "CRIC Filing", deadline: "18 months after fiscal year-end", consequence: "Complete loss of credit", urgency: "critical" },
  { program: "SR&ED (Federal)", deadline: "18 months after fiscal year-end", consequence: "Cannot claim federal portion", urgency: "critical" },
  { program: "CDAE-IA Certificate", deadline: "Before fiscal year-end", consequence: "Ineligible for tax year", urgency: "high" },
  { program: "Form RD-1029.8.CR-T", deadline: "With corporate tax return", consequence: "Penalties and interest", urgency: "high" },
  { program: "Pre-commercialization docs", deadline: "Contemporaneous tracking", consequence: "Audit rejection risk", urgency: "medium" },
];


const industryUnderutilization = [
  { 
    industry: "Manufacturing", 
    claimRate: "35%", 
    missedOpportunities: "Process improvements, equipment R&D",
    avgMissedCredits: "$120K-$400K",
    icon: "factory",
    color: "from-blue-500 to-cyan-500"
  },
  { 
    industry: "Technology/SaaS", 
    claimRate: "45%", 
    missedOpportunities: "AI/ML development, CDAE-IA eligibility",
    avgMissedCredits: "$80K-$250K",
    icon: "it-host",
    color: "from-purple-500 to-pink-500"
  },
  { 
    industry: "Life Sciences", 
    claimRate: "55%", 
    missedOpportunities: "Clinical trials, pre-commercialization",
    avgMissedCredits: "$200K-$800K",
    icon: "lab",
    color: "from-green-500 to-emerald-500"
  },
  { 
    industry: "Construction/Engineering", 
    claimRate: "20%", 
    missedOpportunities: "Materials testing, design optimization",
    avgMissedCredits: "$50K-$150K",
    icon: "building",
    color: "from-orange-500 to-amber-500"
  },
  { 
    industry: "Food & Beverage", 
    claimRate: "25%", 
    missedOpportunities: "Product formulation, packaging R&D",
    avgMissedCredits: "$40K-$120K",
    icon: "nutrition-activity",
    color: "from-red-500 to-rose-500"
  },
  { 
    industry: "Aerospace", 
    claimRate: "65%", 
    missedOpportunities: "Pre-commercialization, equipment costs",
    avgMissedCredits: "$150K-$500K",
    icon: "flight",
    color: "from-indigo-500 to-violet-500"
  },
];


const taxPrograms = [
  {
    id: "cric",
    name: "CRIC",
    fullName: "Tax Credit for Research, Innovation and Commercialization",
    effectiveDate: "March 26, 2025",
    rates: [
      { tier: "First $1M qualified expenditure", rate: "30%", refundable: true },
      { tier: "Above $1M qualified expenditure", rate: "20%", refundable: true },
    ],
    eligibleExpenses: [
      "Salaries and wages of R&D employees",
      "50% of subcontractor payments (Quebec-based)",
      "50% of payments to research centers/universities",
      "Equipment acquisition costs (new in CRIC)",
      "Pre-commercialization activities (new in CRIC)",
    ],
    excludedExpenses: [
      "Land and buildings",
      "Leasehold interests",
      "Administrative overhead (unless directly R&D)",
    ],
    form: "RD-1029.8.CR-T",
    filedWith: "Corporate income tax return",
  },
  {
    id: "sred",
    name: "SR&ED",
    fullName: "Scientific Research & Experimental Development",
    effectiveDate: "Ongoing (Federal)",
    rates: [
      { tier: "CCPCs on first $6M (2025)", rate: "35%", refundable: true },
      { tier: "All other corporations", rate: "15%", refundable: false },
    ],
    eligibleExpenses: [
      "Wages for R&D personnel (up to 1.65x)",
      "Materials consumed in R&D",
      "Contract R&D (80% if arm's length)",
      "Overhead using proxy method",
    ],
    excludedExpenses: [
      "Capital expenditures (since 2014)",
      "Market research",
      "Quality control for commercial production",
    ],
    form: "T661 + Schedule 31",
    filedWith: "Corporate tax return (T2)",
  },

  {
    id: "cdae-ia",
    name: "CDAE-IA",
    fullName: "Tax Credit for E-Business Development with AI",
    effectiveDate: "January 1, 2026",
    rates: [
      { tier: "Eligible AI/ML specialists", rate: "30%", refundable: true },
    ],
    eligibleExpenses: [
      "Salaries of AI/ML developers",
      "Data scientists and engineers",
      "AI-focused software development",
    ],
    excludedExpenses: [
      "Non-AI development work",
      "General IT support",
      "Hardware costs",
    ],
    form: "Via Investissement Qu&eacute;bec certificate",
    filedWith: "Pre-certification required",
  },
  {
    id: "c3i",
    name: "C3i",
    fullName: "Investment and Innovation Tax Credit",
    effectiveDate: "Ongoing",
    rates: [
      { tier: "Manufacturing equipment (Zone A)", rate: "20%", refundable: true },
      { tier: "Manufacturing equipment (Zone B)", rate: "15%", refundable: true },
    ],
    eligibleExpenses: [
      "Manufacturing and processing equipment",
      "Computer equipment for manufacturing",
      "Certain intangible assets",
    ],
    excludedExpenses: [
      "Buildings and structures",
      "Vehicles",
      "Office equipment",
    ],
    form: "CO-1029.8.36.II",
    filedWith: "Corporate tax return",
  },
];

const docSections = [
  { id: "overview", label: "Overview", icon: "home" },
  { id: "programs", label: "Tax Programs", icon: "money-bills" },
  { id: "deadlines", label: "Critical Deadlines", icon: "calendar" },
  { id: "industries", label: "Industry Analysis", icon: "factory" },
  { id: "calculator", label: "Using the Calculator", icon: "calculator" },
  { id: "compliance", label: "Compliance Guide", icon: "shield" },
];


/* ═══════════════════════════════════════════════════════════════════════════
   REUSABLE COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

function SideNav({ activeSection, onSectionChange }: { 
  activeSection: string; 
  onSectionChange: (id: string) => void 
}) {
  return (
    <nav className="sticky top-24 space-y-1">
      <div className="text-xs text-[#7fc8ff]/60 uppercase tracking-wider mb-4 font-medium">
        Documentation
      </div>
      {docSections.map((section) => (
        <button
          key={section.id}
          onClick={() => onSectionChange(section.id)}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
            activeSection === section.id
              ? "bg-[#006ddd]/20 text-[#00d4ff] border-l-2 border-[#00d4ff]"
              : "text-[#7fc8ff]/70 hover:text-[#cce9ff] hover:bg-[#006ddd]/10"
          }`}
        >
          <SapIcon name={section.icon} size={16} />
          {section.label}
        </button>
      ))}
    </nav>
  );
}

function DeadlineCard({ program, deadline, consequence, urgency }: {
  program: string; deadline: string; consequence: string; urgency: string;
}) {
  const urgencyColors = {
    critical: "border-red-500/30 bg-red-500/5",
    high: "border-orange-500/30 bg-orange-500/5",
    medium: "border-yellow-500/30 bg-yellow-500/5",
  };
  const urgencyBadge = {
    critical: "bg-red-500/20 text-red-400",
    high: "bg-orange-500/20 text-orange-400",
    medium: "bg-yellow-500/20 text-yellow-400",
  };
  
  return (
    <div className={`p-4 rounded-xl border ${urgencyColors[urgency as keyof typeof urgencyColors]}`}>
      <div className="flex items-start justify-between mb-2">
        <h4 className="text-[#cce9ff] font-medium">{program}</h4>
        <span className={`text-xs px-2 py-1 rounded-md ${urgencyBadge[urgency as keyof typeof urgencyBadge]}`}>
          {urgency}
        </span>
      </div>
      <p className="text-sm text-[#7fc8ff]/80 mb-2">
        <span className="text-[#00d4ff]">Deadline:</span> {deadline}
      </p>
      <p className="text-xs text-[#7fc8ff]/60">
        <span className="text-red-400">If missed:</span> {consequence}
      </p>
    </div>
  );
}


function IndustryCard({ industry, claimRate, missedOpportunities, avgMissedCredits, icon, color }: {
  industry: string; claimRate: string; missedOpportunities: string; avgMissedCredits: string; icon: string; color: string;
}) {
  const underutilization = 100 - parseInt(claimRate);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="p-5 rounded-xl bg-[#006ddd]/5 border border-[#7fc8ff]/10 hover:border-[#7fc8ff]/20 transition-all group"
    >
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center flex-shrink-0`}>
          <SapIcon name={icon} size={24} className="text-white" />
        </div>
        <div className="flex-1">
          <h4 className="text-[#cce9ff] font-medium mb-2">{industry}</h4>
          
          {/* Utilization bar */}
          <div className="mb-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[#7fc8ff]/60">Credit Utilization</span>
              <span className="text-[#00d4ff]">{claimRate}</span>
            </div>
            <div className="h-2 bg-[#030710] rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full bg-gradient-to-r ${color}`}
                style={{ width: claimRate }}
              />
            </div>
            <p className="text-xs text-red-400/80 mt-1">{underutilization}% potential credits unclaimed</p>
          </div>
          
          <div className="space-y-1 text-sm">
            <p className="text-[#7fc8ff]/70">
              <span className="text-[#7fc8ff]/50">Often missed:</span> {missedOpportunities}
            </p>
            <p className="text-green-400 font-medium">
              Avg. missed: {avgMissedCredits}/year
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}


function ProgramAccordion({ program, isOpen, onToggle }: {
  program: typeof taxPrograms[0]; isOpen: boolean; onToggle: () => void;
}) {
  return (
    <div className="border border-[#7fc8ff]/10 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-5 flex items-center justify-between bg-[#006ddd]/5 hover:bg-[#006ddd]/10 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#006ddd] to-[#00d4ff] flex items-center justify-center">
            <span className="text-white font-bold text-sm">{program.name}</span>
          </div>
          <div className="text-left">
            <h3 className="text-[#cce9ff] font-medium">{program.fullName}</h3>
            <p className="text-sm text-[#7fc8ff]/60">Effective: {program.effectiveDate}</p>
          </div>
        </div>
        <SapIcon 
          name={isOpen ? "navigation-up-arrow" : "navigation-down-arrow"} 
          size={20} 
          className="text-[#7fc8ff]" 
        />
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="p-5 bg-[#030710]/50 space-y-6">
              {/* Rates */}
              <div>
                <h4 className="text-sm font-medium text-[#7fc8ff]/60 uppercase tracking-wider mb-3">Credit Rates</h4>
                <div className="space-y-2">
                  {program.rates.map((rate, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-[#006ddd]/5">
                      <span className="text-[#99d3ff]">{rate.tier}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[#00d4ff] font-medium">{rate.rate}</span>
                        {rate.refundable && (
                          <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400">Refundable</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Eligible Expenses */}
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-green-400 mb-3 flex items-center gap-2">
                    <SapIcon name="accept" size={14} /> Eligible Expenses
                  </h4>
                  <ul className="space-y-2">
                    {program.eligibleExpenses.map((exp, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-[#99d3ff]">
                        <SapIcon name="accept" size={12} className="text-green-400 mt-1 flex-shrink-0" />
                        {exp}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-red-400 mb-3 flex items-center gap-2">
                    <SapIcon name="decline" size={14} /> Excluded
                  </h4>
                  <ul className="space-y-2">
                    {program.excludedExpenses.map((exp, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-[#7fc8ff]/60">
                        <SapIcon name="decline" size={12} className="text-red-400 mt-1 flex-shrink-0" />
                        {exp}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              
              {/* Filing Info */}
              <div className="p-4 rounded-lg bg-[#006ddd]/10 border border-[#7fc8ff]/10">
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-[#7fc8ff]/60">Form:</span>
                    <span className="text-[#cce9ff] ml-2">{program.form}</span>
                  </div>
                  <div>
                    <span className="text-[#7fc8ff]/60">Filed with:</span>
                    <span className="text-[#cce9ff] ml-2">{program.filedWith}</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function QuebecTaxDocumentation() {
  const [activeSection, setActiveSection] = useState("overview");
  const [openProgram, setOpenProgram] = useState<string | null>("cric");

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main className="min-h-screen bg-[#030710]">
      {/* Hero Header */}
      <section className="relative py-16 overflow-hidden border-b border-[#7fc8ff]/10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#006ddd]/20 via-transparent to-transparent" />
        
        <div className="relative z-10 max-w-7xl mx-auto px-6">
          <nav className="flex items-center gap-2 text-sm text-[#7fc8ff]/60 mb-6">
            <Link href="/" className="hover:text-[#cce9ff] transition-colors">Home</Link>
            <SapIcon name="navigation-right-arrow" size={12} />
            <Link href="/learn/documentation" className="hover:text-[#cce9ff] transition-colors">Documentation</Link>
            <SapIcon name="navigation-right-arrow" size={12} />
            <span className="text-[#cce9ff]">Quebec Tax Calculator</span>
          </nav>
          
          <div className="flex items-start gap-4 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#006ddd] to-[#00d4ff] flex items-center justify-center">
              <SapIcon name="document" size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-light text-[#cce9ff] mb-2">
                Quebec Tax Calculator Documentation
              </h1>
              <p className="text-[#99d3ff]/80">
                Complete guide to Quebec R&D tax credits, industry analysis, and maximizing your claims
              </p>
            </div>
          </div>
          
          {/* Quick Stats */}
          <div className="flex flex-wrap gap-6 text-sm">
            <div className="flex items-center gap-2 text-[#7fc8ff]/60">
              <SapIcon name="history" size={14} />
              Last updated: August 2026
            </div>
            <div className="flex items-center gap-2 text-[#7fc8ff]/60">
              <SapIcon name="document" size={14} />
              4 Tax Programs Covered
            </div>
            <div className="flex items-center gap-2 text-[#7fc8ff]/60">
              <SapIcon name="factory" size={14} />
              6 Industries Analyzed
            </div>
          </div>
        </div>
      </section>


      {/* Main Content with Sidebar */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-[240px_1fr] gap-12">
          {/* Sidebar Navigation */}
          <aside className="hidden lg:block">
            <SideNav activeSection={activeSection} onSectionChange={scrollToSection} />
          </aside>

          {/* Content */}
          <div className="space-y-16">
            {/* Overview Section */}
            <section id="overview">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <h2 className="text-2xl font-light text-[#cce9ff] mb-6 flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-[#006ddd]/20 flex items-center justify-center">
                    <SapIcon name="home" size={20} className="text-[#7fc8ff]" />
                  </span>
                  Overview
                </h2>
                
                <div className="prose prose-invert max-w-none">
                  <p className="text-lg text-[#99d3ff] leading-relaxed mb-6">
                    Quebec offers one of the most generous R&D tax credit systems in North America, with combined 
                    federal and provincial benefits reaching <strong className="text-[#00d4ff]">55-65% of eligible expenditures</strong>. 
                    However, <strong className="text-red-400">approximately 70% of eligible businesses</strong> either 
                    don&apos;t claim or significantly under-claim these credits.
                  </p>
                </div>
                
                {/* Key Statistics */}
                <div className="grid md:grid-cols-3 gap-4 mb-8">
                  <div className="p-5 rounded-xl bg-gradient-to-br from-[#006ddd]/10 to-[#00d4ff]/5 border border-[#7fc8ff]/10">
                    <div className="text-3xl font-light text-[#00d4ff] mb-2">$446M</div>
                    <div className="text-sm text-[#7fc8ff]/60">Quebec R&D tax support annually</div>
                    <div className="text-xs text-[#7fc8ff]/40 mt-1">Source: Institut de la statistique du Quebec</div>
                  </div>
                  <div className="p-5 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/5 border border-green-500/10">
                    <div className="text-3xl font-light text-green-400 mb-2">~3,810</div>
                    <div className="text-sm text-[#7fc8ff]/60">Companies receiving credits in Quebec</div>
                    <div className="text-xs text-[#7fc8ff]/40 mt-1">78% are small businesses (&lt;100 employees)</div>
                  </div>
                  <div className="p-5 rounded-xl bg-gradient-to-br from-red-500/10 to-orange-500/5 border border-red-500/10">
                    <div className="text-3xl font-light text-red-400 mb-2">~70%</div>
                    <div className="text-sm text-[#7fc8ff]/60">Eligible SMEs not claiming credits</div>
                    <div className="text-xs text-[#7fc8ff]/40 mt-1">Source: Industry research estimates</div>
                  </div>
                </div>
                
                {/* Alert Box */}
                <div className="p-5 rounded-xl bg-yellow-500/5 border border-yellow-500/20">
                  <div className="flex items-start gap-3">
                    <SapIcon name="warning2" size={24} className="text-yellow-400 flex-shrink-0" />
                    <div>
                      <h4 className="text-yellow-400 font-medium mb-2">2025 CRIC Reform Impact</h4>
                      <p className="text-sm text-[#99d3ff]">
                        As of March 26, 2025, Quebec replaced 8+ overlapping tax credits with the unified CRIC program. 
                        This expands eligibility to include <strong>pre-commercialization activities</strong> and 
                        <strong>equipment costs</strong> for the first time since 2014.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </section>


            {/* Programs Section */}
            <section id="programs">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <h2 className="text-2xl font-light text-[#cce9ff] mb-6 flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-[#006ddd]/20 flex items-center justify-center">
                    <SapIcon name="money-bills" size={20} className="text-[#7fc8ff]" />
                  </span>
                  Tax Credit Programs
                </h2>
                
                <p className="text-[#99d3ff] mb-8">
                  Quebec businesses can potentially claim credits from multiple programs. Understanding each 
                  program&apos;s specific requirements ensures maximum benefit recovery.
                </p>
                
                <div className="space-y-4">
                  {taxPrograms.map((program) => (
                    <ProgramAccordion
                      key={program.id}
                      program={program}
                      isOpen={openProgram === program.id}
                      onToggle={() => setOpenProgram(openProgram === program.id ? null : program.id)}
                    />
                  ))}
                </div>
              </motion.div>
            </section>

            {/* Deadlines Section */}
            <section id="deadlines">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <h2 className="text-2xl font-light text-[#cce9ff] mb-6 flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                    <SapIcon name="calendar" size={20} className="text-red-400" />
                  </span>
                  Critical Deadlines
                </h2>
                
                <div className="p-5 rounded-xl bg-red-500/5 border border-red-500/20 mb-8">
                  <p className="text-[#99d3ff]">
                    <strong className="text-red-400">Missing these deadlines can result in complete loss of credits.</strong> 
                    {" "}Many businesses lose significant tax benefits simply due to late filings or inadequate 
                    documentation maintained throughout the year.
                  </p>
                </div>
                
                <div className="grid md:grid-cols-2 gap-4">
                  {keyDeadlines.map((deadline, index) => (
                    <DeadlineCard key={index} {...deadline} />
                  ))}
                </div>
              </motion.div>
            </section>


            {/* Industries Section */}
            <section id="industries">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <h2 className="text-2xl font-light text-[#cce9ff] mb-6 flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-[#006ddd]/20 flex items-center justify-center">
                    <SapIcon name="factory" size={20} className="text-[#7fc8ff]" />
                  </span>
                  Industry Credit Utilization Analysis
                </h2>
                
                <p className="text-[#99d3ff] mb-8">
                  Different industries have vastly different R&D tax credit claim rates. This analysis shows 
                  where businesses are leaving the most money on the table and what types of activities are 
                  commonly overlooked.
                </p>
                
                <div className="grid md:grid-cols-2 gap-4">
                  {industryUnderutilization.map((industry, index) => (
                    <IndustryCard key={index} {...industry} />
                  ))}
                </div>
                
                {/* Common Reasons */}
                <div className="mt-8 p-6 rounded-xl bg-[#006ddd]/5 border border-[#7fc8ff]/10">
                  <h3 className="text-lg font-medium text-[#cce9ff] mb-4">Why Industries Miss Credits</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    {[
                      { reason: "Don't consider work as 'R&D'", desc: "Process improvements and incremental innovation often qualify" },
                      { reason: "Lack documentation systems", desc: "No contemporaneous tracking of time and expenditures" },
                      { reason: "Complex multi-program landscape", desc: "Unaware of stacking opportunities (CRIC + SR&ED + C3i)" },
                      { reason: "Fear of audits", desc: "Avoid claiming due to perceived risk, missing legitimate benefits" },
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-start gap-3">
                        <SapIcon name="status-negative" size={16} className="text-red-400 mt-1 flex-shrink-0" />
                        <div>
                          <div className="text-[#cce9ff] font-medium text-sm">{item.reason}</div>
                          <div className="text-xs text-[#7fc8ff]/60">{item.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </section>


            {/* Calculator Section */}
            <section id="calculator">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <h2 className="text-2xl font-light text-[#cce9ff] mb-6 flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-[#006ddd]/20 flex items-center justify-center">
                    <SapIcon name="calculator" size={20} className="text-[#7fc8ff]" />
                  </span>
                  Using Quebec Tax Calculator
                </h2>
                
                <p className="text-[#99d3ff] mb-8">
                  Quebec Tax Calculator automates the entire R&D tax credit lifecycle, from expenditure 
                  tracking to claim submission. Here&apos;s how to maximize your results.
                </p>
                
                {/* Workflow Steps */}
                <div className="space-y-4 mb-8">
                  {[
                    { step: 1, title: "Connect Your Data", desc: "Import expenditure data from SAP, Excel, or manual entry. The system categorizes expenses automatically.", icon: "upload-to-cloud" },
                    { step: 2, title: "Run Eligibility Assessment", desc: "AI-powered analysis identifies all applicable programs (CRIC, SR&ED, CDAE-IA, C3i) based on your activities.", icon: "workflow-tasks" },
                    { step: 3, title: "Review & Optimize", desc: "See calculated credits per program with optimization suggestions to maximize your total claim.", icon: "customize" },
                    { step: 4, title: "Generate Documentation", desc: "Export audit-ready documentation, completed forms (RD-1029.8.CR-T, T661), and compliance reports.", icon: "document" },
                    { step: 5, title: "Track & Monitor", desc: "Dashboard shows filing status, deadline reminders, and year-over-year comparison.", icon: "monitor-payments" },
                  ].map((item, index) => (
                    <motion.div
                      key={item.step}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-start gap-4 p-4 rounded-xl bg-[#006ddd]/5 border border-[#7fc8ff]/10"
                    >
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#006ddd] to-[#00d4ff] flex items-center justify-center flex-shrink-0 text-white font-medium">
                        {item.step}
                      </div>
                      <div className="flex-1">
                        <h4 className="text-[#cce9ff] font-medium mb-1">{item.title}</h4>
                        <p className="text-sm text-[#7fc8ff]/70">{item.desc}</p>
                      </div>
                      <SapIcon name={item.icon} size={24} className="text-[#7fc8ff]/40" />
                    </motion.div>
                  ))}
                </div>
                
                {/* Key Features Grid */}
                <div className="grid md:grid-cols-3 gap-4">
                  {[
                    { icon: "detail-view", title: "SAP Fiori UI", desc: "Intuitive, accessible interface with bilingual support (EN/FR)" },
                    { icon: "database", title: "OData v4 APIs", desc: "Enterprise integration with SAP and other ERP systems" },
                    { icon: "locked", title: "Audit Trail", desc: "Complete change history for regulatory compliance" },
                  ].map((feature, idx) => (
                    <div key={idx} className="p-4 rounded-xl bg-[#006ddd]/5 border border-[#7fc8ff]/10 text-center">
                      <SapIcon name={feature.icon} size={28} className="text-[#00d4ff] mx-auto mb-3" />
                      <h4 className="text-[#cce9ff] font-medium mb-1">{feature.title}</h4>
                      <p className="text-xs text-[#7fc8ff]/60">{feature.desc}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            </section>


            {/* Compliance Section */}
            <section id="compliance">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <h2 className="text-2xl font-light text-[#cce9ff] mb-6 flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                    <SapIcon name="shield" size={20} className="text-green-400" />
                  </span>
                  Compliance & Audit Readiness
                </h2>
                
                <p className="text-[#99d3ff] mb-8">
                  Proper documentation is crucial for defending tax credit claims during audits. Quebec Tax 
                  Calculator automates compliance documentation to ensure you&apos;re always audit-ready.
                </p>
                
                {/* Documentation Checklist */}
                <div className="p-6 rounded-xl bg-[#006ddd]/5 border border-[#7fc8ff]/10 mb-8">
                  <h3 className="text-lg font-medium text-[#cce9ff] mb-4">Audit-Ready Documentation Checklist</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    {[
                      "Contemporaneous time tracking per project",
                      "Technical narratives (hypothesis, experiments, results)",
                      "Expenditure allocation worksheets",
                      "Subcontractor agreements with Quebec work proof",
                      "Pre-commercialization activity logs",
                      "Equipment acquisition records with R&D justification",
                      "Form RD-1029.8.CR-T (CRIC) completed",
                      "Form T661 + Schedule 31 (SR&ED)",
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 text-sm">
                        <div className="w-5 h-5 rounded bg-green-500/20 flex items-center justify-center flex-shrink-0">
                          <SapIcon name="accept" size={12} className="text-green-400" />
                        </div>
                        <span className="text-[#99d3ff]">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Audit Statistics */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="p-5 rounded-xl bg-green-500/5 border border-green-500/20">
                    <h4 className="text-green-400 font-medium mb-3">With Quebec Tax Calculator</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center gap-2 text-[#99d3ff]">
                        <SapIcon name="accept" size={14} className="text-green-400" />
                        100% documentation coverage
                      </li>
                      <li className="flex items-center gap-2 text-[#99d3ff]">
                        <SapIcon name="accept" size={14} className="text-green-400" />
                        Automated form generation
                      </li>
                      <li className="flex items-center gap-2 text-[#99d3ff]">
                        <SapIcon name="accept" size={14} className="text-green-400" />
                        Complete audit trail
                      </li>
                    </ul>
                  </div>
                  
                  <div className="p-5 rounded-xl bg-red-500/5 border border-red-500/20">
                    <h4 className="text-red-400 font-medium mb-3">Without Proper Systems</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center gap-2 text-[#7fc8ff]/60">
                        <SapIcon name="decline" size={14} className="text-red-400" />
                        Incomplete records found in 60%+ of audits
                      </li>
                      <li className="flex items-center gap-2 text-[#7fc8ff]/60">
                        <SapIcon name="decline" size={14} className="text-red-400" />
                        Average claim reduction: 20-40%
                      </li>
                      <li className="flex items-center gap-2 text-[#7fc8ff]/60">
                        <SapIcon name="decline" size={14} className="text-red-400" />
                        Potential penalties and interest
                      </li>
                    </ul>
                  </div>
                </div>
              </motion.div>
            </section>


            {/* CTA Section */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="p-8 rounded-2xl bg-gradient-to-r from-[#006ddd]/20 via-[#00d4ff]/20 to-[#7fc8ff]/20 border border-[#7fc8ff]/20"
            >
              <div className="text-center">
                <h3 className="text-2xl font-light text-[#cce9ff] mb-4">
                  Ready to Maximize Your Tax Credits?
                </h3>
                <p className="text-[#99d3ff] mb-6 max-w-xl mx-auto">
                  Stop leaving money on the table. Quebec Tax Calculator helps you identify and claim 
                  every credit you&apos;re entitled to.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Link
                    href="/products/quebec-tax-calculator"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-gradient-to-r from-[#006ddd] to-[#00d4ff] text-white font-medium hover:shadow-[0_0_30px_rgba(0,212,255,0.3)] transition-all"
                  >
                    <SapIcon name="calculator" size={20} />
                    Explore the Product
                  </Link>
                  <Link
                    href="/learn/case-studies/quebec-aerospace-rd-transformation"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-md border border-[#7fc8ff]/20 text-[#cce9ff] hover:bg-[#006ddd]/10 transition-all"
                  >
                    <SapIcon name="study-leave" size={20} />
                    View Case Study
                  </Link>
                </div>
              </div>
            </motion.section>
          </div>
        </div>
      </div>

      {/* Footer Resources */}
      <section className="py-12 border-t border-[#7fc8ff]/10">
        <div className="max-w-7xl mx-auto px-6">
          <h3 className="text-lg font-light text-[#cce9ff] mb-6">Additional Resources</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <a href="https://www.quebec.ca/en/gouvernement/finances-publiques/titre-par-defaut/tax-credit-r-d-commercialization" target="_blank" rel="noopener noreferrer" className="group p-4 rounded-xl bg-[#006ddd]/5 border border-[#7fc8ff]/10 hover:border-[#7fc8ff]/20 transition-all">
              <div className="flex items-center gap-3">
                <SapIcon name="lead-outdated" size={20} className="text-[#7fc8ff]" />
                <div>
                  <div className="text-[#cce9ff] group-hover:text-[#00d4ff] transition-colors">Quebec Government - CRIC</div>
                  <div className="text-sm text-[#7fc8ff]/60">Official program information</div>
                </div>
              </div>
            </a>
            <a href="https://www.canada.ca/en/revenue-agency/services/scientific-research-experimental-development-tax-incentive-program.html" target="_blank" rel="noopener noreferrer" className="group p-4 rounded-xl bg-[#006ddd]/5 border border-[#7fc8ff]/10 hover:border-[#7fc8ff]/20 transition-all">
              <div className="flex items-center gap-3">
                <SapIcon name="lead-outdated" size={20} className="text-[#7fc8ff]" />
                <div>
                  <div className="text-[#cce9ff] group-hover:text-[#00d4ff] transition-colors">CRA - SR&ED Program</div>
                  <div className="text-sm text-[#7fc8ff]/60">Federal tax credit information</div>
                </div>
              </div>
            </a>
            <Link href="/learn/blog/quebec-tax-credits-maximizing-rd-incentives-2026" className="group p-4 rounded-xl bg-[#006ddd]/5 border border-[#7fc8ff]/10 hover:border-[#7fc8ff]/20 transition-all">
              <div className="flex items-center gap-3">
                <SapIcon name="write-new-document" size={20} className="text-[#7fc8ff]" />
                <div>
                  <div className="text-[#cce9ff] group-hover:text-[#00d4ff] transition-colors">2026 CRIC Guide</div>
                  <div className="text-sm text-[#7fc8ff]/60">Our detailed blog post</div>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
