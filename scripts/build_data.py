#!/usr/bin/env python3
"""Build the app's normalised JSON from the source spreadsheets.

Reads ONLY these two files (by exact name) from data/source/:
  A. ai_security_controls_catalogue.xlsx                      -> canonical for all logic
  B. JNIC 26 - Tech-legal alignment in AI security-2.xlsx      -> technique content, help text, AI Act obligations
plus the authored inputs in data/authored/ (translations, obligation rules, corrections, technique condition
refinements, matrix curation), all marked "proposed".

Writes src/data/*.json and reports/data-quality.md.
Exits with status 1 on any blocking problem (unknown flag token, missing or outdated translation,
untranslated Spanish, private draft standard, name-like text not present in the sources, ...).

Usage:  python scripts/build_data.py            (writes outputs)
        python scripts/build_data.py --check    (validates only)
"""
from __future__ import annotations

import datetime as dt
import json
import os
import re
import sys
import warnings
from collections import Counter, OrderedDict
from pathlib import Path

warnings.filterwarnings("ignore")  # openpyxl warns about pivot caches in file B
import openpyxl  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
SRC = Path(os.environ.get("BUILD_DATA_SOURCE", ROOT / "data" / "source"))
CHECK_ONLY = "--check" in sys.argv  # validate everything, write nothing
AUTHORED = ROOT / "data" / "authored"
OUT = ROOT / "src" / "data"
REPORT = ROOT / "reports" / "data-quality.md"

FILE_A = "ai_security_controls_catalogue.xlsx"
FILE_B = "JNIC 26 - Tech-legal alignment in AI security-2.xlsx"

# Lifecycle phases in display order. "Development and Monitoring" is the matrix label "development"
# (decision 2026-11-03: the JNIC 26 phase classification is authoritative; label renamed).
PHASES = [
    "Design", "Pre-training", "Fine-tuning and alignment", "Evaluation", "Deployment",
    "Monitoring", "Development and Monitoring", "Update", "End of life",
]
JNIC_PHASE_MAP = {
    "design": "Design",
    "pre-training": "Pre-training",
    "fine-tuning and alignment": "Fine-tuning and alignment",
    "fine-tunning and alignment": "Fine-tuning and alignment",  # typo in the matrix
    "fine-tuning & alignment": "Fine-tuning and alignment",
    "deployment": "Deployment",
    "monitoring": "Monitoring",
    "evaluation": "Evaluation",
    "update": "Update",
    "development": "Development and Monitoring",
}
CATALOGUE_PHASE_MAP = {p: p for p in PHASES} | {"Development": "Development and Monitoring"}

ATLAS_ID = re.compile(r"^AML\.T\d{4}(\.\d{3})?$")
ATLAS_ID_ANY = re.compile(r"AML\.T\d{4}(?:\.\d{3})?")
FORBIDDEN = re.compile(r"prEN\s*18282|DRAFT\s+PRIVADO", re.I)

errors: list[str] = []
warnings_: list[str] = []
report: "OrderedDict[str, list[str]]" = OrderedDict()


def section(title: str) -> list[str]:
    report[title] = []
    return report[title]


# --------------------------------------------------------------------------- text helpers
def clean(v) -> str | None:
    if v is None:
        return None
    if isinstance(v, (dt.date, dt.datetime)):
        return None  # dates are never valid text here; handled explicitly where they occur
    s = str(v).replace("\r\n", "\n").replace(" ", " ")
    s = "\n".join(line.rstrip() for line in s.split("\n"))
    s = re.sub(r"\n{3,}", "\n\n", s).strip()
    s = re.sub(r"[ \t]{2,}", " ", s)
    return s or None


def is_empty_marker(s: str | None) -> bool:
    return s is None or s in ("—", "-", "–")


def split_list(v) -> list[str]:
    """Multi-value cell: values separated by line breaks or ', '."""
    s = clean(v)
    if is_empty_marker(s):
        return []
    return [x.strip() for x in re.split(r"\n|,\s*", s) if x.strip() and not is_empty_marker(x.strip())]


def split_dot(v) -> list[str]:
    s = clean(v)
    if is_empty_marker(s):
        return []
    return [x.strip() for x in s.split("·") if x.strip()]


def lines(v) -> list[str]:
    s = clean(v)
    if is_empty_marker(s):
        return []
    return [x.strip() for x in s.split("\n") if x.strip()]


# --------------------------------------------------------------------------- expressions
TOKEN = re.compile(r"\s*(\(|\)|&&|\|\||[A-Za-z_][A-Za-z0-9_]*)")


def tokenize(expr: str) -> list[str]:
    toks, pos, s = [], 0, expr.strip()
    while pos < len(s):
        m = TOKEN.match(s, pos)
        if not m or m.end() == pos:
            raise ValueError(f"unexpected character at '{s[pos:]}'")
        toks.append(m.group(1))
        pos = m.end()
        while pos < len(s) and s[pos].isspace():
            pos += 1
    return toks


def check_expression(expr: str | None, vocabulary: set[str]) -> list[str]:
    """Return a list of problems (empty if the expression is valid). Grammar:
    expr := and ('||' and)* ; and := atom ('&&' atom)* ; atom := NAME | '(' expr ')'"""
    if expr is None:
        return ["empty expression"]
    try:
        toks = tokenize(expr)
    except ValueError as e:
        return [str(e)]
    problems = [t for t in toks if t not in ("(", ")", "&&", "||") and t not in vocabulary]
    i = 0

    def atom():
        nonlocal i
        if i >= len(toks):
            raise ValueError("unexpected end")
        t = toks[i]
        i += 1
        if t == "(":
            orx()
            if i >= len(toks) or toks[i] != ")":
                raise ValueError("missing ')'")
            i += 1
        elif t in (")", "&&", "||"):
            raise ValueError(f"unexpected '{t}'")

    def andx():
        nonlocal i
        atom()
        while i < len(toks) and toks[i] == "&&":
            i += 1
            atom()

    def orx():
        nonlocal i
        andx()
        while i < len(toks) and toks[i] == "||":
            i += 1
            andx()

    try:
        orx()
        if i != len(toks):
            raise ValueError(f"unexpected '{toks[i]}'")
    except ValueError as e:
        problems.append(f"syntax: {e}")
    return [f"unknown token '{p}'" if not p.startswith("syntax") else p for p in problems]


# --------------------------------------------------------------------------- workbook access
def load(name: str):
    path = SRC / name
    if not path.exists():
        sys.exit(f"ERROR: source file not found: {path}")
    return openpyxl.load_workbook(path, data_only=True)


def sheet_rows(ws, header_row: int = 1):
    """Return (headers, rows) with rows as dicts keyed by header text, skipping empty rows."""
    rows = list(ws.iter_rows(min_row=header_row, values_only=True))
    headers = [clean(h) for h in rows[0]]
    out = []
    for offset, r in enumerate(rows[1:], start=header_row + 1):
        if not any(v is not None and str(v).strip() for v in r):
            continue
        d = {h: r[i] for i, h in enumerate(headers) if h is not None and i < len(r)}
        d["_row"] = offset
        out.append(d)
    return headers, out


