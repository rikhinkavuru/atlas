"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Compass, Star, ChevronRight } from "lucide-react";
import { computeMultiVenueForecast } from "@/lib/forecast";
import { useSettings } from "@/lib/settings";
import { cn } from "@/lib/cn";
import type { AnalysisReport, SubmissionForecast } from "@/types";

export function MultiVenueForecast({ report }: { report: AnalysisReport }) {
  const venue = useSettings((s) => s.venue);
  const setVenue = useSettings((s) => s.setVenue);
  const { forecasts, best, worst } = useMemo(
    () => computeMultiVenueForecast(report),
    [report],
  );

  if (forecasts.length === 0) return null;

  return (
    <div className="panel p-4 rounded-lg space-y-3">
      <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.15em] text-subtle">
        <Compass className="size-3 text-accent" />
        Multi-venue forecast
        <span className="ml-auto text-foreground/80">
          {forecasts.length} venues
        </span>
      </div>
      {best && worst && (
        <div className="grid grid-cols-2 gap-3 text-[12px]">
          <BestWorstCard
            tone="accent"
            label="Best fit"
            forecast={best}
            onPick={() => setVenue(best.venue as Parameters<typeof setVenue>[0])}
            active={best.venue === venue}
          />
          <BestWorstCard
            tone="danger"
            label="Hardest sell"
            forecast={worst}
            onPick={() => setVenue(worst.venue as Parameters<typeof setVenue>[0])}
            active={worst.venue === venue}
          />
        </div>
      )}
      <div className="space-y-1.5 pt-1">
        {forecasts.map((f, i) => (
          <ForecastRow
            key={f.venue}
            forecast={f}
            index={i}
            active={f.venue === venue}
            onPick={() => setVenue(f.venue as Parameters<typeof setVenue>[0])}
          />
        ))}
      </div>
      <p className="text-[10.5px] text-subtle leading-relaxed">
        Heuristic forecast — rubric grade transformed into a venue-calibrated
        accept probability. Replaced by the Atlas Reviewer Model at v0.5.
      </p>
    </div>
  );
}

function BestWorstCard({
  tone,
  label,
  forecast,
  onPick,
  active,
}: {
  tone: "accent" | "danger";
  label: string;
  forecast: SubmissionForecast;
  onPick: () => void;
  active: boolean;
}) {
  return (
    <button
      onClick={onPick}
      className={cn(
        "rounded-md border bg-background px-3 py-2.5 text-left transition-colors",
        active ? "border-accent" : "border-border hover:border-border-strong",
      )}
    >
      <div className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.15em]">
        <Star
          className={cn(
            "size-2.5",
            tone === "accent" ? "text-accent" : "text-danger",
          )}
        />
        <span className={tone === "accent" ? "text-accent" : "text-danger"}>
          {label}
        </span>
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-[22px] font-semibold tracking-tight text-foreground leading-none">
          {Math.round(forecast.acceptProbability * 100)}
          <span className="text-[12px] text-subtle">%</span>
        </span>
        <span className="text-[12px] text-muted">{forecast.venueName}</span>
      </div>
    </button>
  );
}

function ForecastRow({
  forecast,
  index,
  active,
  onPick,
}: {
  forecast: SubmissionForecast;
  index: number;
  active: boolean;
  onPick: () => void;
}) {
  const p = forecast.acceptProbability;
  const tone =
    p >= 0.55 ? "text-accent" : p >= 0.3 ? "text-warning" : "text-danger";
  const fill =
    p >= 0.55
      ? "bg-accent"
      : p >= 0.3
        ? "bg-warning"
        : "bg-danger";
  return (
    <button
      onClick={onPick}
      className={cn(
        "w-full grid grid-cols-[1fr_60px_18px] items-center gap-2 px-2 py-1.5 rounded transition-colors text-left",
        active ? "bg-surface-2 ring-1 ring-accent/40" : "hover:bg-surface-2/60",
      )}
    >
      <div className="min-w-0 flex items-center gap-2">
        <span className="text-[10px] font-mono text-subtle w-4 text-right">
          {index + 1}
        </span>
        <span className="text-[12px] text-foreground truncate">
          {forecast.venueName}
        </span>
        <span className="text-[9.5px] font-mono text-subtle uppercase tracking-[0.12em]">
          {forecast.band}
        </span>
      </div>
      <div className="relative h-1 rounded-full bg-surface-3 overflow-hidden">
        <motion.span
          initial={{ width: 0 }}
          animate={{ width: `${p * 100}%` }}
          transition={{ duration: 0.4, delay: index * 0.03 }}
          className={cn("absolute inset-y-0 left-0 rounded-full", fill)}
        />
      </div>
      <span className={cn("font-mono text-[11px] text-right", tone)}>
        {Math.round(p * 100)}
      </span>
    </button>
  );
}
