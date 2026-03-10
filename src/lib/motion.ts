import type { Variants } from "framer-motion";

export const smoothSpring = { type: "spring" as const, stiffness: 260, damping: 30 };
export const gentleSpring = { type: "spring" as const, stiffness: 180, damping: 24 };
export const snappySpring = { type: "spring" as const, stiffness: 400, damping: 30 };

export const pageVariants: Variants = {
  initial: { opacity: 0, y: 16, filter: "blur(4px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit: { opacity: 0, y: -8, filter: "blur(4px)", transition: { duration: 0.2 } },
};

export const staggerContainer: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 14, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { ...gentleSpring } },
};

export const fadeUp: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] } },
};

export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.92 },
  animate: { opacity: 1, scale: 1, transition: { ...smoothSpring } },
};

export const cardHover = {
  y: -3,
  scale: 1.01,
  boxShadow: "0 12px 30px -10px hsl(221 83% 53% / 0.12)",
  transition: { ...snappySpring },
};

export const cardTap = {
  scale: 0.98,
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