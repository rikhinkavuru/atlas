"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useAtlas, activePaper } from "@/lib/store";
import { useSettings } from "@/lib/settings";
import { downloadLab, importLabFile } from "@/lib/atlaslab";

interface MenuItem {
  label: string;
  shortcut?: string;
  onClick?: () => void;
  separator?: boolean;
  disabled?: boolean;
  checked?: boolean;
}

function getMenus(): Record<string, MenuItem[]> {
  const A = useAtlas.getState();
  const S = useSettings.getState();
  const paper = activePaper();

  function getEditor() {
    return (window as unknown as { __atlasEditor?: any }).__atlasEditor;
  }

  function exportLaTeX() {
    if (!paper) return;
    window.dispatchEvent(new CustomEvent("atlas:open-export-latex"));
  }

  function openFind() {
    window.dispatchEvent(new CustomEvent("atlas:open-find"));
  }

  function openInsertCitation() {
    window.dispatchEvent(new CustomEvent("atlas:open-insert-citation"));
  }

  function exportHTML() {
    if (!paper) return;
    const blob = new Blob(
      [
        `<!doctype html><meta charset="utf-8"><title>${paper.title}</title>${paper.html}`,
      ],
      { type: "text/html" },
    );
    download(blob, `${slugify(paper.title)}.html`);
  }

  function exportMarkdown() {
    if (!paper) return;
    const md = htmlToMarkdown(paper.html);
    const blob = new Blob([md], { type: "text/markdown" });
    download(blob, `${slugify(paper.title)}.md`);
  }

  function importFile() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".html,.htm,.md,.txt";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      const text = await f.text();
      const id = A.newPaper();
      const html = f.name.endsWith(".md") || f.name.endsWith(".txt")
        ? markdownToHTML(text)
        : text;
      A.updatePaper(id, html);
    };
    input.click();
  }

  function importPdf() {
    window.dispatchEvent(new CustomEvent("atlas:import-pdf"));
  }

  function newReviewSession() {
    window.dispatchEvent(new CustomEvent("atlas:new-review"));
  }

  function importWorkspace() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.atlaslab.json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const res = await importLabFile(file);
        alert(
          `Imported ${res.imported} paper${res.imported === 1 ? "" : "s"}${res.voice ? " + voice profile" : ""}.`,
        );
      } catch (e) {
        alert(`Import failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    };
    input.click();
  }

  return {
    File: [
      {
        label: "Back to atlas.app",
        onClick: () => {
          window.location.href = "/";
        },
      },
      { label: "", separator: true },
      { label: "New paper", shortcut: "⌘N", onClick: () => A.newPaper() },
      { label: "Import PDF…", onClick: importPdf },
      { label: "Import HTML / Markdown…", onClick: importFile },
      { label: "", separator: true },
      {
        label: "New review session…",
        onClick: newReviewSession,
      },
      { label: "", separator: true },
      {
        label: "Export as HTML",
        onClick: exportHTML,
        disabled: !paper,
      },
      {
        label: "Export as Markdown",
        onClick: exportMarkdown,
        disabled: !paper,
      },
      {
        label: "Export as LaTeX…",
        onClick: exportLaTeX,
        disabled: !paper,
      },
      { label: "", separator: true },
      {
        label: "Export workspace…",
        onClick: () => downloadLab(),
      },
      {
        label: "Import workspace…",
        onClick: importWorkspace,
      },
      { label: "", separator: true },
      {
        label: "Settings…",
        shortcut: "⌘,",
        onClick: () => A.toggleSettings(true),
      },
    ],
    Edit: [
      {
        label: "Undo",
        shortcut: "⌘Z",
        onClick: () => getEditor()?.chain().focus().undo().run(),
      },
      {
        label: "Redo",
        shortcut: "⇧⌘Z",
        onClick: () => getEditor()?.chain().focus().redo().run(),
      },
      { label: "", separator: true },
      {
        label: "Select all",
        shortcut: "⌘A",
        onClick: () => getEditor()?.chain().focus().selectAll().run(),
      },
      {
        label: "Find in paper…",
        shortcut: "⌘F",
        onClick: openFind,
      },
    ],
    View: [
      {
        label: "Toggle agent panel",
        shortcut: "⌘L",
        onClick: A.toggleAgent,
        checked: A.agentOpen,
      },
      {
        label: "Toggle paper critic",
        shortcut: "⌘⇧A",
        onClick: A.toggleAnalyzer,
        checked: A.analyzerOpen,
      },
      { label: "", separator: true },
      {
        label: `${S.theme === "dark" ? "Light" : "Dark"} mode`,
        onClick: () => S.setTheme(S.theme === "dark" ? "light" : "dark"),
      },
    ],
    Cite: [
      {
        label: "Insert citation…",
        onClick: openInsertCitation,
      },
      {
        label: "Search the web for sources…",
        onClick: () => {
          const id = `t_search_${Math.random().toString(36).slice(2, 7)}`;
          A.openTab({
            id,
            kind: "search",
            title: "New search",
            query: "",
          });
        },
      },
      {
        label: "Manage citation library…",
        onClick: () => {
          A.toggleSettings(true);
        },
      },
      {
        label: "Open command palette",
        shortcut: "⌘K",
        onClick: () => A.toggleCommand(true),
      },
    ],
    Help: [
      {
        label: "Keyboard shortcuts",
        shortcut: "?",
        onClick: () => A.toggleShortcuts(true),
      },
      {
        label: "About Atlas",
        onClick: () => A.toggleSettings(true),
      },
      { label: "", separator: true },
      {
        label: "Report an issue",
        onClick: () => window.open("https://github.com", "_blank"),
      },
    ],
  };
}

export function NavMenuBar() {
  const [open, setOpen] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(null);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);

  const menus = getMenus();

  return (
    <div ref={containerRef} className="flex items-center gap-0 text-xs text-muted">
      {Object.keys(menus).map((name) => (
        <div key={name} className="relative">
          <button
            onClick={() => setOpen((o) => (o === name ? null : name))}
            onMouseEnter={() => open && setOpen(name)}
            className={cn(
              "px-2 py-1 rounded transition-colors",
              open === name
                ? "bg-surface-2 text-foreground"
                : "hover:bg-surface-2 hover:text-foreground",
            )}
          >
            {name}
          </button>
          {open === name && (
            <div className="absolute left-0 top-full mt-1 z-40 w-60 panel shadow-2xl rounded-lg p-1">
              {menus[name].map((item, i) => {
                if (item.separator) {
                  return (
                    <div key={i} className="h-px my-1 bg-border" />
                  );
                }
                return (
                  <button
                    key={i}
                    onClick={() => {
                      if (item.disabled) return;
                      item.onClick?.();
                      setOpen(null);
                    }}
                    disabled={item.disabled}
                    className={cn(
                      "w-full flex items-center px-2 py-1.5 rounded text-[12px] text-left transition-colors",
                      item.disabled
                        ? "text-subtle cursor-not-allowed"
                        : "text-foreground hover:bg-surface-2",
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      {item.checked !== undefined && (
                        <span
                          className={cn(
                            "size-1.5 rounded-full",
                            item.checked ? "bg-accent" : "bg-border",
                          )}
                        />
                      )}
                      {item.label}
                    </span>
                    {item.shortcut && (
                      <span className="ml-auto text-[10px] text-subtle font-mono">
                        {item.shortcut}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function htmlToMarkdown(html: string) {
  return html
    .replace(/<h1>([\s\S]*?)<\/h1>/gi, "# $1\n\n")
    .replace(/<h2>([\s\S]*?)<\/h2>/gi, "## $1\n\n")
    .replace(/<h3>([\s\S]*?)<\/h3>/gi, "### $1\n\n")
    .replace(/<strong>([\s\S]*?)<\/strong>/gi, "**$1**")
    .replace(/<b>([\s\S]*?)<\/b>/gi, "**$1**")
    .replace(/<em>([\s\S]*?)<\/em>/gi, "*$1*")
    .replace(/<i>([\s\S]*?)<\/i>/gi, "*$1*")
    .replace(/<code>([\s\S]*?)<\/code>/gi, "`$1`")
    .replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/gi, "```\n$1\n```\n\n")
    .replace(/<blockquote>([\s\S]*?)<\/blockquote>/gi, "> $1\n\n")
    .replace(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)")
    .replace(/<li>([\s\S]*?)<\/li>/gi, "- $1\n")
    .replace(/<\/?(ul|ol)>/gi, "\n")
    .replace(/<p>([\s\S]*?)<\/p>/gi, "$1\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function markdownToHTML(md: string) {
  const lines = md.split("\n");
  const out: string[] = [];
  let inList = false;
  for (const line of lines) {
    if (/^### (.+)$/.test(line)) {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      out.push(`<h3>${escape(line.replace(/^### /, ""))}</h3>`);
    } else if (/^## (.+)$/.test(line)) {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      out.push(`<h2>${escape(line.replace(/^## /, ""))}</h2>`);
    } else if (/^# (.+)$/.test(line)) {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      out.push(`<h1>${escape(line.replace(/^# /, ""))}</h1>`);
    } else if (/^[-*] /.test(line)) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${inline(line.replace(/^[-*] /, ""))}</li>`);
    } else if (line.trim() === "") {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
    } else {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      out.push(`<p>${inline(escape(line))}</p>`);
    }
  }
  if (inList) out.push("</ul>");
  return out.join("\n");
}

function escape(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function inline(s: string) {
  return s
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}
