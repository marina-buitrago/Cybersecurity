import { useState } from 'react';
import { DataTable } from '../../components/DataTable';
import { Disclosure, ExternalLink, Segmented, atlasMitigationUrl, atlasTechniqueUrl } from '../../components/ui';
import { en } from '../../content/en';
import { aiact, atlas, catalogue, catalogueDocs, phaseOrder } from '../../engine/data';
import { variablesOf, parse } from '../../engine/expr';
import { QUESTIONS } from '../../engine/questionnaire';
import type { Control, Technique } from '../../engine/types';

const H = en.how.cyber;
type Tab = keyof typeof H.tabs;
const join = (xs: string[]) => xs.join(', ');
const FLAG_SET = new Set(catalogue.flags.map((f) => f.id));
const PURPOSE_SET = new Set(aiact.purposeVocabulary.map((v) => v.id));

// Key figures named in the brief, read from the catalogue's Summary sheet.
const FIGURE_LABELS = [
  'Techniques (unique IDs)',
  'Covered by a control with an official ATLAS link',
  'Covered only by proposed controls',
  'IDs no longer in ATLAS 2026.10',
  'Matrix records no MITRE mitigation but ATLAS 2026.10 has one',
];

function Pipeline() {
  return (
    <ol className="pipeline" aria-label={H.pipelineLabel}>
      {H.pipeline.map((s, i) => (
        <li key={s}>
          <span className="mono small muted">{i + 1}</span> {s}
        </li>
      ))}
    </ol>
  );
}

// ------------------------------------------------------------ questionnaire logic
interface LogicRow {
  step: string;
  question: string;
  answer: string;
  flags: string[];
}
function logicRows(): LogicRow[] {
  const rows: LogicRow[] = [];
  for (const q of QUESTIONS) {
    const text = en.cyber.questions[q.id];
    const label = text?.label ?? q.id;
    for (const o of q.options) {
      const answer = o.id === 'yes' ? en.common.yes : o.id === 'no' ? en.common.no : (text?.options?.[o.id] ?? o.id);
      rows.push({ step: String(q.step), question: label, answer, flags: [...(o.sets ?? []), ...(o.prohibited ? ['(stops the assessment)'] : [])] });
    }
    rows.push({
      step: String(q.step),
      question: label,
      answer: en.common.dontKnow,
      flags: q.id === 'phases' ? [...q.unknownSets, H.unknownSetsAll] : q.unknownSets.length ? q.unknownSets : ['—'],
    });
  }
  return rows;
}
const flagLabel = (f: string) => (FLAG_SET.has(f) || f.startsWith('(') || f === '—' || f.includes(' ') ? f : PURPOSE_SET.has(f) ? `${f} ${H.purposeOnly}` : f);

function LogicTab() {
  return (
    <>
      <DataTable<LogicRow>
        caption={H.tabs.logic}
        rows={logicRows()}
        rowKey={(r, i) => `${r.question}-${r.answer}-${i}`}
        filters={[{ label: en.cyber.stepLabel, values: (r) => [r.step] }]}
        columns={[
          { header: H.logicCols.step, text: (r) => r.step, mono: true },
          { header: H.logicCols.question, text: (r) => r.question, minWidth: 260 },
          { header: H.logicCols.answer, text: (r) => r.answer, minWidth: 220 },
          { header: H.logicCols.flags, text: (r) => r.flags.map(flagLabel).join(', '), mono: true, minWidth: 200 },
        ]}
      />
      <p className="small muted">{H.highRiskRule}</p>
      <Disclosure summary={<span>{H.flagsTitle}</span>}>
        <DataTable
          caption={H.flagsTitle}
          rows={catalogue.flags}
          rowKey={(f) => f.id}
          columns={[
            { header: H.flagCols.flag, text: (f) => f.id, mono: true },
            { header: H.flagCols.meaning, text: (f) => f.meaning, minWidth: 320 },
            { header: H.flagCols.step, text: (f) => f.step },
          ]}
        />
      </Disclosure>
      <Disclosure summary={<span>{H.purposeVocabTitle}</span>}>
        <DataTable
          caption={H.purposeVocabTitle}
          rows={aiact.purposeVocabulary}
          rowKey={(f) => f.id}
          columns={[
            { header: H.flagCols.flag, text: (f) => f.id, mono: true },
            { header: H.flagCols.meaning, text: (f) => f.meaning, minWidth: 320 },
          ]}
        />
      </Disclosure>
    </>
  );
}

// ------------------------------------------------------------ controls and techniques

