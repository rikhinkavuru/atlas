export interface VoiceProfile {
  // Raw user-pasted samples (truncated for storage)
  samples: string[];
  // Derived stats
  avgSentenceLength: number;
  medianSentenceLength: number;
  hedgeRate: number; // 0..1
  passiveRate: number;
  citationDensityPer1k: number;
  jargonVocab: string[];
  characteristicBigrams: string[];
  preferredHedges: string[];
  preferredConnectives: string[];
  updatedAt: number;
}

const HEDGES = [
  "may", "might", "could", "perhaps", "likely", "suggests", "appears",
  "we hypothesise", "we hypothesize", "we conjecture", "we argue",
  "to our knowledge", "in our view", "we believe", "we observe",
];

const CONNECTIVES = [
  "however", "moreover", "in contrast", "specifically", "in particular",
  "by contrast", "in addition", "furthermore", "consequently",
  "therefore", "in turn", "as a result",
];

const STOPWORDS = new Set([
  "the", "a", "an", "of", "and", "or", "but", "in", "on", "at", "to",
  "from", "by", "for", "with", "as", "is", "are", "was", "were", "be",
  "been", "being", "this", "that", "these", "those", "we", "our", "us",
  "i", "you", "they", "them", "it", "its", "his", "her", "their", "have",
  "has", "had", "do", "does", "did", "not", "no", "so", "if", "then",
  "than", "which", "who", "whom", "whose", "where", "when", "while",
  "also", "such", "into", "over", "under", "above", "below", "between",
  "among", "during", "after", "before", "very", "more", "most", "less",
  "few", "many", "all", "any", "some", "each", "every", "other",
  "another", "same", "only", "own", "about", "against", "without",
]);

export function computeVoiceProfile(samples: string[]): VoiceProfile {
  const clean = samples
    .map((s) => stripHtml(s).trim())
    .filter((s) => s.length > 50);
  const joined = clean.join("\n\n");
  const sentences = joined
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const wordsPerSentence = sentences.map((s) => s.split(/\s+/).length);
  const avg = mean(wordsPerSentence);
  const med = median(wordsPerSentence);

  const lower = joined.toLowerCase();
  const totalWords = lower.split(/\s+/).filter(Boolean).length || 1;

  const hedgeHits = HEDGES.filter((h) =>
    new RegExp(`\\b${escapeRegex(h)}\\b`, "i").test(lower),
  );
  const preferredHedges = HEDGES.filter((h) =>
    countMatches(lower, new RegExp(`\\b${escapeRegex(h)}\\b`, "gi")) >= 2,
  );
  const hedgeTotal = HEDGES.reduce(
    (acc, h) =>
      acc + countMatches(lower, new RegExp(`\\b${escapeRegex(h)}\\b`, "gi")),
    0,
  );

  const preferredConnectives = CONNECTIVES.filter((c) =>
    countMatches(lower, new RegExp(`\\b${escapeRegex(c)}\\b`, "gi")) >= 2,
  );

  const passive = countMatches(
    lower,
    /\b(?:was|were|is|are|been|being)\s+\w+ed\b/gi,
  );

  const citationHits = countMatches(joined, /\b\w+\s+et\s+al\.|\[\d+\]/g);

  const tokens = lower
    .replace(/[^a-z0-9 -]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 4 && !STOPWORDS.has(t));
  const freq = new Map<string, number>();
  for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1);
  const jargon = [...freq.entries()]
    .filter(([t]) => /^[a-z][a-z-]+$/i.test(t))
    .filter(([, c]) => c >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 18)
    .map(([t]) => t);

  // Bigrams (excluding stopword-only pairs)
  const bigramFreq = new Map<string, number>();
  for (let i = 0; i < tokens.length - 1; i++) {
    const a = tokens[i];
    const b = tokens[i + 1];
    if (a === b) continue;
    const key = `${a} ${b}`;
    bigramFreq.set(key, (bigramFreq.get(key) ?? 0) + 1);
  }
  const characteristicBigrams = [...bigramFreq.entries()]
    .filter(([, c]) => c >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([k]) => k);

  return {
    samples: clean.map((s) => s.slice(0, 6000)),
    avgSentenceLength: round(avg, 1),
    medianSentenceLength: round(med, 1),
    hedgeRate: round(hedgeTotal / totalWords, 4),
    passiveRate: round(passive / Math.max(sentences.length, 1), 3),
    citationDensityPer1k: round((citationHits / totalWords) * 1000, 2),
    jargonVocab: jargon,
    characteristicBigrams,
    preferredHedges:
      preferredHedges.length > 0 ? preferredHedges : hedgeHits.slice(0, 6),
    preferredConnectives,
    updatedAt: Date.now(),
  };
}

export function formatVoiceForPrompt(p: VoiceProfile | null): string {
  if (!p || p.samples.length === 0) return "";
  return [
    "# Author voice profile (match this style in every rewrite)",
    `- Average sentence length: ${p.avgSentenceLength} words (median ${p.medianSentenceLength}). Match this — do not produce noticeably longer or shorter sentences.`,
    `- Hedge rate: ${(p.hedgeRate * 100).toFixed(2)}% of words. ${
      p.preferredHedges.length
        ? `Preferred hedges: ${p.preferredHedges.slice(0, 6).join(", ")}.`
        : "Use modest hedging."
    }`,
    `- Passive constructions per sentence: ${p.passiveRate}. Stay near this ratio.`,
    `- Citation density per 1k words: ${p.citationDensityPer1k}.`,
    p.preferredConnectives.length
      ? `- Preferred connectives the author uses repeatedly: ${p.preferredConnectives.slice(0, 6).join(", ")}.`
      : "",
    p.jargonVocab.length
      ? `- Vocabulary the author uses (keep these, do NOT replace with synonyms): ${p.jargonVocab.slice(0, 12).join(", ")}.`
      : "",
    p.characteristicBigrams.length
      ? `- Characteristic phrases (re-use when natural): ${p.characteristicBigrams.slice(0, 6).join(" / ")}.`
      : "",
    "Hard rule: do not introduce generic AI-default phrasing such as 'in conclusion', 'it is important to note', 'delve into', 'leverage', 'in today's fast-paced world'. If the author does not use a phrase, do not introduce it.",
  ]
    .filter(Boolean)
    .join("\n");
}

function stripHtml(s: string) {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function mean(xs: number[]) {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function median(xs: number[]) {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function round(n: number, d: number) {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}

function countMatches(s: string, re: RegExp) {
  return (s.match(re) ?? []).length;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
