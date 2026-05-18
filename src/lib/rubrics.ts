export type VenueId =
  | "generic"
  | "neurips"
  | "iclr"
  | "acl"
  | "nature"
  | "jama"
  | "cell"
  | "thesis";

export interface Rubric {
  id: VenueId;
  name: string;
  audience: string;
  dimensions: RubricDimension[];
}

export interface RubricDimension {
  name: string;
  weight: number;
  criteria: string[];
}

export const VENUE_PRESETS: Record<VenueId, Rubric> = {
  generic: {
    id: "generic",
    name: "Generic academic",
    audience: "broad academic readership",
    dimensions: [
      {
        name: "Clarity",
        weight: 1,
        criteria: [
          "Sentences are direct and avoid filler ('in order to', 'utilize', 'very').",
          "Jargon is defined the first time it appears.",
          "Each paragraph has a single, identifiable claim.",
        ],
      },
      {
        name: "Structure",
        weight: 1,
        criteria: [
          "There is an abstract, introduction, methods/approach, results/evaluation, discussion, limitations, conclusion.",
          "Section order matches the reader's expected information flow.",
          "Headings are informative, not generic.",
        ],
      },
      {
        name: "Rigor",
        weight: 1,
        criteria: [
          "Every quantitative claim is sourced or accompanied by uncertainty.",
          "Baselines and ablations are present where the method demands them.",
          "Failure modes and threats to validity are named explicitly.",
        ],
      },
      {
        name: "Novelty",
        weight: 1,
        criteria: [
          "Contributions are listed and each is distinguishable from prior work.",
          "Related-work paragraph explains what is different, not only similar.",
        ],
      },
      {
        name: "Citations",
        weight: 1,
        criteria: [
          "Non-trivial claims are cited.",
          "Citations are canonical (authors and year identifiable).",
          "No obvious omissions of must-cite references in the topic.",
        ],
      },
    ],
  },
  neurips: {
    id: "neurips",
    name: "NeurIPS / ICML (ML)",
    audience: "ML reviewers at top conferences",
    dimensions: [
      {
        name: "Clarity",
        weight: 0.8,
        criteria: [
          "Mathematical notation is consistent and defined.",
          "Figures are self-contained with full captions.",
          "The contribution paragraph in the intro is itemised.",
        ],
      },
      {
        name: "Soundness",
        weight: 1.2,
        criteria: [
          "Experimental setup specifies seeds, hardware, hyper-parameters, dataset versions.",
          "Multiple baselines are compared on the same protocol.",
          "Error bars / confidence intervals reported for headline numbers.",
        ],
      },
      {
        name: "Significance",
        weight: 1.0,
        criteria: [
          "Headline result is not within noise of prior best.",
          "Generalisation beyond the specific benchmark is discussed.",
        ],
      },
      {
        name: "Novelty",
        weight: 1.0,
        criteria: [
          "Distinct from concurrent / prior submissions on the same idea.",
          "Mechanism for the improvement is explained, not just observed.",
        ],
      },
      {
        name: "Reproducibility",
        weight: 1.0,
        criteria: [
          "Code / data release plan is stated.",
          "Algorithm box or pseudocode for the method.",
          "Compute budget reported.",
        ],
      },
      {
        name: "Citations",
        weight: 0.8,
        criteria: [
          "Recent (≤24 months) related work is engaged with.",
          "Foundational references are cited.",
        ],
      },
      {
        name: "Broader impact",
        weight: 0.6,
        criteria: [
          "Limitations section is honest, not boilerplate.",
          "Foreseeable misuse or fairness concerns acknowledged.",
        ],
      },
    ],
  },
  iclr: {
    id: "iclr",
    name: "ICLR (representation learning)",
    audience: "ICLR reviewers",
    dimensions: [
      {
        name: "Clarity",
        weight: 0.8,
        criteria: ["Notation tight; figures self-explanatory."],
      },
      {
        name: "Technical novelty",
        weight: 1.2,
        criteria: [
          "Idea is non-obvious given the cited prior art.",
          "Connections to representation-learning theory are made where relevant.",
        ],
      },
      {
        name: "Empirical strength",
        weight: 1.1,
        criteria: [
          "Multiple datasets / scales reported.",
          "Comparisons span methods and architectures, not only one family.",
        ],
      },
      {
        name: "Analysis depth",
        weight: 1.0,
        criteria: [
          "Ablations isolate the contribution.",
          "Qualitative examples or visualisations included.",
        ],
      },
      {
        name: "Reproducibility",
        weight: 0.9,
        criteria: ["Code + checkpoints commitment."],
      },
    ],
  },
  acl: {
    id: "acl",
    name: "ACL / EMNLP (NLP)",
    audience: "NLP reviewers",
    dimensions: [
      {
        name: "Clarity",
        weight: 0.9,
        criteria: ["Linguistic intuitions stated, not assumed."],
      },
      {
        name: "Methodology",
        weight: 1.1,
        criteria: [
          "Datasets and language coverage documented (incl. licences).",
          "Tokenisation, preprocessing, and evaluation metrics explicit.",
        ],
      },
      {
        name: "Linguistic significance",
        weight: 1.0,
        criteria: [
          "Phenomenon being modelled is motivated linguistically, not only via SOTA chase.",
        ],
      },
      {
        name: "Multilinguality / fairness",
        weight: 0.8,
        criteria: [
          "Results across language families where applicable.",
          "Bias / fairness considerations stated.",
        ],
      },
      {
        name: "Reproducibility",
        weight: 0.9,
        criteria: ["Code + data + prompts release plan."],
      },
    ],
  },
  nature: {
    id: "nature",
    name: "Nature / Science (broad-audience science)",
    audience: "non-specialist Nature/Science reviewers and editors",
    dimensions: [
      {
        name: "Importance",
        weight: 1.3,
        criteria: [
          "Why a non-specialist reader should care is in the first paragraph.",
          "Findings have implications beyond the immediate subfield.",
        ],
      },
      {
        name: "Clarity for non-specialists",
        weight: 1.1,
        criteria: [
          "Jargon is minimised or unpacked in the main text.",
          "Figures are interpretable on a first read.",
        ],
      },
      {
        name: "Methodological rigour",
        weight: 1.1,
        criteria: [
          "Independent replication or pre-registration discussed.",
          "Sample sizes justified.",
        ],
      },
      {
        name: "Data + code transparency",
        weight: 1.0,
        criteria: [
          "Data deposition statement.",
          "Reporting checklist items addressed.",
        ],
      },
      {
        name: "Citations",
        weight: 0.7,
        criteria: [
          "Cites foundational and recent literature without bloat.",
        ],
      },
    ],
  },
  jama: {
    id: "jama",
    name: "JAMA / NEJM (clinical)",
    audience: "clinical reviewers",
    dimensions: [
      {
        name: "Clinical relevance",
        weight: 1.3,
        criteria: [
          "Population, intervention, comparator, outcome, time-frame (PICOT) stated.",
          "Why a clinician should act differently after reading.",
        ],
      },
      {
        name: "Methodology",
        weight: 1.2,
        criteria: [
          "Study design named (RCT, cohort, etc.) with appropriate reporting guideline (CONSORT, STROBE).",
          "Pre-registration / IRB statement.",
          "Statistical analysis plan disclosed.",
        ],
      },
      {
        name: "Safety + ethics",
        weight: 1.0,
        criteria: [
          "Adverse events reported.",
          "Conflicts of interest disclosed.",
        ],
      },
      {
        name: "Generalisability",
        weight: 0.9,
        criteria: [
          "Demographics of cohort reported.",
          "Limits to external validity discussed.",
        ],
      },
      {
        name: "Citations",
        weight: 0.8,
        criteria: [
          "Recent systematic reviews / guidelines engaged with.",
        ],
      },
    ],
  },
  cell: {
    id: "cell",
    name: "Cell / Mol Bio",
    audience: "molecular biology reviewers",
    dimensions: [
      {
        name: "Mechanism",
        weight: 1.2,
        criteria: [
          "Causal mechanism proposed, not just correlations.",
          "Loss-of-function and gain-of-function controls.",
        ],
      },
      {
        name: "Experimental rigor",
        weight: 1.2,
        criteria: [
          "n, replicates, statistical tests reported per figure.",
          "Antibodies / reagents validated and sourced.",
        ],
      },
      {
        name: "Figure quality",
        weight: 1.0,
        criteria: [
          "Figures match the claims made in the text.",
          "No unnecessary cropping; scale bars present.",
        ],
      },
      {
        name: "Translational implications",
        weight: 0.8,
        criteria: ["In-vivo relevance discussed where applicable."],
      },
    ],
  },
  thesis: {
    id: "thesis",
    name: "PhD thesis chapter",
    audience: "thesis committee",
    dimensions: [
      {
        name: "Scoping",
        weight: 1.0,
        criteria: [
          "Chapter has a clear, single research question.",
          "Relation to overall thesis arc stated.",
        ],
      },
      {
        name: "Literature breadth",
        weight: 1.1,
        criteria: [
          "Engages with the canonical literature in the area.",
          "Recent work (≤24 months) included.",
        ],
      },
      {
        name: "Methodological depth",
        weight: 1.1,
        criteria: [
          "Method choices justified, not merely described.",
          "Failure modes and threats to validity included.",
        ],
      },
      {
        name: "Contribution clarity",
        weight: 1.0,
        criteria: [
          "Chapter contribution is itemised at the front.",
          "Distinguished from co-authored work where applicable.",
        ],
      },
      {
        name: "Citations",
        weight: 0.8,
        criteria: ["Citations are canonical and recent."],
      },
    ],
  },
};

export function rubricForVenue(id: VenueId): Rubric {
  return VENUE_PRESETS[id] ?? VENUE_PRESETS.generic;
}

export function formatRubricForPrompt(rubric: Rubric): string {
  const dims = rubric.dimensions
    .map(
      (d) =>
        `### ${d.name} (weight ${d.weight})\n${d.criteria.map((c) => `- ${c}`).join("\n")}`,
    )
    .join("\n\n");
  return `# Venue: ${rubric.name}\nAudience: ${rubric.audience}\n\n# Rubric\n${dims}`;
}
