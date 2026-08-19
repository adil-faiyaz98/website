"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Calendar,
  CheckCircle2,
  User,
  Mail,
  Building2,
  Phone,
  MessageSquare,
  Sparkles,
  Clock,
  Shield,
  Zap,
  ArrowRight,
  Loader2,
  PartyPopper,
  Send,
  X,
} from "lucide-react";
import Link from "next/link";

// Form field configuration
const formFields = [
  {
    id: "name",
    label: "Full Name",
    type: "text",
    placeholder: "John Doe",
    required: true,
    icon: User,
  },
  {
    id: "email",
    label: "Work Email",
    type: "email",
    placeholder: "john@company.com",
    required: true,
    icon: Mail,
  },
  {
    id: "company",
    label: "Company",
    type: "text",
    placeholder: "Acme Corporation",
    required: true,
    icon: Building2,
  },
  {
    id: "phone",
    label: "Phone",
    type: "tel",
    placeholder: "+1 (514) 555-0123",
    required: false,
    icon: Phone,
  },
];

// Benefits data
const benefits = [
  {
    icon: Clock,
    title: "30-min Session",
    description: "Quick, focused demo tailored to your needs",
  },
  {
    icon: Shield,
    title: "No Commitment",
    description: "Learn how we can help, pressure-free",
  },
  {
    icon: Zap,
    title: "Expert Guidance",
    description: "Direct access to our solution architects",
  },
];

// What to expect items
const expectations = [
  "Personalized walkthrough of our platform",
  "Live demonstration with your use case in mind",
  "Technical Q&A with our integration experts",
  "Custom ROI assessment for your organization",
  "Next steps and implementation timeline",
];

