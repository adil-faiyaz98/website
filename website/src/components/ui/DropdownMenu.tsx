"use client";

import { useRef, useState, useCallback, useEffect, useId } from "react";
import Link from "next/link";
import { DropdownItem } from "@/data/navigation";

export interface DropdownMenuProps {
  label: string;
  items: DropdownItem[];
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}

export function DropdownMenu({
  label,
  items,
  isOpen,
  onToggle,
  onClose,
}: DropdownMenuProps) {
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  // Reset focused index when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setFocusedIndex(-1);
    }
  }, [isOpen]);

  // Focus the item at focusedIndex when it changes
  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && focusedIndex < items.length) {
      itemRefs.current[focusedIndex]?.focus();
    }
  }, [focusedIndex, isOpen, items.length]);

  const handleTriggerKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      switch (e.key) {
        case "Enter":
        case " ":
          e.preventDefault();
          onToggle();
          if (!isOpen) {
            // Will open — focus first item after state updates
            setTimeout(() => {
              setFocusedIndex(0);
            }, 0);
          }
          break;
        case "ArrowDown":
          e.preventDefault();
          if (!isOpen) {
            onToggle();
            setTimeout(() => {
              setFocusedIndex(0);
            }, 0);
          } else {
            setFocusedIndex(0);
          }
          break;
        case "ArrowUp":
          e.preventDefault();
          if (isOpen) {
            setFocusedIndex(items.length - 1);
          }
          break;
        case "Escape":
          e.preventDefault();
          if (isOpen) {
            onClose();
            triggerRef.current?.focus();
          }
          break;
        case "Tab":
          if (isOpen) {
            onClose();
          }
          break;
      }
    },
    [isOpen, items.length, onToggle, onClose]
  );

  const handleDropdownKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setFocusedIndex((prev) =>
            prev < items.length - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setFocusedIndex((prev) =>
            prev > 0 ? prev - 1 : items.length - 1
          );
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          triggerRef.current?.focus();
          break;
        case "Tab":
          onClose();
          break;
      }
    },
    [items.length, onClose]
  );

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={onToggle}
      onMouseLeave={onClose}
    >
      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={onToggle}
        onKeyDown={handleTriggerKeyDown}
        className="flex items-center gap-1 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:rounded-sm"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-controls={panelId}
      >
        {label}
        <svg
          className={`h-4 w-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div
          className="absolute top-full left-0 mt-2 w-72 rounded-lg border border-border bg-surface-elevated shadow-lg animate-dropdown-in"
          role="menu"
          id={panelId}
          aria-label={`${label} submenu`}
          tabIndex={-1}
          onKeyDown={handleDropdownKeyDown}
        >
          <div className="p-2">
            {items.map((item, index) => (
              <Link
                key={item.href}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                href={item.href}
                onClick={onClose}
                role="menuitem"
                tabIndex={focusedIndex === index ? 0 : -1}
                className="block rounded-md px-3 py-2.5 transition-colors hover:bg-white/5 focus:bg-white/5 focus:outline-none focus:ring-2 focus:ring-accent-primary"
              >
                <span className="block text-sm font-medium text-text-primary">
                  {item.label}
                </span>
                {item.description && (
                  <span className="block mt-0.5 text-xs text-text-muted leading-relaxed">
                    {item.description}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
