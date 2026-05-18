"use client";

import { useState } from "react";
import {
  Plus,
  Trash2,
  Upload,
  Download,
  Users,
  Target,
  Library,
  Sparkles,
  Check,
  X,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useSettings } from "@/lib/settings";
import {
  downloadLabCapsule,
  emptyLab,
  fingerprintVoice,
  mergeLab,
  readLabCapsule,
  type ImportedCapsule,
  type Lab,
  type LabMember,
  type LabRule,
  type LabRuleCategory,
  type LabSharedSource,
} from "@/lib/lab";
import { cn } from "@/lib/cn";

const ROLES = ["PI", "Postdoc", "PhD Y1", "PhD Y2", "PhD Y3", "PhD Y4+", "RA / RSE", "Visiting"];
const CATEGORIES: { id: LabRuleCategory; label: string }[] = [
  { id: "voice", label: "Voice" },
  { id: "citation", label: "Citation" },
  { id: "structure", label: "Structure" },
  { id: "submission", label: "Submission" },
];

export function LabSection() {
  const lab = useSettings((s) => s.lab);
  const setLab = useSettings((s) => s.setLab);
  const patchLab = useSettings((s) => s.patchLab);
  const voiceProfile = useSettings((s) => s.voiceProfile);
  const styleNotes = useSettings((s) => s.styleNotes);

  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!lab) {
    return (
      <div className="space-y-5">
        <FreeTierBanner />
        <p className="text-[12px] text-muted leading-relaxed">
          A Lab is the unit of stickiness above a single researcher. It owns
          the shared library, voice baseline, citation rules, and a roster of
          contributing members. New PhDs join, import the capsule, and inherit
          everything in one step. Leaving means walking away from years of
          compounded group asset.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <button
            onClick={() => {
              const seeded = emptyLab("Smith Lab");
              setLab(seeded);
              setInfo("New lab created. Add members below.");
            }}
            className="panel p-4 rounded-lg text-left hover:border-border-strong transition-colors"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="size-7 rounded-md bg-accent-soft border border-[#2d3d12] flex items-center justify-center text-accent">
                <Plus className="size-3.5" />
              </span>
              <span className="text-[13px] font-semibold text-foreground">
                Create a new lab
              </span>
            </div>
            <p className="text-[12px] text-muted leading-relaxed">
              You become the first member. Add the rest of your group, write
              the shared rules, and the workspace starts compounding.
            </p>
          </button>
          <CapsulePicker
            onResult={(parsed) => {
              setLab(parsed.lab);
              setInfo(
                `${trustHeadline(parsed)} — imported ${parsed.lab.members.length} member${parsed.lab.members.length === 1 ? "" : "s"} and ${parsed.lab.rules.length} rule${parsed.lab.rules.length === 1 ? "" : "s"}.`,
              );
              setError(null);
            }}
            onError={(e) => {
              setError(e);
              setInfo(null);
            }}
          />
        </div>
        {info && <Toast tone="ok">{info}</Toast>}
        {error && <Toast tone="warn">{error}</Toast>}
      </div>
    );
  }

  function addMember() {
    const name = prompt("Member name");
    if (!name?.trim()) return;
    const role = prompt(`Role (${ROLES.join(" / ")})`, "PhD Y1") || "PhD";
    const id = `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const member: LabMember = {
      id,
      name: name.trim(),
      role: role.trim() || "PhD",
      joinedAt: Date.now(),
      voiceImported: false,
    };
    patchLab({ members: [...lab!.members, member] });
  }

  function removeMember(id: string) {
    patchLab({ members: lab!.members.filter((m) => m.id !== id) });
  }

  function attachVoiceTo(memberId: string) {
    if (!voiceProfile) {
      setError(
        "No voice profile to attach. Settings → Voice to compute one from your samples first.",
      );
      return;
    }
    patchLab({
      members: lab!.members.map((m) =>
        m.id === memberId
          ? { ...m, voiceImported: true, voiceUpdatedAt: Date.now() }
          : m,
      ),
      voiceSnapshot: voiceProfile,
    });
    setInfo("Voice profile snapshot attached to the lab.");
  }

  function addRule(category: LabRuleCategory) {
    const text = prompt(`New ${category} rule`);
    if (!text?.trim()) return;
    const rule: LabRule = {
      id: `r_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      text: text.trim(),
      category,
      addedAt: Date.now(),
    };
    patchLab({ rules: [...lab!.rules, rule] });
  }

  function removeRule(id: string) {
    patchLab({ rules: lab!.rules.filter((r) => r.id !== id) });
  }

  function syncStyleNotesToRules() {
    if (!styleNotes.trim()) {
      setError(
        "No free-form style notes to import. Settings → Voice has the field.",
      );
      return;
    }
    const lines = styleNotes
      .split(/[\n.]+/)
      .map((l) => l.trim())
      .filter((l) => l.length > 8);
    const existing = new Set(lab!.rules.map((r) => r.text.toLowerCase()));
    const added: LabRule[] = lines
      .filter((l) => !existing.has(l.toLowerCase()))
      .map((l) => ({
        id: `r_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        text: l,
        category: "voice",
        addedAt: Date.now(),
      }));
    patchLab({ rules: [...lab!.rules, ...added] });
    setInfo(`Imported ${added.length} rule${added.length === 1 ? "" : "s"} from your style notes.`);
  }

  function addSource() {
    const url = prompt("Source URL (paper, blog, doc)");
    if (!url?.trim()) return;
    const label = prompt("Short label", "") || url;
    const s: LabSharedSource = {
      id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      label: label.trim(),
      url: url.trim(),
      addedAt: Date.now(),
    };
    patchLab({ sharedSources: [...lab!.sharedSources, s] });
  }

  function removeSource(id: string) {
    patchLab({
      sharedSources: lab!.sharedSources.filter((s) => s.id !== id),
    });
  }

  function dissolveLab() {
    if (
      !confirm(
        `Dissolve "${lab!.name}"? Your local copy is wiped. Re-import any time if you exported a capsule.`,
      )
    ) {
      return;
    }
    setLab(null);
  }

  return (
    <div className="space-y-5">
      <FreeTierBanner />
      <div className="panel p-4 rounded-lg space-y-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
          <Field label="Lab name">
            <input
              value={lab.name}
              onChange={(e) => patchLab({ name: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="PI">
            <input
              value={lab.pi ?? ""}
              onChange={(e) => patchLab({ pi: e.target.value })}
              placeholder="Dr. Smith"
              className="input"
            />
          </Field>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono text-subtle">
          <span>
            id <span className="text-foreground">{lab.id}</span>
          </span>
          <span>
            updated{" "}
            <span className="text-foreground">
              {new Date(lab.updatedAt).toLocaleString()}
            </span>
          </span>
        </div>
      </div>

      <Block
        icon={<Users className="size-4" />}
        label="Members"
        count={lab.members.length}
        action={
          <button onClick={addMember} className="btn h-7 text-[11px]">
            <Plus className="size-3.5" />
            Add
          </button>
        }
      >
        {lab.members.length === 0 ? (
          <Empty>
            No members yet. Add the PI and the cohort here. Each member can
            attach a voice profile snapshot so the agent learns who&apos;s
            writing.
          </Empty>
        ) : (
          <ul className="space-y-1.5">
            {lab.members.map((m) => (
              <li
                key={m.id}
                className="border border-border rounded-md p-2.5 flex items-center gap-2.5"
              >
                <span className="size-7 rounded-full bg-surface-2 border border-border flex items-center justify-center text-[10.5px] font-mono text-foreground">
                  {m.name.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] text-foreground font-medium leading-none">
                    {m.name}
                  </div>
                  <div className="text-[10.5px] font-mono text-subtle mt-0.5">
                    {m.role} · joined{" "}
                    {new Date(m.joinedAt).toLocaleDateString()}
                  </div>
                </div>
                <span
                  className={cn(
                    "ml-auto text-[10px] font-mono uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-full border",
                    m.voiceImported
                      ? "border-[#2d3d12] bg-accent-soft text-accent"
                      : "border-border bg-surface-2 text-subtle",
                  )}
                >
                  {m.voiceImported ? "voice attached" : "voice missing"}
                </span>
                <button
                  onClick={() => attachVoiceTo(m.id)}
                  className="btn btn-ghost h-7 text-[11px]"
                  title="Attach your current voice profile snapshot to this member"
                >
                  <Sparkles className="size-3.5" />
                  Attach
                </button>
                <button
                  onClick={() => removeMember(m.id)}
                  className="btn btn-icon h-7 w-7 text-subtle hover:text-danger"
                  aria-label="Remove member"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {lab.voiceSnapshot && (
          <div className="mt-3 text-[11px] text-subtle font-mono">
            voice fingerprint · {fingerprintVoice(lab.voiceSnapshot)}
          </div>
        )}
      </Block>

      <Block
        icon={<Target className="size-4" />}
        label="Lab rules"
        count={lab.rules.length}
        action={
          <div className="flex items-center gap-1">
            <button
              onClick={syncStyleNotesToRules}
              className="btn btn-ghost h-7 text-[11px]"
              title="Pull lines from your Voice → style notes as voice rules"
            >
              <RefreshCw className="size-3.5" />
              From style notes
            </button>
            <div className="flex items-center gap-0.5">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => addRule(c.id)}
                  className="btn btn-ghost h-7 text-[10.5px] text-muted"
                  title={`Add a ${c.label.toLowerCase()} rule`}
                >
                  <Plus className="size-3" />
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        }
      >
        {lab.rules.length === 0 ? (
          <Empty>
            Lab rules condense the advisor&apos;s style preferences. Add things
            like &ldquo;use British spelling&rdquo;, &ldquo;always cite the
            CONSORT statement for trials&rdquo;, &ldquo;prefer 'we' over 'the
            authors'&rdquo;. The agent injects them in every rewrite.
          </Empty>
        ) : (
          <ul className="space-y-1">
            {lab.rules.map((r) => (
              <li
                key={r.id}
                className="border border-border rounded-md px-2.5 py-1.5 flex items-center gap-2 text-[12.5px]"
              >
                <span className="px-1.5 py-0.5 rounded text-[9.5px] font-mono uppercase tracking-[0.12em] border border-border bg-surface-2 text-subtle shrink-0">
                  {r.category}
                </span>
                <span className="text-foreground">{r.text}</span>
                <button
                  onClick={() => removeRule(r.id)}
                  className="btn btn-icon h-6 w-6 ml-auto text-subtle hover:text-danger"
                  aria-label="Remove rule"
                >
                  <X className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Block>

      <Block
        icon={<Library className="size-4" />}
        label="Shared sources"
        count={lab.sharedSources.length}
        action={
          <button onClick={addSource} className="btn h-7 text-[11px]">
            <Plus className="size-3.5" />
            Add URL
          </button>
        }
      >
        {lab.sharedSources.length === 0 ? (
          <Empty>
            Paper URLs every lab member should cite. They&apos;re bundled into
            the capsule and surfaced inside the agent&apos;s Cite mode for any
            paper drafted under this lab.
          </Empty>
        ) : (
          <ul className="space-y-1">
            {lab.sharedSources.map((s) => (
              <li
                key={s.id}
                className="border border-border rounded-md px-2.5 py-1.5 flex items-center gap-2 text-[12.5px]"
              >
                <span className="text-foreground font-medium truncate">
                  {s.label}
                </span>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-subtle text-[10.5px] font-mono truncate ml-2"
                >
                  {s.url}
                </a>
                <button
                  onClick={() => removeSource(s.id)}
                  className="btn btn-icon h-6 w-6 ml-auto text-subtle hover:text-danger"
                  aria-label="Remove source"
                >
                  <X className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Block>

      <Block
        icon={<Download className="size-4" />}
        label="Capsule"
        action={
          <div className="flex items-center gap-1.5">
            <CapsulePicker
              onResult={(incoming) => {
                const merged = mergeLab(lab, incoming.lab);
                useSettings.getState().setLab(merged);
                setInfo(
                  `${trustHeadline(incoming)} — merged ${incoming.lab.members.length} member${incoming.lab.members.length === 1 ? "" : "s"} from "${incoming.lab.name}".`,
                );
                setError(null);
              }}
              onError={(e) => {
                setError(e);
                setInfo(null);
              }}
              compact
            />
            <button
              onClick={() => downloadLabCapsule(lab)}
              className="btn h-7 text-[11px]"
            >
              <Download className="size-3.5" />
              Export
            </button>
          </div>
        }
      >
        <p className="text-[12.5px] text-muted leading-relaxed">
          The capsule is the lab as a portable JSON-LD file. Hand it to a
          joining PhD; their workspace inherits the members, the rules, the
          shared sources, and the voice snapshot in one import. No backend
          required.
        </p>
      </Block>

      <div className="pt-3 border-t border-border flex items-center gap-2">
        <button
          onClick={dissolveLab}
          className="btn btn-ghost h-7 text-[11px] text-subtle hover:text-danger"
        >
          <Trash2 className="size-3.5" />
          Dissolve lab
        </button>
        {info && <Toast tone="ok">{info}</Toast>}
        {error && <Toast tone="warn">{error}</Toast>}
      </div>
    </div>
  );
}

function trustHeadline(capsule: ImportedCapsule): string {
  if (capsule.trust === "signed-valid") {
    return `Signature valid · key ${capsule.fingerprint ?? ""}`.trim();
  }
  if (capsule.trust === "signed-invalid") {
    return "Signature did not verify";
  }
  return "Capsule was unsigned";
}

function FreeTierBanner() {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-[#2d3d12] bg-accent-soft/40">
      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-[0.15em] border border-[#2d3d12] bg-accent-soft text-accent shrink-0 mt-0.5">
        Free · local-first
      </span>
      <p className="text-[12px] text-foreground/85 leading-relaxed">
        Members, rules, shared sources, voice fingerprint snapshot, and the
        capsule export / import are all in the Free tier — nothing on this
        page is paywalled. Realtime multi-user sync across the lab is the{" "}
        <Link href="/pricing" className="text-accent underline underline-offset-2">
          Lab tier
        </Link>{" "}
        — it adds on top, it doesn&apos;t lock the local graph.
      </p>
    </div>
  );
}

function Block({
  icon,
  label,
  count,
  action,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="panel rounded-lg overflow-hidden">
      <header className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border bg-surface-2">
        <span className="size-6 rounded bg-accent-soft border border-[#2d3d12] flex items-center justify-center text-accent">
          {icon}
        </span>
        <span className="text-[12.5px] font-semibold text-foreground">
          {label}
        </span>
        {typeof count === "number" && (
          <span className="text-[10px] font-mono text-subtle">{count}</span>
        )}
        <div className="ml-auto">{action}</div>
      </header>
      <div className="p-3.5">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[12px] text-subtle border border-dashed border-border rounded p-3 leading-relaxed">
      {children}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] font-mono uppercase tracking-[0.15em] text-subtle mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}

function Toast({
  tone,
  children,
}: {
  tone: "ok" | "warn";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "text-[11px] px-2 py-1 rounded border inline-flex items-center gap-1.5",
        tone === "ok"
          ? "border-[#2d3d12] bg-accent-soft text-accent"
          : "border-warning/40 bg-warning/5 text-warning",
      )}
    >
      {tone === "ok" ? (
        <Check className="size-3" />
      ) : (
        <X className="size-3" />
      )}
      {children}
    </span>
  );
}

function CapsulePicker({
  onResult,
  onError,
  compact,
}: {
  onResult: (capsule: ImportedCapsule) => void;
  onError: (msg: string) => void;
  compact?: boolean;
}) {
  function pick() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.jsonld,.atlaslab-capsule.jsonld";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      try {
        const capsule = await readLabCapsule(f);
        onResult(capsule);
      } catch (e) {
        onError(e instanceof Error ? e.message : String(e));
      }
    };
    input.click();
  }
  if (compact) {
    return (
      <button onClick={pick} className="btn h-7 text-[11px]">
        <Upload className="size-3.5" />
        Import
      </button>
    );
  }
  return (
    <button
      onClick={pick}
      className="panel p-4 rounded-lg text-left hover:border-border-strong transition-colors"
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="size-7 rounded-md bg-accent-soft border border-[#2d3d12] flex items-center justify-center text-accent">
          <Upload className="size-3.5" />
        </span>
        <span className="text-[13px] font-semibold text-foreground">
          Import a lab capsule
        </span>
      </div>
      <p className="text-[12px] text-muted leading-relaxed">
        Got a <code className="font-mono text-foreground">.atlaslab-capsule.jsonld</code> from
        your advisor or a labmate? Drop it in and inherit the lab in one
        click.
      </p>
    </button>
  );
}