def require(headers, names, sheet):
    missing = [n for n in names if n not in headers]
    if missing:
        errors.append(f"Sheet '{sheet}' is missing expected columns: {missing}")


def all_strings(wb) -> list[str]:
    out = []
    for ws in wb.worksheets:
        for r in ws.iter_rows(values_only=True):
            out.extend(str(v) for v in r if isinstance(v, str))
    return out


# --------------------------------------------------------------------------- authored inputs
def load_json(name: str):
    with open(AUTHORED / name, encoding="utf-8") as fh:
        return json.load(fh)


TRANSLATIONS = {t["key"]: t for t in load_json("translations_es_en.json")["entries"]}
used_translations: set[str] = set()


def tr(key: str, source_text: str | None) -> str | None:
    """Translate a Spanish source cell. Fails if the translation is missing or outdated."""
    if source_text is None:
        return None
    t = TRANSLATIONS.get(key)
    if t is None:
        errors.append(f"Missing translation for {key}: {source_text[:80]!r}")
        return None
    if clean(t["es"]) != source_text:
        errors.append(f"Translation for {key} is outdated: source now reads {source_text[:80]!r}")
    used_translations.add(key)
    return t["en"]


# =========================================================================== A. catalogue
wbA = load(FILE_A)
wbB = load(FILE_B)
rows_read = section("Rows read per sheet")

for required_sheet in ("README", "Summary", "Controls", "Matrix techniques", "ATLAS mitigations 2026.10",
                       "ATLAS outside the matrix", "Flags", "Legal basis"):
    if required_sheet not in wbA.sheetnames:
        errors.append(f"Catalogue sheet missing: {required_sheet}")
if errors:
    sys.exit("\n".join(errors))

# ---- Flags
h, flag_rows = sheet_rows(wbA["Flags"])
require(h, ["Flag", "Meaning (set by the answer)", "Questionnaire step"], "Flags")
flags = [{"id": clean(r["Flag"]), "meaning": clean(r["Meaning (set by the answer)"]),
          "step": clean(r["Questionnaire step"])} for r in flag_rows]
FLAG_IDS = {f["id"] for f in flags}
rows_read.append(f"Catalogue · Flags: {len(flags)}")

# ---- Controls
CTRL_COLS = {
    "id": "ID", "family": "Family", "name": "Control", "what": "What to implement",
    "evidence": "Verification evidence", "phases": "Phases", "type": "Type", "appliesWhen": "Applies when",
    "condition": "Condition (flags)", "atlas": "ATLAS techniques mitigated (official ATLAS link)",
    "proposed": "ATLAS techniques (proposed link)", "atlasSrc": "Technical source: MITRE ATLAS 2026.10 [concreteness]",
    "etsi": "Standard: ETSI EN 304 223 V2.1.1 (verb) [concreteness]",
    "iso": "Standard: ISO/IEC 27001:2022 Annex A (general control)",
    "legal": "Legal basis · condition [concreteness]", "nature": "Nature of the grounding",
    "concreteness": "Most concrete source", "noSource": "If there is no source: why it matters", "status": "Status",
}
h, ctrl_rows = sheet_rows(wbA["Controls"])
require(h, list(CTRL_COLS.values()), "Controls")
rows_read.append(f"Catalogue · Controls: {len(ctrl_rows)}")

RE_MIT = re.compile(r'^(AML\.M\d{4}) "([^"]+)" \[(\w+)\](?: \((partial)\))?$')
RE_ETSI = re.compile(r"^([\d.]+-[\d.]+) \((shall|should)\) \[(\w+)\] · (.+)$")
RE_ISO = re.compile(r"^(A\.\d+\.\d+) (.+)$")
RE_LEGAL = re.compile(r"^(.+?) · if: (.+) \[(\w+)(\*?)\]$")
parse_problems = section("Cells that could not be parsed (kept as raw text)")

controls = []
for r in ctrl_rows:
    c = {k: r.get(v) for k, v in CTRL_COLS.items()}
    cid = clean(c["id"])
    mits, etsi, iso, legal = [], [], [], []
    for ln in lines(c["atlasSrc"]):
        m = RE_MIT.match(ln)
        mits.append({"id": m[1], "name": m[2], "concreteness": m[3], "partial": bool(m[4])} if m else {"raw": ln})
        if not m:
            parse_problems.append(f"{cid} ATLAS source: {ln}")
    for ln in lines(c["etsi"]):
        m = RE_ETSI.match(ln)
        etsi.append({"provision": m[1], "verb": m[2], "concreteness": m[3], "principle": m[4]} if m else {"raw": ln})
        if not m:
            parse_problems.append(f"{cid} ETSI: {ln}")
    for ln in lines(c["iso"]):
        m = RE_ISO.match(ln)
        iso.append({"id": m[1], "name": m[2]} if m else {"raw": ln})
        if not m:
            parse_problems.append(f"{cid} ISO: {ln}")
    for ln in lines(c["legal"]):
        m = RE_LEGAL.match(ln)
        legal.append({"citation": m[1], "condition": m[2], "concreteness": m[3] + m[4]} if m else {"raw": ln})
        if not m:
            parse_problems.append(f"{cid} legal: {ln}")
    atlas_cell = clean(c["atlas"])
    phases = [CATALOGUE_PHASE_MAP.get(p, p) for p in split_dot(c["phases"])]
    controls.append({
        "id": cid, "family": clean(c["family"]), "name": clean(c["name"]), "what": clean(c["what"]),
        "evidence": clean(c["evidence"]), "phases": phases, "type": clean(c["type"]),
        "appliesWhen": clean(c["appliesWhen"]), "condition": clean(c["condition"]),
        "crossCutting": atlas_cell == "Cross-cutting",
        "atlasLinks": [] if atlas_cell == "Cross-cutting" else split_list(c["atlas"]),
        "proposedLinks": split_list(c["proposed"]),
        "atlasMitigations": mits, "etsi": etsi, "iso": iso, "legal": legal,
        "nature": [x.strip() for x in (clean(c["nature"]) or "").split(" · ") if x.strip()],
        "concreteness": clean(c["concreteness"]), "noSourceWhy": clean(c["noSource"]), "status": clean(c["status"]),
    })
CONTROL_IDS = {c["id"] for c in controls}

