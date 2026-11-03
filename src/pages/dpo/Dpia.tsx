import { useState } from 'react';
import { fmtDate } from '../../components/format';
import { Pending, Tag } from '../../components/ui';
import { en } from '../../content/en';
import type { Dpia } from '../../engine/dpo';
import { BasisTag } from './ClientPage';

const P = en.dpo.dpia;

/** Six-step impact assessment. Labels say "Advice issued" and "Controller's decision recorded", never "DPO authorises". */
export function DpiaStepper({ dpia }: { dpia: Dpia }) {
  const [step, setStep] = useState(dpia.currentStep);
  const state = (n: number) => (n < dpia.currentStep ? 'done' : n === dpia.currentStep ? 'current' : 'upcoming');
  return (
    <div>
      <h3 className="dpia-title">
        <span className="mono muted">{dpia.id}</span> {dpia.title}
      </h3>
      <ol className="stepper stepper-buttons">
        {P.steps.map((label, i) => {
          const n = i + 1;
          return (
            <li key={label} className={`step step-${state(n)}`}>
              <button type="button" aria-pressed={step === n} aria-current={n === dpia.currentStep ? 'step' : undefined} onClick={() => setStep(n)}>
                <span className="mono small">{n}</span> {label}
                <span className="small muted"> · {P.stepState[state(n)]}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="step-panel" aria-live="polite">
        <h4 className="label">
          {P.stepLabel(step)} · {P.steps[step - 1]}
        </h4>
        {step === 1 && (
          <dl className="kv">
            <dt>{P.facts}</dt>
            <dd>
              <ul className="plain">
                {dpia.screening.facts.map((f) => (
                  <li key={f.text}>
                    {f.text} <BasisTag basis={f.basis} />
                  </li>
                ))}
              </ul>
            </dd>
            <dt>{P.criteria}</dt>
            <dd>
              <ul className="plain">
                {dpia.screening.criteria.map((c) => (
                  <li key={c.criterion}>
                    <strong>{c.criterion}.</strong> {c.assessment}
                  </li>
                ))}
              </ul>
            </dd>
            <dt>{P.outcome}</dt>
            <dd>
              {dpia.screening.outcome}
              <p className="small muted">{dpia.screening.note}</p>
            </dd>
          </dl>
        )}
        {step === 2 && (
          <dl className="kv">
            {(Object.keys(P.allocation) as (keyof typeof P.allocation)[]).map((k) => (
              <div key={k} style={{ display: 'contents' }}>
                <dt>{P.allocation[k]}</dt>
                <dd>{dpia.allocation[k]}</dd>
              </div>
            ))}
          </dl>
        )}
        {step === 3 && (
          <div className="cards">
            {dpia.observations.map((o) => (
              <article key={o.id} className="obs-card" aria-label={o.id}>
                <p className="mono small muted">{o.id}</p>
                <dl className="kv">
                  {(Object.keys(P.obs) as (keyof typeof P.obs)[]).map((k) => (
                    <div key={k} style={{ display: 'contents' }}>
                      <dt>{P.obs[k]}</dt>
                      <dd>{k === 'status' ? <Tag kind={o.status === 'Open' ? 'alert' : 'filled'}>{o.status}</Tag> : (o[k] ?? <Pending />)}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </div>
        )}
        {step === 4 && (
          <div className="outputs">
            <section className="output">
              <h5 className="label">{P.outputs.dpoReport}</h5>
              <p>
                <Tag kind="filled">{dpia.decision.dpoReport.status}</Tag> {fmtDate(dpia.decision.dpoReport.date)}
              </p>
              <p>{dpia.decision.dpoReport.summary}</p>
            </section>
            <section className="output">
              <h5 className="label">{P.outputs.controllerResponse}</h5>
              <p className="small muted">{fmtDate(dpia.decision.controllerResponse.date)}</p>
              <p>{dpia.decision.controllerResponse.text}</p>
            </section>
            <section className="output">
              <h5 className="label">{P.outputs.committedMeasures}</h5>
              <ul>
                {dpia.decision.committedMeasures.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </section>
            <section className="output output-wide">
              <h5 className="label">{P.outputs.projectDecision}</h5>
              <p>
                <Tag kind="filled">{dpia.decision.projectDecision.status}</Tag> {fmtDate(dpia.decision.projectDecision.date)}
              </p>
              <p>{dpia.decision.projectDecision.text}</p>
              {dpia.decision.projectDecision.departsFromAdvice && (
                <dl className="kv">
                  <dt>{P.departs}</dt>
                  <dd>{en.common.yes}</dd>
                  <dt>{P.reasons}</dt>
                  <dd>{dpia.decision.projectDecision.reasons}</dd>
                  <dt>{P.disagreement}</dt>
                  <dd>{dpia.decision.projectDecision.disagreement}</dd>
                </dl>
              )}
              {dpia.decision.projectDecision.businessRiskAccepted && <p className="small">{P.riskAccepted}</p>}
            </section>
          </div>
        )}
        {step === 5 && (
          <>
            {dpia.measures.map((m) => (
              <div key={m.id} className="measure">
                <p>
                  <span className="mono muted">{m.id}</span> {m.title} <Tag>{en.dpo.measureStatus[m.status]}</Tag>
                </p>
                <dl className="kv">
                  <dt>{P.claimedBy}</dt>
                  <dd>{m.claimedBy ?? '—'}</dd>
                  <dt>{en.dpo.client.chain.evidence}</dt>
                  <dd>{m.evidence ?? <Pending />}</dd>
                  <dt>{P.measureVerification}</dt>
                  <dd>{m.verification}</dd>
                </dl>
              </div>
            ))}
            <p className="small muted">{P.notClosed}</p>
          </>
        )}
        {step === 6 && (
          <dl className="kv">
            <dt>{P.triggers}</dt>
            <dd>
              <ul className="plain">
                {dpia.followUp.triggers.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </dd>
            <dt>{P.events}</dt>
            <dd>
              <ul className="plain">
                {dpia.followUp.events.map((e) => (
                  <li key={e.date}>
                    <span className="muted">{fmtDate(e.date)}</span> {e.change} <strong>{e.effect}</strong>
                  </li>
                ))}
              </ul>
            </dd>
          </dl>
        )}
      </div>
    </div>
  );
}