function ControlsTab() {
  return (
    <DataTable<Control>
      caption={H.tabs.controls}
      rows={catalogue.controls}
      rowKey={(c) => c.id}
      filters={[
        { label: H.filters.family, values: (c) => [c.family], order: [...new Set(catalogue.controls.map((c) => c.family))] },
        { label: H.filters.phase, values: (c) => c.phases, order: phaseOrder },
        { label: H.filters.type, values: (c) => [c.type] },
        { label: H.filters.nature, values: (c) => c.nature },
      ]}
      columns={[
        { header: H.controlCols.id, text: (c) => c.id, mono: true },
        { header: H.controlCols.family, text: (c) => c.family, minWidth: 160 },
        { header: H.controlCols.control, text: (c) => c.name, minWidth: 220 },
        { header: H.controlCols.what, text: (c) => c.what, long: true, minWidth: 300 },
        { header: H.controlCols.evidence, text: (c) => c.evidence, long: true, minWidth: 240 },
        { header: H.controlCols.phases, text: (c) => c.phases.join(' · '), minWidth: 160 },
        { header: H.controlCols.type, text: (c) => c.type },
        { header: H.controlCols.condition, text: (c) => c.condition, mono: true, minWidth: 180 },
        { header: H.controlCols.atlasLinks, text: (c) => (c.crossCutting ? 'Cross-cutting' : join(c.atlasLinks)), long: true, mono: true, minWidth: 200 },
        { header: H.controlCols.proposedLinks, text: (c) => join(c.proposedLinks), long: true, mono: true, minWidth: 180 },
        {
          header: H.controlCols.atlas,
          text: (c) => c.atlasMitigations.map((m) => (m.id ? `${m.id} ${m.name} [${m.concreteness}]${m.partial ? ' (partial)' : ''}` : m.raw)).join('\n'),
          long: true,
          minWidth: 240,
        },
        {
          header: H.controlCols.etsi,
          text: (c) => c.etsi.map((e) => (e.provision ? `${e.provision} (${e.verb}) [${e.concreteness}] · ${e.principle}` : e.raw)).join('\n'),
          long: true,
          minWidth: 240,
        },
        { header: H.controlCols.iso, text: (c) => c.iso.map((i) => (i.id ? `${i.id} ${i.name}` : i.raw)).join('\n'), long: true, minWidth: 220 },
        {
          header: H.controlCols.legal,
          text: (c) => c.legal.map((l) => (l.citation ? `${l.citation} · if: ${l.condition} [${l.concreteness}]` : l.raw)).join('\n'),
          long: true,
          minWidth: 240,
        },
        { header: H.controlCols.nature, text: (c) => c.nature.join(' · '), long: true, minWidth: 220 },
        { header: H.controlCols.concreteness, text: (c) => c.concreteness },
        { header: H.controlCols.noSource, text: (c) => c.noSourceWhy, long: true, minWidth: 220 },
      ]}
    />
  );
}

const conditionFlags = (t: Technique) => variablesOf(parse(t.appliesWhen, FLAG_SET));

function TechniquesTab() {
  return (
    <DataTable<Technique>
      caption={H.tabs.techniques}
      rows={catalogue.techniques}
      rowKey={(t) => t.id}
      filters={[
        { label: H.filters.phase, values: (t) => t.phases, order: phaseOrder },
        { label: H.filters.tactic, values: (t) => t.tactics },
        { label: H.filters.condition, values: conditionFlags },
      ]}
      columns={[
        {
          header: H.techCols.id,
          text: (t) => t.id,
          render: (t) => (
            <ExternalLink href={t.jnic.link ?? atlasTechniqueUrl(t.id)}>
              <span className="mono">{t.id}</span>
            </ExternalLink>
          ),
        },
        { header: H.techCols.name, text: (t) => t.nameAtlas, minWidth: 180 },
        { header: H.techCols.nameMatrix, text: (t) => t.nameMatrix, minWidth: 180 },
        { header: H.techCols.tactic, text: (t) => join(t.tactics), minWidth: 140 },
        { header: H.techCols.phases, text: (t) => t.phases.join(' · '), minWidth: 150 },
        { header: H.techCols.inAtlas, text: (t) => (t.inAtlas ? H.yes : H.no) },
        { header: H.techCols.appliesWhen, text: (t) => t.appliesWhen, mono: true, minWidth: 200 },
        { header: H.techCols.prep, text: (t) => (t.attackerPreparation ? H.yes : H.no) },
        { header: H.techCols.mitigations, text: (t) => join(t.atlasMitigations), mono: true, long: true, minWidth: 160 },
        { header: H.techCols.controlsAtlas, text: (t) => join(t.controlsAtlas), mono: true, long: true, minWidth: 150 },
        { header: H.techCols.controlsProposed, text: (t) => join(t.controlsProposed), mono: true, long: true, minWidth: 150 },
        { header: H.techCols.colJ, text: (t) => t.jnic.matrixMitigation.join('\n\n'), long: true, minWidth: 320 },
        { header: H.techCols.coverage, text: (t) => t.jnic.coverageRaw.map((c) => c.text).join('\n\n'), long: true, minWidth: 280 },
        { header: H.techCols.nist, text: (t) => join(t.nist), mono: true, long: true, minWidth: 150 },
        { header: H.techCols.notes, text: (t) => t.notes.join('\n'), long: true, minWidth: 240 },
      ]}
    />
  );
}

