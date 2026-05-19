"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, FilePlus, Search, Upload } from "lucide-react";
import { TopBar } from "./TopBar";
import { TabBar } from "./TabBar";
import { LeftSidebar } from "./LeftSidebar";
import { AgentPanel } from "./AgentPanel";
import { AnalyzerDrawer } from "./AnalyzerDrawer";
import { CommandPalette } from "./CommandPalette";
import { SettingsModal } from "./SettingsModal";
import { ShortcutsModal } from "./ShortcutsModal";
import { StatusBar } from "./StatusBar";
import { ErrorBoundary } from "./ErrorBoundary";
import { AgentPanelResizeHandle } from "./ResizeHandle";
import { PaperEditor } from "../editor/PaperEditor";
import { BrowserTab } from "../browser/BrowserTab";
import { HintStrip } from "../common/HintStrip";
import {
  ReviewerStudio,
  NewReviewModal,
} from "../reviewer/ReviewerStudio";
import { PdfImportZone } from "../import/PdfImportZone";
import { WelcomeModal } from "../onboarding/WelcomeModal";
import { NavDialogs } from "./NavDialogs";
import { PublishLedgerDialog } from "./PublishLedgerDialog";
import { ReferencesDialog } from "./ReferencesDialog";
import { useAtlas } from "@/lib/store";
import { useSettings } from "@/lib/settings";

export default function Workspace() {
  return (
    <ErrorBoundary>
      <WorkspaceInner />
    </ErrorBoundary>
  );
}

function WorkspaceInner() {
  const tabs = useAtlas((s) => s.tabs);
  const activeTabId = useAtlas((s) => s.activeTabId);
  const agentOpen = useAtlas((s) => s.agentOpen);
  const analyzerOpen = useAtlas((s) => s.analyzerOpen);
  const settingsOpen = useAtlas((s) => s.settingsOpen);
  const shortcutsOpen = useAtlas((s) => s.shortcutsOpen);
  const toggleAgent = useAtlas((s) => s.toggleAgent);
  const toggleAnalyzer = useAtlas((s) => s.toggleAnalyzer);
  const toggleCommand = useAtlas((s) => s.toggleCommand);
  const toggleSettings = useAtlas((s) => s.toggleSettings);
  const toggleShortcuts = useAtlas((s) => s.toggleShortcuts);
  const theme = useSettings((s) => s.theme);
  const agentPanelWidth = useSettings((s) => s.agentPanelWidth);
  const focusMode = useSettings((s) => s.focusMode);
  const toggleFocusMode = useSettings((s) => s.toggleFocusMode);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    const onNewReview = () => setReviewModalOpen(true);
    window.addEventListener("atlas:new-review", onNewReview);
    return () => window.removeEventListener("atlas:new-review", onNewReview);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const tag = (e.target as HTMLElement | null)?.tagName ?? "";
      const inField =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggleCommand();
      } else if (mod && e.key.toLowerCase() === "l") {
        e.preventDefault();
        // If the agent is already open, refocus its input instead of toggling
        // it closed — users hit ⌘L to "get back to the agent", not to dismiss
        // it. Only toggle off when explicitly closed via the X button or Esc.
        if (useAtlas.getState().agentOpen) {
          window.dispatchEvent(new CustomEvent("atlas:focus-agent"));
        } else {
          toggleAgent();
        }
      } else if (mod && e.shiftKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        toggleAnalyzer();
      } else if (mod && e.key === ",") {
        e.preventDefault();
        toggleSettings(true);
      } else if (mod && e.key === ".") {
        e.preventDefault();
        toggleFocusMode();
      } else if (e.key === "?" && !inField && !mod) {
        e.preventDefault();
        toggleShortcuts(true);
      } else if (e.key === "Escape") {
        if (useAtlas.getState().commandOpen) toggleCommand(false);
        if (useAtlas.getState().settingsOpen) toggleSettings(false);
        if (useAtlas.getState().shortcutsOpen) toggleShortcuts(false);
        if (useSettings.getState().focusMode) toggleFocusMode(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    toggleAgent,
    toggleAnalyzer,
    toggleCommand,
    toggleSettings,
    toggleShortcuts,
    toggleFocusMode,
  ]);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const showAgent = agentOpen && !focusMode;
  const showChrome = !focusMode;

  // Browser tab title reflects the active workspace tab, so multitasking users
  // can find Atlas among many browser tabs and notice when context changes.
  useEffect(() => {
    if (!activeTab) {
      document.title = "Atlas · Workspace";
      return;
    }
    document.title = `${activeTab.title} · Atlas`;
  }, [activeTab]);

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      {showChrome && <TopBar />}
      {showChrome && <TabBar />}
      <div className="flex-1 flex min-h-0">
        {showChrome && <LeftSidebar />}
        <main className="flex-1 min-w-0 flex flex-col relative">
          {activeTab?.kind === "editor" && (
            <PaperEditor key={activeTab.id} tab={activeTab} />
          )}
          {(activeTab?.kind === "browser" || activeTab?.kind === "search") && (
            <BrowserTab key={activeTab.id} tab={activeTab} />
          )}
          {activeTab?.kind === "review" && (
            <ReviewerStudio key={activeTab.id} tab={activeTab} />
          )}
          {!activeTab && <EmptyState />}
          {analyzerOpen && !focusMode && <AnalyzerDrawer />}
          <HintStrip />
          <FocusExitButton focus={focusMode} onExit={() => toggleFocusMode(false)} />
        </main>
        {showAgent && (
          <>
            <AgentPanelResizeHandle />
            <div
              style={{ width: agentPanelWidth }}
              className="shrink-0 min-w-[300px] max-w-[720px] h-full flex flex-col"
            >
              <AgentPanel />
            </div>
          </>
        )}
      </div>
      {showChrome && <StatusBar />}
      <CommandPalette />
      <SettingsModal
        open={settingsOpen}
        onClose={() => toggleSettings(false)}
      />
      <ShortcutsModal
        open={shortcutsOpen}
        onClose={() => toggleShortcuts(false)}
      />
      <NewReviewModal
        open={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
      />
      <PdfImportZone />
      <WelcomeModal />
      <NavDialogs />
      <PublishLedgerDialog />
      <ReferencesDialog />
    </div>
  );
}

