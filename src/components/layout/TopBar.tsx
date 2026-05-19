"use client";

import Link from "next/link";
import {
  PanelRightOpen,
  PanelRightClose,
  Wand2,
  Search,
  Sun,
  Moon,
  Settings,
  KeyRound,
  Home,
  HelpCircle,
} from "lucide-react";
import { Logo } from "../common/Logo";
import { WorkspaceAuthChip } from "../auth/AuthChip";
import { useAtlas } from "@/lib/store";
import { useSettings } from "@/lib/settings";
import { cn } from "@/lib/cn";
import { NavMenuBar } from "./NavMenu";
import { TrustMeter } from "./TrustMeter";
import { PresenceChips } from "../collab/PresenceChips";

export function TopBar() {
  const agentOpen = useAtlas((s) => s.agentOpen);
  const toggleAgent = useAtlas((s) => s.toggleAgent);
  const toggleAnalyzer = useAtlas((s) => s.toggleAnalyzer);
  const toggleCommand = useAtlas((s) => s.toggleCommand);
  const toggleSettings = useAtlas((s) => s.toggleSettings);
  const toggleShortcuts = useAtlas((s) => s.toggleShortcuts);
  const theme = useSettings((s) => s.theme);
  const setTheme = useSettings((s) => s.setTheme);
  const provider = useSettings((s) => s.provider);
  const openaiKey = useSettings((s) => s.openaiKey);
  const anthropicKey = useSettings((s) => s.anthropicKey);

  const hasKey =
    provider === "mock" ||
    (provider === "openai" && openaiKey) ||
    (provider === "anthropic" && anthropicKey);

  return (
    <header className="h-11 flex items-center px-3 border-b border-border bg-surface/80 backdrop-blur z-30">
      <Link
        href="/"
        className="group flex items-center gap-1 -mx-1 px-1 py-0.5 rounded hover:bg-surface-2 transition-colors"
        title="Back to atlas.app"
      >
        <Home className="size-3 text-subtle opacity-0 group-hover:opacity-100 transition-opacity -ml-0.5 mr-0.5" />
        <Logo />
      </Link>
      <span className="mx-3 h-4 w-px bg-border" />
      <NavMenuBar />

      <button
        onClick={() => toggleCommand(true)}
        className="ml-6 flex items-center gap-2 h-7 w-56 lg:w-72 px-2.5 rounded-md border border-border bg-surface text-subtle text-xs hover:bg-surface-2 transition-colors"
        title="Open command palette (⌘K)"
      >
        <Search className="size-3.5" />
        <span className="truncate">Jump to anything…</span>
        <span className="ml-auto flex items-center gap-1 shrink-0">
          <span className="kbd">⌘</span>
          <span className="kbd">K</span>
        </span>
      </button>

      <div className="ml-auto flex items-center gap-1">
        {/* Primary actions — Analyze & Agent stay prominent */}
        <button
          onClick={toggleAnalyzer}
          className="btn btn-ghost h-7 text-xs"
          title="Analyze paper (⌘⇧A)"
        >
          <Wand2 className="size-3.5" />
          Analyze
        </button>
        <button
          onClick={toggleAgent}
          className={cn("btn h-7 text-xs", agentOpen && "btn-primary")}
          title="Toggle agent (⌘L)"
        >
          {agentOpen ? (
            <PanelRightClose className="size-3.5" />
          ) : (
            <PanelRightOpen className="size-3.5" />
          )}
          Agent
        </button>

        <span className="mx-1 h-4 w-px bg-border" />

        {/* Presence — collab status chip; renders nothing in single-author mode. */}
        <PresenceChips />

        {/* Trust Meter — the moat status badge, anchored before utility cluster */}
        <TrustMeter />

        {/* Single source of truth for API-key state: warning button when missing,
            otherwise just a small connected-dot tooltip on the settings icon. */}
        {!hasKey && (
          <button
            onClick={() => toggleSettings(true)}
            className="btn h-7 text-[11px] text-warning border-warning/40 hover:border-warning bg-warning/5"
            title="No API key set — click to add one"
          >
            <KeyRound className="size-3.5" />
            Add API key
          </button>
        )}

        {/* Utility icons — tight cluster */}
        <div className="flex items-center gap-0.5 ml-0.5">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="btn btn-icon h-7 w-7 text-muted hover:text-foreground"
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <Sun className="size-4" strokeWidth={2} />
            ) : (
              <Moon className="size-4" strokeWidth={2} />
            )}
          </button>
          <button
            onClick={() => toggleShortcuts(true)}
            className="btn btn-icon h-7 w-7 text-muted hover:text-foreground"
            title="Keyboard shortcuts (?)"
            aria-label="Keyboard shortcuts"
          >
            <HelpCircle className="size-4" strokeWidth={2} />
          </button>
          <button
            onClick={() => toggleSettings(true)}
            className="btn btn-icon h-7 w-7 text-muted hover:text-foreground relative"
            title={
              hasKey
                ? `Settings · connected to ${provider}`
                : "Settings"
            }
            aria-label="Settings"
          >
            <Settings className="size-4" strokeWidth={2} />
            {hasKey && (
              <span
                className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-accent pulse-dot"
                aria-hidden
              />
            )}
          </button>
        </div>
        <WorkspaceAuthChip />
      </div>
    </header>
  );
}
