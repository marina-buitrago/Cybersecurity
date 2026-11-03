import { Link } from 'react-router-dom';
import { fmtDate, fmtDateTime } from '../../components/format';
import { Tag } from '../../components/ui';
import { en } from '../../content/en';
import { clientById, clientCounts, demo, teamName, urgencyOf, type Level } from '../../engine/dpo';

const T = en.dpo.today;

export function RiskTag({ level }: { level: Level }) {
  const kind = level === 'high' ? 'alert' : level === 'medium' ? 'filled' : 'outline';
  return <Tag kind={kind}>{en.dpo.risk[level]}</Tag>;
}

export function Today() {
  // Blocked tasks never disappear: every item stays, ordered by date.
  const rows = demo.attention
    .map((item) => ({ item, u: urgencyOf(item) }))
    .sort((a, b) => (a.u.due?.getTime() ?? Infinity) - (b.u.due?.getTime() ?? Infinity));
  return (
    <>
      <section className="section" aria-labelledby="today-q">
        <h2 id="today-q" className="label">
          {T.question}
        </h2>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{T.cols.client}</th>
                <th scope="col">{T.cols.situation}</th>
                <th scope="col">{T.cols.next}</th>
                <th scope="col">{T.cols.assigned}</th>
                <th scope="col">{T.cols.time}</th>
                <th scope="col">{T.cols.risk}</th>
                <th scope="col">{T.cols.blocker}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ item, u }) => {
                const client = clientById.get(item.clientId)!;
                const when = u.due ? (u.withTime ? fmtDateTime(u.due) : fmtDate(u.due)) : '';
                return (
                  <tr key={item.id}>
                    <td className="nowrap">
                      <Link to={`/dpo/clients/${client.id}`}>{client.name}</Link>
                    </td>
                    <td>
                      <span className="cell-strong">{item.situation}</span>
                      <br />
                      <span className="muted">{item.why}</span>
                    </td>
                    <td>{item.nextAction}</td>
                    <td className="nowrap">{teamName(item.assignedTo)}</td>
                    <td>
                      {u.days === null ? (
                        '—'
                      ) : (
                        <>
                          {u.kind === 'deadline' ? T.due(when, u.days) : T.review(when, u.days)}
                          {u.pendingValidation && <div className="small muted">{en.dpo.countingPending}</div>}
                        </>
                      )}
                    </td>
                    <td>
                      <RiskTag level={item.risk} />
                    </td>
                    <td>
                      {item.blocker ? (
                        <>
                          <Tag kind="alert">{T.blocked}</Tag> <span>{item.blocker}</span>
                        </>
                      ) : (
                        <span className="muted">{T.noBlocker}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section className="section" aria-labelledby="counts-title">
        <h2 id="counts-title" className="label">
          {T.countsTitle}
        </h2>
        <p className="small muted">{T.countsLead}</p>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{T.cols.client}</th>
                {Object.values(en.dpo.counts).map((l) => (
                  <th key={l} scope="col" className="th-wrap">
                    {l}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {demo.clients.map((c) => {
                const counts = clientCounts(c);
                return (
                  <tr key={c.id}>
                    <th scope="row" className="nowrap">
                      <Link to={`/dpo/clients/${c.id}`}>{c.name}</Link>
                    </th>
                    {Object.keys(en.dpo.counts).map((k) => (
                      <td key={k} className="mono">
                        {counts[k as keyof typeof counts]}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
