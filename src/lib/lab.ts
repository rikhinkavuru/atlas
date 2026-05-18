"use client";

import type { VoiceProfile } from "./voice";
import { sha256, canonicalize } from "./provenance";
import {
  ensureWorkspaceKey,
  publicKeyFingerprint,
  signMessage,
  verifySignature,
  type PublicKeyJwk,
} from "./crypto";

export interface LabMember {
  id: string;
  name: string;
  role: string;
  joinedAt: number;
  voiceImported: boolean;
  voiceUpdatedAt?: number;
}

export type LabRuleCategory =
  | "voice"
  | "citation"
  | "structure"
  | "submission";

export interface LabRule {
  id: string;
  text: string;
  category: LabRuleCategory;
  addedAt: number;
}

export interface LabSharedSource {
  id: string;
  label: string;
  url: string;
  addedAt: number;
}

export interface Lab {
  id: string;
  name: string;
  pi?: string;
  members: LabMember[];
  rules: LabRule[];
  sharedSources: LabSharedSource[];
  voiceSnapshot?: VoiceProfile | null;
  createdAt: number;
  updatedAt: number;
}

export interface LabCapsuleSignature {
  rootHash: string;
  signature: string;
  publicKey: PublicKeyJwk;
  publicKeyFingerprint: string;
}

export interface LabCapsule {
  "@context": "https://atlas.example/schemas/lab-capsule/v1";
  "@type": "AtlasLabCapsule";
  version: 1;
  exportedAt: number;
  lab: Lab;
  /** ECDSA-P256 signature over canonicalised(lab) bound to the workspace key. */
  signature?: LabCapsuleSignature;
}

export interface ImportedCapsule {
  lab: Lab;
  trust: "signed-valid" | "signed-invalid" | "unsigned";
  fingerprint?: string;
}

export function emptyLab(name = "New Lab"): Lab {
  return {
    id: `lab_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`,
    name,
    pi: "",
    members: [],
    rules: [],
    sharedSources: [],
    voiceSnapshot: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export async function exportLabCapsule(lab: Lab): Promise<Blob> {
  const canon = canonicalize(lab);
  const rootHash = await sha256(canon);
  let signature: LabCapsuleSignature | undefined;
  try {
    const { privateKey, publicKey } = await ensureWorkspaceKey();
    const sig = await signMessage(rootHash, privateKey);
    const fp = await publicKeyFingerprint(publicKey);
    signature = {
      rootHash,
      signature: sig,
      publicKey,
      publicKeyFingerprint: fp,
    };
  } catch {
    // Older runtime — emit an unsigned capsule; importers see "unsigned" trust.
  }
  const capsule: LabCapsule = {
    "@context": "https://atlas.example/schemas/lab-capsule/v1",
    "@type": "AtlasLabCapsule",
    version: 1,
    exportedAt: Date.now(),
    lab,
    signature,
  };
  return new Blob([JSON.stringify(capsule, null, 2)], {
    type: "application/ld+json",
  });
}

export async function downloadLabCapsule(lab: Lab) {
  const blob = await exportLabCapsule(lab);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const slug =
    lab.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || "lab";
  a.download = `${slug}.atlaslab-capsule.jsonld`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function readLabCapsule(file: File): Promise<ImportedCapsule> {
  const text = await file.text();
  const parsed = JSON.parse(text) as Partial<LabCapsule> | Lab;
  const capsule = (parsed as LabCapsule).lab
    ? (parsed as LabCapsule)
    : ({
        "@context": "https://atlas.example/schemas/lab-capsule/v1",
        "@type": "AtlasLabCapsule",
        version: 1,
        exportedAt: Date.now(),
        lab: parsed as unknown as Lab,
      } as LabCapsule);
  const lab = capsule.lab;
  if (!lab?.id || !Array.isArray(lab.members)) {
    throw new Error(
      "Not a valid Atlas lab capsule. Expected { lab: { id, members, rules, … } }.",
    );
  }
  let trust: ImportedCapsule["trust"] = "unsigned";
  let fingerprint: string | undefined;
  if (capsule.signature) {
    try {
      const canon = canonicalize(lab);
      const rehash = await sha256(canon);
      if (rehash === capsule.signature.rootHash) {
        const ok = await verifySignature(
          rehash,
          capsule.signature.signature,
          capsule.signature.publicKey,
        );
        trust = ok ? "signed-valid" : "signed-invalid";
        fingerprint = capsule.signature.publicKeyFingerprint;
      } else {
        trust = "signed-invalid";
      }
    } catch {
      trust = "signed-invalid";
    }
  }
  return {
    lab: { ...lab, updatedAt: Date.now() },
    trust,
    fingerprint,
  };
}

export function mergeLab(current: Lab | null, incoming: Lab): Lab {
  if (!current) return incoming;
  const memberIds = new Set(current.members.map((m) => m.id));
  const newMembers = incoming.members.filter((m) => !memberIds.has(m.id));
  const ruleTexts = new Set(current.rules.map((r) => r.text.toLowerCase()));
  const newRules = incoming.rules.filter(
    (r) => !ruleTexts.has(r.text.toLowerCase()),
  );
  const sourceUrls = new Set(current.sharedSources.map((s) => s.url));
  const newSources = incoming.sharedSources.filter(
    (s) => !sourceUrls.has(s.url),
  );
  return {
    ...current,
    name: current.name === "New Lab" ? incoming.name : current.name,
    pi: current.pi || incoming.pi,
    members: [...current.members, ...newMembers],
    rules: [...current.rules, ...newRules],
    sharedSources: [...current.sharedSources, ...newSources],
    voiceSnapshot: current.voiceSnapshot ?? incoming.voiceSnapshot ?? null,
    updatedAt: Date.now(),
  };
}

export function fingerprintVoice(profile: VoiceProfile | null): string {
  if (!profile) return "";
  // Light fingerprint summary that's safe to include with member records.
  return [
    `len:${profile.avgSentenceLength}`,
    `hedge:${profile.hedgeRate}`,
    `passive:${profile.passiveRate}`,
    `vocab:${profile.jargonVocab.slice(0, 4).join("|")}`,
  ].join(";");
}
