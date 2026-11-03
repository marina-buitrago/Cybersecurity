/**
 * Questionnaire structure and the flags each answer sets (labels live in src/content/en.ts).
 *
 * Flags come from the catalogue sheet "Flags". Step 3 also sets purpose-only variables
 * (data/authored/obligation_rules.json) that are used only for the "Obligations by purpose" block.
 * "I don't know" sets every related flag to true and marks it as unknown: missing information never
 * means "not applicable".
 */

export const UNKNOWN = 'unknown';
export const NONE = 'none';

export type Answer = string | string[];
export type Answers = Partial<Record<string, Answer>>;

export interface OptionDef {
  id: string;
  /** Flags or purpose variables set when this option is chosen. */
  sets?: string[];
  /** Lifecycle phases the organisation controls when this option is chosen (phases question). */
  phases?: string[];
  /** Selecting it clears other options (e.g. "None of these"). */
  exclusive?: boolean;
  /** An Art. 5 prohibited practice: stops the assessment. */
  prohibited?: boolean;
}

export interface QuestionDef {
  id: string;
  step: 1 | 2 | 3;
  kind: 'single' | 'multi';
  options: OptionDef[];
  /** Flags set (as unknown) when the answer is "I don't know". */
  unknownSets: string[];
  /** Shown only when this returns true; hidden questions are ignored. */
  showIf?: (answers: Answers) => boolean;
}

const yesNo = (id: string, step: 1 | 2 | 3, sets: string[]): QuestionDef => ({
  id,
  step,
  kind: 'single',
  options: [{ id: 'yes', sets }, { id: 'no' }],
  unknownSets: sets,
});

export const ANNEX3_AREAS = [
  'annex3_biometrics',
  'annex3_critical_infrastructure',
  'annex3_education',
  'annex3_employment',
  'annex3_essential_services',
  'annex3_law_enforcement',
  'annex3_migration',
  'annex3_justice_democracy',
] as const;

export const ART5_PRACTICES = ['art5_a', 'art5_b', 'art5_c', 'art5_d', 'art5_e', 'art5_f', 'art5_g', 'art5_h'] as const;

/** Art. 6(3)(a)–(d) AI Act: conditions under which an Annex III system is not high-risk. */
export const ART6_3_CONDITIONS = ['art6_3_a', 'art6_3_b', 'art6_3_c', 'art6_3_d'] as const;

export const ART50_CASES = [
  'art50_interaction',
  'art50_synthetic',
  'art50_emotion_biometric',
  'art50_deepfake',
  'art50_public_text',
] as const;

/** True when a multi-select answer is "I don't know" or has an option other than "None of these". */
const anyOption = (v: Answer | undefined) => v === UNKNOWN || (Array.isArray(v) && v.some((x) => x !== NONE));
const hasAnnex3 = (a: Answers) => anyOption(a.annex3);
const hasArt63Condition = (a: Answers) => hasAnnex3(a) && anyOption(a.art6_3_conditions);

