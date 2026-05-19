import type { CitationCandidate } from "@/types";

/**
 * Bibliography formatter — converts CitationCandidate records into
 * standards-compliant reference entries in five formats:
 *
 *   APA       (American Psychological Association, 7th ed.)
 *   Chicago   (Author-date, 17th ed.)
 *   MLA       (Modern Language Association, 9th ed.)
 *   Vancouver (ICMJE / biomedical)
 *   IEEE      (numbered, used in CS/EE journals)
 *
 * We optimise for typesetting fidelity within the constraints of the
 * CitationCandidate schema. Fields we don't have (journal, pages, edition)
 * degrade gracefully — entries with insufficient data fall through to a
 * minimal "Author (Year). Title. URL." form rather than synthesising data.
 *
 * The formatters return plain strings; the export layer wraps them in HTML
 * or LaTeX as needed.
 */

export type BibliographyFormat = "apa" | "chicago" | "mla" | "vancouver" | "ieee";

export const BIB_FORMATS: { id: BibliographyFormat; label: string; example: string }[] =
  [
    {
      id: "apa",
      label: "APA 7",
      example:
        "Smith, J., & Doe, A. (2024). On long-context retrieval. Nature, 615(7951), 12–24.",
    },
    {
      id: "chicago",
      label: "Chicago (author-date)",
      example:
        "Smith, John, and Anna Doe. 2024. “On Long-Context Retrieval.” Nature 615 (7951): 12–24.",
    },
    {
      id: "mla",
      label: "MLA 9",
      example:
        "Smith, John, and Anna Doe. “On Long-Context Retrieval.” Nature, vol. 615, no. 7951, 2024, pp. 12–24.",
    },
    {
      id: "vancouver",
      label: "Vancouver",
      example:
        "Smith J, Doe A. On long-context retrieval. Nature. 2024;615(7951):12–24.",
    },
    {
      id: "ieee",
      label: "IEEE",
      example:
        "[1] J. Smith and A. Doe, “On long-context retrieval,” Nature, vol. 615, no. 7951, pp. 12–24, 2024.",
    },
  ];

/** Render one entry in the chosen format. Order in the list = display order. */
export function formatReference(
  c: CitationCandidate,
  fmt: BibliographyFormat,
  ordinal = 0,
): string {
  // Author-name normalisation: every author full string → "Last, F." or
  // "F. Last" depending on format. Authors come in as "Given Family" so we
  // split on the last space.
  const parsed = c.authors.map(parseAuthorName);
  const year = c.year != null ? String(c.year) : "n.d.";
  const title = c.title.trim().replace(/\s+/g, " ");
  const url = c.url || (c.doi ? `https://doi.org/${c.doi}` : "");
  switch (fmt) {
    case "apa":
      return apa(parsed, year, title, url, c.doi);
    case "chicago":
      return chicago(parsed, year, title, url);
    case "mla":
      return mla(parsed, year, title, url);
    case "vancouver":
      return vancouver(parsed, year, title, url, c.doi);
    case "ieee":
      return ieee(parsed, year, title, url, ordinal);
    default:
      return `${parsed.map((p) => `${p.given} ${p.family}`).join(", ")} (${year}). ${title}. ${url}`;
  }
}

/** Render a complete bibliography section (HTML) from a list of refs. */
export function formatBibliographyHtml(
  refs: CitationCandidate[],
  fmt: BibliographyFormat,
): string {
  if (refs.length === 0) {
    return `<h2>References</h2>\n<p><em>No references cited.</em></p>`;
  }
  // Author-date formats sort alphabetically by first author family; IEEE is
  // numbered in citation-order so we leave the input order alone.
  let sorted = refs;
  if (fmt !== "ieee") {
    sorted = [...refs].sort((a, b) => {
      const af = parseAuthorName(a.authors[0] ?? "").family.toLowerCase();
      const bf = parseAuthorName(b.authors[0] ?? "").family.toLowerCase();
      return af.localeCompare(bf);
    });
  }
  const items = sorted
    .map((r, i) => `<li>${escapeHtml(formatReference(r, fmt, i + 1))}</li>`)
    .join("\n");
  const tagOpen = fmt === "ieee" ? "<ol>" : "<ul>";
  const tagClose = fmt === "ieee" ? "</ol>" : "</ul>";
  return `<h2>References</h2>\n${tagOpen}\n${items}\n${tagClose}`;
}

// ───────────────────────────────────────────────────────────────────────────

interface ParsedAuthor {
  family: string;
  given: string;
  /** Initials only ("J. M.") — used by Vancouver / IEEE / APA. */
  initials: string;
}

