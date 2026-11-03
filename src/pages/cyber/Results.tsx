import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHead } from '../../components/Shell';
import {
  Disclosure,
  ExternalLink,
  MoreText,
  Segmented,
  TbcTag,
  atlasMitigationUrl,
  atlasTechniqueUrl,
  downloadJson,
} from '../../components/ui';
import { en } from '../../content/en';
import type { AssessmentResult, ControlResult, TechniqueResult } from '../../engine/assess';
import { atlas, catalogue, controlById, flagById, phaseOrder, techniqueById } from '../../engine/data';
import { QUESTION_BY_ID, UNKNOWN, isStepComplete, type Answers } from '../../engine/questionnaire';
import { createLocalAssessmentService } from '../../engine/service';
import { useAnswers } from './state';

const service = createLocalAssessmentService();
const newerAtlasById = new Map(atlas.outside.map((o) => [o.id, o]));
const R = en.cyber.results;
type View = 'controls' | 'attacks';

// ---------------------------------------------------------------- summary sentence
function optionText(qid: string, v: string) {
  return en.cyber.questions[qid]?.options?.[v] ?? v;
}

export function summarize(a: Answers): string {
  const parts: string[] = [];
  const tbc = ` (${en.common.toBeConfirmed.toLowerCase()})`;
  for (const qid of ['typology', 'origin']) {
    const v = a[qid];
    if (v === UNKNOWN) parts.push(`${en.cyber.questions[qid].label}${tbc}`);
    else if (typeof v === 'string') parts.push(optionText(qid, v));
  }
  const acc = a.access;
  if (acc === UNKNOWN) parts.push(`${en.cyber.questions.access.label}${tbc}`);
  else if (Array.isArray(acc)) parts.push(acc.map((x) => optionText('access', x)).join(' and '));
  const tools = a.tools;
  if (tools === 'read' || tools === 'write') parts.push(en.cyber.short[`tools_${tools}`]);
  if (tools === UNKNOWN) parts.push(`${en.cyber.short.tools_write}${tbc}`);
  for (const [qid, label] of Object.entries(en.cyber.short)) {
    if (qid.startsWith('tools_') || !QUESTION_BY_ID.has(qid)) continue;
    if (a[qid] === 'yes') parts.push(label);
    if (a[qid] === UNKNOWN) parts.push(`${label}${tbc}`);
  }
  return parts.join(' · ');
}

// ---------------------------------------------------------------- shared bits
function WhyApplies({ why, unknown }: { why: string[]; unknown: Set<string> }) {
  if (why.includes('always')) return <span>{R.alwaysApplies}</span>;
  return (
    <ul className="plain">
      {why.map((f) => (
        <li key={f}>
          {flagById.get(f)?.meaning ?? f} {unknown.has(f) && <TbcTag />}
        </li>
      ))}
    </ul>
  );
}

const techniqueName = (id: string) => {
  const t = techniqueById.get(id);
  return t?.nameAtlas ?? t?.nameMatrix ?? newerAtlasById.get(id)?.name ?? '';
};

/** Technique ID, linked to ATLAS when the ID exists in ATLAS 2026.10. */
function TechniqueId({ id }: { id: string }) {
  const t = techniqueById.get(id);
  if (t && !t.inAtlas) return <span className="mono">{id}</span>;
  return (
    <ExternalLink href={atlasTechniqueUrl(id)}>
      <span className="mono">{id}</span>
    </ExternalLink>
  );
}

