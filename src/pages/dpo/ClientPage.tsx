import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { fmtDate, fmtDateTime } from '../../components/format';
import { Disclosure, Pending, Segmented, Tag } from '../../components/ui';
import { en } from '../../content/en';
import { RULE_BY_ID } from '../../engine/deadlines';
import { caseDeadline, clientById, type Action, type Basis, type Client, type RegisterEntry } from '../../engine/dpo';
import { AiAssist } from './AiAssist';
import { DpiaStepper } from './Dpia';

const K = en.dpo.client;
type Tab = 'files' | 'actions' | 'requests' | 'register' | 'dpia' | 'ai';

export const BasisTag = ({ basis }: { basis: Basis }) => (
  <Tag kind={basis === 'team_verification' ? 'filled' : 'outline'}>{K.basis[basis]}</Tag>
);

function Structure({ client }: { client: Client }) {
  return (
    <Disclosure summary={<span>{K.structure}</span>}>
      <p className="small muted">{K.structureLead}</p>
      <ul className="tree">
        <li>
          <strong>{client.name}</strong>
          <ul>
            {client.entities.map((e) => (
              <li key={e.id}>
                {e.name} <span className="muted">· {e.role}</span>
                <ul>
                  {e.establishments.map((s) => (
                    <li key={s.id}>
                      {s.name}
                      <ul>
                        {client.processing
                          .filter((p) => p.entityId === e.id && p.establishmentIds.includes(s.id))
                          .map((p) => (
                            <li key={p.id}>
                              {p.name} <span className="muted">· {p.status}</span>
                            </li>
                          ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </li>
      </ul>
    </Disclosure>
  );
}

function FileColumn({ title, question, sections }: { title: string; question: string; sections: Client['fileA'] }) {
  return (
    <section className="block" aria-label={title}>
      <h3 className="label">{title}</h3>
      <p className="small muted">{question}</p>
      {sections.map((s) => (
        <Disclosure
          key={s.section}
          summary={
            <span>
              {s.section} <span className="muted mono small">· {s.items.length}</span>
            </span>
          }
        >
          {s.items.length === 0 ? (
            <p className="muted small">{K.noneRecorded}</p>
          ) : (
            <ul className="plain">
              {s.items.map((it) => (
                <li key={it.title} className="file-item">
                  <span>{it.title}</span> <BasisTag basis={it.basis} />
                  <div className="small muted">{it.detail}</div>
                </li>
              ))}
            </ul>
          )}
        </Disclosure>
      ))}
    </section>
  );
}

function Files({ client }: { client: Client }) {
  return (
    <>
      {client.aspects && (
        <div className="section-inner">
          <h3 className="label">
            {K.aspectsTitle}: {client.aspects.title}
          </h3>
          <div className="table-scroll">
            <table className="table">
              <tbody>
                {client.aspects.rows.map((r) => (
                  <tr key={r.aspect}>
                    <th scope="row">{r.aspect}</th>
                    <td>{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div className="hairline-grid two-col">
        <FileColumn title={K.fileA} question={K.fileAQuestion} sections={client.fileA} />
        <FileColumn title={K.fileB} question={K.fileBQuestion} sections={client.fileB} />
      </div>
      <p className="small muted">{K.supervisionNote}</p>
    </>
  );
}

function actionDeadline(client: Client, a: Action) {
  if (a.caseId) {
    const c = client.cases.find((x) => x.id === a.caseId);
    if (c) {
      const d = caseDeadline(c);
      return (
        <>
          {c.triggerDate.length > 10 ? fmtDateTime(d.due) : fmtDate(d.due)} · {RULE_BY_ID.get(c.ruleId)?.source}
          {d.countingPendingValidation && <span className="small muted"> · {en.dpo.countingPending}</span>}
        </>
      );
    }
  }
  return a.deadline ? fmtDate(a.deadline) : <Pending />;
}

function Actions({ client }: { client: Client }) {
  return (
    <>
      {client.actions.map((a) => (
        <details key={a.id} className="row">
          <summary>
            <span className="row-name">{a.title}</span>
            <Tag>{en.dpo.workStatus[a.workStatus]}</Tag>
            <Tag kind={a.legalOutcome === 'deficiency_found' ? 'alert' : 'outline'}>{en.dpo.legalOutcome[a.legalOutcome]}</Tag>
            <Tag>{a.measureStatus ? en.dpo.measureStatus[a.measureStatus] : K.noMeasure}</Tag>
          </summary>
          <div className="row-body">
            <h4 className="label">{K.chainTitle}</h4>
            <ol className="chain">
              <li><span className="chain-k">{K.chain.subject}</span>{a.subject}</li>
              <li><span className="chain-k">{K.chain.legalBasis}</span>{a.legalBasis === 'Pending validation' ? <Pending /> : a.legalBasis}</li>
              <li><span className="chain-k">{K.chain.who}</span>{a.whoCarriesOut}</li>
              <li><span className="chain-k">{K.chain.dpo}</span>{a.dpoInvolvement}</li>
              <li><span className="chain-k">{K.chain.deadline}</span>{actionDeadline(client, a)}</li>
              <li><span className="chain-k">{K.chain.evidence}</span>{a.evidence ?? <Pending />}</li>
              <li><span className="chain-k">{K.chain.decision}</span>{a.decision ?? <Pending />}</li>
              <li><span className="chain-k">{K.chain.nextReview}</span>{a.nextReview ? fmtDate(a.nextReview) : <Pending />}</li>
            </ol>
            <dl className="kv">
              <dt>{K.states.work}</dt>
              <dd>{en.dpo.workStatus[a.workStatus]}</dd>
              <dt>{K.states.legal}</dt>
              <dd>{en.dpo.legalOutcome[a.legalOutcome]}</dd>
              <dt>{K.states.measure}</dt>
              <dd>{a.measureStatus ? en.dpo.measureStatus[a.measureStatus] : K.noMeasure}</dd>
              <dt>{K.states.applicability}</dt>
              <dd>{en.dpo.applicability[a.applicability]}</dd>
              <dt>{K.basisLabel}</dt>
              <dd>
                <BasisTag basis={a.basis} /> <span className="muted small">· {K.file(a.file)}</span>
              </dd>
            </dl>
          </div>
        </details>
      ))}
      <Deadlines client={client} />
    </>
  );
}

function Deadlines({ client }: { client: Client }) {
  return (
    <div className="section-inner">
      <h3 className="label">{K.deadlinesTitle}</h3>
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">{K.deadlineCols.procedure}</th>
              <th scope="col">{K.deadlineCols.event}</th>
              <th scope="col">{K.deadlineCols.started}</th>
              <th scope="col">{K.deadlineCols.due}</th>
              <th scope="col">{K.deadlineCols.source}</th>
            </tr>
          </thead>
          <tbody>
            {client.cases.map((c) => {
              const rule = RULE_BY_ID.get(c.ruleId)!;
              const d = caseDeadline(c);
              const withTime = c.triggerDate.length > 10;
              const f = withTime ? fmtDateTime : fmtDate;
              return (
                <tr key={c.id}>
                  <td>
                    {rule.procedure}
                    <div className="small muted">{c.title}</div>
                  </td>
                  <td>{rule.triggeringEvent}</td>
                  <td>
                    {f(c.triggerDate)}
                    <div className="small muted">{K.recordedOn(fmtDate(c.recordedOn))}</div>
                  </td>
                  <td>
                    {f(d.due)}
                    {d.extendedDue && <div className="small muted">{K.extended(f(d.extendedDue))}</div>}
                    {d.countingPendingValidation && <div className="small muted">{en.dpo.countingPending}</div>}
                  </td>
                  <td className="nowrap">{rule.source}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Requests({ client }: { client: Client }) {
  if (!client.infoRequests.length) return <p className="muted">{K.noneRecorded}</p>;
  return (
    <div className="table-scroll">
      <table className="table">
        <thead>
          <tr>
            {Object.values(K.requestCols).map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {client.infoRequests.map((r) => (
            <tr key={r.id}>
              <td>{r.subject}</td>
              <td>{r.recipient}</td>
              <td className="nowrap">{fmtDate(r.sentOn)}</td>
              <td>{r.reminders.length ? r.reminders.map((d) => fmtDate(d)).join(', ') : '—'}</td>
              <td className="nowrap">{fmtDate(r.escalationDate)}</td>
              <td>{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RegisterView({ client }: { client: Client }) {
  const [entries, setEntries] = useState<RegisterEntry[]>(client.register);
  const [flowOpen, setFlowOpen] = useState(false);
  const [draft, setDraft] = useState({ subject: '', addressees: '', date: '' });
  const [responses, setResponses] = useState<Record<string, string>>({});

  const issue = () => {
    if (!draft.subject || !draft.addressees || !draft.date) return;
    setEntries([
      {
        id: `new-${entries.length + 1}`,
        type: 'art36_4',
        date: draft.date,
        subject: draft.subject,
        dpoPosition: K.art36Position,
        addressees: draft.addressees,
        clientResponse: null,
        status: 'Issued',
        issued: true,
      },
      ...entries,
    ]);
    setDraft({ subject: '', addressees: '', date: '' });
    setFlowOpen(false);
  };

  return (
    <>
      <p className="small muted readable">{K.registerLead}</p>
      <div className="btn-row">
        <button type="button" className="btn" onClick={() => setFlowOpen(!flowOpen)} aria-expanded={flowOpen}>
          {K.art36Button}
        </button>
      </div>
      {flowOpen && (
        <form
          className="flow"
          onSubmit={(e) => {
            e.preventDefault();
            issue();
          }}
        >
          <h3 className="label">{K.art36Title}</h3>
          <ol className="small">
            {K.art36Steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <label className="field">
            <span>{K.art36Fields.subject}</span>
            <textarea required rows={2} value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
          </label>
          <label className="field">
            <span>{K.art36Fields.addressees}</span>
            <input required type="text" value={draft.addressees} onChange={(e) => setDraft({ ...draft, addressees: e.target.value })} />
          </label>
          <label className="field">
            <span>{K.art36Fields.date}</span>
            <input required type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
          </label>
          <p className="small muted">{K.art36Note}</p>
          <div className="btn-row">
            <button type="submit" className="btn btn-primary">
              {K.art36Issue}
            </button>
            <button type="button" className="btn" onClick={() => setFlowOpen(false)}>
              {K.cancel}
            </button>
          </div>
        </form>
      )}
      {entries.length === 0 && <p className="muted">{K.noneRecorded}</p>}
      {entries.map((g) => {
        const response = g.clientResponse ?? responses[g.id];
        return (
          <details key={g.id} className="row">
            <summary>
              <span className="row-meta nowrap">{fmtDate(g.date)}</span>
              <span className="row-name">{g.subject}</span>
              <Tag kind={g.type === 'art36_4' ? 'alert' : 'outline'}>{K.registerTypes[g.type]}</Tag>
              {g.issued && <Tag kind="plain">{K.locked}</Tag>}
            </summary>
            <div className="row-body">
              <dl className="kv">
                <dt>{K.dpoPosition}</dt>
                <dd>{g.dpoPosition}</dd>
                <dt>{K.addressees}</dt>
                <dd>{g.addressees}</dd>
                <dt>{K.clientResponse}</dt>
                <dd>{response ?? <ResponseForm onSave={(t) => setResponses({ ...responses, [g.id]: t })} />}</dd>
              </dl>
            </div>
          </details>
        );
      })}
    </>
  );
}

function ResponseForm({ onSave }: { onSave: (text: string) => void }) {
  const [text, setText] = useState('');
  return (
    <form
      className="inline-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) onSave(text.trim());
      }}
    >
      <span className="muted small">{K.noResponse}</span>
      <label className="field">
        <span className="visually-hidden">{K.addResponse}</span>
        <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder={K.addResponse} />
      </label>
      <button type="submit" className="btn">
        {K.saveResponse}
      </button>
    </form>
  );
}

export function ClientPage() {
  const { id } = useParams();
  const client = id ? clientById.get(id) : undefined;
  const [tab, setTab] = useState<Tab>('files');
  if (!client) return <Navigate to="/dpo/clients" replace />;
  const tabs = (Object.keys(K.tabs) as Tab[]).filter((t) => t !== 'dpia' || client.dpia);
  return (
    <>
      <section className="section">
        <p className="small">
          <Link to="/dpo/clients">← {en.dpo.clients.back}</Link>
        </p>
        <h2 className="client-name">{client.name}</h2>
        <p className="small muted">
          {client.sector} · {en.dpo.aiSettings[client.aiSetting]}
          {client.onboarding &&
            ` · ${en.dpo.clients.onboardingPhase(client.onboarding.phase, en.dpo.clients.onboardingPhases[client.onboarding.phase - 1])}`}
        </p>
        <Structure client={client} />
      </section>
      <section className="section">
        <div className="section-head">
          <Segmented<Tab> label={en.dpo.viewsLabel} value={tab} onChange={setTab} options={tabs.map((t) => ({ value: t, label: K.tabs[t] }))} />
        </div>
        {tab === 'files' && <Files client={client} />}
        {tab === 'actions' && <Actions client={client} />}
        {tab === 'requests' && <Requests client={client} />}
        {tab === 'register' && <RegisterView client={client} />}
        {tab === 'dpia' && client.dpia && <DpiaStepper dpia={client.dpia} />}
        {tab === 'ai' && <AiAssist client={client} />}
      </section>
    </>
  );
}
