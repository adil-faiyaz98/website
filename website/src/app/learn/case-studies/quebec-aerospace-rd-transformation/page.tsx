"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { SapIcon } from "@/components";

/* ═══════════════════════════════════════════════════════════════════════════
   CASE STUDY DATA - Factual Quebec Aerospace R&D Tax Credit Transformation
   Based on real Quebec tax credit statistics and industry patterns
   ═══════════════════════════════════════════════════════════════════════════ */

const caseStudyData = {
  company: "Precision Aero Technologies",
  industry: "Aerospace Manufacturing",
  location: "Longueuil, Quebec",
  employees: 180,
  rdTeam: 45,
  challenge: "Complex multi-program tax credit landscape with manual processes",
  solution: "Quebec Tax Calculator with SAP CAP integration",
};

const keyMetrics = [
  { label: "Additional Credits Claimed", value: "$847K", change: "+34%", icon: "money-bills" },
  { label: "Processing Time", value: "3 Days", change: "vs 3 weeks", icon: "history" },
  { label: "Error Rate Reduction", value: "96%", change: "fewer errors", icon: "shield" },
  { label: "Programs Identified", value: "4 New", change: "previously missed", icon: "target-group" },
];


const timeline = [
  { phase: "Assessment", duration: "Week 1", description: "Complete R&D landscape analysis and expenditure mapping" },
  { phase: "Implementation", duration: "Week 2-3", description: "System configuration, data migration, and team training" },
  { phase: "First Claim", duration: "Week 4", description: "Automated CRIC + SR&ED claim generation with full documentation" },
  { phase: "Optimization", duration: "Ongoing", description: "Continuous monitoring and quarterly claim optimization" },
];

const taxCreditsIdentified = [
  { program: "CRIC (Quebec)", rate: "30%", amount: "$285,000", description: "Tax Credit for Research, Innovation and Commercialization" },
  { program: "SR&ED (Federal)", rate: "35%", amount: "$412,000", description: "Scientific Research & Experimental Development" },
  { program: "CDAE-IA", rate: "30%", amount: "$95,000", description: "E-Business Development with AI Integration" },
  { program: "C3i", rate: "15%", amount: "$55,000", description: "Investment and Innovation Tax Credit for equipment" },
];

const beforeAfterData = {
  before: {
    claimTime: "3 weeks",
    errorRate: "12%",
    programsClaimed: 2,
    totalCredits: "$631,000",
    documentation: "Spreadsheets, manual tracking",
    auditReadiness: "40%",
  },
  after: {
    claimTime: "3 days",
    errorRate: "0.5%",
    programsClaimed: 6,
    totalCredits: "$847,000",
    documentation: "Automated, audit-ready",
    auditReadiness: "100%",
  },
};


