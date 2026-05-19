import { NextRequest } from "next/server";

export const runtime = "nodejs";

/**
 * Fetch all Official_Review notes for a single OpenReview forum and return
 * them parsed into Atlas's ReviewerItem shape. The existing
 * /api/openreview/sample route already walks v1 + v2 fallbacks for listing
 * submissions; this one targets a single forum (an individual paper) and
 * returns the reviewer text the user wants to import into Reviewer Studio.
 *
 * Input: a forum identifier — either the raw OpenReview ID
 * ("xK3yz9aBcDe") OR a full URL ("https://openreview.net/forum?id=xK3..."),
 * extracted via parseForumId() in the parser below.
 *
 * Output: { ok, items: [{ id, number, reviewerLabel, comment, response,
 * status, linkedQuote? }], paperTitle, decision? }.
 *
 * We don't redistribute full reviewer text without the user pulling it in
 * explicitly — they're choosing to import these comments to draft their
 * response, which mirrors the original use of OpenReview (publicly readable
 * reviews). We attribute via the reviewerLabel field.
 */

interface PostBody {
  /** Forum id or URL. We extract the id either way. */
  forum: string;
}

export async function POST(req: NextRequest) {
  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return Response.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  const forumId = parseForumId(body.forum ?? "");
  if (!forumId) {
    return Response.json(
      {
        ok: false,
        error: "forum_invalid",
        message:
          "Provide an OpenReview forum URL (e.g. https://openreview.net/forum?id=xxx) or the bare forum id.",
      },
      { status: 400 },
    );
  }

  // Try v2 first (current OpenReview API), then fall back to v1.
  const v2 = await tryFetch(
    `https://api2.openreview.net/notes?forum=${encodeURIComponent(forumId)}&limit=200`,
    "v2",
  );
  const v1 = v2.notes.length > 0
    ? null
    : await tryFetch(
        `https://api.openreview.net/notes?forum=${encodeURIComponent(forumId)}&limit=200`,
        "v1",
      );
  const data = v2.notes.length > 0 ? v2 : v1!;
  if (!data || data.notes.length === 0) {
    return Response.json(
      {
        ok: false,
        error: "no_notes",
        message:
          "OpenReview returned no replies for that forum. The forum may be hidden, the id wrong, or rate-limited — try again or paste comments manually.",
      },
      { status: 404 },
    );
  }

  // Parse the head note (paper title) + every Official_Review reply.
  // The forum note IS the paper — its `id` equals the forum id. Replies
  // (reviews, decisions, rebuttals) point to the forum via `forum` but have
  // distinct ids. Filtering on `n.id === forumId` ensures we pick up the
  // paper's title, not (e.g.) the decision note's "Paper Decision" header.
  const forumNote = data.notes.find(
    (n) => n.id === forumId && n.content?.title,
  );
  const paperTitle = readString(forumNote?.content?.title) ?? "Untitled paper";

  const reviewInv = /Official_Review|Review$|Reviewer_/i;
  const decisionInv = /Decision|Meta_Review|Decision_Notification/i;
  let decision: string | undefined;
  const items: Array<{
    id: string;
    number: string;
    reviewerLabel: string;
    comment: string;
    response: string;
    status: "todo";
    linkedQuote?: string;
  }> = [];
  let reviewIdx = 0;

  for (const n of data.notes) {
    const invitations = invitationList(n);
    if (invitations.length === 0) continue;
    const inv = invitations.join(" ");
    const content = n.content ?? {};

    if (decisionInv.test(inv)) {
      const d = readString(content["decision"]) ?? readString(content["recommendation"]);
      if (d) decision = d;
      continue;
    }

    if (!reviewInv.test(inv)) continue;
    reviewIdx++;
    const reviewerLabel = deriveReviewer(n, invitations);
    const comment = buildReviewComment(content);
    if (!comment) continue;
    items.push({
      id: `r_${forumId}_${reviewIdx}`,
      number: `R${reviewIdx}`,
      reviewerLabel,
      comment,
      response: "",
      status: "todo",
    });
  }

  if (items.length === 0) {
    return Response.json(
      {
        ok: false,
        error: "no_reviews",
        message:
          "We found the forum but couldn't extract any Official_Review notes. Some venues hide reviews until accept-decisions are public.",
      },
      { status: 404 },
    );
  }

  return Response.json({
    ok: true,
    forum: forumId,
    paperTitle,
    decision,
    items,
    fetchedAt: Date.now(),
    apiVersion: data.apiVersion,
  });
}

