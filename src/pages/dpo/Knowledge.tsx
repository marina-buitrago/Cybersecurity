import { Pending, Tag } from '../../components/ui';
import { en } from '../../content/en';
import { knowledge, type KnowledgeCard } from '../../engine/dpo';

const Kn = en.dpo.knowledge;
const TEXT_FIELDS = ['obligedParty', 'conditions', 'operationalAction', 'dpoInvolvement', 'expectedEvidence', 'deadlineOrTrigger', 'closingCriterion'] as const;

function Card({ c }: { c: KnowledgeCard }) {
  return (
    <details className="row">
      <summary>
        <span className="mono row-id">{c.id}</span>
        <span className="row-name">{c.requirement}</span>
        {c.nature.map((n) => (
          <Tag key={n}>{n}</Tag>
        ))}
        <Tag kind="alert">
          {Kn.fields.legalValidation}: {Kn.validationPending}
        </Tag>
      </summary>
      <div className="row-body">
        <dl className="kv">
          <dt>{Kn.fields.id}</dt>
          <dd>
            <span className="mono">{c.id}</span> {c.idStatus === 'proposed' && <span className="small muted">({Kn.proposedId})</span>}
          </dd>
          <dt>{Kn.fields.requirement}</dt>
          <dd>{c.requirement}</dd>
          <dt>{Kn.fields.source}</dt>
          <dd>{c.source ?? c.sourceNote ?? <Pending />}</dd>
          <dt>{Kn.fields.nature}</dt>
          <dd>
            {c.nature.join(' / ')} {c.natureStatus === 'proposed' && <span className="small muted">({Kn.proposedNature})</span>}
          </dd>
          {TEXT_FIELDS.map((f) => (
            <div key={f} style={{ display: 'contents' }}>
              <dt>{Kn.fields[f]}</dt>
              <dd>{c[f] ?? <Pending />}</dd>
            </div>
          ))}
          <dt>{Kn.fields.legalValidation}</dt>
          <dd>{Kn.validationPending}</dd>
        </dl>
      </div>
    </details>
  );
}

export function Knowledge() {
  return (
    <>
      <section className="section" aria-labelledby="kn-q">
        <h2 id="kn-q" className="label">
          {Kn.question}
        </h2>
        <p className="small">
          <span className="muted">{Kn.labelsTitle}:</span>{' '}
          {knowledge.labels.map((l) => (
            <span key={l}>
              <Tag>{l}</Tag>{' '}
            </span>
          ))}
        </p>
        {knowledge.cards.map((c) => (
          <Card key={c.id} c={c} />
        ))}
      </section>
      <section className="section" aria-labelledby="cov-title">
        <h2 id="cov-title" className="label">
          {Kn.coverageTitle}
        </h2>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                {Object.values(Kn.coverageCols).map((h) => (
                  <th key={h} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {knowledge.coverage.map((r) => (
                <tr key={r.block}>
                  <th scope="row">{r.block}</th>
                  <td>{r.sources ?? '—'}</td>
                  <td>
                    <Tag>{r.status}</Tag>
                  </td>
                  <td>{r.justification}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