function References({ cr }: { cr: ControlResult }) {
  const c = cr.control;
  if (c.atlasMitigations.length + c.etsi.length + c.iso.length === 0) return null;
  return (
    <>
      <dt>{R.fields.references}</dt>
      <dd>
        <ul className="plain">
          {c.atlasMitigations.map((m, i) =>
            m.id ? (
              <li key={`m${i}`}>
                MITRE ATLAS ·{' '}
                <ExternalLink href={atlasMitigationUrl(m.id)}>
                  <span className="mono">{m.id}</span>
                </ExternalLink>{' '}
                {m.name}
              </li>
            ) : (
              <li key={`m${i}`}>{m.raw}</li>
            ),
          )}
          {c.etsi.map((e, i) =>
            e.provision ? (
              <li key={`e${i}`}>
                ETSI EN 304 223 · <span className="mono">{e.provision}</span> {e.verb ? R.etsiVerb[e.verb] : ''} · {e.principle}
              </li>
            ) : (
              <li key={`e${i}`}>{e.raw}</li>
            ),
          )}
          {c.iso.map((s, i) =>
            s.id ? (
              <li key={`i${i}`}>
                ISO/IEC 27001:2022 · <span className="mono">{s.id}</span> {s.name} ({R.isoGeneral})
              </li>
            ) : (
              <li key={`i${i}`}>{s.raw}</li>
            ),
          )}
        </ul>
      </dd>
    </>
  );
}

function ControlRow({ cr, unknown }: { cr: ControlResult; unknown: Set<string> }) {
  const c = cr.control;
  return (
    <details className="row">
      <summary>
        <span className="mono row-id">{c.id}</span>
        <span className="row-name">{c.name}</span>
        <span className="row-meta">{c.type}</span>
        {cr.tbc && <TbcTag />}
      </summary>
      <div className="row-body">
        <dl className="kv">
          <dt>{R.fields.what}</dt>
          <dd>{c.what}</dd>
          <dt>{R.fields.evidence}</dt>
          <dd>{c.evidence}</dd>
          <dt>{R.fields.whyApplies}</dt>
          <dd>{cr.basis === 'crossCutting' ? R.crossCutting : <WhyApplies why={cr.why} unknown={unknown} />}</dd>
          {cr.techniques.length > 0 && (
            <>
              <dt>{R.fields.mitigates}</dt>
              <dd>
                <ul className="plain">
                  {cr.techniques.map((t) => (
                    <li key={t.id}>
                      <TechniqueId id={t.id} /> {techniqueName(t.id)}
                    </li>
                  ))}
                </ul>
              </dd>
            </>
          )}
          {cr.newerAtlas.length > 0 && (
            <>
              <dt>{R.fields.newerAtlas}</dt>
              <dd>
                <ul className="plain">
                  {cr.newerAtlas.map((id) => (
                    <li key={id}>
                      <TechniqueId id={id} /> {techniqueName(id)}
                    </li>
                  ))}
                </ul>
              </dd>
            </>
          )}
          <References cr={cr} />
          <dt>{R.fields.legal}</dt>
          <dd>
            {cr.legal.length ? (
              <ul className="plain">
                {cr.legal.map((l) => (
                  <li key={l.key}>
                    {l.citation} · {R.legalIf} {l.condition} {l.tbc && <TbcTag />}
                  </li>
                ))}
              </ul>
            ) : (
              <span className="muted">{R.noLegal}</span>
            )}
          </dd>
          <dt>{R.fields.phases}</dt>
          <dd>{c.phases.join(' · ')}</dd>
        </dl>
      </div>
    </details>
  );
}