# ---- Matrix techniques
TECH_COLS = {
    "id": "ATLAS ID", "nameMatrix": "Technique (JNIC matrix)", "nameAtlas": "Name in ATLAS 2026.10",
    "tactic": "ATLAS tactic", "phases": "Phase(s) in the matrix", "inAtlas": "In ATLAS 2026.10?",
    "mitigations": "ATLAS 2026.10 mitigations (direct or via parent)", "matrixMitigation": "Mitigation according to the matrix (col. J)",
    "controlsAtlas": "Catalogue controls (ATLAS link)", "controlsProposed": "Catalogue controls (proposed link)",
    "nist": "NIST AI 600-1 (according to the matrix)", "prep": "Attacker preparation",
    "appliesWhen": "Applies when (flags, proposed)", "notes": "Notes",
}
h, tech_rows = sheet_rows(wbA["Matrix techniques"])
require(h, list(TECH_COLS.values()), "Matrix techniques")
rows_read.append(f"Catalogue · Matrix techniques: {len(tech_rows)}")
techniques = []
for r in tech_rows:
    t = {k: r.get(v) for k, v in TECH_COLS.items()}
    techniques.append({
        "id": clean(t["id"]), "nameMatrix": clean(t["nameMatrix"]),
        "nameAtlas": None if is_empty_marker(clean(t["nameAtlas"])) else clean(t["nameAtlas"]),
        "tactics": split_list(t["tactic"]),
        "phasesCatalogue": [CATALOGUE_PHASE_MAP.get(p, p) for p in split_dot(t["phases"])],
        "inAtlas": clean(t["inAtlas"]) == "Yes", "atlasMitigations": split_list(t["mitigations"]),
        "matrixMitigationStatus": clean(t["matrixMitigation"]),
        "controlsAtlas": split_list(t["controlsAtlas"]), "controlsProposed": split_list(t["controlsProposed"]),
        "nist": split_list(t["nist"]), "attackerPreparation": clean(t["prep"]) == "Yes",
        "appliesWhen": clean(t["appliesWhen"]), "notes": lines(t["notes"]), "jnic_coverage": None,
    })
TECH_IDS = [t["id"] for t in techniques]

# ---- Proposed refinements of technique conditions (data/authored/applicability_refinements.json)
refine_report = section("Technique conditions refined (proposed)")
tech_by_id = {t["id"]: t for t in techniques}
for ref in load_json("applicability_refinements.json")["techniques"]:
    t = tech_by_id.get(ref["id"])
    if t is None:
        errors.append(f"Condition refinement for unknown technique {ref['id']}")
    elif t["appliesWhen"] != ref["catalogue"]:
        errors.append(f"Condition refinement for {ref['id']} expects catalogue value {ref['catalogue']!r}, "
                      f"catalogue has {t['appliesWhen']!r}")
    else:
        t["appliesWhenCatalogue"] = t["appliesWhen"]
        t["appliesWhen"] = ref["proposed"]
        refine_report.append(f"{ref['id']}: '{ref['catalogue']}' → '{ref['proposed']}'. {ref['why']}")

# ---- Legal basis
h, legal_rows = sheet_rows(wbA["Legal basis"])
require(h, ["Key", "Citation", "Condition", "Rule (flags)", "Concreteness", "Origin of the concreteness", "Controls"], "Legal basis")
rows_read.append(f"Catalogue · Legal basis: {len(legal_rows)}")
legal_basis = [{
    "key": clean(r["Key"]), "citation": clean(r["Citation"]), "condition": clean(r["Condition"]),
    "rule": clean(r["Rule (flags)"]), "concreteness": clean(r["Concreteness"]),
    "concretenessOrigin": clean(r["Origin of the concreteness"]), "controls": split_list(r["Controls"]),
} for r in legal_rows]

# ---- ATLAS mitigations / outside the matrix
h, mit_rows = sheet_rows(wbA["ATLAS mitigations 2026.10"])
rows_read.append(f"Catalogue · ATLAS mitigations 2026.10: {len(mit_rows)}")
atlas_mitigations = [{
    "id": clean(r["ID"]), "name": clean(r["Mitigation"]), "category": clean(r["ATLAS category"]),
    "phases": split_list(r["ATLAS phases"]), "concreteness": clean(r["Concreteness (proposed)"]),
    "techniques": split_list(r["Techniques it mitigates (ATLAS)"]), "controls": split_list(r["Catalogue controls"]),
} for r in mit_rows]
MIT_IDS = {m["id"] for m in atlas_mitigations}
h, out_rows = sheet_rows(wbA["ATLAS outside the matrix"])
rows_read.append(f"Catalogue · ATLAS outside the matrix: {len(out_rows)}")
atlas_outside = [{
    "id": clean(r["ID"]), "name": clean(r["Technique"]), "tactics": split_list(r["Tactic"]),
    "maturity": clean(r["ATLAS maturity"]), "mitigations": split_list(r["ATLAS mitigations"]),
    "controlsAtlas": split_list(r["Catalogue controls (ATLAS link)"]),
    "controlsProposed": split_list(r["Catalogue controls (proposed link)"]),
} for r in out_rows]
OUTSIDE_IDS = {o["id"] for o in atlas_outside}

# ---- README and Summary
readme_lines = [clean(r[0]) for r in wbA["README"].iter_rows(values_only=True) if clean(r[0])]
rows_read.append(f"Catalogue · README: {len(readme_lines)} lines")
readme_title, readme_version = readme_lines[0], readme_lines[1]
readme_sections, current = [], None
dropped_readme = []
for ln in readme_lines[2:]:
    if "must not be published" in ln:  # refers to an internal, unpublishable file: never ingested
        dropped_readme.append(ln[:60] + "…")
        continue
    if not (ln.startswith("•") or re.match(r"^\d+\.", ln)) and len(ln) < 40:
        current = {"title": ln, "lines": []}
        readme_sections.append(current)
    elif current is not None:
        current["lines"].append(ln.lstrip("• ").strip())
summary_rows = [[clean(v) if not isinstance(v, (int, float)) else v for v in r]
                for r in wbA["Summary"].iter_rows(values_only=True) if any(v is not None for v in r)]
rows_read.append(f"Catalogue · Summary: {len(summary_rows)} lines")
summary_families = []
summary_figures = []
mode = None
for r in summary_rows[1:]:
    if r[0] == "Family":
        mode = "fam"
        continue
    if r[0] == "JNIC matrix techniques":
        mode = "fig"
        continue
    if mode == "fam":
        summary_families.append({"family": r[0], "controls": r[1], "withAtlasLink": r[2]})
    elif mode == "fig":
        summary_figures.append({"label": r[0], "value": r[1]})

# =========================================================================== B. JNIC workbook
for required_sheet in ("Attacks-phase-standardregulatio", "Hoja 8", "Global - AI Act", "ai act", "etsi",
                       "AI Act Gaps", "Related papers"):
    if required_sheet not in wbB.sheetnames:
        errors.append(f"JNIC sheet missing: {required_sheet}")

