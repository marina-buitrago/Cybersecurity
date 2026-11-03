/**
 * Deterministic assessment: answers -> flags -> applicable techniques, controls, legal citations and
 * AI Act obligations. Pure functions over the catalogue data; no I/O.
 *
 * Rules (brief section 4.5 and decisions of 2026-11-03):
 * - Techniques apply when their "Applies when" expression is true; controls when their "Condition" is true.
 * - Technique <-> control links come from the catalogue sheet "Matrix techniques" (columns
 *   "Catalogue controls (ATLAS link / proposed link)"), which equal the "ID or parent ID" rule except for
 *   four IDs retired from ATLAS 2026.10.
 * - Legal citations on a control appear only when their rule in "Legal basis" is true.
 * - Purpose (step 3) never adds or removes techniques or controls.
 * - "To be confirmed": the item applies only because of an "I don't know" answer, or the phases
 *   question was answered "I don't know" (so the grouping cannot be confirmed).
 * - Phase ownership: an item goes to "Supply chain" when the organisation controls none of its phases.
 *   "Development and Monitoring" counts as controlled when Monitoring is controlled (proposed rule).
 */
import { ALWAYS, evaluate, parse, variablesOf, type Expr } from './expr';
import { computeFlags, type Answers, type FlagState } from './questionnaire';
import type { Catalogue, Control, LegalBasis, Obligation, Technique } from './types';

export type Group = 'main' | 'supplyChain' | 'attackerPreparation';
export type LinkKind = 'atlas' | 'proposed';

export interface TechniqueResult {
  id: string;
  technique: Technique;
  tbc: boolean;
  group: Group;
  /** True flags in the technique's expression ("always" when it applies to any system). */
  why: string[];
  controls: { id: string; link: LinkKind }[];
}

export interface LegalResult {
  key: string;
  citation: string;
  condition: string;
  concreteness: string;
  tbc: boolean;
}

export interface ControlResult {
  id: string;
  control: Control;
  tbc: boolean;
  group: Exclude<Group, 'attackerPreparation'>;
  /** Phase under which the control is listed: its earliest phase the organisation controls. */
  phase: string;
  why: string[];
  techniques: { id: string; link: LinkKind }[];
  legal: LegalResult[];
}

export interface ObligationResult {
  obligation: Obligation;
  tbc: boolean;
}

export interface AssessmentResult {
  flags: { known: string[]; unknown: string[] };
  highRisk: FlagState['highRisk'];
  /** Non-empty: an Art. 5 practice was marked; nothing else is computed. */
  prohibited: string[];
  prohibitedUnknown: boolean;
  phasesOwned: string[];
  phasesUnknown: boolean;
  techniques: TechniqueResult[];
  controls: ControlResult[];
  obligations: ObligationResult[];
  counts: { controls: number; techniques: number; toBeConfirmed: number };
}

export interface EngineData {
  catalogue: Catalogue;
  obligations: Obligation[];
  purposeVocabulary: string[];
}

interface Prepared {
  data: EngineData;
  phaseOrder: string[];
  techniques: { t: Technique; expr: Expr }[];
  controls: { c: Control; expr: Expr }[];
  legal: Map<string, { lb: LegalBasis; expr: Expr }>;
  obligations: { o: Obligation; expr: Expr }[];
}

const cache = new WeakMap<EngineData, Prepared>();

/** Compile every expression once. Throws ExpressionError if any uses an unknown token. */
export function prepare(data: EngineData): Prepared {
  const hit = cache.get(data);
  if (hit) return hit;
  const flags = new Set(data.catalogue.flags.map((f) => f.id));
  const purpose = new Set([...flags, ...data.purposeVocabulary]);
  const prepared: Prepared = {
    data,
    phaseOrder: data.catalogue.meta.phases.map((p) => p.id),
    techniques: data.catalogue.techniques.map((t) => ({ t, expr: parse(t.appliesWhen, flags) })),
    controls: data.catalogue.controls.map((c) => ({ c, expr: parse(c.condition, flags) })),
    legal: new Map(data.catalogue.legalBasis.map((lb) => [lb.citation, { lb, expr: parse(lb.rule, flags) }])),
    obligations: data.obligations.map((o) => ({ o, expr: parse(o.rule, purpose) })),
  };
  cache.set(data, prepared);
  return prepared;
}

