import { Disclosure, Tag } from '../../components/ui';
import { fmtDate } from '../../components/format';
import { en } from '../../content/en';
import { clientById, demo, documents } from '../../engine/dpo';

const Dc = en.dpo.documents;

function StatusTag({ status }: { status: string }) {
  return <Tag kind={status === 'issued' ? 'filled' : status === 'superseded' ? 'plain' : 'outline'}>{Dc.status[status]}</Tag>;
}

function Library() {
  return (
    <section className="section" aria-labelledby="lib-title">
      <h2 id="lib-title" className="label">
        {Dc.library}
      </h2>
      {documents.families.map((family) => {
        const list = documents.templates.filter((t) => t.family === family);
        return (
          <div key={family} className="phase-group">
            <h3 className="label">{family}</h3>
            {list.map((t) => {
              const [current, ...older] = t.versions;
              return (
                <div key={t.id} className="doc-row">
                  <span className="mono row-id">{t.id}</span>
                  <span className="row-name">{t.title}</span>
                  <span className="mono small">v{current.version}</span>
                  <StatusTag status={current.status} />
                  <span className="small muted">
                    {current.author} · {fmtDate(current.date)} · {current.sources.length ? current.sources.join('; ') : Dc.noSources}
                  </span>
                  {older.length > 0 && (
                    <Disclosure className="doc-older" summary={<span className="small">{Dc.olderVersions(older.length)}</span>}>
                      <ul className="plain small">
                        {older.map((v) => (
                          <li key={v.version}>
                            <span className="mono">v{v.version}</span> <StatusTag status={v.status} /> {v.author} · {fmtDate(v.date)}
                          </li>
                        ))}
                      </ul>
                    </Disclosure>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </section>
  );
}

function Generated() {
  const g = documents.generated;
  return (
    <section className="section" aria-labelledby="gen-title">
      <h2 id="gen-title" className="label">
        {Dc.generatedTitle}
      </h2>
      <p className="small muted">{Dc.legend}</p>
      <ul className="plain layer-legend small">
        <li className="legend-approved">{Dc.layers.approved}</li>
        <li className="legend-data">{Dc.layers.data}</li>
        <li className="legend-ai">{Dc.layers.ai}</li>
      </ul>
      <article className="doc">
        <header>
          <p className="mono small muted">
            {g.id} · {g.templateRef} · {clientById.get(g.clientId)?.name}
          </p>
          <h3>{g.title}</h3>
          <p className="small">
            <StatusTag status={g.status} /> {g.author} · {fmtDate(g.date)}
          </p>
          <p className="small muted">{g.sources.join(' · ')}</p>
        </header>
        {g.blocks.map((b, i) =>
          b.layer === 'data' ? (
            <p key={i} className="layer layer-data">
              <span className="layer-tag">{Dc.layers.data}</span>
              <span className="muted">{b.label}:</span>{' '}
              {b.value ?? <Tag kind="alert">{Dc.toBeConfirmed}</Tag>} <span className="small muted">({b.source})</span>
            </p>
          ) : (
            <p key={i} className={`layer layer-${b.layer}`}>
              <span className="layer-tag">{b.layer === 'ai' ? Dc.layers.ai : Dc.layers.approved}</span>
              {b.text}
            </p>
          ),
        )}
      </article>
    </section>
  );
}

/** Report to management: only recorded actions, register entries and evidence; no free text. */
function ManagementReport() {
  return (
    <section className="section" aria-labelledby="rep-title">
      <h2 id="rep-title" className="label">
        {Dc.reportTitle}
      </h2>
      <p className="small muted readable">{Dc.reportLead}</p>
      {demo.clients.map((c) => (
        <Disclosure key={c.id} summary={<span>{c.name}</span>}>
          <ul className="plain small">
            {c.register.map((g) => (
              <li key={g.id}>
                <span className="mono muted">{g.id}</span> {fmtDate(g.date)} · {en.dpo.client.registerTypes[g.type]} · {g.subject} ·{' '}
                {g.status}
              </li>
            ))}
            {c.actions.map((a) => (
              <li key={a.id}>
                <span className="mono muted">{a.id}</span> {a.title} · {en.dpo.workStatus[a.workStatus]} ·{' '}
                {en.dpo.legalOutcome[a.legalOutcome]}
                {a.measureStatus ? ` · ${en.dpo.measureStatus[a.measureStatus]}` : ''} ·{' '}
                {a.evidence ?? <span className="muted">{Dc.reportEmpty}</span>}
              </li>
            ))}
          </ul>
        </Disclosure>
      ))}
    </section>
  );
}

export function Documents() {
  return (
    <>
      <p className="section-q">{Dc.question}</p>
      <Library />
      <Generated />
      <ManagementReport />
    </>
  );
}
