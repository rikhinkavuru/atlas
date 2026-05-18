"use client";

import { motion } from "framer-motion";

export interface CursorStep {
  x: number; // 0..1 (fraction of parent width)
  y: number; // 0..1 (fraction of parent height)
  hold?: number; // weight for time allotment, default 1
  click?: boolean;
  label?: string;
}

export function TourCursor({
  steps,
  duration,
}: {
  steps: CursorStep[];
  duration: number; // seconds for the whole sequence
}) {
  if (steps.length === 0) return null;
  const lefts = steps.map((s) => `${s.x * 100}%`);
  const tops = steps.map((s) => `${s.y * 100}%`);
  const times = computeTimes(steps);

  return (
    <>
      <motion.div
        className="absolute z-30 pointer-events-none"
        initial={{ left: lefts[0], top: tops[0], opacity: 0, scale: 0.7 }}
        animate={{
          left: lefts,
          top: tops,
          opacity: [0, 1, ...Array(Math.max(0, steps.length - 2)).fill(1), 1],
          scale: [0.7, 1, ...Array(Math.max(0, steps.length - 2)).fill(1), 1],
        }}
        transition={{
          duration,
          times,
          ease: [0.4, 0.0, 0.2, 1] as [number, number, number, number],
        }}
      >
        <div className="-translate-x-[3px] -translate-y-[3px]">
          <CursorIcon />
        </div>
        {steps[steps.length - 1]?.label && (
          <motion.div
            initial={{ opacity: 0, y: -2, scale: 0.9 }}
            animate={{ opacity: [0, 0, 1], y: [-2, -2, 4], scale: [0.9, 0.9, 1] }}
            transition={{
              duration,
              times: [0, times[times.length - 2] ?? 0.7, 1],
              ease: "easeOut",
            }}
            className="absolute top-5 left-5 whitespace-nowrap px-2 py-0.5 rounded-md bg-foreground text-background text-[10px] font-mono uppercase tracking-[0.12em] shadow-2xl"
          >
            {steps[steps.length - 1].label}
          </motion.div>
        )}
      </motion.div>
      {steps.map((s, i) =>
        s.click ? (
          <Ripple
            key={`r-${i}`}
            x={lefts[i]}
            y={tops[i]}
            delay={times[i] * duration}
          />
        ) : null,
      )}
    </>
  );
}

function Ripple({
  x,
  y,
  delay,
}: {
  x: string;
  y: string;
  delay: number;
}) {
  return (
    <>
      <motion.span
        className="absolute z-20 pointer-events-none rounded-full bg-accent"
        style={{ left: x, top: y, width: 8, height: 8, marginLeft: -4, marginTop: -4 }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1, 5], opacity: [0, 0.55, 0] }}
        transition={{ delay, duration: 0.75, ease: "easeOut" }}
      />
      <motion.span
        className="absolute z-20 pointer-events-none rounded-full border border-accent"
        style={{
          left: x,
          top: y,
          width: 14,
          height: 14,
          marginLeft: -7,
          marginTop: -7,
        }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.4, 3.4], opacity: [0, 0.9, 0] }}
        transition={{ delay, duration: 0.9, ease: "easeOut" }}
      />
    </>
  );
}

function CursorIcon() {
  return (
    <svg
      width="22"
      height="24"
      viewBox="0 0 22 24"
      fill="none"
      aria-hidden="true"
      style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.55))" }}
    >
      <path
        d="M3 2.2L18.6 13.4L11 14.4L7.6 21.1L3 2.2Z"
        fill="#ffffff"
        stroke="#0a0a0a"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function computeTimes(steps: CursorStep[]): number[] {
  if (steps.length === 1) return [0];
  const weights = steps.map((s) => s.hold ?? 1);
  const total = weights.slice(0, -1).reduce((a, b) => a + b, 0);
  const times: number[] = [0];
  let acc = 0;
  for (let i = 1; i < steps.length; i++) {
    acc += weights[i - 1];
    times.push(Math.min(1, acc / total));
  }
  return times;
}
