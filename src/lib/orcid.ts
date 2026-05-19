/**
 * ORCID iD validation.
 *
 * The canonical form is 16 digits, dash-separated as XXXX-XXXX-XXXX-XXXX,
 * where the last character may be 'X' representing 10. The checksum is
 * ISO 7064 mod-11-2.
 *
 * https://support.orcid.org/hc/en-us/articles/360006897674-Structure-of-the-ORCID-Identifier
 */

const SHAPE = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;

export function isValidOrcid(raw: string): boolean {
  const s = raw.trim();
  if (!SHAPE.test(s)) return false;
  const digits = s.replace(/-/g, "");
  // mod-11-2 checksum: start with total = 0, multiply by 2 then add each digit.
  let total = 0;
  for (let i = 0; i < 15; i++) {
    total = (total + parseInt(digits[i], 10)) * 2;
  }
  const expected = (12 - (total % 11)) % 11;
  const provided = digits[15] === "X" ? 10 : parseInt(digits[15], 10);
  return expected === provided;
}

/** Normalize input: trim, strip an https://orcid.org/ prefix, accept either
 * dashed or undashed input and emit the canonical dashed form. */
export function normalizeOrcid(raw: string): string | null {
  let s = raw.trim();
  s = s.replace(/^https?:\/\/(?:www\.)?orcid\.org\//i, "");
  s = s.replace(/-/g, "");
  if (!/^\d{15}[\dX]$/.test(s)) return null;
  const dashed = `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}`;
  if (!isValidOrcid(dashed)) return null;
  return dashed;
}

export function orcidUrl(orcid: string): string {
  return `https://orcid.org/${orcid}`;
}
