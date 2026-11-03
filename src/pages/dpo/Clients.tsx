import { Link } from 'react-router-dom';
import { fmtDate } from '../../components/format';
import { Tag } from '../../components/ui';
import { en } from '../../content/en';
import { demo } from '../../engine/dpo';

const C = en.dpo.clients;

export function Clients() {
  const onboardingClient = demo.clients.find((c) => c.onboarding);
  return (
    <>
      <section className="section" aria-labelledby="clients-q">
        <h2 id="clients-q" className="label">
          {C.question}
        </h2>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{C.cols.name}</th>
                <th scope="col">{C.cols.sector}</th>
                <th scope="col">{C.cols.entities}</th>
                <th scope="col">{C.cols.ai}</th>
                <th scope="col">{C.cols.onboarding}</th>
              </tr>
            </thead>
            <tbody>
              {demo.clients.map((c) => (
                <tr key={c.id}>
                  <th scope="row">
                    <Link to={c.id}>{c.name}</Link>
                  </th>
                  <td>{c.sector}</td>
                  <td>
                    <ul className="plain">
                      {c.entities.map((e) => (
                        <li key={e.id}>
                          {e.name} <span className="muted">· {e.role}</span>
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td>{en.dpo.aiSettings[c.aiSetting]}</td>
                  <td>{c.onboarding ? C.onboardingPhase(c.onboarding.phase, C.onboardingPhases[c.onboarding.phase - 1]) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="section" aria-labelledby="onb-title">
        <h2 id="onb-title" className="label">
          {C.onboardingTitle}
        </h2>
        <p className="readable">{C.onboardingLead}</p>
        <ol className="stepper">
          {C.onboardingPhases.map((p, i) => {
            const n = i + 1;
            const phase = onboardingClient?.onboarding?.phase ?? 0;
            const state = n < phase ? 'done' : n === phase ? 'current' : 'upcoming';
            return (
              <li key={p} className={`step step-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
                <span className="mono small">{n}</span> {p}
                <span className="small muted"> · {en.dpo.dpia.stepState[state]}</span>
              </li>
            );
          })}
        </ol>
        {onboardingClient && (
          <p className="small">
            {C.onboardingDemo}: <Link to={onboardingClient.id}>{onboardingClient.name}</Link>{' '}
            <span className="muted">({C.started(fmtDate(onboardingClient.onboarding!.startedOn))})</span>{' '}
            <Tag>{en.dpo.aiSettings[onboardingClient.aiSetting]}</Tag>
          </p>
        )}
      </section>
    </>
  );
}
