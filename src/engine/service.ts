/**
 * Swappable boundary between the UI and the engine. Phase 2 can replace the local implementation with
 * a backend client (same interface) without touching the pages.
 */
import { assess, type AssessmentResult, type EngineData } from './assess';
import { engineData } from './data';
import type { Answers } from './questionnaire';

export interface AssessmentService {
  assess(answers: Answers): Promise<AssessmentResult>;
}

export function createLocalAssessmentService(data: EngineData = engineData): AssessmentService {
  return { assess: async (answers) => assess(answers, data) };
}
