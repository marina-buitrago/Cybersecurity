/**
 * Deterministic assessment: answers -> flags -> applicable techniques, controls, legal citations and
 * AI Act obligations. Pure functions over the catalogue data; no I/O.
 *
 * Rules (brief section 4.5 and decisions of 2026-11-03):
 * - Techniques apply when their "Applies when" expression is true (two expressions refined, proposed:
 *   data/authored/applicability_refinements.json).
 * - A control is listed only when its "Condition" is true AND it addresses a risk of this system:
 *   at least one applicable technique it mitigates. Two exceptions, both still gated by the condition:
 *   cross-cutting controls (not tied to single techniques) and controls whose techniques are all newer
 *   ATLAS techniques outside the JNIC matrix (no applicability rule of their own; the condition stands in).
 * - Technique <-> control links come from the catalogue sheet "Matrix techniques" (columns
 *   "Catalogue controls (ATLAS link / proposed link)").
 * - Legal citations on a control appear only when their rule in "Legal basis" is true.
 * - Purpose (step 3) never adds or removes techniques or controls.
 * - Scope: "baseline" items apply to any AI system whatever the answers; the rest are "specific".
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
/** "baseline": applies to any AI system, whatever the answers. "specific": depends on the answers. */
export type Scope = 'baseline' | 'specific';
/** Why a control is listed: risks of this system, cross-cutting, or newer ATLAS techniques only. */
export type ControlBasis = 'risks' | 'crossCutting' | 'newerAtlas';

export interface TechniqueResult {
  id: string;
  technique: Technique;
  tbc: boolean;
  group: Group;
  scope: Scope;
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
  scope: Scope;
  basis: ControlBasis;
  /** Phase under which the control is listed: its earliest phase the organisation controls. */
  phase: string;
  /** True flags behind the control and the risks it addresses ("always" for baseline controls). */
  why: string[];
  techniques: { id: string; link: LinkKind }[];
  /** basis "newerAtlas": the ATLAS techniques (outside the JNIC matrix) the control mitigates. */
  newerAtlas: string[];
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

interface PreparedControl {
  c: Control;
  expr: Expr;
  scope: Scope;
  /** Matrix techniques linked to the control. */
  matrixLinks: string[];
  /** Linked techniques outside the JNIC matrix (used only when matrixLinks is empty). */
  newerAtlas: string[];
}

interface Prepared {
  data: EngineData;
  phaseOrder: string[];
  techniques: { t: Technique; expr: Expr }[];
  controls: PreparedControl[];
  legal: Map<string, { lb: LegalBasis; expr: Expr }>;
  obligations: { o: Obligation; expr: Expr }[];
}

const cache = new WeakMap<EngineData, Prepared>();
const isAlways = (expr: Expr) => variablesOf(expr).includes(ALWAYS);

/** Compile every expression once. Throws ExpressionError if any uses an unknown token. */
export function prepare(data: EngineData): Prepared {
  const hit = cache.get(data);
  if (hit) return hit;
  const flags = new Set(data.catalogue.flags.map((f) => f.id));
  const purpose = new Set([...flags, ...data.purposeVocabulary]);
  const techniques = data.catalogue.techniques.map((t) => ({ t, expr: parse(t.appliesWhen, flags) }));
  const matrixIds = new Set(techniques.map(({ t }) => t.id));
  const inMatrix = (id: string) => matrixIds.has(id) || [...matrixIds].some((m) => m.startsWith(`${id}.`));
  const controls: PreparedControl[] = data.catalogue.controls.map((c) => {
    const expr = parse(c.condition, flags);
    const linked = techniques.filter(({ t }) => t.controlsAtlas.includes(c.id) || t.controlsProposed.includes(c.id));
    const newerAtlas = linked.length ? [] : [...c.atlasLinks, ...c.proposedLinks].filter((id) => !inMatrix(id));
    const baseline = isAlways(expr) && (c.crossCutting || newerAtlas.length > 0 || linked.some(({ expr: e }) => isAlways(e)));
    return { c, expr, scope: baseline ? 'baseline' : 'specific', matrixLinks: linked.map(({ t }) => t.id), newerAtlas };
  });
  const prepared: Prepared = {
    data,
    phaseOrder: data.catalogue.meta.phases.map((p) => p.id),
    techniques,
    controls,
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

const trueFlags = (expr: Expr, all: ReadonlySet<string>) => variablesOf(expr).filter((v) => v !== ALWAYS && all.has(v));

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
      scope: isAlways(expr) ? 'baseline' : 'specific',
      why: isAlways(expr) ? [ALWAYS] : trueFlags(expr, fs.all),
      controls: [],
    }));
  const techById = new Map(techniques.map((t) => [t.id, t]));
  const techExpr = new Map(p.techniques.map(({ t, expr }) => [t.id, expr]));

  const order = (ph: string) => p.phaseOrder.indexOf(ph);
  const controls: ControlResult[] = [];
  for (const pc of p.controls) {
    const { c, expr } = pc;
    if (!applies(expr)) continue;
    const links: { id: string; link: LinkKind }[] = pc.matrixLinks
      .filter((id) => techById.has(id))
      .map((id) => ({ id, link: techById.get(id)!.technique.controlsAtlas.includes(c.id) ? 'atlas' : 'proposed' }));
    const basis: ControlBasis | null = links.length
      ? 'risks'
      : c.crossCutting
        ? 'crossCutting'
        : pc.matrixLinks.length === 0 && pc.newerAtlas.length
          ? 'newerAtlas'
          : null;
    if (basis === null) continue; // no risk of this system calls for it

    const ownedPhases = c.phases.filter((ph) => isPhaseOwned(ph, fs.phasesOwned));
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
    const why = new Set(trueFlags(expr, fs.all));
    for (const l of links) for (const f of trueFlags(techExpr.get(l.id)!, fs.all)) why.add(f);
    const risksTbc = links.length > 0 && links.every((l) => techById.get(l.id)!.tbc);
    controls.push({
      id: c.id,
      control: c,
      tbc: toConfirm(expr) || risksTbc,
      group: ownedPhases.length ? 'main' : 'supplyChain',
      scope: pc.scope,
      basis,
      phase: listed[0] ?? c.phases[0],
      why: pc.scope === 'baseline' ? [ALWAYS] : [...why],
      techniques: links.sort((a, b) => a.id.localeCompare(b.id)),
      newerAtlas: basis === 'newerAtlas' ? pc.newerAtlas : [],
      legal,
    });
  }
  for (const cr of controls) {
    for (const l of cr.techniques) techById.get(l.id)!.controls.push({ id: cr.id, link: l.link });
  }

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
