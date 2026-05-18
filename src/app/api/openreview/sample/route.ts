import { NextRequest } from "next/server";

export const runtime = "nodejs";

/**
 * Public-metadata probe against OpenReview. We list a handful of public
 * submissions, then for each forum we walk its replies to count review
 * notes + average the rating field. We return ONLY metadata + a link out
 * — no reviewer text is republished.
 *
 * OpenReview's API shifted from v1 (api.openreview.net) to v2
 * (api2.openreview.net) around ICLR 2024. We try both for each venue so
 * the page works whether the underlying archive lives on v1 or v2.
 */

interface ReviewerSample {
  forumId: string;
  title: string;
  authors: string[];
  abstractSnippet: string;
  venue: string;
  decision?: string;
  reviewCount: number;
  averageRating?: number;
  ratingScale?: string;
  forumUrl: string;
}

interface VenueDef {
  label: string;
  /** Tried first (API v1). */
  v1Invitations: string[];
  /** Tried next (API v2 venueid filter). */
  v2VenueId?: string;
  ratingScale: string;
}

const VENUES: VenueDef[] = [
  {
    label: "ICLR 2023",
    v1Invitations: ["ICLR.cc/2023/Conference/-/Blind_Submission"],
    ratingScale: "1–10",
  },
  {
    label: "ICLR 2022",
    v1Invitations: ["ICLR.cc/2022/Conference/-/Blind_Submission"],
    ratingScale: "1–10",
  },
  {
    label: "ICLR 2024",
    v1Invitations: ["ICLR.cc/2024/Conference/-/Submission"],
    v2VenueId: "ICLR.cc/2024/Conference",
    ratingScale: "1–10",
  },
];

export async function GET(req: NextRequest) {
  const limit = Math.min(
    8,
    Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") ?? "4", 10)),
  );
  const venueParam = req.nextUrl.searchParams.get("venue");
  const venue =
    VENUES.find((v) => v.label === venueParam) ?? VENUES[0];

  try {
    const notes = await listNotes(venue, limit);
    if (notes.length === 0) {
      return Response.json({
        ok: false,
        venue: venue.label,
        error: "no_notes",
        message:
          "OpenReview returned no submissions for this venue. The public archive can be rate-limited; try again or pick a different venue.",
        samples: [],
      });
    }
    const samples: ReviewerSample[] = [];
    for (const n of notes) {
      const forumId = n.id ?? n.forum ?? "";
      if (!forumId) continue;
      const content = n.content ?? {};
      const title = readString(content.title) ?? "Untitled";
      const authors = normaliseAuthors(content.authors);
      const abs = (readString(content.abstract) ?? "").trim();
      const abstractSnippet =
        abs.length > 220
          ? abs.slice(0, 220).replace(/\s+\S*$/, "") + "…"
          : abs;
      const replies = await fetchReplies(forumId, n.apiVersion);
      const { reviewCount, averageRating, decision } = analyseReplies(replies);
      samples.push({
        forumId,
        title: title.slice(0, 160),
        authors: authors.slice(0, 6),
        abstractSnippet,
        venue: venue.label,
        decision,
        reviewCount,
        averageRating,
        ratingScale: averageRating !== undefined ? venue.ratingScale : undefined,
        forumUrl: `https://openreview.net/forum?id=${encodeURIComponent(forumId)}`,
      });
    }
    return Response.json({
      ok: true,
      venue: venue.label,
      fetchedAt: Date.now(),
      samples,
    });
  } catch (err) {
    return Response.json({
      ok: false,
      venue: venue.label,
      error: "network",
      message: err instanceof Error ? err.message : String(err),
      samples: [],
    });
  }
}

interface OpenReviewNote {
  id?: string;
  forum?: string;
  content?: Record<string, unknown>;
  apiVersion?: "v1" | "v2";
}

async function listNotes(
  venue: VenueDef,
  limit: number,
): Promise<OpenReviewNote[]> {
  // Try v1 invitations first.
  for (const inv of venue.v1Invitations) {
    const r = await fetchJson(
      `https://api.openreview.net/notes?invitation=${encodeURIComponent(
        inv,
      )}&limit=${limit}&offset=0`,
    );
    if (r && Array.isArray(r.notes) && r.notes.length > 0) {
      return r.notes.map((n: OpenReviewNote) => ({ ...n, apiVersion: "v1" }));
    }
  }
  // Fall back to v2 venueid filter.
  if (venue.v2VenueId) {
    const r = await fetchJson(
      `https://api2.openreview.net/notes?content.venueid=${encodeURIComponent(
        venue.v2VenueId,
      )}&limit=${limit}`,
    );
    if (r && Array.isArray(r.notes) && r.notes.length > 0) {
      // v2 wraps fields under content[field].value
      return r.notes.map((n: OpenReviewNote) => ({
        ...n,
        content: unwrapV2Content(n.content),
        apiVersion: "v2",
      }));
    }
  }
  return [];
}

async function fetchReplies(
  forumId: string,
  apiVersion: "v1" | "v2" | undefined,
): Promise<OpenReviewNote[]> {
  const url =
    apiVersion === "v2"
      ? `https://api2.openreview.net/notes?forum=${encodeURIComponent(forumId)}&limit=200`
      : `https://api.openreview.net/notes?forum=${encodeURIComponent(forumId)}&limit=200`;
  const r = await fetchJson(url);
  if (!r || !Array.isArray(r.notes)) return [];
  if (apiVersion === "v2") {
    return r.notes.map((n: OpenReviewNote) => ({
      ...n,
      content: unwrapV2Content(n.content),
    }));
  }
  return r.notes;
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

function readString(v: unknown): string | null {
  if (typeof v === "string") return v;
  return null;
}

function normaliseAuthors(authors: unknown): string[] {
  if (Array.isArray(authors))
    return authors
      .map((a) => (typeof a === "string" ? a : String(a ?? "")))
      .filter(Boolean);
  if (typeof authors === "string") return authors.split(/,\s*/);
  return [];
}

async function fetchJson(url: string): Promise<any | null> {
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; AtlasReviewerProbe/1.0; +https://atlas.example)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(11000),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

function analyseReplies(replies: OpenReviewNote[]): {
  reviewCount: number;
  averageRating?: number;
  decision?: string;
} {
  const reviewInv = /Official_Review|Review$|Reviewer_/i;
  const decisionInv = /Decision|Meta_Review|Decision_Notification/i;
  let reviewCount = 0;
  let ratingSum = 0;
  let ratingN = 0;
  let decision: string | undefined;

  for (const r of replies) {
    const invitations: string[] = Array.isArray((r as any).invitations)
      ? ((r as any).invitations as string[])
      : (r as any).invitation
        ? [(r as any).invitation as string]
        : [];
    if (invitations.length === 0) continue;
    const inv = invitations.join(" ");
    const content = r.content ?? {};
    if (decisionInv.test(inv)) {
      const d = content["decision"] ?? content["recommendation"];
      if (typeof d === "string") decision = d;
    }
    if (reviewInv.test(inv)) {
      reviewCount++;
      const rating = content["rating"] ?? content["overall_rating"];
      if (typeof rating === "string") {
        const num = parseFloat(rating);
        if (Number.isFinite(num)) {
          ratingSum += num;
          ratingN++;
        }
      } else if (typeof rating === "number") {
        ratingSum += rating;
        ratingN++;
      }
    }
  }
  return {
    reviewCount,
    averageRating: ratingN > 0 ? ratingSum / ratingN : undefined,
    decision,
  };
}
