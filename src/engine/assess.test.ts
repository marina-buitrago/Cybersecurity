import { describe, expect, it } from 'vitest';
import { assess, type AssessmentResult } from './assess';
import { engineData } from './data';
import { ExpressionError, evaluate, parse } from './expr';
import { QUESTIONS, UNKNOWN, computeFlags, visibleQuestions, type Answers } from './questionnaire';

/** Answers with every yes/no question set to "no" and neutral step-3 answers, overridden by `over`. */
function answers(over: Answers): Answers {
  const base: Answers = {
    typology: 'llm',
    origin: 'in_house',
    phases: ['design', 'pretraining', 'finetuning_weights', 'evaluation', 'deployment', 'monitoring', 'update', 'end_of_life'],
    access: ['authenticated'],
    tools: 'none',
    role: ['provider'],
    prohibited: ['none'],
    annex3: ['none'],
    art50: ['none'],
  };
  for (const q of QUESTIONS) {
    if (base[q.id] === undefined && q.options.some((o) => o.id === 'no')) base[q.id] = 'no';
  }
  return { ...base, ...over };
}

const run = (a: Answers) => assess(a, engineData);
const techIds = (r: AssessmentResult) => r.techniques.map((t) => t.id);
const ctrlIds = (r: AssessmentResult) => r.controls.map((c) => c.id);
const citations = (r: AssessmentResult) => r.controls.flatMap((c) => c.legal.map((l) => l.citation));

describe('1. Internal tabular classifier, own training, authenticated users only', () => {
  const r = run(answers({ typology: 'predictive', origin: 'in_house', access: ['authenticated'] }));
  it('has no prompt injection techniques (AML.T0051.*)', () => {
    expect(techIds(r).filter((id) => id.startsWith('AML.T0051'))).toEqual([]);
  });
  it('includes MOD-01 and DAT-01', () => {
    expect(ctrlIds(r)).toEqual(expect.arrayContaining(['MOD-01', 'DAT-01']));
  });
  it('does not include ACC-02', () => {
    expect(ctrlIds(r)).not.toContain('ACC-02');
  });
});

describe('2. Public RAG chatbot on a third-party API with personal data', () => {
  const a = answers({
    typology: 'llm',
    origin: 'api',
    phases: ['design', 'configuration', 'deployment', 'monitoring', 'update'],
    access: ['public'],
    natural_language: 'yes',
    rag: 'yes',
    personal_data: 'yes',
    role: ['deployer'],
  });
  const r = run(a);
  it('includes AML.T0051.001 and AML.T0070', () => {
    expect(techIds(r)).toEqual(expect.arrayContaining(['AML.T0051.001', 'AML.T0070']));
  });
  it('includes GEN-02, DAT-05 and DAT-06', () => {
    expect(ctrlIds(r)).toEqual(expect.arrayContaining(['GEN-02', 'DAT-05', 'DAT-06']));
  });
  it('shows GDPR citations', () => {
    expect(citations(r).some((c) => c.endsWith('GDPR'))).toBe(true);
  });
  it('without high risk shows no Art. 15(5) AI Act', () => {
    expect(r.highRisk).toBe('no');
    expect(citations(r)).not.toContain('Art. 15(5) AI Act');
  });
  it('keeps RAG poisoning with the organisation when it configures the RAG corpus', () => {
    expect(r.techniques.find((t) => t.id === 'AML.T0070')?.group).toBe('main');
  });
  it('purpose never changes techniques or controls', () => {
    const highRisk = run({ ...a, annex3: ['annex3_employment'], art6_3_conditions: ['none'], role: ['provider', 'deployer'], gpai: 'yes' });
    expect(highRisk.highRisk).toBe('yes');
    expect(techIds(highRisk)).toEqual(techIds(r));
    expect(ctrlIds(highRisk)).toEqual(ctrlIds(r));
    expect(citations(highRisk)).toContain('Art. 15(5) AI Act');
  });
});