function parseAuthorName(raw: string): ParsedAuthor {
  const s = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!s) return { family: "", given: "", initials: "" };
  // Already in "Last, First" form?
  if (s.includes(",")) {
    const [family, given = ""] = s.split(",").map((x) => x.trim());
    return { family, given, initials: toInitials(given) };
  }
  const parts = s.split(" ");
  if (parts.length === 1) {
    return { family: parts[0], given: "", initials: "" };
  }
  const family = parts[parts.length - 1];
  const given = parts.slice(0, -1).join(" ");
  return { family, given, initials: toInitials(given) };
}

function toInitials(given: string): string {
  return given
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => `${p[0]?.toUpperCase() ?? ""}.`)
    .join(" ");
}

function joinAndList(parts: string[], conj: "and" | "&"): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} ${conj} ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, ${conj} ${parts[parts.length - 1]}`;
}

// ───────────────────────────────────────────────────────────────────────────
// Format implementations

function apa(
  authors: ParsedAuthor[],
  year: string,
  title: string,
  url: string,
  doi: string | null,
): string {
  // APA 7: "Smith, J., & Doe, A. (2024). Title. https://doi.org/..."
  // Up to 20 authors listed; 21+ collapse with "..." + last author.
  const display = authors.slice(0, 20).map((a) =>
    a.family && a.initials ? `${a.family}, ${a.initials}` : (a.family || a.given),
  );
  const authorPart =
    authors.length > 20
      ? `${display.slice(0, 19).join(", ")}, ..., ${
          authors[authors.length - 1].family
        }, ${authors[authors.length - 1].initials}`
      : joinAndList(display, "&");
  const tail = doi ? `https://doi.org/${doi}` : url;
  return `${authorPart} (${year}). ${title}. ${tail}`.trim();
}

function chicago(
  authors: ParsedAuthor[],
  year: string,
  title: string,
  url: string,
): string {
  // Chicago author-date: first author "Last, First", subsequent authors "First Last".
  const formatted = authors.map((a, i) => {
    if (!a.family) return a.given;
    return i === 0 && a.given
      ? `${a.family}, ${a.given}`
      : a.given
        ? `${a.given} ${a.family}`
        : a.family;
  });
  const authorPart =
    formatted.length === 0 ? "Anonymous" : joinAndList(formatted, "and");
  return `${authorPart}. ${year}. “${title}.” ${url}`.trim();
}

function mla(
  authors: ParsedAuthor[],
  year: string,
  title: string,
  url: string,
): string {
  // MLA 9: "Smith, John, et al. "Title." Container, vol. X, no. Y, year, pp. Z."
  // We don't have container/vol/issue — degrade to a sensible minimal form.
  const head =
    authors.length === 0
      ? "Anonymous"
      : authors.length === 1
        ? `${authors[0].family}${authors[0].given ? ", " + authors[0].given : ""}`
        : authors.length === 2
          ? `${authors[0].family}${authors[0].given ? ", " + authors[0].given : ""}, and ${authors[1].given} ${authors[1].family}`
          : `${authors[0].family}${authors[0].given ? ", " + authors[0].given : ""}, et al.`;
  return `${head}. “${title}.” ${year}. ${url}`.trim();
}

function vancouver(
  authors: ParsedAuthor[],
  year: string,
  title: string,
  url: string,
  doi: string | null,
): string {
  // Vancouver: "Smith J, Doe A. Title. Year." Use initial-Last form, max 6 authors then "et al."
  const display = authors.slice(0, 6).map((a) =>
    a.initials
      ? `${a.family} ${a.initials.replace(/\.\s*/g, "").replace(/\./g, "")}`
      : a.family,
  );
  const tail = authors.length > 6 ? ", et al." : "";
  const ref = `${display.join(", ")}${tail}. ${title}. ${year}.`;
  return doi ? `${ref} doi: ${doi}` : url ? `${ref} ${url}` : ref;
}

function ieee(
  authors: ParsedAuthor[],
  year: string,
  title: string,
  url: string,
  ordinal: number,
): string {
  // IEEE: [n] J. Smith and A. Doe, "Title," year. URL
  const display = authors.map((a) =>
    a.initials && a.family
      ? `${a.initials} ${a.family}`
      : a.family || a.given || "Anonymous",
  );
  const authorPart =
    display.length === 0 ? "Anonymous" : joinAndList(display, "and");
  return `[${ordinal}] ${authorPart}, “${title},” ${year}. ${url}`.trim();
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
