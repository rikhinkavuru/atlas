"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useFocusTrap } from "@/lib/use-focus-trap";

interface Props {
  open: boolean;
  onClose: () => void;
}

const GROUPS = [
  {
    name: "Navigation",
    items: [
      ["Command palette", "⌘ K"],
      ["Toggle agent", "⌘ L"],
      ["Toggle paper critic", "⌘ ⇧ A"],
      ["Settings", "⌘ ,"],
      ["Keyboard shortcuts", "?"],
      ["Close popovers", "Esc"],
    ],
  },
  {
    name: "Editing",
    items: [
      ["Bold", "⌘ B"],
      ["Italic", "⌘ I"],
      ["Heading 1 / 2 / 3", "⌘ ⌥ 1 / 2 / 3"],
      ["Bulleted list", "⌘ ⇧ 8"],
      ["Block quote", "⌘ ⇧ B"],
      ["Slash menu", "/"],
      ["Undo / Redo", "⌘ Z / ⇧ ⌘ Z"],
    ],
  },
  {
    name: "Agent",
    items: [
      ["Open agent", "⌘ L"],
      ["Send message", "↵"],
      ["Newline in input", "⇧ ↵"],
      ["Run quick prompt", "Click chip"],
      ["Accept proposal", "Click Accept on diff card"],
    ],
  },
];

export function ShortcutsModal({ open, onClose }: Props) {
  const trapRef = useFocusTrap<HTMLDivElement>(open);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard shortcuts"
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-6"
        >
          <motion.div
            ref={trapRef}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="panel w-[640px] max-w-[94vw] max-h-[80vh] overflow-hidden shadow-2xl rounded-xl flex flex-col"
          >
            <div className="h-11 px-4 flex items-center gap-2 border-b border-border">
              <h2 className="text-[13px] font-semibold tracking-tight">
                Keyboard shortcuts
              </h2>
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("atlas:replay-tour"));
                  onClose();
                }}
                className="ml-auto btn btn-ghost h-7 text-[11px]"
                title="Replay the first-run tour"
              >
                Replay tour
              </button>
              <button
                onClick={onClose}
                className="size-7 rounded hover:bg-surface-2 flex items-center justify-center text-muted"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-5 grid grid-cols-2 gap-x-6 gap-y-5">
              {GROUPS.map((g) => (
                <div key={g.name}>
                  <div className="text-[10px] uppercase tracking-[0.15em] text-subtle font-mono mb-2">
                    {g.name}
                  </div>
                  <ul className="space-y-1">
                    {g.items.map(([label, keys], i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between text-[12px]"
                      >
                        <span className="text-muted">{label}</span>
                        <span className="font-mono text-[11px] text-foreground">
                          {keys.split(" ").map((k, idx) => (
                            <span key={idx} className="kbd ml-1">
                              {k}
                            </span>
                          ))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