// ------------------------------------------------------------ ATLAS, legal, gaps
function AtlasTab() {
  return (
    <>
      <h3 className="label">{H.mitigationsTitle}</h3>
      <DataTable
        caption={H.mitigationsTitle}
        rows={atlas.mitigations}
        rowKey={(m) => m.id}
        filters={[{ label: H.filters.category, values: (m) => [m.category] }]}
        columns={[
          {
            header: H.mitCols.id,
            text: (m) => m.id,
            render: (m) => (
              <ExternalLink href={atlasMitigationUrl(m.id)}>
                <span className="mono">{m.id}</span>
              </ExternalLink>
            ),
          },
          { header: H.mitCols.name, text: (m) => m.name, minWidth: 220 },
          { header: H.mitCols.category, text: (m) => m.category },
          { header: H.mitCols.phases, text: (m) => join(m.phases), minWidth: 180 },
          { header: H.mitCols.concreteness, text: (m) => m.concreteness },
          { header: H.mitCols.techniques, text: (m) => join(m.techniques), mono: true, long: true, minWidth: 220 },
          { header: H.mitCols.controls, text: (m) => join(m.controls), mono: true },
        ]}
      />
      <h3 className="label spaced">{H.outsideTitle}</h3>
      <DataTable
        caption={H.outsideTitle}
        rows={atlas.outside}
        rowKey={(o) => o.id}
        filters={[{ label: H.filters.tactic, values: (o) => o.tactics }]}
        columns={[
          { header: H.outCols.id, text: (o) => o.id, mono: true },
          { header: H.outCols.name, text: (o) => o.name, minWidth: 200 },
          { header: H.outCols.tactic, text: (o) => join(o.tactics), minWidth: 140 },
          { header: H.outCols.maturity, text: (o) => o.maturity },
          { header: H.outCols.mitigations, text: (o) => join(o.mitigations), mono: true, long: true, minWidth: 160 },
          { header: H.outCols.controlsAtlas, text: (o) => join(o.controlsAtlas), mono: true, long: true },
          { header: H.outCols.controlsProposed, text: (o) => join(o.controlsProposed), mono: true },
        ]}
      />
    </>
  );
}

function LegalTab() {
  return (
    <>
      <h3 className="label">{H.legalTitle}</h3>
      <DataTable
        caption={H.legalTitle}
        rows={catalogue.legalBasis}
        rowKey={(l) => l.key}
        columns={[
          { header: H.legalCols.key, text: (l) => l.key, mono: true },
          { header: H.legalCols.citation, text: (l) => l.citation, minWidth: 140 },
          { header: H.legalCols.condition, text: (l) => l.condition, minWidth: 220 },
          { header: H.legalCols.rule, text: (l) => l.rule, mono: true, minWidth: 180 },
          { header: H.legalCols.concreteness, text: (l) => l.concreteness },
          { header: H.legalCols.origin, text: (l) => l.concretenessOrigin, minWidth: 180 },
          { header: H.legalCols.controls, text: (l) => join(l.controls), mono: true, long: true, minWidth: 180 },
        ]}
      />
      <h3 className="label spaced">{H.obligationsTitle}</h3>
      <DataTable
        caption={H.obligationsTitle}
        rows={aiact.obligations}
        rowKey={(o) => o.id}
        filters={[{ label: H.filters.section, values: (o) => [o.section], order: [...new Set(aiact.obligations.map((o) => o.section))] }]}
        columns={[
          { header: H.oblCols.section, text: (o) => o.section, minWidth: 160 },
          { header: H.oblCols.obligation, text: (o) => o.obligation, minWidth: 240 },
          { header: H.oblCols.article, text: (o) => o.article, minWidth: 160 },
          { header: H.oblCols.concreteness, text: (o) => o.concreteness ?? en.common.pendingValidation },
          { header: H.oblCols.preconditions, text: (o) => o.preconditions, long: true, minWidth: 280 },
          { header: H.oblCols.rule, text: (o) => o.rule, mono: true, minWidth: 200 },
        ]}
      />
    </>
  );
}