function TechniqueRow({ tr, unknown }: { tr: TechniqueResult; unknown: Set<string> }) {
  const t = tr.technique;
  return (
    <details className="row">
      <summary>
        <span className="mono row-id">{t.id}</span>
        <span className="row-name">{t.nameAtlas ?? t.nameMatrix}</span>
        <span className="row-meta">{t.tactics.join(', ')}</span>
        {tr.tbc && <TbcTag />}
      </summary>
      <div className="row-body">
        <dl className="kv">
          {t.inAtlas && (
            <>
              <dt>MITRE ATLAS</dt>
              <dd>
                <TechniqueId id={t.id} />
              </dd>
            </>
          )}
          {t.jnic.description && (
            <>
              <dt>{R.fields.description}</dt>
              <dd>
                <MoreText text={t.jnic.description} />
              </dd>
            </>
          )}
          <dt>{R.fields.whyApplies}</dt>
          <dd>
            <WhyApplies why={tr.why} unknown={unknown} />
          </dd>
          {t.jnic.coverage && (
            <>
              <dt>{R.fields.coverage}</dt>
              <dd>
                <MoreText text={t.jnic.coverage} />
              </dd>
            </>
          )}
          <dt>{R.fields.coveredBy}</dt>
          <dd>
            {tr.controls.length ? (
              <ul className="plain">
                {tr.controls.map((c) => (
                  <li key={c.id}>
                    <span className="mono">{c.id}</span> {controlById.get(c.id)?.name}
                  </li>
                ))}
              </ul>
            ) : (
              <span className="muted">{R.noControls}</span>
            )}
          </dd>
        </dl>
      </div>
    </details>
  );
}

// ---------------------------------------------------------------- views
/** Items grouped under the lifecycle phases, in phase order. */
function ByPhase<T>({ items, inPhase, render }: { items: T[]; inPhase: (item: T, phase: string) => boolean; render: (item: T, phase: string) => React.ReactNode }) {
  return (
    <>
      {phaseOrder.map((phase) => {
        const list = items.filter((i) => inPhase(i, phase));
        if (!list.length) return null;
        return (
          <section key={phase} className="phase-group" aria-label={phase}>
            <h4 className="label">
              {phase} <span className="muted">· {list.length}</span>
            </h4>
            {list.map((i) => render(i, phase))}
          </section>
        );
      })}
    </>
  );
}

function ScopedView<T extends { scope: 'specific' | 'baseline' }>({
  items,
  specificLead,
  baselineLead,
  inPhase,
  render,
}: {
  items: T[];
  specificLead: string;
  baselineLead: string;
  inPhase: (item: T, phase: string) => boolean;
  render: (item: T, phase: string) => React.ReactNode;
}) {
  const specific = items.filter((i) => i.scope === 'specific');
  const baseline = items.filter((i) => i.scope === 'baseline');
  return (
    <>
      <div className="scope-block">
        <h3 className="label">
          {R.specificTitle} <span className="muted">· {specific.length}</span>
        </h3>
        <p className="small muted readable">{specificLead}</p>
        {specific.length ? <ByPhase items={specific} inPhase={inPhase} render={render} /> : <p>{R.noneSpecific}</p>}
      </div>
      {baseline.length > 0 && (
        <Disclosure className="scope-block" summary={<h3 className="label inline">{R.baseline(baseline.length)}</h3>}>
          <p className="small muted readable">{baselineLead}</p>
          <ByPhase items={baseline} inPhase={inPhase} render={render} />
        </Disclosure>
      )}
    </>
  );
}

function ControlsView({ controls, unknown }: { controls: ControlResult[]; unknown: Set<string> }) {
  return (
    <ScopedView
      items={controls.filter((c) => c.group === 'main')}
      specificLead={R.specificControlsLead}
      baselineLead={R.baselineControlsLead}
      inPhase={(c, phase) => c.phase === phase}
      render={(cr) => <ControlRow key={cr.id} cr={cr} unknown={unknown} />}
    />
  );
}

function AttacksView({ techniques, unknown }: { techniques: TechniqueResult[]; unknown: Set<string> }) {
  return (
    <ScopedView
      items={techniques.filter((t) => t.group === 'main')}
      specificLead={R.specificAttacksLead}
      baselineLead={R.baselineAttacksLead}
      inPhase={(t, phase) => t.technique.phases.includes(phase)}
      render={(tr, phase) => <TechniqueRow key={`${phase}-${tr.id}`} tr={tr} unknown={unknown} />}
    />
  );
}

