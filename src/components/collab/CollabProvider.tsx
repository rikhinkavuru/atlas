"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { LiveblocksProvider, RoomProvider } from "@liveblocks/react/suspense";
import { LiveblocksYjsProvider } from "@liveblocks/yjs";
import { useRoom } from "@liveblocks/react/suspense";
import * as Y from "yjs";
import { collabEnabled, colorForUser, roomNameForPaper } from "@/lib/collab";
import { getWorkspaceId } from "@/lib/provenance";
import { useAtlas } from "@/lib/store";
import {
  ATLAS_PRESENCE_DEFAULT,
  type AtlasPresence,
} from "@/lib/liveblocks-config";

/**
 * Top-level provider that opens a Liveblocks connection for the active
 * paper. If `collabEnabled` is false (no public key set), this renders
 * children unchanged — Atlas stays in single-author mode.
 *
 * The provider is keyed to the active paper id so switching tabs leaves
 * one room and joins another. Yjs documents are created per room and made
 * available via the `useCollab` hook below for the PaperEditor to bind to.
 */

interface CollabContext {
  /** True when this paper has an active Liveblocks connection. */
  enabled: boolean;
  /** Yjs document for the current room, or null in single-author mode. */
  yDoc: Y.Doc | null;
  /** Liveblocks YjsProvider — needed for the CollaborationCursor extension. */
  yProvider: LiveblocksYjsProvider | null;
  /** Local user metadata as broadcast in presence. */
  selfUser: { id: string; name: string; color: string };
}

const Ctx = createContext<CollabContext>({
  enabled: false,
  yDoc: null,
  yProvider: null,
  selfUser: { id: "self", name: "You", color: "#c6f24e" },
});

export function useCollab(): CollabContext {
  return useContext(Ctx);
}

export function CollabProvider({ children }: { children: React.ReactNode }) {
  // Single-author mode: just render children with the default context.
  if (!collabEnabled) {
    return <>{children}</>;
  }
  return <CollabEnabledProvider>{children}</CollabEnabledProvider>;
}

function CollabEnabledProvider({ children }: { children: React.ReactNode }) {
  const activeTabId = useAtlas((s) => s.activeTabId);
  const tab = useAtlas((s) => s.tabs.find((t) => t.id === activeTabId));
  const paperId = tab?.paperId;
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  // workspaceId comes from a localStorage probe that's only meaningful in
  // the browser. We defer setting it until mount so SSR doesn't trip on a
  // missing window.
  useEffect(() => {
    setWorkspaceId(getWorkspaceId());
  }, []);

  if (!paperId || !workspaceId) {
    // No paper open, or pre-mount: render children unwrapped.
    return <>{children}</>;
  }

  const selfId = workspaceId; // anonymous-mode id; swap to Clerk userId later
  const selfName = "Author";
  const selfColor = colorForUser(selfId);
  const roomName = roomNameForPaper(paperId, workspaceId);

  return (
    <LiveblocksProvider
      authEndpoint={async () => {
        const r = await fetch("/api/liveblocks-auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: selfId,
            name: selfName,
            workspaceId,
          }),
        });
        if (!r.ok) throw new Error(`auth failed: ${r.status}`);
        return r.json();
      }}
      resolveUsers={async ({ userIds }) =>
        userIds.map((id) => ({
          name: "Author",
          color: colorForUser(id),
        }))
      }
    >
      <RoomProvider
        id={roomName}
        initialPresence={
          {
            ...ATLAS_PRESENCE_DEFAULT,
            name: selfName,
            color: selfColor,
          } satisfies AtlasPresence
        }
      >
        <RoomBindings selfUser={{ id: selfId, name: selfName, color: selfColor }}>
          {children}
        </RoomBindings>
      </RoomProvider>
    </LiveblocksProvider>
  );
}

function RoomBindings({
  selfUser,
  children,
}: {
  selfUser: CollabContext["selfUser"];
  children: React.ReactNode;
}) {
  const room = useRoom();
  // Yjs document + Liveblocks provider are remounted whenever the room
  // changes (per-paper). The provider syncs the doc with the room's storage
  // automatically.
  const yDoc = useMemo(() => new Y.Doc(), [room.id]);
  const yProvider = useMemo(
    () => new LiveblocksYjsProvider(room, yDoc),
    [room, yDoc],
  );

  // Clean up on unmount: destroying the provider unsubscribes from room
  // updates; destroying the doc frees the structure.
  useEffect(() => {
    return () => {
      yProvider.destroy();
      yDoc.destroy();
    };
  }, [yProvider, yDoc]);

  const ctx: CollabContext = {
    enabled: true,
    yDoc,
    yProvider,
    selfUser,
  };
  return <Ctx.Provider value={ctx}>{children}</Ctx.Provider>;
}
