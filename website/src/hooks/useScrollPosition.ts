"use client";

import { useState, useEffect } from "react";

/**
 * Custom hook that tracks the current vertical scroll position.
 * Uses requestAnimationFrame for throttled updates to avoid layout thrashing.
 * Used by Navbar to toggle background opacity after scrolling past a threshold.
 */
export function useScrollPosition(): number {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        globalThis.requestAnimationFrame(() => {
          setScrollY(globalThis.scrollY);
          ticking = false;
        });
        ticking = true;
      }
    };

    // Set initial value
    setScrollY(globalThis.scrollY);

    globalThis.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      globalThis.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return scrollY;
}