export const QUESTIONS: QuestionDef[] = [
  // ---- Step 1. What is the system?
  {
    id: 'typology',
    step: 1,
    kind: 'single',
    options: [
      { id: 'llm', sets: ['generative'] },
      { id: 'agentic', sets: ['generative', 'agent'] },
      { id: 'predictive', sets: ['predictive'] },
      { id: 'multimodal', sets: ['generative'] },
    ],
    unknownSets: ['predictive', 'generative', 'agent'],
  },
  {
    id: 'origin',
    step: 1,
    kind: 'single',
    options: [
      { id: 'in_house' },
      { id: 'fine_tuned', sets: ['third_party_artifacts'] },
      { id: 'api', sets: ['third_party_model_api'] },
      { id: 'open_weights', sets: ['third_party_artifacts'] },
    ],
    unknownSets: ['third_party_artifacts', 'third_party_model_api'],
  },
  {
    id: 'phases',
    step: 1,
    kind: 'multi',
    options: [
      { id: 'design', phases: ['Design'] },
      { id: 'pretraining', sets: ['trains_model'], phases: ['Pre-training'] },
      { id: 'finetuning_weights', sets: ['trains_model'], phases: ['Fine-tuning and alignment'] },
      { id: 'configuration', phases: ['Fine-tuning and alignment'] },
      { id: 'evaluation', phases: ['Evaluation'] },
      { id: 'deployment', phases: ['Deployment'] },
      { id: 'monitoring', phases: ['Monitoring'] },
      { id: 'update', phases: ['Update'] },
      { id: 'end_of_life', phases: ['End of life'] },
    ],
    unknownSets: ['trains_model'],
  },
  // ---- Step 2. How is it exposed?
  {
    id: 'access',
    step: 2,
    kind: 'multi',
    options: [
      { id: 'authenticated', sets: ['authenticated_users'] },
      { id: 'public', sets: ['public_access'] },
    ],
    unknownSets: ['authenticated_users', 'public_access'],
  },
  yesNo('third_party_api', 2, ['third_party_api']),
  yesNo('detailed_outputs', 2, ['detailed_outputs']),
  yesNo('natural_language', 2, ['natural_language']),
  yesNo('external_content', 2, ['external_content']),
  yesNo('rag', 2, ['rag']),
  {
    id: 'tools',
    step: 2,
    kind: 'single',
    options: [{ id: 'none' }, { id: 'read', sets: ['tools'] }, { id: 'write', sets: ['tools', 'write_tools'] }],
    unknownSets: ['tools', 'write_tools'],
  },
  yesNo('persistent_memory', 2, ['persistent_memory']),
  yesNo('continuous_learning', 2, ['continuous_learning']),
  yesNo('third_party_artifacts', 2, ['third_party_artifacts']),
  yesNo('physical_inputs', 2, ['physical_inputs']),
  yesNo('identity_verification', 2, ['identity_verification']),
  yesNo('personal_data', 2, ['personal_data']),
  yesNo('secrets', 2, ['secrets']),
  yesNo('renders_output', 2, ['renders_output']),
  yesNo('generates_code', 2, ['generates_code']),
  yesNo('on_device_weights', 2, ['on_device_weights']),
  // ---- Step 3. What is it used for? (adds only the legal layer)
  {
    id: 'role',
    step: 3,
    kind: 'multi',
    options: [
      { id: 'provider', sets: ['provider'] },
      { id: 'deployer', sets: ['deployer'] },
      { id: 'importer', sets: ['importer'] },
      { id: 'distributor', sets: ['distributor'] },
    ],
    unknownSets: ['provider', 'deployer', 'importer', 'distributor'],
  },
  {
    id: 'prohibited',
    step: 3,
    kind: 'multi',
    options: [...ART5_PRACTICES.map((id) => ({ id, prohibited: true })), { id: NONE, exclusive: true }],
    unknownSets: [],
  },
  {
    id: 'annex3',
    step: 3,
    kind: 'multi',
    options: [...ANNEX3_AREAS.map((id) => ({ id, sets: ['annex3', id] })), { id: NONE, exclusive: true }],
    unknownSets: ['annex3', ...ANNEX3_AREAS],
  },
  // Art. 6(3): the exceptions (a)–(d), then the exception to them (profiling keeps the system high-risk).
  {
    id: 'art6_3_conditions',
    step: 3,
    kind: 'multi',
    options: [...ART6_3_CONDITIONS.map((id) => ({ id })), { id: NONE, exclusive: true }],
    unknownSets: [],
    showIf: hasAnnex3,
  },
  { ...yesNo('profiling', 3, []), showIf: hasArt63Condition },
  yesNo('annex1', 3, ['annex1']),
  {
    id: 'art50',
    step: 3,
    kind: 'multi',
    options: [...ART50_CASES.map((id) => ({ id, sets: [id] })), { id: NONE, exclusive: true }],
    unknownSets: [...ART50_CASES],
  },
  yesNo('gpai', 3, ['gpai_systemic_risk']),
];

export const QUESTION_BY_ID = new Map(QUESTIONS.map((q) => [q.id, q]));

export function visibleQuestions(step: 1 | 2 | 3, answers: Answers): QuestionDef[] {
  return QUESTIONS.filter((q) => q.step === step && (!q.showIf || q.showIf(answers)));
}

export function isAnswered(q: QuestionDef, answer: Answer | undefined): boolean {
  if (answer === UNKNOWN) return true;
  if (q.kind === 'single') return typeof answer === 'string' && q.options.some((o) => o.id === answer);
  return Array.isArray(answer) && answer.length > 0 && answer.every((a) => q.options.some((o) => o.id === a));
}

export function isStepComplete(step: 1 | 2 | 3, answers: Answers): boolean {
  return visibleQuestions(step, answers).every((q) => isAnswered(q, answers[q.id]));
}

/** Toggle an option in a multi-select answer, honouring exclusive options and "I don't know". */
export function toggleMulti(q: QuestionDef, current: Answer | undefined, optionId: string): Answer {
  if (optionId === UNKNOWN) return current === UNKNOWN ? [] : UNKNOWN;
  const selected = Array.isArray(current) ? current : [];
  const opt = q.options.find((o) => o.id === optionId);
  if (selected.includes(optionId)) return selected.filter((x) => x !== optionId);
  if (opt?.exclusive) return [optionId];
  const exclusive = new Set(q.options.filter((o) => o.exclusive).map((o) => o.id));
  return [...selected.filter((x) => !exclusive.has(x)), optionId];
}

export type Tri = 'yes' | 'no' | 'unknown';

export interface FlagSource {
  questionId: string;
  optionId: string;
}

