"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { navigationItems } from "@/data/navigation";
import { CTAButton } from "./CTAButton";

export interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  // Lock body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }
    return () => {
      document.body.classList.remove("overflow-hidden");
    };
  }, [isOpen]);

  const toggleSection = (label: string) => {
    setExpandedSection(expandedSection === label ? null : label);
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-in panel */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-72 bg-surface transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation menu"
      >
        {/* Close button */}
        <div className="flex items-center justify-end p-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-md p-2 text-text-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
            aria-label="Close menu"
          >
            <svg
              className="h-6 w-6"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Navigation items */}
        <nav className="flex flex-col gap-1 px-4 overflow-y-auto h-[calc(100%-8rem)]">
          {navigationItems.map((item) => {
            if (item.href) {
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={onClose}
                  className="block px-3 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-elevated rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
                >
                  {item.label}
                </Link>
              );
            }

            if (item.dropdown) {
              const isExpanded = expandedSection === item.label;
              return (
                <div key={item.label}>
                  <button
                    type="button"
                    onClick={() => toggleSection(item.label)}
                    className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-elevated rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
                    aria-expanded={isExpanded}
                  >
                    <span>{item.label}</span>
                    <svg
                      className={`h-4 w-4 transition-transform duration-200 ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                      />
                    </svg>
                  </button>

                  {/* Expandable dropdown items */}
                  <div
                    className={`overflow-hidden transition-all duration-200 ${
                      isExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                    }`}
                  >
                    <div className="ml-3 mt-1 flex flex-col gap-1 border-l border-border pl-3">
                      {item.dropdown.map((subItem) => (
                        <Link
                          key={subItem.label}
                          href={subItem.href}
                          onClick={onClose}
                          className="block px-3 py-2 text-sm text-text-muted hover:text-text-primary hover:bg-surface-elevated rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
                        >
                          {subItem.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              );
            }

            return null;
          })}
        </nav>

        {/* Book a Demo CTA at bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border">
          <CTAButton
            label="Book a Demo"
            variant="primary"
            size="md"
            href="/demo"
            className="w-full"
          />
        </div>
      </div>
    </>
  );
}
