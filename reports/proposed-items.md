# Items authored by the development team (proposed, pending review)

Everything below was written by the development team, not taken from the source files or the brief.
Each item is marked "proposed" in the data or the interface.

## Cybersecurity Initiative

1. **Translations** of the Spanish cells shown on the site (192 cells of JNIC sheets "Global - AI Act",
   "ai act", "AI Act Gaps" and one soft-law cell of the matrix). File: `data/authored/translations_es_en.json`.
   Citation forms normalised (e.g. "Art. 26.4 RIA" → "Art. 26(4) AI Act").
2. **Obligation selection rules**: one rule per row of "Global - AI Act" (54 rows), over the catalogue flags
   plus 18 purpose-only variables (importer, distributor, Annex I, Annex III areas, Art. 6(3), Art. 50 cases).
   File: `data/authored/obligation_rules.json`. These variables never affect techniques or controls.
3. **Step 3 question wording**: Art. 5(1)(a)–(h) practices, Annex III points 1–8, Annex I, Art. 6(3) and
   Art. 50 cases (`src/content/en.ts`, `cyber.questions`). Art. 6(3) is asked in two steps (decision of
   3 Nov 2026): which exception (a)–(d) applies, then, only if one does, whether the system profiles natural
   persons. The derogation applies when an exception is fulfilled and there is no profiling; the general test
   ("does not pose a significant risk of harm…") is given as help text, not asked separately.
4. **Phase option split** (decision of 3 Nov 2026): "Fine-tuning or alignment of model weights" sets
   `trains_model`; "Configuration: RAG corpus, prompt templates, agent memory or tools" does not, but both
   count as controlling "Fine-tuning and alignment".
5. **"Development and Monitoring"** (the matrix label "development", renamed on 3 Nov 2026) counts as
   controlled when the organisation controls Monitoring.
6. **"To be confirmed" rule**: an item is tagged when it applies only because of an "I don't know" answer,
   or when the phases question was answered "I don't know". A control is also tagged when every risk it
   addresses is.
7. **Grouping**: controls listed under the earliest phase the organisation controls; techniques under every
   phase the JNIC matrix gives them.
8. **AI Act coverage**: cells "X" and "-" read as "No provision identified in the matrix"; the six
   cross-references ("Already done", "Same as …") resolved to the row they point to. File:
   `data/authored/matrix_curation.json`.
9. **AI Act Gaps article cells**: display forms; row 4 (an Excel date) shown as "Art. 2(8) AI Act",
   confirmed by the project owner on 3 Nov 2026. File: `data/authored/corrections.json`.

10. **Technique condition refinements** (decision of 3 Nov 2026: results must change with the answers).
    Spearphishing via Social Engineering LLM (AML.T0052.000): "always" → `generative`. Impersonation
    (AML.T0073): "always" → `generative || identity_verification`. File:
    `data/authored/applicability_refinements.json`; the build fails if the catalogue value changes.
11. **Risk rule for controls**: a control is listed only when its condition is true and it mitigates at least
    one technique that applies. Exceptions, still subject to the condition: cross-cutting controls (GOV-01,
    INV-04, MON-07, PPL-03) and controls whose techniques are all outside the JNIC matrix (AGT-09, AGT-12).
12. **Baseline and specific**: results list first what depends on the answers; the baseline (techniques that
    apply to any system and controls whose condition is "always" and that address one of them) is a
    separate, collapsed block.
13. **Curated JNIC matrix** (`src/data/jnic-matrix.json`, page "How it's implemented"): a technique repeated
    within the same phase merged into one row; empty cells filled from the same technique in another phase
    (named under the cell); NIST AI RMF section titles added to the section numbers cited; "AESIA
    (ciberseguridad)" written "AESIA (cybersecurity)"; column J kept only where it is the matrix's own proposal;
    legal basis reached through the catalogue controls added to every row.