describe('3. Agent with write tools, persistent memory and secrets', () => {
  const r = run(
    answers({
      typology: 'agentic',
      origin: 'api',
      phases: ['design', 'configuration', 'deployment', 'monitoring'],
      natural_language: 'yes',
      tools: 'write',
      persistent_memory: 'yes',
      secrets: 'yes',
    }),
  );
  it('includes AML.T0080.000 and AML.T0053', () => {
    expect(techIds(r)).toEqual(expect.arrayContaining(['AML.T0080.000', 'AML.T0053']));
  });
  it('includes AGT-04, AGT-07, AGT-09 and ACC-05', () => {
    expect(ctrlIds(r)).toEqual(expect.arrayContaining(['AGT-04', 'AGT-07', 'AGT-09', 'ACC-05']));
  });
});

describe('4. Open-weights model fine-tuned in house, deployed on the user device', () => {
  const r = run(
    answers({
      typology: 'llm',
      origin: 'open_weights',
      phases: ['finetuning_weights', 'evaluation', 'deployment', 'update'],
      on_device_weights: 'yes',
    }),
  );
  it('includes AML.T0010.003 and AML.T0044', () => {
    expect(techIds(r)).toEqual(expect.arrayContaining(['AML.T0010.003', 'AML.T0044']));
  });
  it('includes EXP-04 and SUP-07', () => {
    expect(ctrlIds(r)).toEqual(expect.arrayContaining(['EXP-04', 'SUP-07']));
  });
});

describe('5. "I don\'t know" on every question', () => {
  const all: Answers = Object.fromEntries(QUESTIONS.map((q) => [q.id, UNKNOWN]));
  const r = run(all);
  it('sets every catalogue flag to true', () => {
    const fs = computeFlags(all);
    for (const f of engineData.catalogue.flags) expect(fs.all.has(f.id), f.id).toBe(true);
  });
  it('applies every technique and control', () => {
    expect(r.techniques).toHaveLength(engineData.catalogue.techniques.length);
    expect(r.controls).toHaveLength(engineData.catalogue.controls.length);
  });
  it('tags every result "To be confirmed"', () => {
    expect(r.techniques.every((t) => t.tbc)).toBe(true);
    expect(r.controls.every((c) => c.tbc)).toBe(true);
    expect(r.controls.flatMap((c) => c.legal).every((l) => l.tbc)).toBe(true);
    expect(r.obligations.length).toBeGreaterThan(0);
    expect(r.obligations.every((o) => o.tbc)).toBe(true);
    expect(r.counts.toBeConfirmed).toBe(r.counts.controls + r.counts.techniques);
  });
  it('does not stop on an unknown answer about prohibited practices', () => {
    expect(r.prohibited).toEqual([]);
    expect(r.prohibitedUnknown).toBe(true);
  });
});

describe('6. Expression parser', () => {
  const vocab = new Set(['always', 'rag', 'tools', 'agent']);
  it('evaluates flags, &&, || and parentheses', () => {
    const e = parse('rag && (tools || agent)', vocab);
    expect(evaluate(e, new Set(['rag', 'agent']))).toBe(true);
    expect(evaluate(e, new Set(['rag']))).toBe(false);
    expect(evaluate(parse('always', vocab), new Set())).toBe(true);
  });
  it('rejects unknown tokens', () => {
    expect(() => parse('rag && not_a_flag', vocab)).toThrow(ExpressionError);
    expect(() => parse('rag && not_a_flag', vocab)).toThrow(/Unknown token "not_a_flag"/);
  });
  it.each([
    ['!rag', 'negation'],
    ['rag & tools', 'single ampersand'],
    ['rag | tools', 'single pipe'],
    ['rag and tools', 'word operator (unknown token)'],
    ['eval(rag)', 'function call'],
    ['rag; tools', 'semicolon'],
    ['rag == tools', 'comparison'],
    ['"rag"', 'string literal'],
    ['1', 'number'],
    ['(rag || tools', 'unbalanced parenthesis'],
    ['rag ||', 'dangling operator'],
    ['rag tools', 'missing operator'],
    ['', 'empty'],
  ])('rejects %s (%s)', (src) => {
    expect(() => parse(src, vocab)).toThrow(ExpressionError);
  });
  it('compiles every expression in the catalogue and the obligation rules', () => {
    const flags = new Set(engineData.catalogue.flags.map((f) => f.id));
    for (const c of engineData.catalogue.controls) expect(() => parse(c.condition, flags)).not.toThrow();
    for (const t of engineData.catalogue.techniques) expect(() => parse(t.appliesWhen, flags)).not.toThrow();
    for (const l of engineData.catalogue.legalBasis) expect(() => parse(l.rule, flags)).not.toThrow();
    const purpose = new Set([...flags, ...engineData.purposeVocabulary]);
    for (const o of engineData.obligations) expect(() => parse(o.rule, purpose)).not.toThrow();
  });
});

