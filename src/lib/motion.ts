// Shared motion tokens. One easing curve, three durations — used everywhere so
// every transition feels like it belongs to the same product.

export const EASE = [0.2, 0.8, 0.2, 1] as const;
export const EASE_OUT = [0, 0, 0.2, 1] as const;
export const EASE_IN = [0.4, 0, 1, 1] as const;

export const DURATION = {
  fast: 0.15,
  base: 0.25,
  slow: 0.4,
} as const;

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