function FocusExitButton({
  focus,
  onExit,
}: {
  focus: boolean;
  onExit: () => void;
}) {
  return (
    <AnimatePresence>
      {focus && (
        <motion.button
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
          onClick={onExit}
          className="fixed top-4 right-5 z-30 btn h-7 text-[11px] text-muted bg-surface/80 backdrop-blur"
          title="Exit focus (⌘.)"
        >
          Exit focus
          <span className="kbd">⌘.</span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}

function EmptyState() {
  const newPaper = useAtlas((s) => s.newPaper);
  const openTab = useAtlas((s) => s.openTab);
  const toggleCommand = useAtlas((s) => s.toggleCommand);

  return (
    <div className="flex-1 flex items-center justify-center text-foreground p-10">
      <div className="text-center max-w-[500px]">
        <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-accent mb-3">
          No tab open
        </div>
        <h2 className="text-[28px] font-semibold tracking-tight">
          Pick a starting point.
        </h2>
        <p className="text-[13px] text-muted mt-2 mb-8 leading-relaxed">
          Open the command palette for everything, or jump straight in.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <ActionCard
            icon={<FilePlus className="size-4" />}
            label="New paper"
            shortcut="⌘N"
            onClick={() => newPaper()}
          />
          <ActionCard
            icon={<Upload className="size-4" />}
            label="Import a PDF"
            shortcut="drop"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("atlas:import-pdf"))
            }
          />
          <ActionCard
            icon={<Search className="size-4" />}
            label="Search the web"
            shortcut="↵"
            onClick={() => {
              const id = `t_search_${Math.random().toString(36).slice(2, 7)}`;
              openTab({
                id,
                kind: "search",
                title: "New search",
                query: "",
              });
            }}
          />
        </div>
        <button
          onClick={() => toggleCommand(true)}
          className="btn btn-ghost h-8 text-[12px] text-muted mt-5"
        >
          Open command palette
          <span className="kbd">⌘K</span>
          <ArrowRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function ActionCard({
  icon,
  label,
  shortcut,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  shortcut: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="panel p-3 text-left hover:border-border-strong transition-colors group"
    >
      <div className="flex items-center gap-2 text-foreground">
        <span className="size-7 rounded-md bg-accent-soft border border-[#2d3d12] flex items-center justify-center text-accent">
          {icon}
        </span>
        <span className="text-[13px] font-medium flex-1">{label}</span>
        <span className="kbd">{shortcut}</span>
      </div>
    </button>
  );
}
