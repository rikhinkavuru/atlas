import type {
  AuthorshipAuthor,
  AuthorshipBreakdown,
  DisclosureTemplate,
} from "./authorship";
import { pct } from "./authorship";

/**
 * Pre-baked AI-use disclosure text for major venues. The exact wording
 * required by each venue evolves; these are written to satisfy the spirit
 * of the policy (be specific, name the tool, name the categories of use)
 * rather than to be lifted verbatim. Authors should still review.
 *
 * Sources for the policy framing:
 *  - NeurIPS 2024 LLM policy: authors disclose use of LLMs in writing.
 *  - Nature: AI tools cannot be listed as authors; must be disclosed in
 *    methods or acknowledgements.
 *  - ACL 2023: AI assistance must be disclosed in a "Use of Generative AI"
 *    section in the limitations or appendix.
 *  - ICML 2023+: LLM disclosure required when used beyond standard editing.
 *
 * The function takes the *attestation inputs* rather than the finalised
 * attestation so it can be called BEFORE signing (the signature commits
 * to the disclosure text — circular if we needed the attestation to
 * render it).
 */

interface RenderArgs {
  paperTitle: string;
  author: AuthorshipAuthor;
  coAuthors: AuthorshipAuthor[];
  breakdown: AuthorshipBreakdown;
  totalChars: number;
  /** Whatever value the workspace records as the attestation share URL.
   *  Passed in so the disclosure body can reference it. */
  shareUrl?: string;
  atlasVersion: string;
}

function authorList(args: RenderArgs): string {
  const all = [args.author, ...args.coAuthors].map((a) => {
    if (a.orcid) return `${a.name} (ORCID: ${a.orcid})`;
    return a.name;
  });
  if (all.length === 1) return all[0];
  if (all.length === 2) return `${all[0]} and ${all[1]}`;
  return `${all.slice(0, -1).join(", ")}, and ${all[all.length - 1]}`;
}

function aiPercent(breakdown: AuthorshipBreakdown): string {
  return pct(breakdown.aiSourced + breakdown.aiUnsourced);
}

function citeShareUrl(url: string | undefined): string {
  if (!url) return "";
  return `\n\nA verifiable Atlas authorship attestation accompanies this submission: ${url}. The attestation is signed and includes the underlying provenance ledger root hash, so any reviewer can independently audit the numbers above.`;
}

const RENDERERS: Record<
  DisclosureTemplate,
  (args: RenderArgs) => string
> = {
  neurips: (args) =>
    `**Use of Large Language Models (NeurIPS policy)**

We disclose the use of an LLM-assisted writing tool (Atlas, atlas-version ${args.atlasVersion}) in the preparation of this manuscript. ${authorList(args)} retained final authorship and responsibility for all content.

Across the manuscript, ${pct(args.breakdown.author)} of textual content was authored directly by the human authors, ${pct(args.breakdown.aiSourced)} was AI-assisted with verified citations, ${pct(args.breakdown.aiUnsourced)} was AI-assisted without specific source citations (typical rewrites, copy-edits, restructuring), and ${pct(args.breakdown.imported)} was imported from prior drafts or related materials. LLM assistance was used for editing, restructuring, and citation suggestion — not for generating novel scientific claims, results, or data interpretations.${citeShareUrl(args.shareUrl)}`,

  nature: (args) =>
    `**AI assistance disclosure (Nature)**

This manuscript was prepared with assistance from a large language model (LLM) integrated into the Atlas writing platform (version ${args.atlasVersion}). Per Nature's editorial policy, ${authorList(args)} take full responsibility for the integrity of the work. The LLM is not listed as an author.

Breakdown of AI involvement, derived from a per-edit signed provenance ledger:
- Human-authored: ${pct(args.breakdown.author)}
- AI-assisted with citations: ${pct(args.breakdown.aiSourced)}
- AI-assisted without specific citations (editing / structural rewrites): ${pct(args.breakdown.aiUnsourced)}
- Imported from prior materials: ${pct(args.breakdown.imported)}

The LLM was used for prose editing, structural suggestions, and citation surfacing. It was not used to generate, interpret, or verify experimental data, statistical analyses, or core scientific claims.${citeShareUrl(args.shareUrl)}`,

  acl: (args) =>
    `**Use of Generative AI (ACL policy)**

In line with the ACL policy on AI assistance, we disclose that this paper was drafted with help from Atlas (version ${args.atlasVersion}), a writing platform that integrates a large language model via a per-edit provenance ledger. The breakdown of AI involvement is:

| Category | Share |
|---|---|
| Human authorship | ${pct(args.breakdown.author)} |
| AI-assisted text with citation sources | ${pct(args.breakdown.aiSourced)} |
| AI-assisted text without citation sources (editing / rewrites) | ${pct(args.breakdown.aiUnsourced)} |
| Imported / reused text | ${pct(args.breakdown.imported)} |

AI was used for paraphrasing, editing, restructuring, and surfacing related citations. All scientific claims, experimental design, statistical analyses, results, and interpretations are the authors' own. ${authorList(args)} take full responsibility for the manuscript.${citeShareUrl(args.shareUrl)}`,

  icml: (args) =>
    `**LLM Use Statement (ICML policy)**

We used a large language model integrated into the Atlas writing tool (version ${args.atlasVersion}) for editing, restructuring, and citation discovery while preparing this manuscript. The LLM was not used to generate novel research ideas, design experiments, perform analyses, or interpret results.

Per Atlas's per-edit provenance ledger, ${aiPercent(args.breakdown)} of the final text was produced with LLM assistance (of which ${pct(args.breakdown.aiSourced)} carried verified citations and ${pct(args.breakdown.aiUnsourced)} consisted of rewrites or copy-edits without per-claim sources). The remaining ${pct(args.breakdown.author)} was authored directly by ${authorList(args)}, with ${pct(args.breakdown.imported)} imported from prior drafts.${citeShareUrl(args.shareUrl)}`,

  generic: (args) =>
    `**AI Assistance Disclosure**

This manuscript was prepared with the assistance of a large language model integrated into the Atlas writing platform (version ${args.atlasVersion}). Per the venue's AI-disclosure requirements, ${authorList(args)} take full responsibility for the content. Approximate breakdown, derived from a signed per-edit provenance ledger:

- Human-authored: ${pct(args.breakdown.author)}
- AI-assisted with cited sources: ${pct(args.breakdown.aiSourced)}
- AI-assisted without per-claim sources (editing, rewrites): ${pct(args.breakdown.aiUnsourced)}
- Imported from prior materials: ${pct(args.breakdown.imported)}

AI assistance was confined to prose editing, restructuring, and citation surfacing. Scientific claims, experimental results, and analyses are entirely the authors' own work.${citeShareUrl(args.shareUrl)}`,
};

export function renderDisclosure(
  template: DisclosureTemplate,
  args: RenderArgs,
): string {
  return RENDERERS[template](args);
}

export const TEMPLATE_LABELS: Record<DisclosureTemplate, string> = {
  neurips: "NeurIPS · LLM use policy",
  nature: "Nature · AI tools disclosure",
  acl: "ACL · Generative AI section",
  icml: "ICML · LLM use statement",
  generic: "Generic — adapt to venue",
};

export const TEMPLATE_ORDER: DisclosureTemplate[] = [
  "neurips",
  "nature",
  "acl",
  "icml",
  "generic",
];
