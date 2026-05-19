/**
 * Per-paper recovery snapshots.
 *
 * Zustand-persist auto-saves the whole workspace on every state change,
 * but that's a single live state — if the user accidentally selects-all
 * and deletes, or pastes garbage from another tab, the persisted blob
 * matches the (now-broken) live state. Recovery snapshots keep a small
 * rolling window of historical HTMLs so the user can roll back.
 *
 * Storage shape (localStorage, one key per snapshot):
 *
 *   atlas:recovery:<paperId>:<isoTimestamp>  →  { html, words, chars }
 *
 * We cap at 5 snapshots per paper, evicting the oldest when a new one
 * lands. The cadence is throttled to once every two minutes — frequent
 * enough to catch typical "oh no" moments, sparse enough that
 * localStorage doesn't bloat.
 */

const PREFIX = "atlas:recovery:";
const CAP_PER_PAPER = 5;

export interface RecoverySnapshot {
  paperId: string;
  /** ISO 8601 timestamp the snapshot was captured. */
  takenAt: string;
  /** Atlas paper HTML at the moment of capture. */
  html: string;
  /** Pre-computed stats so the recovery dialog doesn't re-parse on render. */
  words: number;
  chars: number;
}

interface StoredPayload {
  html: string;
  words: number;
  chars: number;
}

/** Throttle window between snapshots, ms. */
export const SNAPSHOT_INTERVAL_MS = 2 * 60 * 1000;

function keyFor(paperId: string, takenAt: string): string {
  return `${PREFIX}${paperId}:${takenAt}`;
}

/** List every snapshot for a paper, newest first. */
export function listSnapshots(paperId: string): RecoverySnapshot[] {
  if (typeof window === "undefined") return [];
  const out: RecoverySnapshot[] = [];
  const prefix = `${PREFIX}${paperId}:`;
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key || !key.startsWith(prefix)) continue;
    const takenAt = key.slice(prefix.length);
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as StoredPayload;
      out.push({
        paperId,
        takenAt,
        html: parsed.html,
        words: parsed.words ?? 0,
        chars: parsed.chars ?? 0,
      });
    } catch {
      /* corrupt entry → ignore */
    }
  }
  // Newest first.
  out.sort((a, b) => (a.takenAt < b.takenAt ? 1 : -1));
  return out;
}

/** Record a snapshot. Caps the list at CAP_PER_PAPER, evicting oldest. */
export function recordSnapshot(snapshot: RecoverySnapshot): void {
  if (typeof window === "undefined") return;
  const payload: StoredPayload = {
    html: snapshot.html,
    words: snapshot.words,
    chars: snapshot.chars,
  };
  try {
    window.localStorage.setItem(
      keyFor(snapshot.paperId, snapshot.takenAt),
      JSON.stringify(payload),
    );
  } catch {
    // Quota exceeded — drop the oldest two and retry once. If it still
    // fails, give up silently; the user can keep working.
    const existing = listSnapshots(snapshot.paperId);
    for (const old of existing.slice(-2)) {
      window.localStorage.removeItem(keyFor(old.paperId, old.takenAt));
    }
    try {
      window.localStorage.setItem(
        keyFor(snapshot.paperId, snapshot.takenAt),
        JSON.stringify(payload),
      );
    } catch {
      return;
    }
  }
  // Enforce the cap.
  const current = listSnapshots(snapshot.paperId);
  if (current.length > CAP_PER_PAPER) {
    for (const old of current.slice(CAP_PER_PAPER)) {
      window.localStorage.removeItem(keyFor(old.paperId, old.takenAt));
    }
  }
}

/** Drop every snapshot for a paper (e.g. on paper deletion). */
export function clearSnapshots(paperId: string): void {
  if (typeof window === "undefined") return;
  const prefix = `${PREFIX}${paperId}:`;
  const toRemove: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key && key.startsWith(prefix)) toRemove.push(key);
  }
  for (const k of toRemove) window.localStorage.removeItem(k);
}

/**
 * Strip HTML to plain text and return word/char counts. Mirrors the
 * counting logic in StatusBar so the recovery dialog shows the same
 * numbers the user is used to seeing.
 */
export function htmlStats(html: string): { words: number; chars: number } {
  if (typeof window === "undefined") return { words: 0, chars: 0 };
  const div = document.createElement("div");
  div.innerHTML = html;
  const text = (div.textContent ?? "").trim();
  if (!text) return { words: 0, chars: 0 };
  return {
    words: text.split(/\s+/).filter(Boolean).length,
    chars: text.length,
  };
}