function GapsTab() {
  return (
    <>
      <h3 className="label">{H.riskTitle}</h3>
      <DataTable
        caption={H.riskTitle}
        rows={aiact.riskTable}
        rowKey={(r) => String(r.row)}
        columns={[
          { header: H.riskCols.risk, text: (r) => r.risk, minWidth: 160 },
          { header: H.riskCols.description, text: (r) => r.description, minWidth: 240 },
          { header: H.riskCols.why, text: (r) => r.whyMinimalRiskIsExposed, long: true, minWidth: 320 },
        ]}
      />
      <h3 className="label spaced">{H.etsiTitle}</h3>
      <DataTable
        caption={H.etsiTitle}
        rows={aiact.etsi}
        rowKey={(r, i) => `${r.area}-${i}`}
        columns={[
          { header: H.etsiCols.area, text: (r) => r.area, minWidth: 180 },
          { header: H.etsiCols.establishes, text: (r) => r.establishes, long: true, minWidth: 280 },
          { header: H.etsiCols.gaps, text: (r) => r.gaps, long: true, minWidth: 280 },
        ]}
      />
      <h3 className="label spaced">{aiact.gapsTitle}</h3>
      <DataTable
        caption={aiact.gapsTitle}
        rows={aiact.gaps}
        rowKey={(r, i) => `${r.article}-${i}`}
        columns={[
          { header: H.gapsCols.article, text: (r) => r.article, minWidth: 140 },
          { header: H.gapsCols.description, text: (r) => r.description, long: true, minWidth: 280 },
          { header: H.gapsCols.reason, text: (r) => r.reason, long: true, minWidth: 280 },
          { header: H.gapsCols.papers, text: (r) => r.papers.join('\n\n'), long: true, minWidth: 280 },
        ]}
      />
      <h3 className="label spaced">{H.papersTitle}</h3>
      <DataTable
        caption={H.papersTitle}
        rows={aiact.papers}
        rowKey={(_r, i) => `${i}`}
        columns={[
          { header: H.papersCols.reference, text: (r) => r.reference, minWidth: 300 },
          { header: H.papersCols.abstract, text: (r) => r.abstract, long: true, minWidth: 360 },
        ]}
      />
    </>
  );
}

export function HowCyber() {
  const [tab, setTab] = useState<Tab>('logic');
  const premise = aiact.premise.filter((p) => [2, 6, 7].includes(p.row)).map((p) => p.text);
  const built = catalogueDocs.readme.sections.find((s) => s.title === 'How it was built');
  const others = catalogueDocs.readme.sections.filter((s) => s.title !== 'How it was built' && s.title !== 'Sources');
  const figures = FIGURE_LABELS.map((l) => catalogueDocs.summary.figures.find((f) => f.label === l)).filter(Boolean);
  return (
    <>
      <section className="section">
        <h2 className="label">{H.pipelineLabel}</h2>
        <Pipeline />
      </section>
      <section className="section hairline-cols">
        <div>
          <h2 className="label">{H.premiseLabel}</h2>
          <p className="readable">{premise.join(' ')}</p>
          <h2 className="label spaced">{H.figuresLabel}</h2>
          <dl className="figures">
            {figures.map((f) => (
              <div key={f!.label}>
                <dt>{f!.label}</dt>
                <dd className="mono">{f!.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div>
          <h2 className="label">{H.methodLabel}</h2>
          <ol className="small readable">
            {built?.lines.map((l) => (
              <li key={l}>{l.replace(/^\d+\.\s*/, '')}</li>
            ))}
          </ol>
          <Disclosure summary={<span className="small">{H.readmeMore}</span>}>
            {others.map((s) => (
              <div key={s.title} className="small">
                <h3 className="label">{s.title}</h3>
                <ul>
                  {s.lines.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </div>
            ))}
          </Disclosure>
        </div>
      </section>
      <section className="section">
        <Disclosure summary={<span>{H.rulesLabel}</span>}>
          <ol className="readable">
            {H.rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ol>
        </Disclosure>
      </section>
      <section className="section">
        <div className="section-head">
          <Segmented<Tab> label={H.tabsLabel} value={tab} onChange={setTab} options={(Object.keys(H.tabs) as Tab[]).map((t) => ({ value: t, label: H.tabs[t] }))} />
        </div>
        {tab === 'logic' && <LogicTab />}
        {tab === 'controls' && <ControlsTab />}
        {tab === 'techniques' && <TechniquesTab />}
        {tab === 'atlas' && <AtlasTab />}
        {tab === 'legal' && <LegalTab />}
        {tab === 'gaps' && <GapsTab />}
      </section>
    </>
  );
}

