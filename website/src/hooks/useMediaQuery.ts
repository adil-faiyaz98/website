"use client";

import { useState, useEffect } from "react";

/**
 * Custom hook that evaluates a CSS media query and returns whether it matches.
 * Handles SSR gracefully by defaulting to false on the server.
 *
 * @param query - A CSS media query string, e.g. "(min-width: 768px)"
 * @returns boolean indicating if the media query currently matches
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQueryList = globalThis.matchMedia(query);

    // Set initial value on client
    setMatches(mediaQueryList.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    mediaQueryList.addEventListener("change", handleChange);

    return () => {
      mediaQueryList.removeEventListener("change", handleChange);
    };
  }, [query]);

  return matches;
}
