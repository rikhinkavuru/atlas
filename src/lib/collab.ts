/**
 * Realtime-collaboration feature flag + room derivation.
 *
 * Collab is gated on the server: the public env var
 * `NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY` must be set for the client to attempt
 * a connection. The server-side `LIVEBLOCKS_SECRET_KEY` is required for the
 * auth route to mint tokens.
 *
 * Without those vars set the whole product still works — Atlas falls back
 * to single-author local-only editing, the SessionPanel still logs your own
 * edits, and the presence chip is hidden.
 */

export const collabEnabled =
  typeof process !== "undefined" &&
  !!process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY;

export function roomNameForPaper(paperId: string, workspaceId: string): string {
  // Per-paper rooms scoped under a workspace prefix so two unrelated atlas
  // workspaces editing papers with colliding IDs don't share state. The
  // workspaceId is derived from the local crypto keypair (see
  // src/lib/provenance.ts → getWorkspaceId) and is itself stable per
  // browser-profile, so this is a reasonable opt-in identity until a real
  // user system layers on top.
  const safe = paperId.replace(/[^a-zA-Z0-9_-]/g, "");
  const ws = workspaceId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24);
  return `atlas:${ws}:${safe}`;
}

// Stable color palette for presence cursors — assigned by hashing the user
// id so peers see consistent colors across reconnects.
const PRESENCE_COLORS = [
  "#c6f24e", // accent
  "#7dd3fc", // sky-300
  "#f0abfc", // fuchsia-300
  "#fdba74", // orange-300
  "#86efac", // green-300
  "#fda4af", // rose-300
  "#a5b4fc", // indigo-300
];

export function colorForUser(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return PRESENCE_COLORS[hash % PRESENCE_COLORS.length];
}
