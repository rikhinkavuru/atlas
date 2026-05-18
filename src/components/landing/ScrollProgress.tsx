"use client";

import { motion, useScroll, useSpring } from "framer-motion";

export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const x = useSpring(scrollYProgress, {
    stiffness: 220,
    damping: 30,
    mass: 0.4,
  });
  return (
    <motion.div
      style={{ scaleX: x }}
      className="fixed top-0 left-0 right-0 h-[2px] bg-accent z-[55] origin-left"
    />
  );
}
