import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHead } from '../../components/Shell';
import {
  Disclosure,
  ExternalLink,
  MoreText,
  Pending,
  Segmented,
  Tag,
  TbcTag,
  atlasMitigationUrl,
  atlasTechniqueUrl,
  downloadJson,
} from '../../components/ui';
import { en } from '../../content/en';
import type { AssessmentResult, ControlResult, LegalResult, TechniqueResult } from '../../engine/assess';
import { catalogue, controlById, flagById, phaseOrder, techniqueById } from '../../engine/data';
import { QUESTION_BY_ID, UNKNOWN, isStepComplete, type Answers } from '../../engine/questionnaire';
import { createLocalAssessmentService } from '../../engine/service';
import { useAnswers } from './state';

const service = createLocalAssessmentService();
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

function LinkKindTag({ link }: { link: 'atlas' | 'proposed' }) {
  return link === 'atlas' ? <Tag kind="filled">{R.linkAtlas}</Tag> : <Tag>{R.linkProposed}</Tag>;
}

function LegalLine({ l }: { l: LegalResult }) {
  return (
    <li>
      {l.citation} · {R.legalIf} {l.condition} · {l.concreteness} {l.tbc && <TbcTag />}
    </li>
  );
}

function Provenance({ cr }: { cr: ControlResult }) {
  const c = cr.control;
  const starred = cr.legal.some((l) => l.concreteness.endsWith('*'));
  const anySource = c.atlasMitigations.length + c.etsi.length + c.iso.length + c.legal.length > 0;
  return (
    <>
      <dt>{R.fields.source}</dt>
      <dd>
        {anySource && (
          <ul className="plain">
            {c.atlasMitigations.map((m, i) =>
              m.id ? (
                <li key={`m${i}`}>
                  MITRE ATLAS 2026.10 ·{' '}
                  <ExternalLink href={atlasMitigationUrl(m.id)}>
                    <span className="mono">{m.id}</span>
                  </ExternalLink>{' '}
                  {m.name} · {m.concreteness}
                  {m.partial ? ' (partial)' : ''}
                </li>
              ) : (
                <li key={`m${i}`}>{m.raw}</li>
              ),
            )}
            {c.etsi.map((e, i) =>
              e.provision ? (
                <li key={`e${i}`}>
                  ETSI EN 304 223 V2.1.1 · <span className="mono">{e.provision}</span> {e.verb ? R.etsiVerb[e.verb] : ''} ·{' '}
                  {e.concreteness} · {e.principle}
                </li>
              ) : (
                <li key={`e${i}`}>{e.raw}</li>
              ),
            )}
            {c.iso.map((s, i) =>
              s.id ? (
                <li key={`i${i}`}>
                  ISO/IEC 27001:2022 Annex A · <span className="mono">{s.id}</span> {s.name} ({R.isoGeneral})
                </li>
              ) : (
                <li key={`i${i}`}>{s.raw}</li>
              ),
            )}
          </ul>
        )}
        {c.noSourceWhy && (
          <p>
            <strong>{R.noSource}.</strong> {c.noSourceWhy}
          </p>
        )}
        {!anySource && !c.noSourceWhy && <Pending />}
      </dd>
      <dt>{R.fields.legal}</dt>
      <dd>
        {cr.legal.length ? (
          <>
            <ul className="plain">
              {cr.legal.map((l) => (
                <LegalLine key={l.key} l={l} />
              ))}
            </ul>
            {starred && <p className="small muted">{R.proposedClassification}</p>}
          </>
        ) : (
          <span className="muted">{R.noLegal}</span>
        )}
      </dd>
      <dt>{R.fields.nature}</dt>
      <dd>{c.nature.length ? c.nature.join(' · ') : <Pending />}</dd>
      <dt>{R.fields.concreteness}</dt>
      <dd>{c.concreteness ?? <Pending />}</dd>
    </>
  );
}