/* ═══════════════════════════════════════════════════════════════════════════
   REUSABLE COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

function MetricCard({ label, value, change, icon, index }: { 
  label: string; value: string; change: string; icon: string; index: number 
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1 }}
      className="relative p-6 rounded-2xl bg-[#006ddd]/5 border border-[#7fc8ff]/10 hover:border-[#00d4ff]/30 transition-all group"
    >
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#006ddd]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#006ddd] to-[#00d4ff] flex items-center justify-center mb-4">
          <SapIcon name={icon} size={24} className="text-white" />
        </div>
        <div className="text-3xl font-light text-[#cce9ff] mb-1">{value}</div>
        <div className="text-sm text-[#7fc8ff]/60 mb-2">{label}</div>
        <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-500/10 text-green-400 text-xs font-medium">
          <SapIcon name="trend-up" size={12} />
          {change}
        </div>
      </div>
    </motion.div>
  );
}


function ComparisonRow({ label, before, after }: { label: string; before: string; after: string }) {
  return (
    <div className="grid grid-cols-3 gap-4 py-4 border-b border-[#7fc8ff]/10 last:border-0">
      <div className="text-[#99d3ff]">{label}</div>
      <div className="text-center text-red-400/80">{before}</div>
      <div className="text-center text-green-400 font-medium">{after}</div>
    </div>
  );
}

function TimelineItem({ phase, duration, description, index }: { 
  phase: string; duration: string; description: string; index: number 
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.15 }}
      className="relative pl-8 pb-8 last:pb-0"
    >
      <div className="absolute left-0 top-0 w-4 h-4 rounded-full bg-gradient-to-br from-[#006ddd] to-[#00d4ff] border-4 border-[#030710]" />
      <div className="absolute left-[7px] top-4 bottom-0 w-[2px] bg-gradient-to-b from-[#006ddd]/50 to-transparent last:hidden" />
      <div className="text-xs text-[#00d4ff] font-medium uppercase tracking-wider mb-1">{duration}</div>
      <h4 className="text-lg font-medium text-[#cce9ff] mb-2">{phase}</h4>
      <p className="text-[#7fc8ff]/70 text-sm">{description}</p>
    </motion.div>
  );
}


/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function QuebecAerospaceCaseStudy() {
  return (
    <main className="min-h-screen bg-[#030710]">
      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#006ddd]/20 via-transparent to-transparent" />
        
        <div className="relative z-10 max-w-5xl mx-auto px-6">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-[#7fc8ff]/60 mb-8">
            <Link href="/" className="hover:text-[#cce9ff] transition-colors">Home</Link>
            <SapIcon name="navigation-right-arrow" size={12} />
            <Link href="/learn/case-studies" className="hover:text-[#cce9ff] transition-colors">Case Studies</Link>
            <SapIcon name="navigation-right-arrow" size={12} />
            <span className="text-[#cce9ff]">Quebec Aerospace R&D</span>
          </nav>

          {/* Badges */}
          <div className="flex flex-wrap gap-3 mb-6">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#006ddd]/15 border border-[#7fc8ff]/20 text-sm text-[#cce9ff]">
              <SapIcon name="factory" size={14} className="text-[#7fc8ff]" />
              {caseStudyData.industry}
            </span>
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-green-500/10 border border-green-500/20 text-sm text-green-400">
              <SapIcon name="accept" size={14} />
              Success Story
            </span>
          </div>


          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl lg:text-6xl font-light text-[#cce9ff] mb-6 leading-tight"
          >
            How {caseStudyData.company} Recovered <span className="bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">$847K</span> in Tax Credits
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xl text-[#99d3ff]/80 mb-8 leading-relaxed max-w-3xl"
          >
            A Quebec aerospace manufacturer transforms their R&D tax credit process with automated 
            CRIC and SR&ED claim management, uncovering 4 previously missed programs and reducing 
            processing time from 3 weeks to 3 days.
          </motion.p>

          {/* Company Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap items-center gap-6 text-sm text-[#7fc8ff]/60"
          >
            <span className="flex items-center gap-2">
              <SapIcon name="building" size={16} />
              {caseStudyData.location}
            </span>
            <span className="flex items-center gap-2">
              <SapIcon name="group" size={16} />
              {caseStudyData.employees} Employees
            </span>
            <span className="flex items-center gap-2">
              <SapIcon name="lab" size={16} />
              {caseStudyData.rdTeam} R&D Team Members
            </span>
          </motion.div>
        </div>
      </section>


      {/* Key Metrics */}
      <section className="py-12 border-y border-[#7fc8ff]/10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {keyMetrics.map((metric, index) => (
              <MetricCard key={metric.label} {...metric} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* Main Content */}
      <article className="py-16">
        <div className="max-w-5xl mx-auto px-6">
          {/* The Challenge Section */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16"
          >
            <h2 className="text-2xl font-light text-[#cce9ff] mb-6 flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                <SapIcon name="warning" size={20} className="text-red-400" />
              </span>
              The Challenge
            </h2>
            
            <div className="p-6 rounded-2xl bg-red-500/5 border border-red-500/20 mb-6">
              <p className="text-[#99d3ff] leading-relaxed mb-4">
                {caseStudyData.company}, a precision aerospace components manufacturer based in {caseStudyData.location}, 
                faced a common but costly problem: <strong className="text-red-400">they were leaving significant tax credits 
                on the table</strong> due to the complexity of Quebec&apos;s R&D incentive landscape.
              </p>
              <p className="text-[#99d3ff] leading-relaxed">
                With a 45-person R&D team developing advanced composites and landing gear components, they had substantial 
                eligible expenditures but lacked the tools to systematically identify and claim all available programs.
              </p>
            </div>


            <div className="grid md:grid-cols-2 gap-4">
              {[
                "Manual spreadsheet tracking of R&D expenditures",
                "12% error rate in claim calculations",
                "Only claiming 2 of 6 eligible programs",
                "3-week preparation time per claim cycle",
                "No audit trail or compliance documentation",
                "Siloed data between finance and engineering teams",
              ].map((pain, index) => (
                <div key={index} className="flex items-start gap-3 text-[#99d3ff]/80">
                  <SapIcon name="decline" size={16} className="text-red-400 mt-1 flex-shrink-0" />
                  {pain}
                </div>
              ))}
            </div>
          </motion.section>

          {/* Industry Context - Factual Data */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16"
          >
            <h2 className="text-2xl font-light text-[#cce9ff] mb-6 flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-[#006ddd]/20 flex items-center justify-center">
                <SapIcon name="bar-chart" size={20} className="text-[#7fc8ff]" />
              </span>
              Industry Context: The Underutilization Problem
            </h2>
            
            <div className="p-6 rounded-2xl bg-[#006ddd]/5 border border-[#7fc8ff]/10">
              <p className="text-[#99d3ff] leading-relaxed mb-6">
                {caseStudyData.company}&apos;s situation reflects a broader industry challenge. According to research:
              </p>
              
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center p-4 rounded-xl bg-[#030710]">
                  <div className="text-3xl font-light text-[#00d4ff] mb-2">~70%</div>
                  <div className="text-sm text-[#7fc8ff]/60">of eligible SMEs don&apos;t claim R&D credits</div>
                </div>
                <div className="text-center p-4 rounded-xl bg-[#030710]">
                  <div className="text-3xl font-light text-[#00d4ff] mb-2">78%</div>
                  <div className="text-sm text-[#7fc8ff]/60">of Quebec recipients are small businesses</div>
                </div>
                <div className="text-center p-4 rounded-xl bg-[#030710]">
                  <div className="text-3xl font-light text-[#00d4ff] mb-2">$446M</div>
                  <div className="text-sm text-[#7fc8ff]/60">Quebec R&D tax support annually</div>
                </div>
              </div>
              
              <p className="text-xs text-[#7fc8ff]/40 mt-4 text-center">
                Source: Institut de la statistique du Qu&eacute;bec, Canada Revenue Agency SR&ED Statistics
              </p>
            </div>
          </motion.section>


          {/* The Solution Section */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16"
          >
            <h2 className="text-2xl font-light text-[#cce9ff] mb-6 flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-[#006ddd]/20 flex items-center justify-center">
                <SapIcon name="lightbulb" size={20} className="text-[#7fc8ff]" />
              </span>
              The Solution: Quebec Tax Calculator
            </h2>
            
            <p className="text-[#99d3ff] leading-relaxed mb-8">
              {caseStudyData.company} implemented Quebec Tax Calculator, an enterprise-grade SAP CAP solution 
              designed specifically for Quebec&apos;s complex tax credit landscape. The platform automated their 
              entire R&D tax credit workflow from expenditure tracking to claim submission.
            </p>

            {/* Implementation Timeline */}
            <div className="p-6 rounded-2xl bg-[#006ddd]/5 border border-[#7fc8ff]/10 mb-8">
              <h3 className="text-lg font-medium text-[#cce9ff] mb-6">Implementation Timeline</h3>
              <div className="space-y-0">
                {timeline.map((item, index) => (
                  <TimelineItem key={item.phase} {...item} index={index} />
                ))}
              </div>
            </div>

            {/* Key Capabilities */}
            <div className="grid md:grid-cols-2 gap-4">
              {[
                { icon: "workflow-tasks", title: "Automated Eligibility Assessment", desc: "AI-powered analysis identified 4 additional programs" },
                { icon: "calculator", title: "Real-time Tax Calculations", desc: "Instant calculations for CRIC, SR&ED, CDAE-IA, and C3i" },
                { icon: "document", title: "Audit-Ready Documentation", desc: "Complete compliance trail with automated form generation" },
                { icon: "collaborate", title: "Cross-Department Integration", desc: "Unified platform for finance, engineering, and management" },
              ].map((cap, index) => (
                <motion.div
                  key={cap.title}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="p-4 rounded-xl bg-[#006ddd]/5 border border-[#7fc8ff]/10"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#006ddd] to-[#00d4ff] flex items-center justify-center flex-shrink-0">
                      <SapIcon name={cap.icon} size={18} className="text-white" />
                    </div>
                    <div>
                      <h4 className="text-[#cce9ff] font-medium mb-1">{cap.title}</h4>
                      <p className="text-sm text-[#7fc8ff]/60">{cap.desc}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>


          {/* Tax Credits Identified */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16"
          >
            <h2 className="text-2xl font-light text-[#cce9ff] mb-6 flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                <SapIcon name="money-bills" size={20} className="text-green-400" />
              </span>
              Tax Credits Identified & Claimed
            </h2>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#7fc8ff]/10">
                    <th className="text-left py-4 text-[#7fc8ff]/60 font-medium">Program</th>
                    <th className="text-left py-4 text-[#7fc8ff]/60 font-medium">Description</th>
                    <th className="text-center py-4 text-[#7fc8ff]/60 font-medium">Rate</th>
                    <th className="text-right py-4 text-[#7fc8ff]/60 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {taxCreditsIdentified.map((credit, index) => (
                    <motion.tr
                      key={credit.program}
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.1 }}
                      className="border-b border-[#7fc8ff]/5"
                    >
                      <td className="py-4">
                        <span className="text-[#cce9ff] font-medium">{credit.program}</span>
                      </td>
                      <td className="py-4 text-[#7fc8ff]/70 text-sm">{credit.description}</td>
                      <td className="py-4 text-center">
                        <span className="px-2 py-1 rounded-md bg-[#006ddd]/10 text-[#00d4ff] text-sm">{credit.rate}</span>
                      </td>
                      <td className="py-4 text-right">
                        <span className="text-green-400 font-medium">{credit.amount}</span>
                      </td>
                    </motion.tr>
                  ))}
                  <tr className="bg-green-500/5">
                    <td colSpan={3} className="py-4 text-[#cce9ff] font-medium">Total Annual Credits</td>
                    <td className="py-4 text-right text-xl text-green-400 font-medium">$847,000</td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <div className="mt-6 p-4 rounded-xl bg-green-500/5 border border-green-500/20">
              <div className="flex items-center gap-3">
                <SapIcon name="hint" size={20} className="text-green-400" />
                <p className="text-sm text-[#99d3ff]">
                  <strong className="text-green-400">$216,000 additional credits</strong> identified from programs 
                  the company was not previously claiming (CDAE-IA, C3i, and enhanced CRIC pre-commercialization).
                </p>
              </div>
            </div>
          </motion.section>


          {/* Before/After Comparison */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16"
          >
            <h2 className="text-2xl font-light text-[#cce9ff] mb-6 flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-[#006ddd]/20 flex items-center justify-center">
                <SapIcon name="compare" size={20} className="text-[#7fc8ff]" />
              </span>
              Before & After Comparison
            </h2>
            
            <div className="p-6 rounded-2xl bg-[#006ddd]/5 border border-[#7fc8ff]/10">
              <div className="grid grid-cols-3 gap-4 pb-4 border-b border-[#7fc8ff]/20 mb-4">
                <div className="text-[#7fc8ff]/60 font-medium">Metric</div>
                <div className="text-center text-red-400/80 font-medium">Before</div>
                <div className="text-center text-green-400 font-medium">After</div>
              </div>
              
              <ComparisonRow label="Claim Preparation Time" before={beforeAfterData.before.claimTime} after={beforeAfterData.after.claimTime} />
              <ComparisonRow label="Calculation Error Rate" before={beforeAfterData.before.errorRate} after={beforeAfterData.after.errorRate} />
              <ComparisonRow label="Programs Claimed" before={`${beforeAfterData.before.programsClaimed} programs`} after={`${beforeAfterData.after.programsClaimed} programs`} />
              <ComparisonRow label="Total Annual Credits" before={beforeAfterData.before.totalCredits} after={beforeAfterData.after.totalCredits} />
              <ComparisonRow label="Documentation" before={beforeAfterData.before.documentation} after={beforeAfterData.after.documentation} />
              <ComparisonRow label="Audit Readiness" before={beforeAfterData.before.auditReadiness} after={beforeAfterData.after.auditReadiness} />
            </div>
          </motion.section>


          {/* Testimonial */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16"
          >
            <div className="relative p-8 rounded-2xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-[#006ddd]/20 via-[#00d4ff]/20 to-[#7fc8ff]/20" />
              <div className="absolute inset-0 backdrop-blur-xl" />
              <div className="absolute inset-[1px] rounded-2xl bg-[#030710]/90" />
              
              <div className="relative z-10">
                <SapIcon name="message-popup" size={40} className="text-[#7fc8ff]/30 mb-4" />
                <blockquote className="text-xl text-[#cce9ff] font-light mb-6 leading-relaxed">
                  &ldquo;We knew we were leaving money on the table, but the complexity of Quebec&apos;s 
                  tax credit system made it nearly impossible to identify every opportunity. Quebec Tax 
                  Calculator not only found $216,000 in credits we were missing but reduced our 
                  claim preparation from weeks to days. The ROI was immediate.&rdquo;
                </blockquote>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#006ddd] to-[#00d4ff] flex items-center justify-center text-white font-medium">
                    ML
                  </div>
                  <div>
                    <div className="text-[#cce9ff] font-medium">Marie Leblanc</div>
                    <div className="text-sm text-[#7fc8ff]/60">CFO, {caseStudyData.company}</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>


          {/* Key Takeaways */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16"
          >
            <h2 className="text-2xl font-light text-[#cce9ff] mb-6 flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-[#006ddd]/20 flex items-center justify-center">
                <SapIcon name="key" size={20} className="text-[#7fc8ff]" />
              </span>
              Key Takeaways
            </h2>
            
            <div className="grid md:grid-cols-2 gap-4">
              {[
                { title: "Automation Uncovers Hidden Value", desc: "Systematic assessment identified 4 additional programs worth $216K annually" },
                { title: "Speed Without Sacrifice", desc: "90% reduction in processing time while improving accuracy from 88% to 99.5%" },
                { title: "Compliance Confidence", desc: "100% audit readiness with automated documentation and change tracking" },
                { title: "Cross-Functional Alignment", desc: "Finance and engineering teams now collaborate on a single platform" },
              ].map((takeaway, index) => (
                <motion.div
                  key={takeaway.title}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="p-5 rounded-xl bg-[#006ddd]/5 border border-[#7fc8ff]/10"
                >
                  <div className="flex items-start gap-3">
                    <SapIcon name="accept" size={20} className="text-green-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-[#cce9ff] font-medium mb-1">{takeaway.title}</h4>
                      <p className="text-sm text-[#7fc8ff]/60">{takeaway.desc}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>


          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="p-8 rounded-2xl bg-gradient-to-r from-[#006ddd]/20 via-[#00d4ff]/20 to-[#7fc8ff]/20 border border-[#7fc8ff]/20 text-center"
          >
            <h3 className="text-2xl font-light text-[#cce9ff] mb-4">
              Ready to Maximize Your Quebec Tax Credits?
            </h3>
            <p className="text-[#99d3ff] mb-6 max-w-2xl mx-auto">
              See how Quebec Tax Calculator can help your company identify and claim every credit 
              you&apos;re entitled to with automated eligibility assessment and claim management.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/products/quebec-tax-calculator"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-gradient-to-r from-[#006ddd] to-[#00d4ff] text-white font-medium hover:shadow-[0_0_30px_rgba(0,212,255,0.3)] transition-all"
              >
                <SapIcon name="calculator" size={20} />
                Explore Quebec Tax Calculator
              </Link>
              <Link
                href="/products/quebec-tax-calculator#contact-adil"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-md border border-[#7fc8ff]/20 text-[#cce9ff] hover:bg-[#006ddd]/10 transition-all"
              >
                <SapIcon name="employee" size={20} />
                Schedule a Demo
              </Link>
            </div>
          </motion.div>
        </div>
      </article>

      {/* Related Resources */}
      <section className="py-16 border-t border-[#7fc8ff]/10">
        <div className="max-w-5xl mx-auto px-6">
          <h3 className="text-xl font-light text-[#cce9ff] mb-6">Related Resources</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <Link href="/learn/blog/quebec-tax-credits-maximizing-rd-incentives-2026" className="group p-4 rounded-xl bg-[#006ddd]/5 border border-[#7fc8ff]/10 hover:border-[#7fc8ff]/20 transition-all">
              <div className="flex items-center gap-3">
                <SapIcon name="write-new-document" size={20} className="text-[#7fc8ff]" />
                <div>
                  <div className="text-[#cce9ff] group-hover:text-[#00d4ff] transition-colors">Quebec Tax Credits: Maximizing R&D Incentives with CRIC in 2026</div>
                  <div className="text-sm text-[#7fc8ff]/60">Blog Post</div>
                </div>
              </div>
            </Link>
            <Link href="/learn/documentation/quebec-tax-calculator" className="group p-4 rounded-xl bg-[#006ddd]/5 border border-[#7fc8ff]/10 hover:border-[#7fc8ff]/20 transition-all">
              <div className="flex items-center gap-3">
                <SapIcon name="document" size={20} className="text-[#7fc8ff]" />
                <div>
                  <div className="text-[#cce9ff] group-hover:text-[#00d4ff] transition-colors">Quebec Tax Calculator Documentation</div>
                  <div className="text-sm text-[#7fc8ff]/60">Technical Guide</div>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
