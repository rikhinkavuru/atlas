export const SAMPLE_PAPER_HTML = `
<h1>Long-Context Retrieval-Augmented Generation for Domain-Specific Scientific Question Answering</h1>
<p><em>Rikhin Kavuru · Atlas Research · Draft v0.1 · May 2026</em></p>

<h2>Abstract</h2>
<p>Retrieval-augmented generation (RAG) has emerged as a leading approach for grounding large language models in external corpora, yet most existing systems struggle when the relevant evidence is dispersed across long, technical documents. In this work we introduce <strong>AtlasRAG</strong>, a long-context retrieval pipeline that combines hierarchical chunking, query-aware re-ranking, and a 1M-token reader. On a new benchmark of 4,200 expert-written questions over arXiv preprints in machine learning and bioinformatics, AtlasRAG improves exact-match accuracy by 11.4 points over a strong dense-retrieval baseline and reduces hallucinated citations by 38%. We release the benchmark, code, and a hosted demo.</p>

<h2>1. Introduction</h2>
<p>Despite rapid progress in large language models, scientific question answering remains a hard problem. Papers are long, dense, and rely on figures, equations, and references that are not always captured by standard chunk-and-embed pipelines. When a researcher asks a precise question — e.g., "what learning rate schedule did the authors use for the ImageNet ablation in Section 4.2?" — the answer often hinges on a single sentence buried in tens of pages of context.</p>
<p>Prior work has attacked this from two directions. <em>Retrieval-heavy</em> systems improve recall through better embeddings and re-rankers, but tend to over-fetch and confuse the reader. <em>Context-heavy</em> systems pour the full document into a long-context model, but pay a cost in latency and frequently lose precision on small but pivotal details.</p>
<p>We argue for a middle path. The key insight is that long-context reading and high-quality retrieval are complementary: retrieval narrows the haystack, while long context lets the reader reason across surviving evidence. We instantiate this with AtlasRAG.</p>

<h2>2. Related Work</h2>
<p>Dense retrieval over scientific text has been studied extensively. Specter and SciNCL learn paper-level embeddings, while ColBERTv2 generalises to fine-grained passage retrieval. More recent work explores hybrid sparse–dense retrieval and learned re-rankers. Long-context language models have grown from 8K to over 1M tokens in the past 18 months, enabling new applications but also exposing the limits of naive "stuff everything into the prompt" strategies.</p>

<h2>3. Method</h2>
<h3>3.1 Hierarchical Chunking</h3>
<p>We segment each paper at three levels — section, paragraph, and sentence — and index all three. At query time we first retrieve sections, then expand the top-k to their constituent paragraphs, and finally to sentence-level evidence. This lets a downstream reader access local context without us having to commit to a single chunk size up front.</p>

<h3>3.2 Query-Aware Re-Ranking</h3>
<p>Following ColBERTv2, we use a cross-encoder re-ranker, but we condition on the query <em>and</em> a brief auto-generated summary of the candidate section. This summary nudges the re-ranker to prefer evidence that supports a coherent answer rather than incidental keyword overlap.</p>

<h3>3.3 Long-Context Reader</h3>
<p>We pass the top-k passages plus their adjacent context windows into a 1M-token reader. The reader is prompted to emit answers as a JSON list of (claim, citation) pairs, where each citation must resolve to a sentence in the retrieved evidence. We reject answers whose citations cannot be string-matched back into the context, which is a cheap but surprisingly effective hallucination check.</p>

<h2>4. Experiments</h2>
<p>We evaluate on AtlasQA, a new benchmark of 4,200 questions written by domain experts across 1,600 arXiv preprints. Questions are categorised by reasoning type: factual lookup, multi-hop synthesis, numerical comparison, and methodological critique.</p>
<p>AtlasRAG achieves 71.3% exact-match accuracy compared to 59.9% for a strong dense baseline and 64.1% for a long-context-only baseline. The largest gains are in the multi-hop and methodological-critique categories, which we attribute to the reader's ability to reason across multiple surviving sections.</p>

<h2>5. Limitations</h2>
<p>AtlasRAG inherits the biases of its retrieval index and depends on the reader being honest about what it does and doesn't know. We do not yet model figures or equations as first-class evidence, and the system is monolingual.</p>

<h2>6. Conclusion</h2>
<p>Long-context reading and high-recall retrieval are not in tension — they are partners. AtlasRAG shows that a carefully composed pipeline outperforms either extreme on a difficult scientific QA benchmark, and we are releasing the artefacts to enable further work in this direction.</p>
`;