export default function DemoPage() {
  const prefersReducedMotion = useReducedMotion();
  const formRef = useRef<HTMLFormElement>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    phone: "",
    message: "",
    product: "general", // Can be set via URL params
  });
  
  const [formState, setFormState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }
    
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email";
    }
    
    if (!formData.company.trim()) {
      newErrors.company = "Company is required";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setFormState("submitting");
    
    // Simulate API call - replace with actual endpoint
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // For now, always succeed (replace with actual API logic)
    setFormState("success");
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      company: "",
      phone: "",
      message: "",
      product: "general",
    });
    setFormState("idle");
    setErrors({});
  };

  return (
    <main className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Gradient orbs */}
        <motion.div
          animate={prefersReducedMotion ? {} : {
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-20 -left-40 w-[500px] h-[500px] rounded-full bg-purple-500/20 blur-[120px]"
        />
        <motion.div
          animate={prefersReducedMotion ? {} : {
            scale: [1.2, 1, 1.2],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute bottom-20 -right-40 w-[600px] h-[600px] rounded-full bg-cyan-500/20 blur-[120px]"
        />
        <motion.div
          animate={prefersReducedMotion ? {} : {
            scale: [1, 1.3, 1],
            opacity: [0.2, 0.3, 0.2],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 4 }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-pink-500/15 blur-[100px]"
        />
        
        {/* Grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '50px 50px'
          }}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-20 lg:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-start">
          
          {/* Left Column - Info */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="lg:sticky lg:top-32"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 mb-6"
            >
              <Calendar className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium text-purple-400">Schedule Your Demo</span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-text-primary mb-6 leading-tight"
            >
              See SDA in{" "}
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
                Action
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="text-lg text-text-secondary mb-10 leading-relaxed"
            >
              Book a personalized demo and discover how our enterprise integration 
              solutions can transform your SAP landscape and maximize your ROI.
            </motion.p>

            {/* Benefits */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10"
            >
              {benefits.map((benefit, index) => (
                <motion.div
                  key={benefit.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.5 + index * 0.1 }}
                  className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:border-purple-500/30 transition-colors"
                >
                  <benefit.icon className="w-6 h-6 text-purple-400 mb-2" />
                  <h3 className="font-semibold text-text-primary text-sm">{benefit.title}</h3>
                  <p className="text-xs text-text-muted mt-1">{benefit.description}</p>
                </motion.div>
              ))}
            </motion.div>

            {/* What to Expect */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.7 }}
              className="p-6 rounded-2xl bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/20"
            >
              <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                What to Expect
              </h3>
              <ul className="space-y-3">
                {expectations.map((item, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.8 + index * 0.1 }}
                    className="flex items-start gap-3 text-text-secondary text-sm"
                  >
                    <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    {item}
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          </motion.div>

          {/* Right Column - Form */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            <AnimatePresence mode="wait">
              {formState === "success" ? (
                /* Success State */
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.5 }}
                  className="relative p-8 md:p-12 rounded-3xl bg-surface/80 backdrop-blur-xl border border-green-500/30"
                >
                  {/* Success background effect */}
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-green-500/10 to-emerald-500/5 pointer-events-none" />
                  
                  {/* Confetti-like particles */}
                  <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
                    {[...Array(20)].map((_, i) => (
                      <motion.div
                        key={i}
                        initial={{ 
                          y: -20, 
                          x: Math.random() * 100 + "%",
                          opacity: 1,
                          scale: Math.random() * 0.5 + 0.5
                        }}
                        animate={{ 
                          y: "100%",
                          opacity: 0,
                          rotate: Math.random() * 360
                        }}
                        transition={{ 
                          duration: Math.random() * 2 + 2,
                          delay: Math.random() * 0.5,
                          ease: "easeOut"
                        }}
                        className={`absolute w-2 h-2 rounded-full ${
                          ['bg-purple-400', 'bg-pink-400', 'bg-cyan-400', 'bg-green-400', 'bg-yellow-400'][i % 5]
                        }`}
                      />
                    ))}
                  </div>
                  
                  <div className="relative z-10 text-center">
                    {/* Success icon */}
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                      className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 flex items-center justify-center"
                    >
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 300, delay: 0.4 }}
                      >
                        <PartyPopper className="w-10 h-10 text-green-400" />
                      </motion.div>
                    </motion.div>

                    <motion.h2
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                      className="text-3xl font-bold text-text-primary mb-3"
                    >
                      You&apos;re All Set!
                    </motion.h2>

                    <motion.p
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.6 }}
                      className="text-text-secondary mb-8 max-w-sm mx-auto"
                    >
                      Thank you, <span className="text-purple-400 font-semibold">{formData.name.split(' ')[0]}</span>! 
                      We&apos;ve received your demo request and will reach out to{" "}
                      <span className="text-cyan-400 font-semibold">{formData.email}</span> within 24 hours.
                    </motion.p>

                    {/* What happens next */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.7 }}
                      className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.08] mb-8 text-left"
                    >
                      <h3 className="text-sm font-semibold text-text-primary mb-4">What happens next?</h3>
                      <div className="space-y-3">
                        {[
                          { step: 1, text: "You'll receive a confirmation email shortly" },
                          { step: 2, text: "Our team will review your requirements" },
                          { step: 3, text: "We'll schedule a call at your convenience" },
                        ].map((item, index) => (
                          <motion.div
                            key={item.step}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.8 + index * 0.1 }}
                            className="flex items-center gap-3"
                          >
                            <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold flex items-center justify-center flex-shrink-0">
                              {item.step}
                            </div>
                            <span className="text-sm text-text-secondary">{item.text}</span>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>

                    {/* Actions */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 1 }}
                      className="flex flex-col sm:flex-row items-center justify-center gap-4"
                    >
                      <Link
                        href="/"
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold hover:shadow-[0_0_30px_rgba(168,85,247,0.4)] transition-all duration-300 hover:scale-105"
                      >
                        Back to Home
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={resetForm}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-white/10 text-text-primary font-semibold hover:bg-white/5 transition-all duration-300"
                      >
                        Submit Another Request
                      </button>
                    </motion.div>
                  </div>
                </motion.div>
              ) : (
                /* Form State */
                <motion.div
                  key="form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="relative"
                >
                  {/* Glow effect */}
                  <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-cyan-500/20 blur-xl opacity-50" />
                  
                  <form
                    ref={formRef}
                    onSubmit={handleSubmit}
                    className="relative p-8 md:p-10 rounded-3xl bg-surface/80 backdrop-blur-xl border border-white/[0.08]"
                  >
                    {/* Form header */}
                    <div className="mb-8">
                      <h2 className="text-2xl font-bold text-text-primary mb-2">Request Your Demo</h2>
                      <p className="text-text-muted text-sm">Fill in your details and we&apos;ll get back to you within 24 hours.</p>
                    </div>

                    {/* Form fields */}
                    <div className="space-y-5">
                      {formFields.map((field, index) => (
                        <motion.div
                          key={field.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4, delay: index * 0.1 }}
                        >
                          <label
                            htmlFor={field.id}
                            className="block text-sm font-medium text-text-secondary mb-2"
                          >
                            {field.label}
                            {field.required && <span className="text-pink-400 ml-1">*</span>}
                          </label>
                          <div className="relative group">
                            <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${
                              focusedField === field.id ? 'text-purple-400' : 'text-text-muted'
                            }`}>
                              <field.icon className="w-5 h-5" />
                            </div>
                            <input
                              type={field.type}
                              id={field.id}
                              name={field.id}
                              required={field.required}
                              value={formData[field.id as keyof typeof formData]}
                              onChange={(e) => handleInputChange(field.id, e.target.value)}
                              onFocus={() => setFocusedField(field.id)}
                              onBlur={() => setFocusedField(null)}
                              className={`w-full pl-12 pr-4 py-3.5 bg-white/[0.03] border rounded-xl text-text-primary placeholder:text-text-muted/50 transition-all duration-300 focus:outline-none focus:bg-white/[0.05] ${
                                errors[field.id] 
                                  ? 'border-red-500/50 focus:border-red-500 focus:ring-2 focus:ring-red-500/20' 
                                  : 'border-white/[0.08] focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20'
                              }`}
                              placeholder={field.placeholder}
                              disabled={formState === "submitting"}
                            />
                            {/* Focus glow */}
                            <div className={`absolute inset-0 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 opacity-0 transition-opacity pointer-events-none ${
                              focusedField === field.id ? 'opacity-100' : ''
                            }`} />
                          </div>
                          {/* Error message */}
                          <AnimatePresence>
                            {errors[field.id] && (
                              <motion.p
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="text-red-400 text-xs mt-2 flex items-center gap-1"
                              >
                                <X className="w-3 h-3" />
                                {errors[field.id]}
                              </motion.p>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      ))}

                      {/* Message field */}
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: formFields.length * 0.1 }}
                      >
                        <label
                          htmlFor="message"
                          className="block text-sm font-medium text-text-secondary mb-2"
                        >
                          Message / Notes
                          <span className="text-text-muted ml-2 font-normal">(optional)</span>
                        </label>
                        <div className="relative group">
                          <div className={`absolute left-4 top-4 transition-colors ${
                            focusedField === "message" ? 'text-purple-400' : 'text-text-muted'
                          }`}>
                            <MessageSquare className="w-5 h-5" />
                          </div>
                          <textarea
                            id="message"
                            name="message"
                            rows={4}
                            value={formData.message}
                            onChange={(e) => handleInputChange("message", e.target.value)}
                            onFocus={() => setFocusedField("message")}
                            onBlur={() => setFocusedField(null)}
                            className="w-full pl-12 pr-4 py-3.5 bg-white/[0.03] border border-white/[0.08] rounded-xl text-text-primary placeholder:text-text-muted/50 transition-all duration-300 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 focus:bg-white/[0.05] resize-none"
                            placeholder="Tell us about your integration needs, timeline, or any specific challenges..."
                            disabled={formState === "submitting"}
                          />
                        </div>
                      </motion.div>
                    </div>

                    {/* Submit button */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: (formFields.length + 1) * 0.1 }}
                      className="mt-8"
                    >
                      <button
                        type="submit"
                        disabled={formState === "submitting"}
                        className="group relative w-full inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold text-lg overflow-hidden transition-all duration-300 hover:shadow-[0_0_40px_rgba(168,85,247,0.4)] hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100"
                      >
                        {/* Shimmer effect */}
                        <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                        
                        <AnimatePresence mode="wait">
                          {formState === "submitting" ? (
                            <motion.span
                              key="loading"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="flex items-center gap-3"
                            >
                              <Loader2 className="w-5 h-5 animate-spin" />
                              Submitting...
                            </motion.span>
                          ) : (
                            <motion.span
                              key="submit"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="flex items-center gap-3"
                            >
                              <Send className="w-5 h-5" />
                              <span className="relative">Request Demo</span>
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </button>
                    </motion.div>

                    {/* Privacy note */}
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.8 }}
                      className="text-center text-xs text-text-muted mt-4"
                    >
                      By submitting, you agree to our{" "}
                      <Link href="/legal/privacy" className="text-purple-400 hover:underline">
                        Privacy Policy
                      </Link>{" "}
                      and{" "}
                      <Link href="/legal/terms" className="text-purple-400 hover:underline">
                        Terms of Service
                      </Link>
                    </motion.p>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </main>
  );
}
