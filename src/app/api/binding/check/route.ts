import { NextRequest } from "next/server";
import {
  arxivIdFromUrl,
  detectBindingKind,
  githubBlobToRaw,
  isGithubBlob,
} from "@/lib/binding";

export const runtime = "nodejs";

interface Body {
  url: string;
  lastSeenHash?: string;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const url = (body.url ?? "").trim();
  if (!url) {
    return Response.json({ error: "no_url" }, { status: 400 });
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return Response.json({ error: "bad_url" }, { status: 400 });
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    return Response.json({ error: "unsupported_protocol" }, { status: 400 });
  }
  // Block local addresses (SSRF).
  if (
    parsed.hostname === "localhost" ||
    /^127\./.test(parsed.hostname) ||
    /^10\./.test(parsed.hostname) ||
    /^192\.168\./.test(parsed.hostname) ||
    /^172\.(1[6-9]|2[0-9]|3[01])\./.test(parsed.hostname)
  ) {
    return Response.json({ error: "blocked_host" }, { status: 400 });
  }

  const kind = detectBindingKind(url);

  try {
    if (kind === "github") {
      const result = await checkGithub(url, body.lastSeenHash);
      return Response.json(result);
    }
    if (kind === "arxiv") {
      const result = await checkArxiv(url, body.lastSeenHash);
      return Response.json(result);
    }
    if (kind === "wandb") {
      // W&B's public read API doesn't require auth for public runs but rate-limits;
      // we treat it like a generic URL probe + parse landing-page title.
      const result = await checkGeneric(url, body.lastSeenHash, "W&B run");
      return Response.json(result);
    }
    if (kind === "doi") {
      const target =
        url.startsWith("http") ? url : `https://doi.org/${url}`;
      const result = await checkDoi(target, body.lastSeenHash);
      return Response.json(result);
    }
    const result = await checkGeneric(url, body.lastSeenHash);
    return Response.json(result);
  } catch (err) {
    return Response.json({
      url,
      status: "unknown",
      lastCheckedAt: Date.now(),
      contentHash: body.lastSeenHash ?? null,
      metadata: {
        error: err instanceof Error ? err.message : String(err),
      },
    });
  }
}

async function sha256Hex(input: ArrayBuffer | string): Promise<string> {
  const buf =
    typeof input === "string" ? new TextEncoder().encode(input) : input;
  const digest = await globalThis.crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; AtlasBindingProbe/1.0; +https://atlas.example)",
        ...(init.headers ?? {}),
      },
      redirect: "follow",
    });
  } finally {
    clearTimeout(t);
  }
}

async function checkGithub(url: string, lastSeenHash?: string) {
  // Three flavours: blob (specific file), commit (specific sha), repo / tree.
  const blobMatch = url.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/,
  );
  const commitMatch = url.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/commit\/([0-9a-f]+)/i,
  );
  const repoMatch = url.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/?$/,
  );

  if (blobMatch) {
    const raw = githubBlobToRaw(url);
    if (!raw) throw new Error("Could not derive raw URL");
    const r = await fetchWithTimeout(raw);
    if (r.status === 404) {
      return missing(url);
    }
    if (!r.ok) throw new Error(`GitHub raw returned ${r.status}`);
    const buf = await r.arrayBuffer();
    const hash = await sha256Hex(buf);
    const [, owner, repo, ref, path] = blobMatch;
    return {
      url,
      status: lastSeenHash
        ? lastSeenHash === hash
          ? "fresh"
          : "stale"
        : "fresh",
      lastCheckedAt: Date.now(),
      contentHash: hash,
      metadata: {
        kind: "github-blob",
        title: `${owner}/${repo}@${ref.slice(0, 7)} · ${path.split("/").pop()}`,
        owner,
        repo,
        ref,
        path,
        size: buf.byteLength,
      },
    };
  }
  if (commitMatch) {
    const [, owner, repo, sha] = commitMatch;
    // Commit URL is immutable, so fresh as long as it exists.
    const r = await fetchWithTimeout(
      `https://api.github.com/repos/${owner}/${repo}/commits/${sha}`,
      {
        headers: { Accept: "application/vnd.github+json" },
      },
    );
    if (r.status === 404) return missing(url);
    if (!r.ok) throw new Error(`GitHub API returned ${r.status}`);
    const data = (await r.json()) as {
      sha?: string;
      commit?: { message?: string; author?: { date?: string } };
    };
    const hash = data.sha ?? sha;
    return {
      url,
      status: "fresh" as const,
      lastCheckedAt: Date.now(),
      contentHash: hash,
      metadata: {
        kind: "github-commit",
        title: data.commit?.message?.split("\n")[0]?.slice(0, 120) ?? sha,
        sha: data.sha,
        date: data.commit?.author?.date,
        owner,
        repo,
      },
    };
  }
  if (repoMatch) {
    const [, owner, repo] = repoMatch;
    const r = await fetchWithTimeout(
      `https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`,
      {
        headers: { Accept: "application/vnd.github+json" },
      },
    );
    if (r.status === 404) return missing(url);
    if (!r.ok) throw new Error(`GitHub API returned ${r.status}`);
    const arr = (await r.json()) as Array<{
      sha?: string;
      commit?: { author?: { date?: string }; message?: string };
    }>;
    const head = arr[0];
    const hash = head?.sha ?? "";
    return {
      url,
      status: lastSeenHash
        ? lastSeenHash === hash
          ? "fresh"
          : "stale"
        : "fresh",
      lastCheckedAt: Date.now(),
      contentHash: hash,
      metadata: {
        kind: "github-repo",
        title: `${owner}/${repo}`,
        headSha: hash,
        headDate: head?.commit?.author?.date,
        headMessage: head?.commit?.message?.split("\n")[0]?.slice(0, 120),
      },
    };
  }
  return checkGeneric(url, lastSeenHash, "GitHub");
}

