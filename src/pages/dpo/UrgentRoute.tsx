import { useEffect, useRef, useState } from 'react';
import { fmtDateTime, madridLocalToIso } from '../../components/format';
import { en } from '../../content/en';
import { RULE_BY_ID, computeDeadline } from '../../engine/deadlines';
import { demo } from '../../engine/dpo';

const U = en.dpo.urgent;

/** Breach route: rules only, no AI. The time of awareness must be entered; there is no default. */
export function UrgentRoute({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [clientId, setClientId] = useState(demo.clients[0].id);
  const [aware, setAware] = useState('');
  const rule = RULE_BY_ID.get('breach-notification')!;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const iso = aware ? madridLocalToIso(aware) : null;
  const deadline = iso ? computeDeadline(rule, iso) : null;

  return (
    <dialog ref={ref} className="dialog" aria-labelledby="urgent-title" onClose={onClose}>
      <h2 id="urgent-title">{U.title}</h2>
      <p className="small muted">{U.lead}</p>
      <form method="dialog" className="flow">
        <label className="field">
          <span>{U.client}</span>
          <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
            {demo.clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{U.aware}</span>
          <input type="datetime-local" value={aware} onChange={(e) => setAware(e.target.value)} required />
        </label>
        <div aria-live="polite">
          {deadline ? (
            <p className="urgent-result">
              {U.result(fmtDateTime(deadline.due))} <span className="nowrap">({rule.source})</span>
              {deadline.countingPendingValidation && <span className="small muted"> · {en.dpo.countingPending}</span>}
            </p>
          ) : (
            <p className="small muted">{U.required}</p>
          )}
        </div>
        <ol className="small">
          {U.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <div className="btn-row">
          <button type="submit" className="btn">
            {U.close}
          </button>
        </div>
      </form>
    </dialog>
  );
}
