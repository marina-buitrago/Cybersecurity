# DPO + AI cybersecurity (prototype)

Front-end prototype with three sections: **DPO Initiative**, **Cybersecurity Initiative** and
**How it's implemented**. No backend, no authentication, no model calls, no cookies, no analytics.
Questionnaire answers stay in the browser tab (sessionStorage).

## Run

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest: engine and deadline tests
npm run build      # type-check and static build in dist/
```

## Data pipeline

The app never reads spreadsheets at runtime. `scripts/build_data.py` reads two files from
`data/source/` (git-ignored) and writes `src/data/*.json` and `reports/data-quality.md`:

- `ai_security_controls_catalogue.xlsx` — canonical for all logic
- `JNIC 26 - Tech-legal alignment in AI security-2.xlsx` — technique content, help text, AI Act obligations

```sh
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
npm run data       # rebuild JSON and the data quality report
npm run data:test  # pipeline must reject unknown flags and non-flag syntax
```

The build fails on unknown flag tokens, bad expression syntax, missing or outdated translations,
untranslated Spanish, the private draft standard, or name-like text not found in the two sources.

Authored inputs, all **proposed and pending review**, live in `data/authored/`:
translations (`translations_es_en.json`), AI Act obligation rules (`obligation_rules.json`),
corrections (`corrections.json`). The full list of proposed items is in `reports/proposed-items.md`.

## Layout

- `src/engine/` — pure, deterministic TypeScript: expression parser (no `eval`), questionnaire,
  assessment, deadline rules. `service.ts` is the swappable boundary for a future backend.
- `src/content/en.ts` — every UI string; `glossary.ts` — Spanish → English terms.
- `src/data/` — generated JSON plus fictitious DPO demo data (`dpo-*.json`).
- `src/pages/` — home, `cyber/`, `dpo/`, `how/`.

Placeholders to fill in `src/content/en.ts`: `{{SITE_NAME}}`, `{{TAGLINE}}` and the home H1.