describe('Other rules', () => {
  it('stops at a prohibited practice and shows nothing else', () => {
    const r = run(answers({ prohibited: ['art5_c'] }));
    expect(r.prohibited).toEqual(['art5_c']);
    expect(r.techniques).toEqual([]);
    expect(r.controls).toEqual([]);
    expect(r.obligations).toEqual([]);
  });
  it('treats an Annex III system as high risk unless the Art. 6(3) derogation applies', () => {
    const edu = { annex3: ['annex3_education'] };
    // No exception (a)-(d): high risk.
    expect(run(answers({ ...edu, art6_3_conditions: ['none'] })).highRisk).toBe('yes');
    // An exception and no profiling: not high risk.
    expect(run(answers({ ...edu, art6_3_conditions: ['art6_3_a'], profiling: 'no' })).highRisk).toBe('no');
    // An exception, but the system profiles natural persons: always high risk.
    expect(run(answers({ ...edu, art6_3_conditions: ['art6_3_b', 'art6_3_d'], profiling: 'yes' })).highRisk).toBe('yes');
    // Unknowns keep the classification open.
    expect(run(answers({ ...edu, art6_3_conditions: UNKNOWN, profiling: 'no' })).highRisk).toBe('unknown');
    expect(run(answers({ ...edu, art6_3_conditions: ['art6_3_c'], profiling: UNKNOWN })).highRisk).toBe('unknown');
    expect(run(answers({ annex1: 'yes' })).highRisk).toBe('yes');
  });
  it('asks about profiling only when an Art. 6(3) exception may apply', () => {
    const shown = (a: Answers) => visibleQuestions(3, answers(a)).map((q) => q.id);
    expect(shown({ annex3: ['none'] })).not.toContain('art6_3_conditions');
    expect(shown({ annex3: ['annex3_employment'], art6_3_conditions: ['none'] })).not.toContain('profiling');
    expect(shown({ annex3: ['annex3_employment'], art6_3_conditions: ['art6_3_a'] })).toContain('profiling');
    // A stale "yes" to profiling is ignored once no exception is selected.
    expect(run(answers({ annex3: ['annex3_employment'], art6_3_conditions: ['none'], profiling: 'yes' })).highRisk).toBe('yes');
  });
  it('selects the Art. 6(4) and 49(2) obligation only when the derogation applies', () => {
    const art64 = (a: Answers) => run(answers({ annex3: ['annex3_employment'], role: ['provider'], ...a })).obligations.some((o) => o.obligation.row === 5);
    expect(art64({ art6_3_conditions: ['art6_3_a'], profiling: 'no' })).toBe(true);
    expect(art64({ art6_3_conditions: ['art6_3_a'], profiling: 'yes' })).toBe(false);
    expect(art64({ art6_3_conditions: ['none'] })).toBe(false);
  });
  it('tags only what depends on an unknown answer', () => {
    const r = run(answers({ rag: UNKNOWN }));
    expect(r.controls.find((c) => c.id === 'DAT-05')?.tbc).toBe(true); // condition: rag
    expect(r.controls.find((c) => c.id === 'GOV-01')?.tbc).toBe(false); // condition: always
  });
  it('sends phases the organisation does not control to the supply-chain group', () => {
    const r = run(answers({ origin: 'api', phases: ['deployment', 'monitoring'] }));
    const t = r.techniques.find((x) => x.id === 'AML.T0010.002' || x.id === 'AML.T0010.004');
    expect(t?.group).toBe('supplyChain');
    expect(r.controls.find((c) => c.id === 'DAT-03')).toBeUndefined(); // trains_model is false
    expect(r.controls.filter((c) => c.group === 'supplyChain').every((c) => c.control.phases.every((p) => !['Deployment', 'Monitoring'].includes(p)))).toBe(true);
  });
  it('puts attacker-preparation techniques in their own group', () => {
    const r = run(answers({}));
    const prep = r.techniques.filter((t) => t.technique.attackerPreparation);
    expect(prep.length).toBeGreaterThan(0);
    expect(prep.every((t) => t.group === 'attackerPreparation')).toBe(true);
  });
  it('keeps controls for the four IDs retired from ATLAS 2026.10', () => {
    const r = run(answers({ third_party_artifacts: 'yes', rag: 'yes' }));
    const retired = r.techniques.find((t) => t.id === 'AML.T0019');
    expect(retired?.controls.length).toBeGreaterThan(0);
  });
  it('lists a control only when a risk of this system calls for it', () => {
    // ACC-08 (condition "always") mitigates only Exploit Public-Facing Application in the matrix.
    expect(ctrlIds(run(answers({ access: ['authenticated'] })))).not.toContain('ACC-08');
    expect(ctrlIds(run(answers({ access: ['public'] })))).toContain('ACC-08');
    // INV-03 (generative || agent) mitigates only Modify AI Agent Configuration (agent).
    expect(ctrlIds(run(answers({ typology: 'llm' })))).not.toContain('INV-03');
    expect(ctrlIds(run(answers({ typology: 'agentic' })))).toContain('INV-03');
    for (const c of run(answers({})).controls) {
      if (c.basis === 'risks') expect(c.techniques.length, c.id).toBeGreaterThan(0);
    }
  });
  it('keeps cross-cutting controls and controls tied only to newer ATLAS techniques', () => {
    const r = run(answers({ typology: 'agentic' }));
    expect(r.controls.find((c) => c.id === 'GOV-01')?.basis).toBe('crossCutting');
    expect(r.controls.find((c) => c.id === 'AGT-09')?.basis).toBe('newerAtlas');
    expect(r.controls.find((c) => c.id === 'AGT-09')?.newerAtlas.length).toBeGreaterThan(0);
  });
  it('applies the proposed condition refinements', () => {
    const predictive = techIds(run(answers({ typology: 'predictive' })));
    expect(predictive).not.toContain('AML.T0052.000');
    expect(predictive).not.toContain('AML.T0073');
    expect(techIds(run(answers({ typology: 'predictive', identity_verification: 'yes' })))).toContain('AML.T0073');
    expect(techIds(run(answers({ typology: 'llm' })))).toEqual(expect.arrayContaining(['AML.T0052.000', 'AML.T0073']));
    expect(ctrlIds(run(answers({ typology: 'predictive' })))).not.toContain('PPL-02');
  });
  it('separates baseline items from those specific to the answers', () => {
    const a = run(answers({ typology: 'predictive' }));
    const b = run(answers({ typology: 'agentic', tools: 'write', rag: 'yes', access: ['public'] }));
    const baseline = (r: AssessmentResult) => r.controls.filter((c) => c.scope === 'baseline').map((c) => c.id).sort();
    expect(baseline(a)).toEqual(baseline(b));
    expect(a.controls.find((c) => c.id === 'MOD-01')?.scope).toBe('specific');
    expect(b.controls.find((c) => c.id === 'AGT-04')?.scope).toBe('specific');
    expect(a.techniques.filter((t) => t.scope === 'baseline').every((t) => t.technique.appliesWhen === 'always')).toBe(true);
  });
  it('lists a control under the earliest phase the organisation controls', () => {
    const r = run(answers({ phases: ['deployment', 'monitoring'] }));
    expect(r.controls.find((c) => c.id === 'GOV-04')?.phase).toBe('Deployment');
  });
});
