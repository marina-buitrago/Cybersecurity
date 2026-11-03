import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Answer, Answers } from '../../engine/questionnaire';

/**
 * Questionnaire answers live only in this browser tab (sessionStorage, no cookies, nothing sent).
 */
const KEY = 'ai-assessment-answers';

function read(): Answers {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Answers) : {};
  } catch {
    return {};
  }
}

function write(a: Answers) {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(a));
  } catch {
    /* storage unavailable: answers stay in memory */
  }
}

interface Ctx {
  answers: Answers;
  setAnswer: (id: string, value: Answer) => void;
  reset: () => void;
}

const AnswersContext = createContext<Ctx | null>(null);

export function AnswersProvider({ children }: { children: ReactNode }) {
  const [answers, setAnswers] = useState<Answers>(read);
  const setAnswer = useCallback((id: string, value: Answer) => {
    setAnswers((prev) => {
      const next = { ...prev, [id]: value };
      write(next);
      return next;
    });
  }, []);
  const reset = useCallback(() => {
    write({});
    setAnswers({});
  }, []);
  const value = useMemo(() => ({ answers, setAnswer, reset }), [answers, setAnswer, reset]);
  return <AnswersContext.Provider value={value}>{children}</AnswersContext.Provider>;
}

export function useAnswers(): Ctx {
  const ctx = useContext(AnswersContext);
  if (!ctx) throw new Error('useAnswers outside AnswersProvider');
  return ctx;
}