async function checkArxiv(url: string, lastSeenHash?: string) {
  const id = arxivIdFromUrl(url);
  if (!id) return checkGeneric(url, lastSeenHash, "arXiv");
  const r = await fetchWithTimeout(
    `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(id)}`,
  );
  if (!r.ok) throw new Error(`arXiv API returned ${r.status}`);
  const xml = await r.text();
  const title =
    /<title>([\s\S]*?)<\/title>/i
      .exec(xml.split("<entry>")[1] ?? "")
      ?.[1]?.replace(/\s+/g, " ")
      .trim() ?? id;
  const updated =
    /<updated>([\s\S]*?)<\/updated>/i.exec(xml.split("<entry>")[1] ?? "")?.[1] ??
    "";
  const versionMatch = id.match(/v(\d+)$/);
  const hash = await sha256Hex(updated + id);
  return {
    url,
    status: lastSeenHash
      ? lastSeenHash === hash
        ? "fresh"
        : "stale"
      : "fresh",
    lastCheckedAt: Date.now(),
    contentHash: hash,
    metadata: {
      kind: "arxiv",
      title,
      arxivId: id,
      version: versionMatch ? `v${versionMatch[1]}` : undefined,
      updated,
    },
  };
}

async function checkDoi(url: string, lastSeenHash?: string) {
  const doi = url.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
  const r = await fetchWithTimeout(
    `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
  );
  if (r.status === 404) return missing(url);
  if (!r.ok) throw new Error(`CrossRef returned ${r.status}`);
  const data = (await r.json()) as { message?: any };
  const msg = data.message ?? {};
  const title = Array.isArray(msg.title) ? msg.title[0] : msg.title ?? doi;
  const updated = msg.deposited?.["date-time"] ?? msg.created?.["date-time"] ?? "";
  const hash = await sha256Hex(`${doi}|${updated}`);
  return {
    url,
    status: lastSeenHash
      ? lastSeenHash === hash
        ? "fresh"
        : "stale"
      : "fresh",
    lastCheckedAt: Date.now(),
    contentHash: hash,
    metadata: {
      kind: "doi",
      title,
      doi,
      updated,
    },
  };
}

async function checkGeneric(
  url: string,
  lastSeenHash: string | undefined,
  kindLabel = "URL",
) {
  const r = await fetchWithTimeout(url);
  if (r.status === 404) return missing(url);
  if (!r.ok) throw new Error(`Upstream returned ${r.status}`);
  const ct = r.headers.get("content-type") ?? "";
  // For HTML, hash a stripped version. For binary, hash the body.
  let hash = "";
  let title = url;
  if (/text\/html|application\/xhtml/.test(ct)) {
    const html = await r.text();
    const t = /<title>([\s\S]*?)<\/title>/i.exec(html);
    if (t?.[1]) title = t[1].trim().slice(0, 160);
    const stripped = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/\s+/g, " ")
      .slice(0, 32000);
    hash = await sha256Hex(stripped);
  } else {
    const buf = await r.arrayBuffer();
    hash = await sha256Hex(buf);
  }
  return {
    url,
    status: lastSeenHash
      ? lastSeenHash === hash
        ? "fresh"
        : "stale"
      : "fresh",
    lastCheckedAt: Date.now(),
    contentHash: hash,
    metadata: {
      kind: kindLabel.toLowerCase(),
      title,
      etag: r.headers.get("etag") ?? undefined,
      lastModified: r.headers.get("last-modified") ?? undefined,
    },
  };
}

function missing(url: string) {
  return {
    url,
    status: "missing" as const,
    lastCheckedAt: Date.now(),
    contentHash: null,
    metadata: { kind: "missing" },
  };
}
