"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSettings } from "@/lib/settings";
import { cn } from "@/lib/cn";

export function AgentPanelResizeHandle() {
  const setAgentPanelWidth = useSettings((s) => s.setAgentPanelWidth);
  const [hovering, setHovering] = useState(false);
  const dragging = useRef(false);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragging.current) return;
      // Panel sits on the right; width = viewport - mouseX.
      const next = window.innerWidth - e.clientX;
      setAgentPanelWidth(next);
    }
    function onUp() {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [setAgentPanelWidth]);

  return (
    <div
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      className="relative w-1.5 shrink-0 cursor-col-resize group select-none"
      role="separator"
      aria-orientation="vertical"
      title="Drag to resize · ⌘. for focus"
    >
      <div
        className={cn(
          "absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-border transition-colors",
          hovering && "bg-accent",
        )}
      />
      <div
        className={cn(
          "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-10 w-1 rounded-full transition-colors",
          hovering ? "bg-accent" : "bg-transparent",
        )}
      />
    </div>
  );
}
