"use client";

import { ArrowLeft } from "lucide-react";

export function BackButton() {
  return (
    <button
      onClick={() => {
        if (typeof window !== "undefined") window.history.back();
      }}
      className="mt-6 inline-flex items-center gap-1.5 text-[12px] text-subtle hover:text-foreground transition-colors"
    >
      <ArrowLeft className="size-3.5" />
      Back to wherever you came from
    </button>
  );
}
