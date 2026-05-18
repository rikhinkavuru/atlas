"use client";

import { FileText, Globe, X, Plus, Search, Inbox } from "lucide-react";
import { useAtlas } from "@/lib/store";
import { cn } from "@/lib/cn";
import type { Tab } from "@/types";

export function TabBar() {
  const tabs = useAtlas((s) => s.tabs);
  const activeTabId = useAtlas((s) => s.activeTabId);
  const setActiveTab = useAtlas((s) => s.setActiveTab);
  const closeTab = useAtlas((s) => s.closeTab);
  const openTab = useAtlas((s) => s.openTab);

  return (
    <div className="h-9 flex items-stretch border-b border-border bg-background pl-2 pr-2 gap-0.5 select-none overflow-x-auto">
      {tabs.map((tab) => (
        <TabButton
          key={tab.id}
          tab={tab}
          active={tab.id === activeTabId}
          onClick={() => setActiveTab(tab.id)}
          onClose={() => closeTab(tab.id)}
        />
      ))}
      <button
        onClick={() => {
          const id = `t_search_${Math.random().toString(36).slice(2, 7)}`;
          openTab({
            id,
            kind: "search",
            title: "New search",
            query: "",
          });
        }}
        className="flex items-center gap-1 px-2 my-1 rounded text-subtle hover:text-foreground hover:bg-surface-2 text-xs"
        title="New browser tab"
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

function TabButton({
  tab,
  active,
  onClick,
  onClose,
}: {
  tab: Tab;
  active: boolean;
  onClick: () => void;
  onClose: () => void;
}) {
  const Icon =
    tab.kind === "editor"
      ? FileText
      : tab.kind === "search"
        ? Search
        : tab.kind === "review"
          ? Inbox
          : Globe;
  return (
    <button
      type="button"
      onClick={onClick}
      onKeyDown={(e) => {
        if ((e.key === "Backspace" || e.key === "Delete") && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          onClose();
        }
      }}
      aria-current={active ? "page" : undefined}
      title={tab.title}
      className={cn(
        "group h-full flex items-center gap-2 px-3 text-[12px] cursor-pointer relative max-w-[240px] min-w-[120px] text-left",
        active
          ? "text-foreground bg-surface"
          : "text-muted hover:text-foreground hover:bg-surface/60",
      )}
    >
      <Icon
        className={cn("size-3.5 shrink-0", active && "text-accent")}
        aria-hidden="true"
      />
      <span className="truncate">{tab.title}</span>
      <span
        role="button"
        tabIndex={0}
        aria-label={`Close ${tab.title}`}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }
        }}
        className={cn(
          "ml-auto shrink-0 size-4 rounded hover:bg-surface-3 flex items-center justify-center transition-opacity",
          // Always visible but unobtrusive — Chrome/Arc pattern. Keyboard
          // focus and hover lift opacity to full.
          active
            ? "opacity-70 hover:opacity-100"
            : "opacity-30 group-hover:opacity-80 focus:opacity-100",
        )}
      >
        <X className="size-3" aria-hidden="true" />
      </span>
      {active && (
        <span
          className="absolute left-0 right-0 top-0 h-px bg-accent"
          aria-hidden="true"
        />
      )}
    </button>
  );
}
