"use client";

import { motion } from "framer-motion";
import { TrendingUp, AlertTriangle, Sparkles } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useAtlas, activePaper } from "@/lib/store";
import { useSettings } from "@/lib/settings";
import { computeForecast } from "@/lib/forecast";
import type { AnalysisReport, SubmissionForecast as Forecast } from "@/types";
import { cn } from "@/lib/cn";

const BAND_COPY: Record<Forecast["band"], { color: string; label: string }> = {
  "desk-reject": { color: "text-danger", label: "Desk-reject risk" },
  weak: { color: "text-danger", label: "Weak — needs work" },
  borderline: { color: "text-warning", label: "Borderline" },
  competitive: { color: "text-accent", label: "Competitive" },
  strong: { color: "text-accent", label: "Strong" },
};

export function SubmissionForecastCard({
  report,
}: {
  report: AnalysisReport;
}) {
  const paper = useAtlas((s) => activePaper(s));
  const venue = useSettings((s) => s.venue);
  const setForecast = useAtlas((s) => s.setForecast);
  const storedForecast = useAtlas((s) =>
    paper ? s.forecasts[paper.id] : undefined,
  );

  const forecast = useMemo<Forecast>(
    () => computeForecast(venue, report),
    [venue, report],
  );

  useEffect(() => {
    if (paper) setForecast(paper.id, forecast);
  }, [paper, forecast, setForecast]);

  const display = storedForecast ?? forecast;
  const band = BAND_COPY[display.band];
  const pct = Math.round(display.acceptProbability * 100);

  return (
    <div className="panel p-4 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.15em] text-subtle mb-3">
        <TrendingUp className="size-3 text-accent" />
        Submission forecast · {display.venueName}
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-5 items-center">
        <Gauge probability={display.acceptProbability} band={display.band} />
        <div className="space-y-2 min-w-0">
          <div className={cn("text-[14px] font-semibold", band.color)}>
            {band.label}
          </div>
          <div className="text-[12.5px] text-muted leading-relaxed">
            <span className="text-foreground font-mono">{pct}%</span> estimated
            chance of avoiding desk-reject at {display.venueName}. Roughly the
            top <span className="text-foreground font-mono">{display.topPercentile}%</span> of
            submissions to this venue would score higher.
          </div>
          <div className="pt-1">
            <div className="text-[9.5px] uppercase tracking-[0.15em] text-subtle font-mono mb-1">
              Top drivers
            </div>
            <ul className="space-y-0.5">
              {display.drivers.slice(0, 3).map((d) => (
                <li
                  key={d.dimension}
                  className="flex items-center gap-2 text-[11.5px]"
                >
                  <span
                    className={cn(
                      "font-mono w-10 text-right",
                      d.delta >= 0 ? "text-accent" : "text-warning",
                    )}
                  >
                    {d.delta >= 0 ? "+" : ""}
                    {Math.round(d.delta)}
                  </span>
                  <span className="text-muted truncate">{d.dimension}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <div className="mt-3 text-[10px] text-subtle leading-relaxed flex items-start gap-1">
        <AlertTriangle className="size-2.5 mt-0.5 shrink-0" />
        <span>{display.caveat}</span>
      </div>
    </div>
  );
}

function Gauge({
  probability,
  band,
}: {
  probability: number;
  band: Forecast["band"];
}) {
  const radius = 36;
  const stroke = 7;
  const C = 2 * Math.PI * radius;
  const offset = C * (1 - probability);
  const color =
    band === "strong" || band === "competitive"
      ? "var(--accent)"
      : band === "borderline"
        ? "var(--color-warning)"
        : "var(--color-danger)";
  return (
    <div className="relative size-[96px]">
      <svg viewBox="0 0 96 96" className="size-full -rotate-90">
        <circle
          cx="48"
          cy="48"
          r={radius}
          stroke="var(--surface-3)"
          strokeWidth={stroke}
          fill="none"
        />
        <motion.circle
          cx="48"
          cy="48"
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: [0.2, 0.7, 0.2, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[22px] font-semibold tracking-tight text-foreground leading-none">
          {Math.round(probability * 100)}
          <span className="text-[12px] text-subtle">%</span>
        </div>
        <div className="text-[8.5px] font-mono uppercase tracking-[0.15em] text-subtle mt-0.5">
          accept
        </div>
      </div>
    </div>
  );
}
