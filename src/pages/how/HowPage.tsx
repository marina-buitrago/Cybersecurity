import { useState } from 'react';
import { PageHead, Shell } from '../../components/Shell';
import { Segmented, Tag } from '../../components/ui';
import { fmtDate } from '../../components/format';
import { en } from '../../content/en';
import { catalogue, catalogueDocs } from '../../engine/data';
import { CANDIDATE_REGIMES, DEADLINE_RULES, type Duration } from '../../engine/deadlines';
import { knowledge } from '../../engine/dpo';
import { HowCyber } from './HowCyber';

const H = en.how;
type Section = keyof typeof H.sections;

const dur = (d: Duration) => `${d.amount} ${d.amount === 1 ? d.unit.replace(/s$/, '') : d.unit}`;

function HowDpo() {
  const D = H.dpo;
  const K = en.dpo.client;
  return (
    <>
      <section className="section hairline-cols">
        <div>
          <h2 className="label">{D.filesTitle}</h2>
          <dl className="kv">
            <dt>{K.fileA}</dt>
            <dd>{K.fileAQuestion}</dd>
            <dt>{K.fileB}</dt>
            <dd>{K.fileBQuestion}</dd>
          </dl>
          <p className="small muted readable">{D.filesRule}</p>
        </div>
        <div>
          <h2 className="label">{D.statesTitle}</h2>
          <dl className="kv">
            <dt>{K.states.work}</dt>
            <dd>{Object.values(en.dpo.workStatus).join(' · ')}</dd>
            <dt>{K.states.legal}</dt>
            <dd>{Object.values(en.dpo.legalOutcome).join(' · ')}</dd>
            <dt>{K.states.measure}</dt>
            <dd>{Object.values(en.dpo.measureStatus).join(' · ')}</dd>
            <dt>{K.states.applicability}</dt>
            <dd>{Object.values(en.dpo.applicability).join(' · ')}</dd>
          </dl>
        </div>
      </section>
      <section className="section hairline-cols">
        <div>
          <h2 className="label">{D.cardTitle}</h2>
          <p className="small">{Object.values(en.dpo.knowledge.fields).join(' · ')}</p>
        </div>
        <div>
          <h2 className="label">{D.labelsTitle}</h2>
          <p>
            {knowledge.labels.map((l) => (
              <span key={l}>
                <Tag>{l}</Tag>{' '}
              </span>
            ))}
          </p>
        </div>
      </section>
      <section className="section">
        <h2 className="label">{D.deadlinesTitle}</h2>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                {Object.values(D.deadlineCols).map((h) => (
                  <th key={h} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DEADLINE_RULES.map((r) => (
                <tr key={r.id}>
                  <td>{r.procedure}</td>
                  <td>
                    {r.qualifier ?? dur(r.duration)}
                    {r.extension && <div className="small muted">{r.extension.note}</div>}
                  </td>
                  <td>{r.triggeringEvent}</td>
                  <td className="nowrap">{r.source}</td>
                  <td>{r.countingRegime ?? D.regimePending}</td>
                  <td>{r.validated ? en.common.yes : en.common.no}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small">
          <span className="muted">{D.candidates}:</span> {CANDIDATE_REGIMES.map((c) => `${c.label} (${c.scope})`).join(' · ')}
        </p>
        <ul className="small muted readable">
          {D.deadlineNotes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </section>
      <section className="section hairline-cols">
        <div>
          <h2 className="label">{D.aiTitle}</h2>
          <ol className="pipeline pipeline-compact">
            {D.aiLayers.map((l) => (
              <li key={l.name}>
                <strong>{l.name}</strong>
                <span className="small muted">{l.text}</span>
              </li>
            ))}
          </ol>
          <h2 className="label spaced">{D.aiSettingsTitle}</h2>
          <dl className="kv">
            {Object.keys(en.dpo.aiSettings).map((k) => (
              <div key={k} style={{ display: 'contents' }}>
                <dt>{en.dpo.aiSettings[k]}</dt>
                <dd>{en.dpo.aiSettingHelp[k]}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div>
          <h2 className="label">{D.reposTitle}</h2>
          <dl className="kv">
            {D.repos.map((r) => (
              <div key={r.name} style={{ display: 'contents' }}>
                <dt>{r.name}</dt>
                <dd>{r.text}</dd>
              </div>
            ))}
          </dl>
          <p className="readable">{D.reposRule}</p>
          <p className="small muted">{D.prototypeNote}</p>
        </div>
      </section>
    </>
  );
}

function HowSources() {
  const S = H.sources;
  const m = catalogue.meta;
  const atlasLine = catalogueDocs.readme.sections.find((s) => s.title === 'How it was built')?.lines[0];
  return (
    <>
      <section className="section">
        <h2 className="label">{S.dataset}</h2>
        <p>{S.datasetBuilt(fmtDate(m.buildDate))}</p>
        <h3 className="label spaced">{S.files}</h3>
        <ul className="plain">
          <li>
            <span className="mono">{m.catalogue.file}</span> · {m.catalogue.title} · {m.catalogue.version}
          </li>
          <li>
            <span className="mono">{m.jnic.file}</span> · {m.jnic.title}
          </li>
        </ul>
        {atlasLine && (
          <>
            <h3 className="label spaced">{S.atlasRelease}</h3>
            <p className="readable">{atlasLine.replace(/^\d+\.\s*/, '')}</p>
          </>
        )}
        <h3 className="label spaced">{S.cited}</h3>
        <ul className="plain">
          {m.sources.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        <h3 className="label spaced">{S.brief}</h3>
        <ul className="plain">
          {S.briefSources.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </section>
    </>
  );
}

export function HowPage() {
  const [section, setSection] = useState<Section>('cyber');
  return (
    <Shell title={en.menu.how}>
      <PageHead title={H.title} lead={<p>{H.lead}</p>}>
        <div className="dpo-bar">
          <Segmented<Section>
            label={H.sectionsLabel}
            value={section}
            onChange={setSection}
            options={(Object.keys(H.sections) as Section[]).map((s) => ({ value: s, label: H.sections[s] }))}
          />
        </div>
      </PageHead>
      {section === 'cyber' && <HowCyber />}
      {section === 'dpo' && <HowDpo />}
      {section === 'sources' && <HowSources />}
    </Shell>
  );
}
