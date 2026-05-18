"use client";

import { useAtlas } from "./store";
import { useSettings } from "./settings";
import type { VoiceProfile } from "./voice";

interface AtlasLabBundle {
  version: 1;
  exportedAt: number;
  papers: { id: string; title: string; html: string; updatedAt: number }[];
  comments: ReturnType<typeof useAtlas.getState>["comments"];
  settings: {
    venue: string;
    voice: VoiceProfile | null;
    styleNotes: string;
    openaiModel: string;
    anthropicModel: string;
    provider: string;
  };
}

export function exportLab(): Blob {
  const a = useAtlas.getState();
  const s = useSettings.getState();
  const bundle: AtlasLabBundle = {
    version: 1,
    exportedAt: Date.now(),
    papers: Object.values(a.papers).map((p) => ({
      id: p.id,
      title: p.title,
      html: p.html,
      updatedAt: p.updatedAt,
    })),
    comments: a.comments,
    settings: {
      venue: s.venue,
      voice: s.voiceProfile ?? null,
      styleNotes: s.styleNotes,
      openaiModel: s.openaiModel,
      anthropicModel: s.anthropicModel,
      provider: s.provider,
    },
  };
  return new Blob([JSON.stringify(bundle, null, 2)], {
    type: "application/json",
  });
}

export function downloadLab() {
  const blob = exportLab();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `workspace-${new Date().toISOString().slice(0, 10)}.atlaslab.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function importLabFile(file: File): Promise<{
  imported: number;
  voice: boolean;
}> {
  const text = await file.text();
  const bundle = JSON.parse(text) as AtlasLabBundle;
  if (bundle.version !== 1) {
    throw new Error("Unsupported workspace version");
  }
  const a = useAtlas.getState();
  const s = useSettings.getState();
  let imported = 0;
  for (const p of bundle.papers) {
    // Create a new paper so we never overwrite existing local content
    const newId = a.newPaper();
    a.updatePaper(newId, p.html);
    // Patch the title via direct set
    useAtlas.setState((state) => ({
      papers: {
        ...state.papers,
        [newId]: { ...state.papers[newId], title: p.title },
      },
    }));
    imported++;
  }
  if (bundle.settings?.voice) s.setVoiceProfile(bundle.settings.voice);
  if (bundle.settings?.styleNotes) s.setStyleNotes(bundle.settings.styleNotes);
  if (bundle.settings?.venue)
    s.setVenue(bundle.settings.venue as Parameters<typeof s.setVenue>[0]);
  return { imported, voice: !!bundle.settings?.voice };
}