# ---- Attacks matrix (headers in row 2, data from row 3; column A forward-filled)
ws = wbB["Attacks-phase-standardregulatio"]
raw_phase_labels = Counter()
unrecognised_phases = section("Matrix phase labels not recognised")
attack_rows = []
phase = None
name_to_id = {t["nameMatrix"].strip().lower(): t["id"] for t in techniques if t["nameMatrix"]}
unresolved = []
for i, r in enumerate(ws.iter_rows(min_row=3, values_only=True), start=3):
    if not any(v is not None and str(v).strip() for v in r[:12]):
        continue
    if clean(r[0]):
        raw = clean(r[0])
        raw_phase_labels[raw] += 1
        phase = JNIC_PHASE_MAP.get(raw.lower())
        if phase is None:
            unrecognised_phases.append(f"Row {i}: '{raw}'")
            errors.append(f"Unrecognised phase label in JNIC matrix row {i}: {raw!r}")
    link = clean(r[2])
    m = ATLAS_ID_ANY.search(link or "")
    tid = m.group(0) if m else name_to_id.get((clean(r[1]) or "").lower())
    if not m:
        (unresolved if tid is None else parse_problems).append(
            f"JNIC row {i}: no ATLAS link in column C ({(link or '')[:50]!r}); "
            + (f"resolved by name to {tid}" if tid else "could not be resolved"))
    attack_rows.append({"row": i, "phase": phase, "name": clean(r[1]), "id": tid, "link": link if m else None,
                        "coverage": clean(r[3]), "why": clean(r[4]), "softLaw": clean(r[5]), "nistRmf": clean(r[6]),
                        "whyNist": clean(r[7]), "nist600": clean(r[8]), "mitigation": clean(r[9]),
                        "description": clean(r[11])})
rows_read.append(f"JNIC · Attacks-phase-standardregulatio: {len(attack_rows)} data rows "
                 f"({len({a['id'] for a in attack_rows if a['id']})} unique technique IDs)")
for u in unresolved:
    errors.append(u)

jnic = {}
for a in attack_rows:
    if not a["id"]:
        continue
    j = jnic.setdefault(a["id"], {"phases": [], "names": [], "description": None, "whyAiAct": None, "link": None})
    if a["phase"] and a["phase"] not in j["phases"]:
        j["phases"].append(a["phase"])
    if a["name"] and a["name"] not in j["names"]:
        j["names"].append(a["name"])
    if a["description"] and (j["description"] is None or len(a["description"]) > len(j["description"])):
        j["description"] = a["description"]
    if a["why"] and j["whyAiAct"] is None:
        j["whyAiAct"] = a["why"]
    j["link"] = j["link"] or a["link"]

# ---- Hoja 8: phase definitions (rows "N) Phase" followed by the definition)
h8 = [clean(r[0]) for r in wbB["Hoja 8"].iter_rows(values_only=True)]
phase_definitions = {}
for i, v in enumerate(h8):
    m = re.match(r"^\d\)\s*(.+)$", v or "")
    if m and i + 1 < len(h8) and h8[i + 1]:
        ph = JNIC_PHASE_MAP.get(m.group(1).strip().lower())
        if ph:
            phase_definitions[ph] = h8[i + 1]
rows_read.append(f"JNIC · Hoja 8: {len(phase_definitions)} phase definitions")

# ---- Global - AI Act (Spanish; columns A obligation, B article, C class, E preconditions)
rules_doc = load_json("obligation_rules.json")
PURPOSE_VOCAB = {v["id"] for v in rules_doc["vocabulary"]}
overlap = PURPOSE_VOCAB & FLAG_IDS
if overlap:
    errors.append(f"Purpose vocabulary redefines catalogue flags: {sorted(overlap)}")
rules_by_row = {r["row"]: r for r in rules_doc["rules"]}
CLASS_MAP = {"Material": "Concrete", "Abstracta": "Abstract", "Abtracta": "Abstract"}
ws = wbB["Global - AI Act"]
obligations, obligation_sections = [], []
sec_title = "General"  # authored title for the rows before the sheet's first section header
for i, r in enumerate(ws.iter_rows(min_row=2, max_row=ws.max_row, values_only=True), start=2):
    a, b, c, e = clean(r[0]), clean(r[1]), clean(r[2]), clean(r[4])
    if not a:
        continue
    if b is None and c is None and e is None and a.upper() == a:
        sec_title = tr(f"Global - AI Act!A{i}", a)
        continue
    rule = rules_by_row.get(i)
    if rule is None:
        errors.append(f"No obligation rule for Global - AI Act row {i} ({b})")
        continue
    if rule["article_es"] != b:
        errors.append(f"Obligation rule for row {i} expects article {rule['article_es']!r}, sheet has {b!r}")
    for p in check_expression(rule["rule"], FLAG_IDS | PURPOSE_VOCAB):
        errors.append(f"Obligation rule row {i}: {p}")
    if c is not None and c not in CLASS_MAP:
        errors.append(f"Unknown class in Global - AI Act row {i}: {c!r}")
    obligations.append({
        "id": f"AIA-OBL-{i:02d}", "row": i, "section": sec_title,
        "obligation": tr(f"Global - AI Act!A{i}", a), "article": tr(f"Global - AI Act!B{i}", b),
        "concreteness": CLASS_MAP.get(c) if c else None, "classRaw": c,
        "preconditions": tr(f"Global - AI Act!E{i}", e), "rule": rule["rule"], "ruleStatus": "proposed",
        "translationStatus": "proposed",
    })
rows_read.append(f"JNIC · Global - AI Act: {len(obligations)} obligations")

# ---- ai act sheet (premise + risk table; Spanish)
ws = wbB["ai act"]
premise, risk_table = [], []
for i, r in enumerate(ws.iter_rows(values_only=True), start=1):
    vals = [clean(v) for v in r[:3]]
    if not any(vals):
        continue
    if i <= 7:
        premise.append({"row": i, "text": tr(f"ai act!A{i}", vals[0]) if vals[0] else None})
    elif i == 10:
        continue  # table title row ("Riesgo de ciberseguridad")
    else:
        risk_table.append({"row": i, "risk": tr(f"ai act!A{i}", vals[0]), "description": tr(f"ai act!B{i}", vals[1]),
                           "whyMinimalRiskIsExposed": tr(f"ai act!C{i}", vals[2])})
rows_read.append(f"JNIC · ai act: {len(premise)} premise lines, {len(risk_table)} risk rows")

# ---- etsi sheet
ws = wbB["etsi"]
etsi_rows = []
etsi_link = None
for i, r in enumerate(ws.iter_rows(values_only=True), start=1):
    vals = [clean(v) for v in r[:3]]
    if i == 1:
        etsi_link = vals[0]
        continue
    if i == 2 or not vals[0]:
        continue
    norm = [re.sub(r"\./\s*", ".\n", v).strip().rstrip("/") if v else None for v in vals]
    etsi_rows.append({"area": norm[0], "establishes": norm[1], "gaps": norm[2]})
rows_read.append(f"JNIC · etsi: {len(etsi_rows)}")

# ---- AI Act Gaps (article cells: corrections and display forms in data/authored/corrections.json)
corrections = load_json("corrections.json")
ws = wbB["AI Act Gaps"]
gaps = []
gaps_title_es = clean(ws["A1"].value)
gaps_title = tr("AI Act Gaps!A1", gaps_title_es)
for i, r in enumerate(ws.iter_rows(min_row=4, values_only=True), start=4):
    if not any(v is not None for v in r[:4]):
        continue
    key = f"AI Act Gaps!A{i}"
    raw = r[0]
    corr = corrections.get(key)
    if corr is None:
        errors.append(f"No display form for {key} ({raw!r}) in corrections.json")
        article = None
    else:
        found = raw.isoformat()[:10] if isinstance(raw, (dt.date, dt.datetime)) else clean(raw)
        if corr["found"] != found:
            errors.append(f"Correction for {key} expects {corr['found']!r}, sheet has {found!r}")
        article = corr["value"]
    gaps.append({"article": article, "description": clean(r[1]), "reason": clean(r[2]),
                 "papers": [p.strip() for p in (clean(r[3]) or "").split("\n\n") if p.strip()]})