function ControlRow({ cr }: { cr: ControlResult }) {
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
          <dt>{R.fields.appliesWhen}</dt>
          <dd>{c.appliesWhen}</dd>
          <dt>{R.fields.phases}</dt>
          <dd>{c.phases.join(' · ')}</dd>
          <dt>{R.fields.mitigates}</dt>
          <dd>
            {c.crossCutting && <p className="muted">{R.crossCutting}</p>}
            {cr.techniques.length ? (
              <ul className="plain">
                {cr.techniques.map((t) => (
                  <li key={t.id}>
                    <ExternalLink href={atlasTechniqueUrl(t.id)}>
                      <span className="mono">{t.id}</span>
                    </ExternalLink>{' '}
                    {techniqueById.get(t.id)?.nameAtlas ?? techniqueById.get(t.id)?.nameMatrix} <LinkKindTag link={t.link} />
                  </li>
                ))}
              </ul>
            ) : (
              !c.crossCutting && <span className="muted">{R.noApplicableTechniques}</span>
            )}
          </dd>
          <Provenance cr={cr} />
          <dt>{R.fields.status}</dt>
          <dd>{c.status}</dd>
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
        <RowId id={t.id} />
        <span className="row-name">{t.nameAtlas ?? t.nameMatrix}</span>
        <span className="row-meta">{t.tactics.join(', ')}</span>
        {tr.tbc && <TbcTag />}
      </summary>
      <div className="row-body">
        <dl className="kv">
          <dt>ATLAS</dt>
          <dd>
            <ExternalLink href={t.jnic.link ?? atlasTechniqueUrl(t.id)}>
              <span className="mono">{t.id}</span>
            </ExternalLink>
            {!t.inAtlas && <> · <Tag>{R.notInAtlas}</Tag></>}
          </dd>
          <dt>{R.fields.description}</dt>
          <dd>{t.jnic.description ? <MoreText text={t.jnic.description} /> : <Pending />}</dd>
          <dt>{R.fields.whyApplies}</dt>
          <dd>
            <WhyApplies why={tr.why} unknown={unknown} />
          </dd>
          <dt>{R.fields.coverage}</dt>
          <dd>{t.jnic.coverage ? <MoreText text={t.jnic.coverage} /> : <Pending />}</dd>
          <dt>{R.fields.coveredBy}</dt>
          <dd>
            {tr.controls.length ? (
              <ul className="plain">
                {tr.controls.map((c) => (
                  <li key={c.id}>
                    <span className="mono">{c.id}</span> {controlById.get(c.id)?.name} <LinkKindTag link={c.link} />
                  </li>
                ))}
              </ul>
            ) : (
              <span className="muted">{R.noControls}</span>
            )}
          </dd>
          {t.notes.length > 0 && (
            <>
              <dt>{R.fields.notes}</dt>
              <dd className="pre">{t.notes.join('\n')}</dd>
            </>
          )}
        </dl>
      </div>
    </details>
  );
}

const RowId = ({ id }: { id: string }) => <span className="mono row-id">{id}</span>;

// ---------------------------------------------------------------- views
function ControlsView({ controls }: { controls: ControlResult[] }) {
  const main = controls.filter((c) => c.group === 'main');
  return (
    <>
      {phaseOrder.map((phase) => {
        const list = main.filter((c) => c.phase === phase);
        if (!list.length) return null;
        return (
          <section key={phase} className="phase-group" aria-label={phase}>
            <h3 className="label">
              {phase} <span className="muted">· {list.length}</span>
            </h3>
            {list.map((cr) => (
              <ControlRow key={cr.id} cr={cr} />
            ))}
          </section>
        );
      })}
    </>
  );
}

function AttacksView({ techniques, unknown }: { techniques: TechniqueResult[]; unknown: Set<string> }) {
  const main = techniques.filter((t) => t.group === 'main');
  return (
    <>
      {phaseOrder.map((phase) => {
        const list = main.filter((t) => t.technique.phases.includes(phase));
        if (!list.length) return null;
        return (
          <section key={phase} className="phase-group" aria-label={phase}>
            <h3 className="label">
              {phase} <span className="muted">· {list.length}</span>
            </h3>
            {list.map((tr) => (
              <TechniqueRow key={`${phase}-${tr.id}`} tr={tr} unknown={unknown} />
            ))}
          </section>
        );
      })}
    </>
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
                  {o.concreteness ? <Tag>{o.concreteness}</Tag> : <Tag>{en.common.pendingValidation}</Tag>}
                  {tbc && <TbcTag />}
                </summary>
                <div className="row-body">
                  <dl className="kv">
                    <dt>{R.preconditions}</dt>
                    <dd className="pre">{o.preconditions ?? <Pending />}</dd>
                  </dl>
                </div>
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
      toBeConfirmed: c.tbc,
      techniques: c.techniques,
      legal: c.legal.map((l) => ({ citation: l.citation, condition: l.condition, concreteness: l.concreteness, toBeConfirmed: l.tbc })),
    })),
    techniques: r.techniques.map((t) => ({
      id: t.id,
      name: t.technique.nameAtlas ?? t.technique.nameMatrix,
      phases: t.technique.phases,
      group: t.group,
      toBeConfirmed: t.tbc,
      why: t.why,
      controls: t.controls,
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
        {view === 'controls' ? <ControlsView controls={result.controls} /> : <AttacksView techniques={result.techniques} unknown={unknown} />}
      </section>

      <section className="section">
        <Disclosure summary={<span>{R.supplyChain(supplyControls.length + supplyTechniques.length)}</span>}>
          <p className="small muted readable">{R.supplyChainLead}</p>
          {supplyControls.length > 0 && (
            <div className="phase-group">
              <h3 className="label">{R.controlsHeading}</h3>
              {supplyControls.map((cr) => (
                <ControlRow key={cr.id} cr={cr} />
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
