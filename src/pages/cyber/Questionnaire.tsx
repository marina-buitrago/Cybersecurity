import { useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { PageHead } from '../../components/Shell';
import { Disclosure, Tag } from '../../components/ui';
import { en } from '../../content/en';
import { catalogue } from '../../engine/data';
import {
  UNKNOWN,
  isAnswered,
  isStepComplete,
  toggleMulti,
  visibleQuestions,
  type Answer,
  type QuestionDef,
} from '../../engine/questionnaire';
import { useAnswers } from './state';

const isYesNo = (q: QuestionDef) => q.kind === 'single' && q.options.length === 2 && q.options[0].id === 'yes';

function optionLabel(q: QuestionDef, optionId: string): string {
  if (optionId === 'yes') return en.common.yes;
  if (optionId === 'no') return en.common.no;
  return en.cyber.questions[q.id]?.options?.[optionId] ?? optionId;
}

function Question({
  q,
  value,
  onChange,
  showMissing,
}: {
  q: QuestionDef;
  value: Answer | undefined;
  onChange: (v: Answer) => void;
  showMissing: boolean;
}) {
  const text = en.cyber.questions[q.id];
  const missing = showMissing && !isAnswered(q, value);
  const multi = q.kind === 'multi';
  const ids = [...q.options.map((o) => o.id), UNKNOWN];
  const checked = (id: string) =>
    id === UNKNOWN ? value === UNKNOWN : multi ? Array.isArray(value) && value.includes(id) : value === id;
  const select = (id: string) => onChange(multi ? toggleMulti(q, value, id) : id);

  return (
    <fieldset className={`q ${isYesNo(q) ? 'q-inline' : ''}`} id={`q-${q.id}`} tabIndex={-1} aria-invalid={missing || undefined}>
      <legend className="q-label">
        {text?.label ?? q.id}
        {missing && (
          <>
            {' '}
            <Tag kind="alert">{en.cyber.unansweredTag}</Tag>
          </>
        )}
      </legend>
      {(text?.help || multi) && <p className="q-help">{text?.help ?? en.cyber.selectAll}</p>}
      <div className={`q-options ${q.options.length > 4 ? 'q-options-col' : ''}`}>
        {ids.map((id) => (
          <label key={id} className={`q-opt ${id === UNKNOWN ? 'q-unknown' : ''}`}>
            <input type={multi ? 'checkbox' : 'radio'} name={q.id} checked={checked(id)} onChange={() => select(id)} />
            <span>{id === UNKNOWN ? en.common.dontKnow : optionLabel(q, id)}</span>
          </label>
        ))}
      </div>
      {q.id === 'phases' && (
        <Disclosure summary={<span className="small">{en.cyber.phaseDefinitions}</span>}>
          <dl className="kv small">
            {catalogue.meta.phases
              .filter((p) => p.definition)
              .map((p) => (
                <div key={p.id} style={{ display: 'contents' }}>
                  <dt>{p.id}</dt>
                  <dd>{p.definition}</dd>
                </div>
              ))}
          </dl>
        </Disclosure>
      )}
    </fieldset>
  );
}

export function Questionnaire() {
  const { n } = useParams();
  const step = Number(n) as 1 | 2 | 3;
  const { answers, setAnswer } = useAnswers();
  const navigate = useNavigate();
  const [showMissing, setShowMissing] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  if (![1, 2, 3].includes(step)) return <Navigate to="../step/1" replace />;

  const questions = visibleQuestions(step, answers);
  const missing = questions.filter((q) => !isAnswered(q, answers[q.id]));
  const meta = en.cyber.steps[step];

  const next = () => {
    if (!isStepComplete(step, answers)) {
      setShowMissing(true);
      document.getElementById(`q-${missing[0].id}`)?.focus();
      return;
    }
    setShowMissing(false);
    navigate(step < 3 ? `../step/${step + 1}` : '../results');
  };

  return (
    <>
      <PageHead title={meta.title} lead={meta.lead || undefined}>
        <p className="progress">
          <span className="visually-hidden">{en.cyber.stepLabel} </span>
          <span className="mono">{en.cyber.progress(step)}</span>
        </p>
      </PageHead>
      <form
        ref={formRef}
        className="section"
        onSubmit={(e) => {
          e.preventDefault();
          next();
        }}
      >
        {questions.map((q) => (
          <Question key={q.id} q={q} value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} showMissing={showMissing} />
        ))}
        <div className="q-nav">
          {step > 1 ? (
            <Link className="btn" to={`../step/${step - 1}`}>
              {en.common.back}
            </Link>
          ) : (
            <Link className="btn" to="..">
              {en.common.back}
            </Link>
          )}
          <button type="submit" className="btn btn-primary">
            {step < 3 ? en.common.next : en.cyber.toResults}
          </button>
          {missing.length > 0 && (
            <span className="small muted" aria-live="polite">
              {en.cyber.unanswered(missing.length)}
            </span>
          )}
        </div>
      </form>
    </>
  );
}