rows_read.append(f"JNIC · AI Act Gaps: {len(gaps)}")

ws = wbB["Related papers"]
papers = []
for r in ws.iter_rows(values_only=True):
    ref, abstract = clean(r[0]), clean(r[1]) if len(r) > 1 else None
    if ref:
        papers.append({"reference": ref, "abstract": abstract})
rows_read.append(f"JNIC · Related papers: {len(papers)}")

# =========================================================================== checks
# ---- expression tokens
tok_issues = section("Expression tokens not in Flags")
n_expr = 0
for c in controls:
    n_expr += 1
    for p in check_expression(c["condition"], FLAG_IDS):
        tok_issues.append(f"Controls {c['id']}: {p}")
for t in techniques:
    n_expr += 1
    for p in check_expression(t["appliesWhen"], FLAG_IDS):
        tok_issues.append(f"Matrix techniques {t['id']}: {p}")
for lb in legal_basis:
    n_expr += 1
    for p in check_expression(lb["rule"], FLAG_IDS):
        tok_issues.append(f"Legal basis {lb['key']}: {p}")
errors.extend(tok_issues)
tok_issues.insert(0, f"Checked {n_expr} expressions (Controls, Matrix techniques, Legal basis) "
                     f"against {len(FLAG_IDS)} flags. Problems: {len(tok_issues)}.")
tok_issues.append(f"Also checked {len(obligations)} proposed obligation rules against Flags plus "
                  f"{len(PURPOSE_VOCAB)} purpose-only variables (data/authored/obligation_rules.json).")

# ---- technique IDs referenced by controls
id_issues = section("Technique IDs in Controls not in Matrix techniques")
referenced = set()
for c in controls:
    for tid in c["atlasLinks"] + c["proposedLinks"]:
        referenced.add(tid)
        if not ATLAS_ID.match(tid):
            id_issues.append(f"{c['id']}: '{tid}' is not a valid ATLAS technique ID")
            errors.append(f"Invalid technique ID in Controls {c['id']}: {tid}")
not_in_matrix = sorted(referenced - set(TECH_IDS))
unlisted = sorted(set(not_in_matrix) - OUTSIDE_IDS)
id_issues.insert(0, f"{len(referenced)} distinct technique IDs referenced; all well formed. "
                    f"{len(not_in_matrix)} are not in Matrix techniques; of those, {len(not_in_matrix) - len(unlisted)} are listed "
                    f"in 'ATLAS outside the matrix'.")
if unlisted:
    id_issues.append(f"Valid IDs listed in neither technique sheet: {', '.join(unlisted)} "
                     "(the 'probable successors' named in the Notes column).")
for c in controls:
    for m in c["atlasMitigations"]:
        if "id" in m and m["id"] not in MIT_IDS:
            errors.append(f"{c['id']} cites unknown ATLAS mitigation {m['id']}")

# ---- technique <-> control links: Matrix techniques columns are canonical (decision 2026-11-03)
link_issues = section("Technique ↔ control links")


def covers(links: list[str], tid: str) -> bool:
    parts = tid.split(".")
    parent = ".".join(parts[:2]) if len(parts) == 3 else None
    return tid in links or (parent is not None and parent in links)


diffs = []
for t in techniques:
    calc_a = sorted(c["id"] for c in controls if covers(c["atlasLinks"], t["id"]))
    calc_p = sorted(c["id"] for c in controls if covers(c["proposedLinks"], t["id"]) and c["id"] not in calc_a)
    if calc_a != sorted(t["controlsAtlas"]) or calc_p != sorted(t["controlsProposed"]):
        diffs.append(t["id"])
    for cid in t["controlsAtlas"] + t["controlsProposed"]:
        if cid not in CONTROL_IDS:
            errors.append(f"Matrix techniques {t['id']} lists unknown control {cid}")
link_issues.append(f"Links in Matrix techniques (columns 'Catalogue controls') match the 'ID or parent' rule applied to "
                   f"Controls for {len(techniques) - len(diffs)} of {len(techniques)} techniques.")
if diffs:
    link_issues.append(f"Different for: {', '.join(diffs)} (IDs retired from ATLAS 2026.10, linked via their probable "
                       "successor). The app uses the Matrix techniques columns, so these keep their controls.")

# ---- legal basis consistency
legal_issues = section("Legal basis ↔ Controls consistency")
lb_by_cit = {lb["citation"]: lb for lb in legal_basis}
for c in controls:
    for l in c["legal"]:
        if "citation" not in l:
            continue
        lb = lb_by_cit.get(l["citation"])
        if lb is None:
            legal_issues.append(f"{c['id']}: citation '{l['citation']}' not in Legal basis")
            errors.append(f"{c['id']}: citation not in Legal basis: {l['citation']}")
        elif c["id"] not in lb["controls"]:
            legal_issues.append(f"{c['id']}: '{l['citation']}' not listed for this control in Legal basis")
        l["key"] = lb["key"] if lb else None
for lb in legal_basis:
    for cid in lb["controls"]:
        ctrl = next((c for c in controls if c["id"] == cid), None)
        if ctrl is None or not any(l.get("citation") == lb["citation"] for l in ctrl["legal"]):
            legal_issues.append(f"Legal basis {lb['key']} lists {cid}, but the control does not cite it")
if not legal_issues:
    legal_issues.append("Consistent in both directions (citation and concreteness).")

# ---- phases: JNIC (authoritative) vs catalogue
phase_issues = section("Technique phases: JNIC matrix vs catalogue")
phase_issues.append("Raw labels in JNIC column A (forward-filled): " +
                    ", ".join(f"'{k}' ×{v}" for k, v in raw_phase_labels.items()))
phase_issues.append("Normalised: 'Fine-tunning' → 'Fine-tuning and alignment' (typo); lowercase 'deployment' → "
                    "'Deployment'; 'development' → 'Development and Monitoring' (decision 2026-11-03).")
for t in techniques:
    j = jnic.get(t["id"])
    if j is None:
        errors.append(f"Technique {t['id']} has no row in the JNIC matrix")
        t["phases"] = t["phasesCatalogue"]
        continue
    t["phases"] = sorted(j["phases"], key=PHASES.index)
    if sorted(t["phasesCatalogue"], key=PHASES.index) != t["phases"]:
        phase_issues.append(f"{t['id']}: JNIC {t['phases']} vs catalogue {t['phasesCatalogue']} (JNIC used)")
if len(phase_issues) == 2:
    phase_issues.append("After normalisation, JNIC and catalogue phases are identical for all techniques.")
missing_jnic = [t for t in jnic if t not in TECH_IDS]
if missing_jnic:
    errors.append(f"JNIC matrix techniques missing from the catalogue: {missing_jnic}")
if not unrecognised_phases:
    unrecognised_phases.append("None after normalisation.")
