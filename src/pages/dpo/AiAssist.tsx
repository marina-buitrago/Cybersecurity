import { useRef, useState } from 'react';
import { Tag } from '../../components/ui';
import { en } from '../../content/en';
import type { Client } from '../../engine/dpo';

const A = en.dpo.ai;

/**
 * Mock AI: no model is called. Output is labelled "AI proposal: pending validation" and becomes the DPO's
 * advice only after an explicit validation step. External calls show "Content that will be sent" first.
 */
export function AiAssist({ client }: { client: Client }) {
  const externalAllowed = client.aiSetting !== 'controlled';
  const [local, setLocal] = useState<string | null>(null);
  const [proposal, setProposal] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [validated, setValidated] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  return (
    <div className="readable">
      <h3 className="label">{A.title}</h3>
      <p className="small">
        <Tag>{en.dpo.aiSettings[client.aiSetting]}</Tag> <span className="muted">{en.dpo.aiSettingHelp[client.aiSetting]}</span>
      </p>
      <p className="small muted">{A.limits}</p>
      <div className="btn-row">
        <button type="button" className="btn" onClick={() => setLocal(client.aiSamples.localSummary)}>
          {A.local}
        </button>
        <button type="button" className="btn" disabled={!externalAllowed} aria-describedby={!externalAllowed ? 'ext-disabled' : undefined} onClick={() => dialog.current?.showModal()}>
          {A.external}
        </button>
        {!externalAllowed && (
          <span id="ext-disabled" className="small muted">
            {A.disabled}
          </span>
        )}
      </div>

      {local && (
        <div className="ai-proposal">
          <Tag kind="alert">{A.proposalLabel}</Tag>
          <p>{local}</p>
        </div>
      )}

      {proposal && !validated && (
        <div className="ai-proposal">
          <Tag kind="alert">{A.proposalLabel}</Tag>
          <p>{proposal}</p>
          <label className="check">
            <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} /> {A.validateCheck}
          </label>
          <div className="btn-row">
            <button type="button" className="btn btn-primary" disabled={!checked} onClick={() => setValidated(proposal)}>
              {A.validateButton}
            </button>
            <button type="button" className="btn" onClick={() => setProposal(null)}>
              {A.discard}
            </button>
          </div>
        </div>
      )}
      {validated && (
        <div className="validated">
          <Tag kind="filled">{en.dpo.dpia.outputs.dpoReport}</Tag>
          <p>{validated}</p>
          <p className="small muted">{A.validated(A.validator)}</p>
        </div>
      )}

      <dialog ref={dialog} className="dialog" aria-labelledby="preview-title">
        <h3 id="preview-title" className="label">
          {A.previewTitle}
        </h3>
        <pre className="preview">{client.aiSamples.externalPayload}</pre>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              dialog.current?.close();
              setChecked(false);
              setValidated(null);
              setProposal(client.aiSamples.externalProposal);
            }}
          >
            {A.previewConfirm}
          </button>
          <button type="button" className="btn" onClick={() => dialog.current?.close()}>
            {en.dpo.client.cancel}
          </button>
        </div>
      </dialog>
    </div>
  );
}
