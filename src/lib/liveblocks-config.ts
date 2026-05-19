/**
 * Liveblocks room schema. Shared by the client + auth route so both sides
 * know the expected shape of presence + storage.
 *
 * Presence: per-peer ephemeral state (cursor, selection, name). Storage:
 * persistent room state. We're using a Yjs document for the actual text
 * (via Liveblocks Yjs), so room Storage stays minimal.
 */

export interface AtlasPresence {
  /** Display name surfaced to other peers. */
  name: string;
  /** Hex color string, derived from user id so it's stable. */
  color: string;
  /** Last cursor position (ProseMirror absolute offset). Optional — we
   *  populate it when the editor is mounted; null while not connected. */
  cursor: number | null;
}

export interface AtlasUserMeta {
  /** Stable user id. Matches what /api/liveblocks-auth signs into the token. */
  id: string;
  info: {
    name: string;
    color: string;
    /** Avatar URL when we have one (Clerk). Stays optional. */
    avatar?: string;
  };
}

/** Liveblocks Storage payload. Reserved — currently unused; rich
 *  text lives in the y-doc the Liveblocks Yjs provider syncs. */
export type AtlasStorage = Record<string, never>;

/** Custom RoomEvent shapes. We don't broadcast any RoomEvents yet; this
 *  is here so future features (e.g. "remote agent kicked off a refactor")
 *  have a single point of declaration. */
export type AtlasRoomEvent = { type: "noop" };

export const ATLAS_PRESENCE_DEFAULT: AtlasPresence = {
  name: "Anonymous",
  color: "#c6f24e",
  cursor: null,
};