// ───────────────────────────────────────────────────────────────────────────

interface OpenReviewNote {
  id?: string;
  forum?: string;
  content?: Record<string, unknown>;
  invitation?: string;
  invitations?: string[];
  signatures?: string[];
}

interface FetchResult {
  notes: OpenReviewNote[];
  apiVersion: "v1" | "v2";
}

async function tryFetch(url: string, apiVersion: "v1" | "v2"): Promise<FetchResult> {
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent":
          "Atlas/1.0 (https://github.com/rikhinkavuru/atlas; mailto:hello@paper-atlas.com)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) return { notes: [], apiVersion };
    const json = (await r.json()) as { notes?: OpenReviewNote[] };
    let notes = Array.isArray(json.notes) ? json.notes : [];
    if (apiVersion === "v2") {
      notes = notes.map((n) => ({
        ...n,
        content: unwrapV2Content(n.content),
      }));
    }
    return { notes, apiVersion };
  } catch {
    return { notes: [], apiVersion };
  }
}

function unwrapV2Content(
  content: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!content) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(content)) {
    if (v && typeof v === "object" && "value" in (v as Record<string, unknown>)) {
      out[k] = (v as { value: unknown }).value;
    } else {
      out[k] = v;
    }
  }
  return out;
}

function invitationList(n: OpenReviewNote): string[] {
  if (Array.isArray(n.invitations)) return n.invitations;
  if (n.invitation) return [n.invitation];
  return [];
}

function readString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function deriveReviewer(n: OpenReviewNote, invitations: string[]): string {
  // Prefer the "Reviewer_xyz" signature when present (most informative);
  // fall back to the invitation suffix; finally to "Reviewer".
  const sig = Array.isArray(n.signatures) ? n.signatures.join(" ") : "";
  const reviewerMatch = /Reviewer_[A-Za-z0-9]+/.exec(sig + " " + invitations.join(" "));
  if (reviewerMatch) return reviewerMatch[0].replace(/_/g, " ");
  return "Reviewer";
}

function buildReviewComment(
  content: Record<string, unknown>,
): string {
  // OpenReview review schemas differ across venues — typical fields include
  // summary, strengths, weaknesses, questions, soundness, presentation,
  // contribution, rating. We concatenate the human-readable narrative
  // fields, keeping a title for each so the reviewer studio can present a
  // structured comment instead of a wall of text.
  const sections: Array<[string, string]> = [];
  const pickStr = (key: string): string | null => {
    const v = content[key];
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };
  const sum = pickStr("summary");
  if (sum) sections.push(["Summary", sum]);
  const strengths = pickStr("strengths");
  if (strengths) sections.push(["Strengths", strengths]);
  const weaknesses =
    pickStr("weaknesses") ?? pickStr("weaknesses_and_limitations");
  if (weaknesses) sections.push(["Weaknesses", weaknesses]);
  const questions = pickStr("questions");
  if (questions) sections.push(["Questions", questions]);
  const review = pickStr("review");
  if (review && sections.length === 0) sections.push(["Review", review]);
  if (sections.length === 0) return "";
  return sections
    .map(([label, body]) => `**${label}.** ${body}`)
    .join("\n\n");
}

function parseForumId(input: string): string | null {
  const s = (input ?? "").trim();
  if (!s) return null;
  // URL form: https://openreview.net/forum?id=XYZ or pdf?id=XYZ
  const urlMatch = /[?&]id=([A-Za-z0-9_-]+)/.exec(s);
  if (urlMatch) return urlMatch[1];
  // Bare id form: alnum / dash / underscore, 6-32 chars
  if (/^[A-Za-z0-9_-]{6,32}$/.test(s)) return s;
  return null;
}