export interface FlagState {
  /** Variables set by an explicit answer (plus `always`). */
  known: Set<string>;
  /** Variables true only because of an "I don't know" answer. */
  unknown: Set<string>;
  /** known ∪ unknown: the variables treated as true. */
  all: Set<string>;
  /** Which answers set each variable. */
  sources: Map<string, FlagSource[]>;
  phasesOwned: Set<string>;
  phasesUnknown: boolean;
  prohibited: string[];
  prohibitedUnknown: boolean;
  highRisk: Tri;
}

export const ALL_LIFECYCLE_PHASES = [
  'Design',
  'Pre-training',
  'Fine-tuning and alignment',
  'Evaluation',
  'Deployment',
  'Monitoring',
  'Update',
  'End of life',
];

export function computeFlags(answers: Answers): FlagState {
  const known = new Set<string>(['always']);
  const unknownOnly = new Set<string>();
  const sources = new Map<string, FlagSource[]>();
  const phasesOwned = new Set<string>();
  let phasesUnknown = false;
  const prohibited: string[] = [];
  let prohibitedUnknown = false;

  const addSource = (v: string, s: FlagSource) => {
    const list = sources.get(v) ?? [];
    list.push(s);
    sources.set(v, list);
  };

  for (const q of QUESTIONS) {
    if (q.showIf && !q.showIf(answers)) continue;
    const a = answers[q.id];
    if (a === undefined) continue;
    if (a === UNKNOWN) {
      for (const v of q.unknownSets) {
        unknownOnly.add(v);
        addSource(v, { questionId: q.id, optionId: UNKNOWN });
      }
      if (q.id === 'phases') phasesUnknown = true;
      if (q.id === 'prohibited') prohibitedUnknown = true;
      continue;
    }
    const chosen = Array.isArray(a) ? a : [a];
    for (const optionId of chosen) {
      const opt = q.options.find((o) => o.id === optionId);
      if (!opt) continue;
      for (const v of opt.sets ?? []) {
        known.add(v);
        addSource(v, { questionId: q.id, optionId });
      }
      for (const p of opt.phases ?? []) phasesOwned.add(p);
      if (opt.prohibited) prohibited.push(optionId);
    }
  }

  // High risk: Annex I safety component, or an Annex III area without the Art. 6(3) derogation.
  // The derogation applies when a condition (a)–(d) is met and the system does not profile natural persons
  // (Art. 6(3), last subparagraph: profiling always keeps an Annex III system high-risk).
  const tri = (id: string): Tri | undefined => {
    const v = answers[id];
    if (v === UNKNOWN) return 'unknown';
    if (v === 'yes') return 'yes';
    if (v === 'no') return 'no';
    return undefined;
  };
  const a3 = answers.annex3;
  const annex3: Tri = a3 === UNKNOWN ? 'unknown' : Array.isArray(a3) && a3.some((x) => x !== NONE) ? 'yes' : 'no';
  let derogation: Tri = 'no';
  if (annex3 !== 'no') {
    const c = answers.art6_3_conditions;
    const conditions: Tri = c === UNKNOWN ? 'unknown' : anyOption(c) ? 'yes' : Array.isArray(c) ? 'no' : 'unknown';
    const profiling = conditions === 'no' ? 'no' : (tri('profiling') ?? 'unknown');
    if (conditions === 'no' || profiling === 'yes') derogation = 'no';
    else if (conditions === 'yes' && profiling === 'no') derogation = 'yes';
    else derogation = 'unknown';
  }
  const annex3Part: Tri = annex3 === 'no' || derogation === 'yes' ? 'no' : derogation === 'no' ? annex3 : 'unknown';
  if (derogation === 'yes') {
    known.add('art6_3');
    addSource('art6_3', { questionId: 'art6_3_conditions', optionId: 'yes' });
  } else if (derogation === 'unknown') {
    unknownOnly.add('art6_3');
    addSource('art6_3', { questionId: 'art6_3_conditions', optionId: UNKNOWN });
  }
  const annex1 = tri('annex1') ?? 'no';
  const highRisk: Tri =
    annex1 === 'yes' || annex3Part === 'yes' ? 'yes' : annex1 === 'unknown' || annex3Part === 'unknown' ? 'unknown' : 'no';
  if (highRisk === 'yes') {
    known.add('high_risk');
    addSource('high_risk', { questionId: annex1 === 'yes' ? 'annex1' : 'annex3', optionId: 'yes' });
  } else if (highRisk === 'unknown') {
    unknownOnly.add('high_risk');
    addSource('high_risk', { questionId: 'annex3', optionId: UNKNOWN });
  }

  if (phasesUnknown) ALL_LIFECYCLE_PHASES.forEach((p) => phasesOwned.add(p));

  const unknown = new Set([...unknownOnly].filter((v) => !known.has(v)));
  return {
    known,
    unknown,
    all: new Set([...known, ...unknown]),
    sources,
    phasesOwned,
    phasesUnknown,
    prohibited,
    prohibitedUnknown,
    highRisk,
  };
}
