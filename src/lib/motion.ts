import type { Variants } from "framer-motion";

// Spring presets
export const smoothSpring = { type: "spring" as const, stiffness: 280, damping: 32 };
export const gentleSpring = { type: "spring" as const, stiffness: 200, damping: 26 };
export const snappySpring = { type: "spring" as const, stiffness: 450, damping: 32 };
export const bouncySpring = { type: "spring" as const, stiffness: 320, damping: 22 };
export const silkySpring = { type: "spring" as const, stiffness: 140, damping: 22, mass: 0.8 };
export const butterSpring = { type: "spring" as const, stiffness: 120, damping: 20, mass: 0.6 };

// Easing
export const premiumEase = [0.16, 1, 0.3, 1] as const;
export const smoothEase = [0.25, 0.46, 0.45, 0.94] as const;
export const luxuryEase = [0.22, 0.68, 0, 1] as const;

export const pageVariants: Variants = {
  initial: { opacity: 0, y: 12, filter: "blur(4px)" },
  animate: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.4, ease: premiumEase },
  },
  exit: {
    opacity: 0,
    y: -6,
    filter: "blur(2px)",
    transition: { duration: 0.2, ease: smoothEase },
  },
};

export const staggerContainer: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.04, delayChildren: 0.06 } },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 16, scale: 0.97 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.35, ease: premiumEase },
  },
};

export const fadeUp: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.45, ease: premiumEase } },
};

export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.92 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: { ...smoothSpring },
  },
};

export const cardHover = {
  y: -4,
  scale: 1.008,
  transition: { ...silkySpring },
};

export const cardTap = {
  scale: 0.985,
  y: 0,
  transition: { duration: 0.1 },
};

export const slideInLeft: Variants = {
  initial: { opacity: 0, x: -16 },
  animate: { opacity: 1, x: 0, transition: { ...gentleSpring } },
};

export const listItem: Variants = {
  initial: { opacity: 0, x: -10, scale: 0.98 },
  animate: { opacity: 1, x: 0, scale: 1, transition: { ...gentleSpring } },
};

export const heroTitle: Variants = {
  initial: { opacity: 0, y: 18 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: premiumEase },
  },
};

export const popIn: Variants = {
  initial: { opacity: 0, scale: 0.85 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: { ...bouncySpring },
  },
};

export const slideUp: Variants = {
  initial: { opacity: 0, y: 24 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: premiumEase },
  },
};

export const glowPulse: Variants = {
  initial: { opacity: 0.6 },
  animate: {
    opacity: [0.6, 1, 0.6],
    transition: { duration: 2, repeat: Infinity, ease: "easeInOut" },
  },
};

export const buttonHover = {
  scale: 1.025,
  transition: { ...snappySpring },
};

export const buttonTap = {
  scale: 0.975,
  transition: { duration: 0.08 },
};

// Card grid stagger — used for lead card grids
export const cardGridContainer: Variants = {
  initial: {},
  animate: {
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

export const cardGridItem: Variants = {
  initial: { opacity: 0, y: 20, scale: 0.96 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.45, ease: luxuryEase },
  },
};

// Smooth section reveal
export const sectionReveal: Variants = {
  initial: { opacity: 0, y: 14 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: premiumEase },
  },
};
