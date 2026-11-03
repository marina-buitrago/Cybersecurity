# Items authored by the development team (proposed, pending review)

Everything below was written by the development team, not taken from the source files or the brief.
Each item is marked "proposed" in the data or the interface.

## Cybersecurity Initiative

1. **Translations** of the Spanish cells shown on the site (191 cells of JNIC sheets "Global - AI Act",
   "ai act" and "AI Act Gaps"). File: `data/authored/translations_es_en.json`. Glossary:
   `src/content/glossary.ts`. Citation forms normalised (e.g. "Art. 26.4 RIA" → "Art. 26(4) AI Act").
2. **Obligation selection rules**: one rule per row of "Global - AI Act" (54 rows), over the catalogue flags
   plus 18 purpose-only variables (importer, distributor, Annex I, Annex III areas, Art. 6(3), Art. 50 cases).
   File: `data/authored/obligation_rules.json`. These variables never affect techniques or controls.
3. **Step 3 question wording**: Art. 5(1)(a)–(h) practices, Annex III points 1–8, Annex I, Art. 6(3) and
   Art. 50 cases (`src/content/en.ts`, `cyber.questions`).
4. **Phase option split** (decision of 3 Nov 2026): "Fine-tuning or alignment of model weights" sets
   `trains_model`; "Configuration: RAG corpus, prompt templates, agent memory or tools" does not, but both
   count as controlling "Fine-tuning and alignment".
5. **"Development and Monitoring"** (the matrix label "development", renamed on 3 Nov 2026) counts as
   controlled when the organisation controls Monitoring.
6. **"To be confirmed" rule**: an item is tagged when it applies only because of an "I don't know" answer,
   or when the phases question was answered "I don't know".
7. **Grouping**: controls listed under the earliest phase the organisation controls; techniques under every
   phase the JNIC matrix gives them.
8. **AI Act coverage**: cells "X", "-" and cross-references ("Already done", "Same as …") shown as
   "Pending validation".
9. **AI Act Gaps article cells**: display forms; row 4 (an Excel date) shown as "Art. 2(8) AI Act",
   confirmed by the project owner on 3 Nov 2026. File: `data/authored/corrections.json`.

## DPO Initiative

10. **Deadline engine provisional arithmetic** until the counting regime is chosen per rule: same day number
    in the target month (or its last day), calendar days, extension counted from the same start.
11. **Knowledge cards**: identifiers other than DPO-DPIA-004, and the label "Legal obligation" on five cards.
    Fields not stated in the brief are left empty ("Pending validation").
12. **AI settings and AI architecture descriptions**, repository descriptions.
13. **All demo content** (`src/data/dpo-demo.json`, `dpo-documents.json`): fictitious organisations,
    roles and events, including the impact-assessment screening criteria and mock AI texts.
