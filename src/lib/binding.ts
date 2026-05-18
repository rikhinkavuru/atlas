import type { BindingKind, DataBinding } from "@/types";

export function detectBindingKind(url: string): BindingKind {
  const u = url.trim().toLowerCase();
  if (/wandb\.ai\/.+\/runs\//.test(u) || /wandb\.ai/.test(u)) return "wandb";
  if (/github\.com\//.test(u)) return "github";
  if (/arxiv\.org\/(abs|pdf)\//.test(u)) return "arxiv";
  if (
    /colab\.research\.google\.com/.test(u) ||
    /\.ipynb($|\?|#)/.test(u) ||
    /jupyter\.org/.test(u)
  ) {
    return "jupyter";
  }
  // DOI only when it appears as a real URL or a strict CrossRef-style ID with
  // a registrant + slash. "10.5_update.txt" no longer matches.
  if (
    /^https?:\/\/(dx\.)?doi\.org\/10\.\d{4,9}\/[\w./\-:()<>;]+/.test(u) ||
    /^10\.\d{4,9}\/\S+$/.test(u)
  ) {
    return "doi";
  }
  return "url";
}

export function bindingKindLabel(k: BindingKind): string {
  switch (k) {
    case "wandb":
      return "W&B run";
    case "github":
      return "GitHub";
    case "arxiv":
      return "arXiv";
    case "jupyter":
      return "Jupyter";
    case "doi":
      return "DOI";
    default:
      return "URL";
  }
}

export function isGithubBlob(url: string): boolean {
  return /github\.com\/[^/]+\/[^/]+\/blob\//.test(url);
}

/** Convert a GitHub blob URL into a raw-content URL for hashing. */
export function githubBlobToRaw(url: string): string | null {
  const m = url.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/,
  );
  if (!m) return null;
  const [, owner, repo, ref, path] = m;
  return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`;
}

/** Extract the arXiv identifier from an arXiv URL (e.g. 2310.06825 or 2310.06825v3). */
export function arxivIdFromUrl(url: string): string | null {
  const m = url.match(/arxiv\.org\/(?:abs|pdf)\/([^/?#]+)/i);
  return m ? m[1].replace(/\.pdf$/i, "") : null;
}

export function createBinding(input: {
  paperId: string;
  passage: string;
  url: string;
  notes?: string;
}): DataBinding {
  const url = input.url.trim();
  return {
    id: `bind_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    paperId: input.paperId,
    passage: input.passage.slice(0, 360),
    url,
    kind: detectBindingKind(url),
    createdAt: Date.now(),
    status: "unknown",
    notes: input.notes,
  };
}
