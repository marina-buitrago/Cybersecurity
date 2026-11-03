import type { ReactNode } from 'react';
import { DataTable } from '../../components/DataTable';
import { Disclosure, ExternalLink, MoreText, Tag, atlasMitigationUrl, atlasTechniqueUrl } from '../../components/ui';
import { en } from '../../content/en';
import matrixJson from '../../data/jnic-matrix.json';
import { catalogue, phaseOrder } from '../../engine/data';
import { parse, variablesOf, type Expr } from '../../engine/expr';
import type { JnicMatrixRow } from '../../engine/types';

const M = en.how.cyber.matrix;
const rows = (matrixJson as unknown as { rows: JnicMatrixRow[] }).rows;
const FLAGS = new Set(catalogue.flags.map((f) => f.id));
const isAiAct = (citation: string) => citation.endsWith('AI Act');

/** "rag && (tools || agent)" -> "RAG and (tools or agentic)". */
function describe(e: Expr, parent?: Expr['kind']): string {
  if (e.kind === 'var') return M.flagShort[e.name] ?? e.name;
  const text = `${describe(e.left, e.kind)} ${e.kind === 'and' ? M.and : M.or} ${describe(e.right, e.kind)}`;
  return parent && parent !== e.kind ? `(${text})` : text;
}
const appliesText = (r: JnicMatrixRow) => describe(parse(r.appliesWhen, FLAGS));
const appliesFlags = (r: JnicMatrixRow) => variablesOf(parse(r.appliesWhen, FLAGS)).map((f) => M.flagShort[f] ?? f);

const aiActKind = (r: JnicMatrixRow) =>
  M.aiActKinds[
    r.aiAct.origin === 'matrix' ? 'matrix' : r.aiAct.origin === 'noProvision' ? 'noProvision' : r.aiAct.origin === 'none' ? 'none' : 'carried'
  ];

const Note = ({ children }: { children: ReactNode }) => <span className="small muted cell-note">{children}</span>;

function FilledFrom({ r, field }: { r: JnicMatrixRow; field: keyof JnicMatrixRow['filledFrom'] }) {
  const phase = r.filledFrom[field];
  return phase ? <Note>{M.fromPhase(phase)}</Note> : null;
}

function Long({ r, field, text }: { r: JnicMatrixRow; field?: keyof JnicMatrixRow['filledFrom']; text: string | null }) {
  if (!text) return <span className="muted">—</span>;
  return (
    <>
      <MoreText text={text} limit={140} />
      {field && <FilledFrom r={r} field={field} />}
    </>
  );
}

function Citations({ list }: { list: JnicMatrixRow['legalViaControls'] }) {
  return (
    <ul className="plain">
      {list.map((l) => (
        <li key={l.citation}>
          {l.citation} · {en.cyber.results.legalIf} {l.condition}
          <Note>{l.controls.join(', ')}</Note>
        </li>
      ))}
    </ul>
  );
}

function AiActCell({ r }: { r: JnicMatrixRow }) {
  const viaControls = r.legalViaControls.filter((l) => isAiAct(l.citation));
  const { text, origin, from } = r.aiAct;
  return (
    <>
      {text && <MoreText text={text} limit={140} />}
      {origin === 'crossReference' && from && <Note>{M.sameAnalysis(from.name, from.phase)}</Note>}
      {origin === 'sameTechnique' && from && <Note>{M.fromPhase(from.phase)}</Note>}
      {origin === 'noProvision' && <span>{M.noProvision}</span>}
      {viaControls.length > 0 && (
        <div className={text || origin === 'noProvision' ? 'cell-sub' : undefined}>
          {(text || origin === 'noProvision') && <span className="small muted">{M.cols.legal}</span>}
          <Citations list={viaControls} />
        </div>
      )}
      {!text && origin !== 'noProvision' && viaControls.length === 0 && <span className="muted">—</span>}
    </>
  );
}

