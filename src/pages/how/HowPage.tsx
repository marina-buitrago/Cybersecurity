import { useState } from 'react';
import { PageHead, Shell } from '../../components/Shell';
import { Segmented } from '../../components/ui';
import { fmtDate } from '../../components/format';
import { en } from '../../content/en';
import { catalogue, catalogueDocs } from '../../engine/data';
import { HowCyber } from './HowCyber';

const H = en.how;
type Section = keyof typeof H.sections;

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
      </section>
    </>
  );
}

export function HowPage() {
  const [section, setSection] = useState<Section>('cyber');
  return (
    <Shell title={en.menu.how}>
      <PageHead title={H.title} lead={<p>{H.lead}</p>}>
        <div className="page-bar">
          <Segmented<Section>
            label={H.sectionsLabel}
            value={section}
            onChange={setSection}
            options={(Object.keys(H.sections) as Section[]).map((s) => ({ value: s, label: H.sections[s] }))}
          />
        </div>
      </PageHead>
      {section === 'cyber' && <HowCyber />}
      {section === 'sources' && <HowSources />}
    </Shell>
  );
}