export function isPhaseOwned(phase: string, owned: ReadonlySet<string>): boolean {
  if (phase === 'Development and Monitoring') return owned.has('Monitoring');
  return owned.has(phase);
}

const whyOf = (expr: Expr, all: ReadonlySet<string>) => {
  const vars = variablesOf(expr);
  if (vars.includes(ALWAYS)) return [ALWAYS];
  return vars.filter((v) => all.has(v));
};

export function assess(answers: Answers, data: EngineData): AssessmentResult {
  const p = prepare(data);
  const fs = computeFlags(answers);
  const base = {
    flags: { known: [...fs.known].filter((f) => f !== ALWAYS).sort(), unknown: [...fs.unknown].sort() },
    highRisk: fs.highRisk,
    prohibited: fs.prohibited,
    prohibitedUnknown: fs.prohibitedUnknown,
    phasesOwned: p.phaseOrder.filter((ph) => fs.phasesOwned.has(ph)),
    phasesUnknown: fs.phasesUnknown,
  };
  if (fs.prohibited.length > 0) {
    return { ...base, techniques: [], controls: [], obligations: [], counts: { controls: 0, techniques: 0, toBeConfirmed: 0 } };
  }

  const applies = (expr: Expr) => evaluate(expr, fs.all);
  const toConfirm = (expr: Expr) => fs.phasesUnknown || !evaluate(expr, fs.known);
  const owned = (phases: string[]) => phases.some((ph) => isPhaseOwned(ph, fs.phasesOwned));

  const techniques: TechniqueResult[] = p.techniques
    .filter(({ expr }) => applies(expr))
    .map(({ t, expr }) => ({
      id: t.id,
      technique: t,
      tbc: toConfirm(expr),
      group: t.attackerPreparation ? 'attackerPreparation' : owned(t.phases) ? 'main' : 'supplyChain',
      why: whyOf(expr, fs.all),
      controls: [],
    }));

  const controls: ControlResult[] = p.controls
    .filter(({ expr }) => applies(expr))
    .map(({ c, expr }) => {
      const ownedPhases = c.phases.filter((ph) => isPhaseOwned(ph, fs.phasesOwned));
      const order = (ph: string) => p.phaseOrder.indexOf(ph);
      const listed = (ownedPhases.length ? ownedPhases : c.phases).slice().sort((a, b) => order(a) - order(b));
      const legal: LegalResult[] = [];
      for (const ref of c.legal) {
        const entry = ref.citation ? p.legal.get(ref.citation) : undefined;
        if (!entry || !applies(entry.expr)) continue;
        legal.push({
          key: entry.lb.key,
          citation: entry.lb.citation,
          condition: ref.condition ?? entry.lb.condition,
          concreteness: ref.concreteness ?? entry.lb.concreteness,
          tbc: !evaluate(entry.expr, fs.known),
        });
      }
      return {
        id: c.id,
        control: c,
        tbc: toConfirm(expr),
        group: ownedPhases.length ? 'main' : 'supplyChain',
        phase: listed[0] ?? c.phases[0],
        why: whyOf(expr, fs.all),
        techniques: [],
        legal,
      } satisfies ControlResult;
    });
  const ctrlById = new Map(controls.map((c) => [c.id, c]));

  for (const tr of techniques) {
    const links: [string[], LinkKind][] = [
      [tr.technique.controlsAtlas, 'atlas'],
      [tr.technique.controlsProposed, 'proposed'],
    ];
    for (const [ids, link] of links) {
      for (const cid of ids) {
        const cr = ctrlById.get(cid);
        if (!cr) continue;
        tr.controls.push({ id: cid, link });
        cr.techniques.push({ id: tr.id, link });
      }
    }
  }
  for (const cr of controls) cr.techniques.sort((a, b) => a.id.localeCompare(b.id));

  const obligations: ObligationResult[] = p.obligations
    .filter(({ expr }) => applies(expr))
    .map(({ o, expr }) => ({ obligation: o, tbc: !evaluate(expr, fs.known) }));

  return {
    ...base,
    techniques,
    controls,
    obligations,
    counts: {
      controls: controls.length,
      techniques: techniques.length,
      toBeConfirmed: controls.filter((c) => c.tbc).length + techniques.filter((t) => t.tbc).length,
    },
  };
}
