import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { PageHead, Shell } from '../../components/Shell';
import { en } from '../../content/en';
import { aiact } from '../../engine/data';
import { isStepComplete } from '../../engine/questionnaire';
import { Questionnaire } from './Questionnaire';
import { Results } from './Results';
import { useAnswers } from './state';

// Premise lines taken from the JNIC sheet "ai act" (rows 2 and 6, translated).
const PREMISE_ROWS = [2, 6];

function Intro() {
  const { answers } = useAnswers();
  const started = Object.keys(answers).length > 0;
  const complete = ([1, 2, 3] as const).every((s) => isStepComplete(s, answers));
  const premise = PREMISE_ROWS.map((r) => aiact.premise.find((p) => p.row === r)?.text).filter(Boolean);
  return (
    <>
      <PageHead
        title={en.cyber.title}
        lead={
          <div className="readable">
            <p>
              {premise.join(' ')} {en.cyber.method}
            </p>
          </div>
        }
      />
      <div className="section">
        <div className="btn-row">
          <Link to={started ? firstIncomplete(answers) : 'step/1'} className="btn btn-primary">
            {started ? en.cyber.resume : en.cyber.start}
          </Link>
          {complete && (
            <Link to="results" className="btn">
              {en.cyber.viewResults}
            </Link>
          )}
        </div>
      </div>
    </>
  );
}

function firstIncomplete(answers: ReturnType<typeof useAnswers>['answers']) {
  for (const s of [1, 2, 3] as const) if (!isStepComplete(s, answers)) return `step/${s}`;
  return 'results';
}

export function CyberPage() {
  return (
    <Shell title={en.menu.cyber}>
      <Routes>
        <Route index element={<Intro />} />
        <Route path="step/:n" element={<Questionnaire />} />
        <Route path="results" element={<Results />} />
        <Route path="*" element={<Navigate to="" replace />} />
      </Routes>
    </Shell>
  );
}