for c in controls:
    for p in c["phases"]:
        if p not in PHASES:
            errors.append(f"Control {c['id']} has unrecognised phase '{p}'")

# ---- JNIC coverage column D
cov = section("AI Act coverage (JNIC column D)")
filled = sum(1 for a in attack_rows if a["coverage"])
vals = Counter(a["coverage"] for a in attack_rows if a["coverage"] in ("X", "-"))
cov.append(f"Filled in {filled} of {len(attack_rows)} rows ('X' ×{vals.get('X', 0)}, '-' ×{vals.get('-', 0)}). "
           "Cross-references ('Already done', 'Same as …') are resolved in the curated matrix (below).")

# ---- Curated JNIC matrix (page "How it's implemented"; curation in data/authored/matrix_curation.json)
curation = load_json("matrix_curation.json")
cur = section("Curated JNIC matrix")
row_by_num = {a["row"]: a for a in attack_rows}
mit_name = {m["id"]: m["name"] for m in atlas_mitigations}
ctrl_by_id = {c["id"]: c for c in controls}
NO_PROVISION = set(curation["noProvisionMarkers"])
# Section titles of the NIST AI RMF 1.0 cited in column G (titles as in the framework).
NIST_RMF_SECTIONS = {
    "1.2.1": "Risk Measurement", "1.2.4": "Organizational Integration and Management of Risk",
    "3.1": "Valid and Reliable", "3.2": "Safe", "3.3": "Secure and Resilient",
    "3.4": "Accountable and Transparent", "3.6": "Privacy-Enhanced",
}
RE_NIST_SECTION = re.compile(r"(?<![\d.])(\d\.\d(?:\.\d)?)\s+(?=[A-Z])")
RE_NIST_ACTION = re.compile(r"\b(GV|MP|MS|MG)\s*-?\s*(\d+\.\d+)\s*-\s*(\d{3})\b")


def fix_text(v: str | None) -> str | None:
    """Curated prose: known label fixes, stray leading punctuation, capital first letter."""
    if v is None:
        return None
    for f in curation["textFixes"]:
        v = v.replace(f["from"], f["to"])
    v = v.lstrip(". ").strip()
    return (v[:1].upper() + v[1:]) or None


xref = {}
for x in curation["crossReferences"]:
    a = row_by_num.get(x["row"])
    if a is None or a["coverage"] != clean(x["found"]):
        errors.append(f"Matrix curation: row {x['row']} expects {x['found']!r}, sheet has {a and a['coverage']!r}")
    elif x["target"] not in row_by_num:
        errors.append(f"Matrix curation: row {x['row']} points to missing row {x['target']}")
    else:
        xref[x["row"]] = x["target"]


def resolve_coverage(rownum: int, seen: tuple = ()) -> tuple[str | None, int]:
    if rownum in xref:
        if rownum in seen:
            errors.append(f"Matrix curation: circular cross-reference at row {rownum}")
            return None, rownum
        return resolve_coverage(xref[rownum], seen + (rownum,))
    return row_by_num[rownum]["coverage"], rownum


def nist_actions(v: str | None) -> tuple[list[str], str | None]:
    if v is None:
        return [], None
    ids = [f"{m[1]}-{m[2]}-{m[3]}" for m in RE_NIST_ACTION.finditer(v)]
    rest = RE_NIST_ACTION.sub("", v).replace(",", " ").strip()
    if rest and rest.lower() != "no direct action":
        cur.append(f"Column I text kept as a note: {rest[:60]!r}")
    return list(dict.fromkeys(ids)), ("No direct action" if rest.lower() == "no direct action" else rest or None)


def nist_sections(v: str | None) -> list[str]:
    out = []
    for m in RE_NIST_SECTION.finditer(v or ""):
        num = m.group(1)
        if num not in NIST_RMF_SECTIONS:
            errors.append(f"Unknown NIST AI RMF section {num} in matrix column G")
            continue
        label = f"{num} {NIST_RMF_SECTIONS[num]}"
        if label not in out:
            out.append(label)
    return out


# 1. Merge rows that repeat the same technique in the same phase (empty cells filled from the repeat).
FIELDS = ("coverage", "why", "softLaw", "nistRmf", "whyNist", "nist600", "mitigation", "description")
merged: "OrderedDict[tuple, dict]" = OrderedDict()
n_merged = 0
for a in sorted((a for a in attack_rows if a["id"]), key=lambda a: (PHASES.index(a["phase"]), a["row"])):
    key = (a["phase"], a["id"])
    if key in merged:
        n_merged += 1
        first = merged[key]
        for f in FIELDS:
            if first[f] is None and a[f] is not None:
                first[f] = a[f]
        first["rows"].append(a["row"])
    else:
        merged[key] = dict(a, rows=[a["row"]])

# 2. Per row: AI Act text (cross-references resolved), then fill gaps from the same technique's other rows.
for m in merged.values():
    text, src = resolve_coverage(m["row"]) if m["coverage"] else (None, m["row"])
    m["aiActSrc"] = src
    m["aiActText"] = text
    m["aiActOrigin"] = ("noProvision" if text in NO_PROVISION else "crossReference" if src != m["row"] else "matrix") if text else "none"
    m["whyAiAct"] = m["why"] or (row_by_num[src]["why"] if src != m["row"] else None)
by_tech: dict[str, list[dict]] = {}
for m in merged.values():
    by_tech.setdefault(m["id"], []).append(m)
n_prop = Counter()
for m in merged.values():
    others = [o for o in by_tech[m["id"]] if o is not m]
    if m["aiActOrigin"] in ("none", "noProvision"):
        donor = next((o for o in others if o["aiActOrigin"] in ("matrix", "crossReference")), None)
        if donor:
            m.update(aiActText=donor["aiActText"], aiActSrc=donor["aiActSrc"], aiActOrigin="sameTechnique",
                     whyAiAct=m["whyAiAct"] or donor["whyAiAct"])
            n_prop["AI Act"] += 1
    for f in ("softLaw", "nistRmf", "whyNist", "nist600", "description"):
        if m[f] is None:
            donor = next((o for o in others if o[f] is not None), None)
            if donor:
                m[f] = donor[f]
                m[f + "From"] = donor["phase"]
                n_prop[f] += 1