export function MatrixTab() {
  return (
    <>
      <div className="matrix-intro">
        <h3 className="label">{M.title}</h3>
        <p className="readable small">{M.lead}</p>
        <Disclosure summary={<span className="small">{M.howLabel}</span>}>
          <div className="hairline-cols">
            <div>
              <h4 className="label">{M.curatedLabel}</h4>
              <ul className="small readable">
                {M.curated.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="label">{M.completedLabel}</h4>
              <ul className="small readable">
                {M.completed.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          </div>
        </Disclosure>
      </div>
      <DataTable<JnicMatrixRow>
        caption={M.title}
        rows={rows}
        rowKey={(r) => `${r.phase}-${r.id}`}
        filters={[
          { label: en.how.cyber.filters.phase, values: (r) => [r.phase], order: phaseOrder },
          { label: en.how.cyber.filters.tactic, values: (r) => r.tactics },
          { label: M.aiActFilter, values: (r) => [aiActKind(r)], order: Object.values(M.aiActKinds) },
          { label: M.flagFilter, values: appliesFlags, order: Object.values(M.flagShort) },
        ]}
        columns={[
          { header: M.cols.phase, text: (r) => r.phase, minWidth: 120 },
          {
            header: M.cols.id,
            text: (r) => r.id,
            render: (r) =>
              r.inAtlas ? (
                <ExternalLink href={atlasTechniqueUrl(r.id)}>
                  <span className="mono">{r.id}</span>
                </ExternalLink>
              ) : (
                <span className="mono">{r.id}</span>
              ),
          },
          {
            header: M.cols.technique,
            text: (r) => r.name,
            minWidth: 180,
            render: (r) => (
              <>
                {r.name}
                {r.attackerPreparation && (
                  <>
                    {' '}
                    <Tag>{M.prep}</Tag>
                  </>
                )}
                {r.successor && <Note>{M.retired(r.successor)}</Note>}
              </>
            ),
          },
          { header: M.cols.tactic, text: (r) => r.tactics.join(', '), minWidth: 130 },
          {
            header: M.cols.appliesWhen,
            text: appliesText,
            minWidth: 180,
            render: (r) => (
              <>
                {appliesText(r)}
                {r.appliesWhenCatalogue && <Note>{M.refined(describe(parse(r.appliesWhenCatalogue, FLAGS)))}</Note>}
              </>
            ),
          },
          { header: M.cols.description, text: (r) => r.description, minWidth: 300, render: (r) => <Long r={r} field="description" text={r.description} /> },
          {
            header: M.cols.aiAct,
            text: (r) => [r.aiAct.text, ...r.legalViaControls.filter((l) => isAiAct(l.citation)).map((l) => l.citation)].join(' '),
            minWidth: 320,
            render: (r) => <AiActCell r={r} />,
          },
          { header: M.cols.whyAiAct, text: (r) => r.whyAiAct, long: true, minWidth: 280 },
          { header: M.cols.softLaw, text: (r) => r.softLaw, minWidth: 260, render: (r) => <Long r={r} field="softLaw" text={r.softLaw} /> },
          {
            header: M.cols.nistRmf,
            text: (r) => [r.nistRmf.sections.join(' '), r.nistRmf.text].join(' '),
            minWidth: 240,
            render: (r) =>
              r.nistRmf.text ? (
                <>
                  {r.nistRmf.sections.length > 0 && (
                    <ul className="plain">
                      {r.nistRmf.sections.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  )}
                  <MoreText className="small muted" text={r.nistRmf.text} limit={r.nistRmf.sections.length ? 0 : 140} />
                  <FilledFrom r={r} field="nistRmf" />
                </>
              ) : (
                <span className="muted">—</span>
              ),
          },
          { header: M.cols.whyNist, text: (r) => r.whyNist, minWidth: 260, render: (r) => <Long r={r} field="whyNist" text={r.whyNist} /> },
          {
            header: M.cols.nist600,
            text: (r) => r.nist600.actions.join(', ') || r.nist600.note,
            minWidth: 150,
            render: (r) =>
              r.nist600.actions.length || r.nist600.note ? (
                <>
                  {r.nist600.actions.length ? <span className="mono">{r.nist600.actions.join(', ')}</span> : M.noDirectAction}
                  <FilledFrom r={r} field="nist600" />
                </>
              ) : (
                <span className="muted">—</span>
              ),
          },
          {
            header: M.cols.mitigations,
            text: (r) => r.mitigations.map((m) => `${m.id} ${m.name ?? ''}`).join(' '),
            minWidth: 240,
            render: (r) =>
              r.mitigations.length ? (
                <ul className="plain">
                  {r.mitigations.map((m) => (
                    <li key={m.id}>
                      <ExternalLink href={atlasMitigationUrl(m.id)}>
                        <span className="mono">{m.id}</span>
                      </ExternalLink>{' '}
                      {m.name}
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="muted">—</span>
              ),
          },
          { header: M.cols.proposal, text: (r) => r.matrixProposal, long: true, minWidth: 260 },
          {
            header: M.cols.controls,
            text: (r) => r.controls.map((c) => `${c.id} ${c.name}`).join(' '),
            minWidth: 260,
            render: (r) =>
              r.controls.length ? (
                <ul className="plain">
                  {r.controls.map((c) => (
                    <li key={c.id}>
                      <span className="mono">{c.id}</span> {c.name}
                      {c.link === 'proposed' && <Note>{M.proposedLink}</Note>}
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="muted">—</span>
              ),
          },
          {
            header: M.cols.legal,
            text: (r) => r.legalViaControls.map((l) => l.citation).join(' '),
            minWidth: 260,
            render: (r) => (r.legalViaControls.length ? <Citations list={r.legalViaControls} /> : <span className="muted">—</span>),
          },
        ]}
      />
    </>
  );
}
