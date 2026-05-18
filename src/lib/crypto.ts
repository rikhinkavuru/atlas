// ECDSA P-256 signing for the Provenance Ledger.
// Same code path runs in Node 20+ and modern browsers via Web Crypto.

const ALG = { name: "ECDSA", namedCurve: "P-256" } as const;
const SIGN_ALG = { name: "ECDSA", hash: "SHA-256" } as const;

export interface PublicKeyJwk {
  kty: "EC";
  crv: "P-256";
  x: string;
  y: string;
  ext?: boolean;
}

export interface PrivateKeyJwk extends PublicKeyJwk {
  d: string;
}

const KEY_STORAGE = "atlas:workspace-key";

function subtle(): SubtleCrypto {
  if (typeof globalThis === "undefined" || !globalThis.crypto?.subtle) {
    throw new Error("Web Crypto subtle API unavailable in this runtime.");
  }
  return globalThis.crypto.subtle;
}

export async function generateWorkspaceKey(): Promise<{
  privateKey: PrivateKeyJwk;
  publicKey: PublicKeyJwk;
}> {
  const pair = await subtle().generateKey(ALG, true, ["sign", "verify"]);
  const privateKey = (await subtle().exportKey(
    "jwk",
    pair.privateKey,
  )) as PrivateKeyJwk;
  const publicKey = (await subtle().exportKey(
    "jwk",
    pair.publicKey,
  )) as PublicKeyJwk;
  return { privateKey, publicKey };
}

export async function ensureWorkspaceKey(): Promise<{
  privateKey: PrivateKeyJwk;
  publicKey: PublicKeyJwk;
}> {
  if (typeof window === "undefined") {
    // Server side - generate ephemeral, not persisted
    return generateWorkspaceKey();
  }
  try {
    const raw = window.localStorage.getItem(KEY_STORAGE);
    if (raw) {
      const parsed = JSON.parse(raw) as {
        privateKey: PrivateKeyJwk;
        publicKey: PublicKeyJwk;
      };
      if (parsed?.privateKey?.d && parsed?.publicKey?.x) return parsed;
    }
  } catch {}
  const kp = await generateWorkspaceKey();
  try {
    window.localStorage.setItem(KEY_STORAGE, JSON.stringify(kp));
  } catch {}
  return kp;
}

export async function publicKeyFingerprint(jwk: PublicKeyJwk): Promise<string> {
  const canonical = JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y });
  const buf = await subtle().digest("SHA-256", new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

export async function signMessage(
  message: string,
  privateKey: PrivateKeyJwk,
): Promise<string> {
  const key = await subtle().importKey("jwk", privateKey, ALG, false, ["sign"]);
  const sig = await subtle().sign(
    SIGN_ALG,
    key,
    new TextEncoder().encode(message),
  );
  return bufToBase64(sig);
}

export async function verifySignature(
  message: string,
  signature: string,
  publicKey: PublicKeyJwk,
): Promise<boolean> {
  try {
    const key = await subtle().importKey(
      "jwk",
      publicKey as unknown as JsonWebKey,
      ALG,
      false,
      ["verify"],
    );
    const sigBuf = base64ToBuf(signature);
    return await subtle().verify(
      SIGN_ALG,
      key,
      sigBuf,
      new TextEncoder().encode(message),
    );
  } catch {
    return false;
  }
}

function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  if (typeof btoa === "function") return btoa(bin);
  return Buffer.from(bin, "binary").toString("base64");
}

function base64ToBuf(b64: string): ArrayBuffer {
  const bin =
    typeof atob === "function"
      ? atob(b64)
      : Buffer.from(b64, "base64").toString("binary");
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}
