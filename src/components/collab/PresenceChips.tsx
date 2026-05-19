"use client";

import { useOthers, useSelf } from "@liveblocks/react/suspense";
import { Wifi, WifiOff } from "lucide-react";
import { collabEnabled, colorForUser } from "@/lib/collab";
import { useCollab } from "./CollabProvider";
import { cn } from "@/lib/cn";

/**
 * Live presence row — one avatar chip per peer in the current room, plus
 * a small "X online" status. Hidden entirely when collab is disabled so
 * single-author mode stays clean.
 */
export function PresenceChips() {
  if (!collabEnabled) return null;
  return <PresenceChipsInner />;
}

function PresenceChipsInner() {
  const collab = useCollab();
  if (!collab.enabled) return null;
  return <PresenceChipsConnected />;
}

function PresenceChipsConnected() {
  const others = useOthers();
  const self = useSelf();
  const total = others.length + (self ? 1 : 0);

  // Build the avatar list — self first, then peers. We cap at 5 visible
  // chips and collapse the rest into a "+N" badge to keep the top bar tidy.
  const visible = [
    ...(self ? [{ id: self.id ?? "self", info: self.info }] : []),
    ...others.map((o) => ({ id: o.id ?? `peer-${o.connectionId}`, info: o.info })),
  ].slice(0, 5);
  const overflow = total - visible.length;

  return (
    <div className="flex items-center gap-1.5 px-2 h-7 rounded-md border border-border bg-surface/60 text-[10.5px] font-mono uppercase tracking-[0.12em] text-subtle">
      {total > 1 ? (
        <Wifi className="size-3 text-accent" aria-label="Connected" />
      ) : (
        <WifiOff className="size-3 text-subtle" aria-label="Alone in room" />
      )}
      <span className="hidden lg:inline">
        {total} {total === 1 ? "editor" : "editors"}
      </span>
      <div className="flex items-center -space-x-1.5 ml-1">
        {visible.map((u, i) => {
          const name =
            (u.info as { name?: string } | undefined)?.name ?? "Author";
          const color =
            (u.info as { color?: string } | undefined)?.color ??
            colorForUser(String(u.id));
          return (
            <span
              key={String(u.id) + i}
              className={cn(
                "size-5 rounded-full border-2 border-background flex items-center justify-center text-[9.5px] font-mono font-bold text-background",
                self && i === 0 && "ring-1 ring-background",
              )}
              style={{ background: color }}
              title={i === 0 && self ? `${name} (you)` : name}
              aria-label={name}
            >
              {name.charAt(0).toUpperCase()}
            </span>
          );
        })}
        {overflow > 0 && (
          <span
            className="size-5 rounded-full border-2 border-background bg-surface-2 flex items-center justify-center text-[9px] font-mono text-muted"
            title={`+${overflow} more`}
          >
            +{overflow}
          </span>
        )}
      </div>
    </div>
  );
}