# 3. Assemble, completing from the catalogue.
jnic_matrix = []
for m in merged.values():
    t = tech_by_id[m["id"]]
    soft = tr(f"Attacks-phase-standardregulatio!F{m['rows'][0]}", m["softLaw"]) \
        if f"Attacks-phase-standardregulatio!F{m['rows'][0]}" in TRANSLATIONS else m["softLaw"]
    actions, action_note = nist_actions(m["nist600"])
    nist_origin = "matrix" if m["nist600"] else "none"
    if not actions and not action_note and t["nist"]:
        actions, nist_origin = list(t["nist"]), "catalogue"
    proposal = None
    if m["mitigation"]:
        pm = re.search(r"(?:Possible mitigation|Proposed mitigation \(no mitigation in mitre\))\s*:\s*(.+)$",
                       m["mitigation"], re.S)
        proposal = fix_text(pm.group(1)) if pm else None
    links = [(cid, "atlas") for cid in t["controlsAtlas"]] + [(cid, "proposed") for cid in t["controlsProposed"]]
    legal_via: "OrderedDict[str, dict]" = OrderedDict()
    for cid, _ in links:
        for l in ctrl_by_id[cid]["legal"]:
            if "citation" not in l:
                continue
            e = legal_via.setdefault(l["citation"], {"citation": l["citation"], "condition": l["condition"], "controls": []})
            e["controls"].append(cid)
    src = row_by_num[m["aiActSrc"]]
    successor = next((n.split("probable successor (to verify):", 1)[1].strip() for n in t["notes"]
                      if "probable successor (to verify):" in n), None)
    jnic_matrix.append({
        "phase": m["phase"], "id": t["id"], "name": t["nameAtlas"] or t["nameMatrix"], "inAtlas": t["inAtlas"],
        "successor": successor, "tactics": t["tactics"], "attackerPreparation": t["attackerPreparation"],
        "appliesWhen": t["appliesWhen"], "appliesWhenCatalogue": t.get("appliesWhenCatalogue"),
        "description": fix_text(m["description"]),
        "aiAct": {
            "text": None if m["aiActOrigin"] in ("none", "noProvision") else fix_text(m["aiActText"]),
            "origin": m["aiActOrigin"],
            "from": None if m["aiActOrigin"] not in ("crossReference", "sameTechnique") else
            {"id": src["id"], "phase": src["phase"], "name": tech_by_id[src["id"]]["nameAtlas"] or src["name"]},
        },
        "whyAiAct": fix_text(m["whyAiAct"]),
        "softLaw": fix_text(soft),
        "nistRmf": {"sections": nist_sections(m["nistRmf"]), "text": fix_text(m["nistRmf"])},
        "whyNist": fix_text(m["whyNist"]),
        "nist600": {"actions": actions, "note": action_note, "origin": nist_origin},
        "mitigations": [{"id": mid, "name": mit_name.get(mid)} for mid in t["atlasMitigations"]],
        "matrixProposal": proposal,
        "controls": [{"id": cid, "name": ctrl_by_id[cid]["name"], "link": link} for cid, link in links],
        "legalViaControls": list(legal_via.values()),
        "filledFrom": {f: m[f + "From"] for f in ("description", "softLaw", "nistRmf", "whyNist", "nist600")
                       if m.get(f + "From")},
    })
    if m["aiActOrigin"] in ("matrix", "crossReference", "sameTechnique") and not t["jnic_coverage"]:
        t["jnic_coverage"] = fix_text(m["aiActText"])

origins = Counter(r["aiAct"]["origin"] for r in jnic_matrix)
cur.append(f"{len(attack_rows)} matrix rows → {len(jnic_matrix)} curated rows ({n_merged} repeated technique–phase "
           "rows merged); sorted by phase. Phase labels normalised (see below); names as in ATLAS 2026.10.")
cur.append(f"AI Act column: text from the matrix ×{origins['matrix']}, cross-reference resolved ×{origins['crossReference']}, "
           f"taken from the same technique in another phase ×{origins['sameTechnique']}, 'X' or '-' (no provision "
           f"identified) ×{origins['noProvision']}, empty ×{origins['none']}. Every row also lists the legal citations "
           "reached through its catalogue controls.")
cur.append("Filled from the same technique in another phase: " + ", ".join(f"{k} ×{v}" for k, v in n_prop.items()) + ".")
cur.append(f"NIST AI 600-1 actions normalised to the form 'MS-2.7-007'; taken from the catalogue where the matrix is empty "
           f"×{sum(1 for r in jnic_matrix if r['nist600']['origin'] == 'catalogue')}.")
cur.append("MITRE mitigations: the outdated column J is replaced by the ATLAS 2026.10 mitigations of the catalogue; "
           f"the matrix's own proposals are kept ×{sum(1 for r in jnic_matrix if r['matrixProposal'])}.")
cur.append("Completed from the catalogue: tactic, condition, ATLAS 2026.10 mitigations, controls and legal citations.")
cov.append(f"{sum(1 for t in techniques if t['jnic_coverage'])} of {len(techniques)} techniques have AI Act text after "
           "curation; the assessment results show it and omit the field for the rest.")

# ---- summary recomputation
summ = section("Catalogue Summary sheet recomputed from rows")
recomputed = {
    "Techniques (unique IDs)": len(set(TECH_IDS)),
    "Covered by a control with an official ATLAS link": sum(1 for t in techniques if t["controlsAtlas"]),
    "Covered only by proposed controls": sum(1 for t in techniques if not t["controlsAtlas"] and t["controlsProposed"]),
    "Without any control": sum(1 for t in techniques if not t["controlsAtlas"] and not t["controlsProposed"]),
    "Matrix records no MITRE mitigation but ATLAS 2026.10 has one": sum(1 for t in techniques if any("now includes" in n for n in t["notes"])),
    "IDs no longer in ATLAS 2026.10": sum(1 for t in techniques if not t["inAtlas"]),
    "ATLAS 2026.10 techniques not in the matrix": len(atlas_outside),
}
for f in summary_figures:
    got = recomputed.get(f["label"])
    status = "matches" if got == f["value"] else f"DIFFERS (recomputed {got})"
    summ.append(f"{f['label']}: {f['value']} — {status}")
fam_counts = Counter(c["family"] for c in controls)
fam_link = Counter(c["family"] for c in controls if c["atlasLinks"])
for f in summary_families:
    if f["family"] == "Total":
        ok = f["controls"] == len(controls) and f["withAtlasLink"] == sum(fam_link.values())
    else:
        ok = fam_counts.get(f["family"]) == f["controls"] and fam_link.get(f["family"], 0) == f["withAtlasLink"]
    if not ok:
        summ.append(f"Family '{f['family']}' differs from the Controls sheet")
summ.append(f"Family counts ({len(summary_families) - 1} families, {len(controls)} controls): "
            + ("all match." if all("differs" not in s for s in summ) else "see above."))

# ---- other findings
other = section("Other findings")
other.append(f"Hoja 8 defines {len(phase_definitions)} phases ({', '.join(phase_definitions)}); no definition for "
             + ", ".join(p for p in PHASES if p not in phase_definitions) + " (shown as 'Pending validation'). "
             "It lists the four typologies by name only, without definitions.")
other.append("Global - AI Act: the row 'Art. 6 RIA' has no class (shown as 'Pending validation'); 'Abtracta' read as Abstract.")
other.append("AI Act Gaps row 4: the article cell holds an Excel date (2026-08-02); displayed as 'Art. 2(8) AI Act' "
             "(confirmed by the project owner, 2026-11-03).")
other.append("The JNIC matrix column J (mitigation) is outdated: replaced by ATLAS 2026.10 mitigations in the curated matrix.")
other.append("Controls 'Phases' cells use ' · ' as separator; the source files use spaces in their names.")
if dropped_readme:
    other.append(f"README: {len(dropped_readme)} line naming an internal, unpublishable file was not ingested.")
