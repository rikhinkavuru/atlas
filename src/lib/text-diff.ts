/**
 * Word-level diff via longest-common-subsequence, returning an ordered list
 * of segments tagged equal / inserted / deleted.
 *
 * Why word-level not character-level: academic prose diffs are almost always
 * word-boundary edits ("rewrite this sentence", "change tighten to compress").
 * Character-level diffs look noisy on prose — you get spurious matches like
 * sharing "the" letters between unrelated words. Word-level matches reviewer
 * intuition.
 *
 * We treat whitespace runs as their own tokens so the diff preserves spacing
 * and the reconstructed text is byte-identical to `b` when concatenated.
 */

export type DiffOp = "eq" | "del" | "ins";
export interface DiffSegment {
  op: DiffOp;
  text: string;
}

export function tokenize(text: string): string[] {
  // Split into [word, whitespace, word, whitespace, ...]. Punctuation rides
  // with its preceding word.
  const re = /(\s+|[^\s]+)/g;
  return text.match(re) ?? [];
}

export function diffText(a: string, b: string): DiffSegment[] {
  if (a === b) return a ? [{ op: "eq", text: a }] : [];
  if (!a) return b ? [{ op: "ins", text: b }] : [];
  if (!b) return [{ op: "del", text: a }];

  const A = tokenize(a);
  const B = tokenize(b);

  // Patience-style early termination for long-but-different inputs: an LCS
  // matrix is O(|A|·|B|). Anything over ~400 tokens degrades to a simpler
  // "del everything, ins everything" diff so the editor stays responsive.
  const SIZE_CAP = 400;
  if (A.length > SIZE_CAP || B.length > SIZE_CAP) {
    return coarse(A, B);
  }

  // LCS table — table[i][j] = length of LCS of A[..i], B[..j].
  const table: number[][] = Array.from({ length: A.length + 1 }, () =>
    new Array(B.length + 1).fill(0),
  );
  for (let i = 1; i <= A.length; i++) {
    for (let j = 1; j <= B.length; j++) {
      if (A[i - 1] === B[j - 1]) {
        table[i][j] = table[i - 1][j - 1] + 1;
      } else {
        table[i][j] = Math.max(table[i - 1][j], table[i][j - 1]);
      }
    }
  }

  // Backtrack from the corner to produce the ordered diff. We coalesce
  // runs of the same op so the consumer doesn't have to.
  const segs: DiffSegment[] = [];
  let i = A.length;
  let j = B.length;
  const push = (op: DiffOp, text: string) => {
    if (segs.length > 0 && segs[segs.length - 1].op === op) {
      segs[segs.length - 1].text += text;
    } else {
      segs.push({ op, text });
    }
  };
  // Backtrack builds the diff in reverse; we collect into `rev` then flip.
  const rev: DiffSegment[] = [];
  const pushRev = (op: DiffOp, text: string) => {
    if (rev.length > 0 && rev[rev.length - 1].op === op) {
      rev[rev.length - 1].text = text + rev[rev.length - 1].text;
    } else {
      rev.push({ op, text });
    }
  };
  while (i > 0 && j > 0) {
    if (A[i - 1] === B[j - 1]) {
      pushRev("eq", A[i - 1]);
      i--;
      j--;
    } else if (table[i - 1][j] >= table[i][j - 1]) {
      pushRev("del", A[i - 1]);
      i--;
    } else {
      pushRev("ins", B[j - 1]);
      j--;
    }
  }
  while (i > 0) {
    pushRev("del", A[i - 1]);
    i--;
  }
  while (j > 0) {
    pushRev("ins", B[j - 1]);
    j--;
  }
  for (let k = rev.length - 1; k >= 0; k--) {
    push(rev[k].op, rev[k].text);
  }
  return segs;
}

function coarse(A: string[], B: string[]): DiffSegment[] {
  // Find longest common prefix + suffix, treat the middle as one big swap.
  let pre = 0;
  const max = Math.min(A.length, B.length);
  while (pre < max && A[pre] === B[pre]) pre++;
  let suf = 0;
  while (
    suf < max - pre &&
    A[A.length - 1 - suf] === B[B.length - 1 - suf]
  )
    suf++;
  const out: DiffSegment[] = [];
  if (pre > 0) out.push({ op: "eq", text: A.slice(0, pre).join("") });
  const middleA = A.slice(pre, A.length - suf).join("");
  const middleB = B.slice(pre, B.length - suf).join("");
  if (middleA) out.push({ op: "del", text: middleA });
  if (middleB) out.push({ op: "ins", text: middleB });
  if (suf > 0) out.push({ op: "eq", text: A.slice(A.length - suf).join("") });
  return out;
}

/**
 * Render a diff as HTML suitable for the inline-diff animation. The output
 * uses `<span class="diff-eq">`, `<span class="diff-del">`, and `<span
 * class="diff-ins">` so CSS in globals.css can animate the transition.
 *
 * The HTML is wrapped in a single `<span class="diff-flash" data-flash-id="X">`
 * so the settle helper can target this specific flash even if a second
 * applyProposal lands before the first one settles.
 */
export function renderDiffHtml(segs: DiffSegment[], flashId: string): string {
  const inner = segs
    .map((s) => {
      const cls =
        s.op === "eq" ? "diff-eq" : s.op === "del" ? "diff-del" : "diff-ins";
      return `<span class="${cls}">${escapeHtml(s.text)}</span>`;
    })
    .join("");
  return `<span class="diff-flash" data-flash-id="${escapeAttr(flashId)}">${inner}</span>`;
}

/** Generate a short unique id for diff-flash tagging. */
export function newFlashId(): string {
  return (
    Math.random().toString(36).slice(2, 8) +
    Date.now().toString(36).slice(-4)
  );
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
