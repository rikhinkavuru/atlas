// Static venue list mirrored from src/app/api/openreview/sample/route.ts so
// the client can render the venue picker without a round-trip. Keep in sync
// when adding/removing venues there.
export const OPENREVIEW_VENUES = [
  "ICLR 2024",
  "ICLR 2023",
  "ICLR 2022",
  "NeurIPS 2023",
  "NeurIPS 2022",
  "EMNLP 2023",
  "TMLR",
] as const;

export type OpenReviewVenueLabel = (typeof OPENREVIEW_VENUES)[number];
