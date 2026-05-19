"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Loader2, Upload, X } from "lucide-react";
import { useAtlas } from "@/lib/store";
import { extractPdf } from "@/lib/pdf";

interface ImportSummary {
  fileName: string;
  title: string;
  pages: number;
  blocks: number;
  headings: number;
  columns: 1 | 2;
  mathFragments: number;
  droppedHeaderFooter: number;
  figuresExtracted: number;
  figuresSkipped: number;
}

export function PdfImportZone() {
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const dragCounter = useRef(0);
  const newPaper = useAtlas((s) => s.newPaper);
  const updatePaper = useAtlas((s) => s.updatePaper);

  const ingest = useCallback(
    async (files: File[]) => {
      for (const file of files) {
        if (!file.name.toLowerCase().endsWith(".pdf")) continue;
        setBusy(file.name);
        setError(null);
        try {
          const result = await extractPdf(file);
          const id = newPaper();
          updatePaper(id, result.html);
          // Patch title
          useAtlas.setState((s) => ({
            papers: {
              ...s.papers,
              [id]: { ...s.papers[id], title: result.title },
            },
            tabs: s.tabs.map((t) =>
              t.paperId === id ? { ...t, title: result.title } : t,
            ),
          }));
          setSummary({
            fileName: file.name,
            title: result.title,
            pages: result.pages,
            blocks: result.stats.blocks,
            headings: result.stats.headings,
            columns: result.stats.columns,
            mathFragments: result.stats.mathFragments,
            droppedHeaderFooter: result.stats.droppedHeaderFooter,
            figuresExtracted: result.stats.figuresExtracted,
            figuresSkipped: result.stats.figuresSkipped,
          });
        } catch (e) {
          setError(
            `Failed to import ${file.name}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
      setBusy(null);
    },
    [newPaper, updatePaper],
  );

  useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("Files")) return;
      e.preventDefault();
      dragCounter.current++;
      setDragging(true);
    };
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) {
        e.preventDefault();
      }
    };
    const onDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current = Math.max(0, dragCounter.current - 1);
      if (dragCounter.current === 0) setDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current = 0;
      setDragging(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length > 0) ingest(files);
    };
    const onImportEvent = () => openFilePicker();
    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    window.addEventListener("atlas:import-pdf", onImportEvent);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("atlas:import-pdf", onImportEvent);
    };
  }, [ingest]);

  function openFilePicker() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf";
    input.multiple = true;
    input.onchange = () => {
      const files = Array.from(input.files ?? []);
      if (files.length > 0) ingest(files);
    };
    input.click();
  }

  return (
    <AnimatePresence>
      {(dragging || busy || error || summary) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center"
        >
          {dragging && !busy && (
            <div className="absolute inset-4 rounded-2xl border-2 border-dashed border-accent bg-accent-soft/30 backdrop-blur flex items-center justify-center pointer-events-auto">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center"
              >
                <Upload className="size-10 mx-auto text-accent mb-3" />
                <div className="text-lg font-semibold text-foreground">
                  Drop a PDF to import
                </div>
                <div className="text-sm text-muted mt-1">
                  Atlas will extract the text and open it for analysis.
                </div>
              </motion.div>
            </div>
          )}
          {busy && (
            <div className="pointer-events-auto panel px-5 py-4 flex items-center gap-3 shadow-2xl rounded-xl">
              <Loader2 className="size-5 animate-spin text-accent" />
              <div>
                <div className="text-[13px] font-medium">Importing PDF…</div>
                <div className="text-[11px] text-subtle">{busy}</div>
              </div>
            </div>
          )}
          {error && (
            <div className="pointer-events-auto panel px-4 py-3 flex items-start gap-2 shadow-2xl rounded-xl max-w-md absolute bottom-6 right-6">
              <FileText className="size-4 text-warning mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-medium text-warning">
                  Import error
                </div>
                <div className="text-[11px] text-muted">{error}</div>
              </div>
              <button
                onClick={() => setError(null)}
                className="size-5 flex items-center justify-center text-subtle hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}
          {summary && !busy && !error && (
            <div className="pointer-events-auto panel px-4 py-3 shadow-2xl rounded-xl max-w-md absolute bottom-6 right-6 space-y-2">
              <div className="flex items-start gap-2">
                <FileText className="size-4 text-accent mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-medium text-foreground truncate">
                    Imported · {summary.title}
                  </div>
                  <div className="text-[10.5px] text-subtle font-mono mt-0.5">
                    {summary.pages} pages · {summary.blocks} blocks ·{" "}
                    {summary.headings} headings · {summary.columns}-col
                  </div>
                </div>
                <button
                  onClick={() => setSummary(null)}
                  className="size-5 flex items-center justify-center text-subtle hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </div>
              {(summary.mathFragments > 0 ||
                summary.droppedHeaderFooter > 0 ||
                summary.figuresExtracted > 0 ||
                summary.figuresSkipped > 0) && (
                <div className="text-[10.5px] text-muted leading-relaxed border-t border-border pt-2 space-y-0.5">
                  {summary.figuresExtracted > 0 && (
                    <div>
                      <span className="text-accent font-mono">
                        {summary.figuresExtracted}
                      </span>{" "}
                      figure{summary.figuresExtracted === 1 ? "" : "s"}{" "}
                      extracted as inline images, appended at the end.
                    </div>
                  )}
                  {summary.figuresSkipped > 0 && (
                    <div>
                      <span className="text-warning font-mono">
                        {summary.figuresSkipped}
                      </span>{" "}
                      figure{summary.figuresSkipped === 1 ? "" : "s"}{" "}
                      skipped (oversized or unsupported bitmap).
                    </div>
                  )}
                  {summary.mathFragments > 0 && (
                    <div>
                      <span className="text-warning font-mono">
                        {summary.mathFragments}
                      </span>{" "}
                      math fragment{summary.mathFragments === 1 ? "" : "s"}{" "}
                      wrapped — PDF math isn&apos;t reliably decompilable to
                      LaTeX; review and re-enter.
                    </div>
                  )}
                  {summary.droppedHeaderFooter > 0 && (
                    <div>
                      Dropped{" "}
                      <span className="font-mono">
                        {summary.droppedHeaderFooter}
                      </span>{" "}
                      page-header/footer fragments.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