function ObligationsBlock({ result }: { result: AssessmentResult }) {
  const sections = [...new Set(result.obligations.map((o) => o.obligation.section))];
  return (
    <section className="section" aria-labelledby="obl-title">
      <h2 id="obl-title" className="label">
        {R.obligationsTitle}
      </h2>
      <p className="small muted readable">{R.obligationsLead}</p>
      {result.obligations.length === 0 && <p>{R.noObligations}</p>}
      {sections.map((s) => (
        <div key={s} className="phase-group">
          <h3 className="label">{s}</h3>
          {result.obligations
            .filter((o) => o.obligation.section === s)
            .map(({ obligation: o, tbc }) => (
              <details key={o.id} className="row">
                <summary>
                  <span className="row-name">{o.obligation}</span>
                  <span className="row-meta">{o.article}</span>
                  {tbc && <TbcTag />}
                </summary>
                {o.preconditions && (
                  <div className="row-body">
                    <dl className="kv">
                      <dt>{R.preconditions}</dt>
                      <dd className="pre">{o.preconditions}</dd>
                    </dl>
                  </div>
                )}
              </details>
            ))}
        </div>
      ))}
    </section>
  );
}

// ---------------------------------------------------------------- page
function exportPayload(answers: Answers, r: AssessmentResult) {
  return {
    generatedOn: new Date().toISOString(),
    catalogue: catalogue.meta.catalogue.version,
    dataset: catalogue.meta.buildDate,
    disclaimer: R.disclaimer,
    answers,
    flags: r.flags,
    highRisk: r.highRisk,
    counts: r.counts,
    controls: r.controls.map((c) => ({
      id: c.id,
      name: c.control.name,
      phase: c.phase,
      group: c.group,
      scope: c.scope,
      toBeConfirmed: c.tbc,
      techniques: c.techniques.map((t) => t.id),
      newerAtlasTechniques: c.newerAtlas,
      legal: c.legal.map((l) => ({ citation: l.citation, condition: l.condition, toBeConfirmed: l.tbc })),
    })),
    techniques: r.techniques.map((t) => ({
      id: t.id,
      name: t.technique.nameAtlas ?? t.technique.nameMatrix,
      phases: t.technique.phases,
      group: t.group,
      scope: t.scope,
      toBeConfirmed: t.tbc,
      why: t.why,
      controls: t.controls.map((c) => c.id),
    })),
    obligations: r.obligations.map((o) => ({ id: o.obligation.id, article: o.obligation.article, obligation: o.obligation.obligation, toBeConfirmed: o.tbc })),
  };
}

/** Open every <details> while printing so the PDF contains the full detail. */
function usePrintExpand(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    let closed: HTMLDetailsElement[] = [];
    const before = () => {
      closed = [...(ref.current?.querySelectorAll('details:not([open])') ?? [])] as HTMLDetailsElement[];
      closed.forEach((d) => (d.open = true));
    };
    const after = () => closed.forEach((d) => (d.open = false));
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, [ref]);
}