other.append("Not ingested: sheet 'AI Act V. Standards' (contains a private draft standard), the JNIC copy without '-2' "
             "and the older draft workbook.")

# =========================================================================== assemble output
build_date = dt.date.today().isoformat()
version_line = readme_version
sources_line = next((s["lines"][0] for s in readme_sections if s["title"] == "Sources" and s["lines"]), "")
meta = {
    "buildDate": build_date,
    "phases": [{"id": p, "definition": phase_definitions.get(p)} for p in PHASES],
    "catalogue": {"file": FILE_A, "title": readme_title, "version": version_line},
    "jnic": {"file": FILE_B, "title": "JNIC 26 — Tech-legal alignment in AI security"},
    "sources": [s.strip() for s in sources_line.split(" · ") if s.strip()],
    "etsiLink": etsi_link,
}
catalogue = {
    "meta": meta, "flags": flags, "controls": controls, "techniques": techniques, "legalBasis": legal_basis,
}
for t in techniques:
    j = jnic.get(t["id"], {})
    t["jnic"] = {"names": j.get("names", []), "description": fix_text(j.get("description")),
                 "coverage": t.pop("jnic_coverage"), "whyAiAct": j.get("whyAiAct"), "link": j.get("link")}
atlas = {"mitigations": atlas_mitigations, "outside": atlas_outside}
aiact = {
    "premise": premise, "riskTable": risk_table, "obligations": obligations,
    "purposeVocabulary": rules_doc["vocabulary"], "gapsTitle": gaps_title, "gaps": gaps, "papers": papers,
    "etsi": etsi_rows,
}
docs = {"readme": {"title": readme_title, "version": readme_version, "sections": readme_sections},
        "summary": {"families": summary_families, "figures": summary_figures}}
outputs = {"catalogue.json": catalogue, "atlas.json": atlas, "aiact.json": aiact, "catalogue-docs.json": docs,
           "jnic-matrix.json": {"rows": jnic_matrix}}


def walk_strings(o, path="$"):
    if isinstance(o, str):
        yield path, o
    elif isinstance(o, dict):
        for k, v in o.items():
            yield from walk_strings(v, f"{path}.{k}")
    elif isinstance(o, list):
        for i, v in enumerate(o):
            yield from walk_strings(v, f"{path}[{i}]")


# ---- forbidden content and untranslated Spanish
ES_WORDS = re.compile(r"\b(el|los|las|del|que|para|con|una|sistemas|riesgo|datos|deben|también|según|mediante|"
                      r"proveedor(?:es)?|despliegue|obligación|ser|alto)\b", re.I)
lang = section("Language and forbidden content")
spanish_hits = []
for fname, obj in outputs.items():
    for path, s in walk_strings(obj):
        if FORBIDDEN.search(s):
            errors.append(f"Private draft standard referenced in {fname} {path}")
        if path.endswith((".rule", ".condition", ".appliesWhen", ".id", ".key")):
            continue
        hits = ES_WORDS.findall(s)
        if len(hits) >= 3 or re.search(r"[¿¡ñ]|\bRIA\b", s):
            spanish_hits.append(f"{fname} {path}: {s[:70]!r}")
lang.append(f"Translated cells: {len(used_translations)} (data/authored/translations_es_en.json, status: proposed).")
lang.append(f"Strings that look untranslated: {len(spanish_hits)}")
lang.extend(spanish_hits[:20])
errors.extend(f"Untranslated Spanish text: {s}" for s in spanish_hits)
unused = sorted(set(TRANSLATIONS) - used_translations)
if unused:
    warnings_.append(f"Unused translations: {unused}")

# ---- name-like text not present in the two source files
corpus = "\n".join(all_strings(wbA) + all_strings(wbB))
allow = set(load_json("names_allowlist.json")["terms"])
NAME_RE = re.compile(r"\b(?:[A-ZÁÉÍÓÚÑÜ][a-záéíóúñüçèø'’\-]+)(?:[ ]+(?:(?:de|del|la|van|von|der)[ ]+)?[A-ZÁÉÍÓÚÑÜ][a-záéíóúñüçèø'’\-]+){1,3}\b")
COMPANY_RE = re.compile(r"\b[\w&.'\- ]{2,40}?[ ](?:S\.L\.U?\.?|S\.A\.U?\.?|Ltd\.?|Inc\.?|GmbH|LLC|PLC|plc|S\.p\.A\.)(?=\W|$)")
LEADING_GENERIC = {"The", "A", "An", "This", "That", "These", "Those", "If", "When", "For", "In", "On", "At", "By",
                   "Of", "And", "Or", "To", "Being", "Is", "Are", "Art", "Arts", "Annex", "Section", "Point", "Each",
                   "Every", "Any", "No", "Not", "All", "Only", "With", "Without", "Use", "Uses"}
names = section("Name-like text not present in the source files")
candidates = Counter()
for fname, obj in outputs.items():
    for path, s in walk_strings(obj):
        for rx in (NAME_RE, COMPANY_RE):
            for m in rx.finditer(s):
                cand = m.group(0).strip()
                if rx is NAME_RE:
                    words = cand.split()
                    while words and words[0] in LEADING_GENERIC:
                        words.pop(0)
                    if len(words) < 2:
                        continue
                    cand = " ".join(words)
                if cand not in corpus and cand not in allow:
                    candidates[(fname, cand)] += 1
names.append(f"Candidates (capitalised word sequences and company suffixes) not found in the two source files "
             f"or in data/authored/names_allowlist.json: {len(candidates)} (must be 0).")
for (fname, cand), n in sorted(candidates.items()):
    names.append(f"{fname}: '{cand}' ×{n}")
    errors.append(f"Name-like text not in sources: {cand!r} ({fname})")

# =========================================================================== write
if errors:
    print("Data build FAILED:\n  - " + "\n  - ".join(dict.fromkeys(errors)), file=sys.stderr)
    sys.exit(1)

if CHECK_ONLY:
    print("OK: all checks passed (--check: nothing written)")
    sys.exit(0)

OUT.mkdir(parents=True, exist_ok=True)
for fname, obj in outputs.items():
    with open(OUT / fname, "w", encoding="utf-8") as fh:
        json.dump(obj, fh, ensure_ascii=False, indent=1)
        fh.write("\n")

REPORT.parent.mkdir(parents=True, exist_ok=True)
with open(REPORT, "w", encoding="utf-8") as fh:
    fh.write(f"# Data quality report\n\nGenerated by `scripts/build_data.py` on {build_date}.\n\n")
    fh.write(f"Sources: `{FILE_A}` ({version_line}) and `{FILE_B}`.\n")
    for title, items in report.items():
        fh.write(f"\n## {title}\n\n")
        fh.write("\n".join(f"- {x}" for x in items) if items else "- None.")
        fh.write("\n")
    if warnings_:
        fh.write("\n## Warnings\n\n" + "\n".join(f"- {w}" for w in warnings_) + "\n")

print(f"OK: wrote {', '.join(outputs)} to {OUT.relative_to(ROOT)} and {REPORT.relative_to(ROOT)}")
