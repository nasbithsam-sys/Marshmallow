import type { Variants } from "framer-motion";

// Premium spring configs
export const smoothSpring = { type: "spring" as const, stiffness: 260, damping: 30 };
export const gentleSpring = { type: "spring" as const, stiffness: 180, damping: 24 };
export const snappySpring = { type: "spring" as const, stiffness: 400, damping: 30 };
export const bouncySpring = { type: "spring" as const, stiffness: 300, damping: 20 };
export const silkySpring = { type: "spring" as const, stiffness: 120, damping: 20, mass: 0.8 };

// Premium easing
export const premiumEase = [0.16, 1, 0.3, 1] as const;
export const smoothEase = [0.25, 0.46, 0.45, 0.94] as const;

export const pageVariants: Variants = {
  initial: { opacity: 0, y: 20, filter: "blur(6px)", scale: 0.98 },
  animate: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    scale: 1,
    transition: { duration: 0.5, ease: premiumEase },
  },
  exit: {
    opacity: 0,
    y: -12,
    filter: "blur(4px)",
    scale: 0.98,
    transition: { duration: 0.25 },
  },
};

export const staggerContainer: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.07, delayChildren: 0.08 } },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 18, scale: 0.96, filter: "blur(3px)" },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: { ...silkySpring },
  },
};

export const fadeUp: Variants = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: premiumEase } },
};

export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.9, filter: "blur(4px)" },
  animate: {
    opacity: 1,
    scale: 1,
    filter: "blur(0px)",
    transition: { ...smoothSpring },
  },
};

export const cardHover = {
  y: -4,
  scale: 1.015,
  transition: { ...snappySpring },
};

export const cardTap = {
  scale: 0.98,
  transition: { duration: 0.12 },
};

export const slideInLeft: Variants = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0, transition: { ...gentleSpring } },
};

export const listItem: Variants = {
  initial: { opacity: 0, x: -12, scale: 0.97 },
  animate: { opacity: 1, x: 0, scale: 1, transition: { ...gentleSpring } },
};

// New premium variants
export const heroTitle: Variants = {
  initial: { opacity: 0, y: 40, filter: "blur(10px)" },
  animate: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.7, ease: premiumEase },
  },
};

export const popIn: Variants = {
  initial: { opacity: 0, scale: 0.8 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: { ...bouncySpring },
  },
};

export const slideUp: Variants = {
  initial: { opacity: 0, y: 30 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: premiumEase },
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
  scale: 1.03,
  transition: { ...snappySpring },
};

export const buttonTap = {
  scale: 0.97,
  transition: { duration: 0.08 },
};