export function Results() {
  const { answers } = useAnswers();
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [view, setView] = useState<View>('controls');
  const ref = useRef<HTMLDivElement>(null);
  usePrintExpand(ref);
  const complete = ([1, 2, 3] as const).every((s) => isStepComplete(s, answers));
  const unknown = useMemo(() => new Set(result?.flags.unknown ?? []), [result]);

  useEffect(() => {
    if (!complete) return;
    let live = true;
    service.assess(answers).then((r) => live && setResult(r));
    return () => {
      live = false;
    };
  }, [answers, complete]);

  if (!complete) {
    const step = ([1, 2, 3] as const).find((s) => !isStepComplete(s, answers)) ?? 1;
    return (
      <>
        <PageHead title={R.title} />
        <div className="section">
          <Link className="btn btn-primary" to={`../step/${step}`}>
            {en.cyber.resume}
          </Link>
        </div>
      </>
    );
  }
  if (!result) return null;

  if (result.prohibited.length > 0) {
    return (
      <>
        <PageHead title={R.prohibitedTitle} lead={<p className="readable">{R.prohibitedText}</p>} />
        <div className="section">
          <ul className="plain">
            {result.prohibited.map((p) => (
              <li key={p}>{en.cyber.questions.prohibited.options?.[p]}</li>
            ))}
          </ul>
        </div>
        <div className="section">
          <Link className="btn" to="../step/3">
            {R.changeAnswers}
          </Link>
        </div>
      </>
    );
  }

  const supplyControls = result.controls.filter((c) => c.group === 'supplyChain');
  const supplyTechniques = result.techniques.filter((t) => t.group === 'supplyChain');
  const prep = result.techniques.filter((t) => t.group === 'attackerPreparation');

  return (
    <div ref={ref} className="results">
      <PageHead
        title={R.title}
        lead={
          <>
            <p>
              <span className="muted">{R.summaryPrefix}:</span> {summarize(answers)}
            </p>
            <p className="small">
              {result.phasesUnknown ? R.phasesUnknown : `${R.phasesControlled}: ${result.phasesOwned.join(', ') || '—'}`} ·{' '}
              {R.highRisk[result.highRisk]}
            </p>
          </>
        }
      >
        <p className="counts">{R.counts(result.counts.controls, result.counts.techniques, result.counts.toBeConfirmed)}</p>
      </PageHead>

      {result.prohibitedUnknown && (
        <div className="section">
          <p>
            <TbcTag /> {R.prohibitedUnknown}
          </p>
        </div>
      )}

      <section className="section" aria-label={R.viewLabel}>
        <div className="section-head no-print">
          <Segmented<View>
            label={R.viewLabel}
            value={view}
            onChange={setView}
            options={[
              { value: 'controls', label: R.viewControls },
              { value: 'attacks', label: R.viewAttacks },
            ]}
          />
          <Link className="btn" to="../step/1">
            {R.changeAnswers}
          </Link>
        </div>
        <h2 className="visually-hidden">{view === 'controls' ? R.viewControls : R.viewAttacks}</h2>
        {view === 'controls' ? <ControlsView controls={result.controls} unknown={unknown} /> : <AttacksView techniques={result.techniques} unknown={unknown} />}
      </section>

      <section className="section">
        <Disclosure summary={<span>{R.supplyChain(supplyControls.length + supplyTechniques.length)}</span>}>
          <p className="small muted readable">{R.supplyChainLead}</p>
          {supplyControls.length > 0 && (
            <div className="phase-group">
              <h3 className="label">{R.controlsHeading}</h3>
              {supplyControls.map((cr) => (
                <ControlRow key={cr.id} cr={cr} unknown={unknown} />
              ))}
            </div>
          )}
          {supplyTechniques.length > 0 && (
            <div className="phase-group">
              <h3 className="label">{R.techniquesHeading}</h3>
              {supplyTechniques.map((tr) => (
                <TechniqueRow key={tr.id} tr={tr} unknown={unknown} />
              ))}
            </div>
          )}
        </Disclosure>
        <Disclosure summary={<span>{R.attackerPrep(prep.length)}</span>}>
          <p className="small muted readable">{R.attackerPrepLead}</p>
          {prep.map((tr) => (
            <TechniqueRow key={tr.id} tr={tr} unknown={unknown} />
          ))}
        </Disclosure>
      </section>

      <ObligationsBlock result={result} />

      <section className="section no-print" aria-labelledby="export-title">
        <h2 id="export-title" className="label">
          {R.exportTitle}
        </h2>
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => window.print()}>
            {en.common.print}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => downloadJson(`ai-security-assessment-${new Date().toISOString().slice(0, 10)}.json`, exportPayload(answers, result))}
          >
            {en.common.downloadJson}
          </button>
        </div>
      </section>

      <p className="section disclaimer small">{R.disclaimer}</p>
    </div>
  );
}
