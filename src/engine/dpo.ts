/** Types and pure helpers for the DPO prototype (fictitious demo data). */
import demoJson from '../data/dpo-demo.json';
import documentsJson from '../data/dpo-documents.json';
import knowledgeJson from '../data/dpo-knowledge.json';
import { RULE_BY_ID, computeDeadline, daysBetween, type ComputedDeadline } from './deadlines';

export type WorkStatus = 'pending' | 'in_progress' | 'awaiting_information' | 'reviewed';
export type LegalOutcome = 'compliant' | 'deficiency_found' | 'not_determined' | 'justified_not_applicable';
export type MeasureStatus = 'proposed' | 'accepted' | 'implemented' | 'verified' | 'ineffective';
export type Applicability = 'applicable' | 'justified_not_applicable' | 'to_be_determined';
export type AiSetting = 'controlled' | 'limited' | 'authorised';
export type Basis = 'client_statement' | 'team_verification';
export type Level = 'high' | 'medium' | 'low';

export interface FileItem {
  title: string;
  detail: string;
  basis: Basis;
}
export interface FileSection {
  section: string;
  items: FileItem[];
}
export interface Action {
  id: string;
  title: string;
  subject: string;
  legalBasis: string;
  whoCarriesOut: string;
  dpoInvolvement: string;
  caseId?: string;
  deadline?: string | null;
  evidence: string | null;
  decision: string | null;
  nextReview: string | null;
  workStatus: WorkStatus;
  legalOutcome: LegalOutcome;
  measureStatus: MeasureStatus | null;
  significant?: boolean;
  /** Links the action to an impact-assessment measure so it is counted once. */
  measureId?: string;
  awaitingManagementDecision?: boolean;
  applicability: Applicability;
  basis: Basis;
  file: 'A' | 'B';
}
export interface InfoRequest {
  id: string;
  subject: string;
  recipient: string;
  sentOn: string;
  reminders: string[];
  escalationDate: string;
  status: string;
}
export interface RegisterEntry {
  id: string;
  type: 'art36_4' | 'disagreement' | 'management_communication';
  date: string;
  subject: string;
  dpoPosition: string;
  addressees: string;
  clientResponse: string | null;
  status: string;
  issued: boolean;
}
export interface Case {
  id: string;
  ruleId: string;
  title: string;
  triggerDate: string;
  recordedOn: string;
  status: 'open' | 'closed';
}
export interface Dpia {
  id: string;
  title: string;
  currentStep: number;
  screening: {
    facts: { text: string; basis: Basis }[];
    criteria: { criterion: string; assessment: string }[];
    outcome: string;
    note: string;
  };
  allocation: { authorship: string; factValidation: string; advice: string; decision: string };
  observations: {
    id: string;
    section: string;
    observation: string;
    informationRequired: string;
    recommendation: string;
    addressee: string;
    evidenceOfCorrection: string | null;
    status: string;
  }[];
  decision: {
    dpoReport: { status: string; date: string; summary: string };
    controllerResponse: { date: string; text: string };
    committedMeasures: string[];
    projectDecision: {
      status: string;
      date: string;
      text: string;
      departsFromAdvice: boolean;
      reasons: string;
      disagreement: string;
      businessRiskAccepted: boolean;
    };
  };
  measures: { id: string; title: string; status: MeasureStatus; claimedBy: string | null; evidence: string | null; verification: string }[];
  followUp: { triggers: string[]; events: { date: string; change: string; effect: string }[] };
}
export interface Client {
  id: string;
  name: string;
  sector: string;
  aiSetting: AiSetting;
  onboarding: { phase: number; startedOn: string } | null;
  entities: { id: string; name: string; role: string; establishments: { id: string; name: string }[] }[];
  processing: { id: string; name: string; entityId: string; establishmentIds: string[]; assessed: boolean; status: string; basis: Basis }[];
  fileA: FileSection[];
  fileB: FileSection[];
  aspects?: { title: string; rows: { aspect: string; status: string }[] };
  actions: Action[];
  infoRequests: InfoRequest[];
  register: RegisterEntry[];
  cases: Case[];
  dpia?: Dpia;
  aiSamples: { localSummary: string; externalPayload: string; externalProposal: string };
}
export interface AttentionItem {
  id: string;
  clientId: string;
  situation: string;
  why: string;
  nextAction: string;
  assignedTo: string;
  caseId?: string;
  reviewDate?: string;
  risk: Level;
  blocker: string | null;
}
export interface Demo {
  notice: string;
  demoDate: string;
  team: { id: string; name: string }[];
  clients: Client[];
  attention: AttentionItem[];
}

export interface KnowledgeCard {
  id: string;
  idStatus: 'brief' | 'proposed';
  requirement: string;
  source: string | null;
  sourceNote?: string;
  nature: string[];
  natureStatus: 'brief' | 'proposed';
  obligedParty: string | null;
  conditions: string | null;
  operationalAction: string | null;
  dpoInvolvement: string | null;
  expectedEvidence: string | null;
  deadlineOrTrigger: string | null;
  closingCriterion: string | null;
  legalValidation: string;
}
export interface Knowledge {
  labels: string[];
  cards: KnowledgeCard[];
  coverage: { block: string; sources: string | null; status: string; justification: string }[];
}
export interface DocVersion {
  version: string;
  status: 'draft' | 'reviewed' | 'issued' | 'superseded';
  author: string;
  date: string;
  sources: string[];
}
export interface Documents {
  families: string[];
  templates: { id: string; family: string; title: string; versions: DocVersion[] }[];
  generated: {
    id: string;
    templateRef: string;
    clientId: string;
    title: string;
    status: DocVersion['status'];
    author: string;
    date: string;
    sources: string[];
    blocks: ({ layer: 'approved' | 'ai'; text: string } | { layer: 'data'; label: string; value: string | null; source: string })[];
  };
}

export const demo = demoJson as unknown as Demo;
export const knowledge = knowledgeJson as unknown as Knowledge;
export const documents = documentsJson as unknown as Documents;
export const DEMO_TODAY = new Date(`${demo.demoDate}T12:00:00Z`);

export const clientById = new Map(demo.clients.map((c) => [c.id, c]));
export const teamName = (id: string) => demo.team.find((t) => t.id === id)?.name ?? id;

export function caseDeadline(c: Case): ComputedDeadline {
  const rule = RULE_BY_ID.get(c.ruleId);
  if (!rule) throw new Error(`Unknown deadline rule ${c.ruleId}`);
  return computeDeadline(rule, c.triggerDate);
}

export function findCase(caseId: string): { client: Client; c: Case } | undefined {
  for (const client of demo.clients) {
    const c = client.cases.find((x) => x.id === caseId);
    if (c) return { client, c };
  }
  return undefined;
}

export interface ClientCounts {
  openSignificantDeficiencies: number;
  overdueDeadlines: number;
  processingNotAssessed: number;
  measuresWithoutEvidence: number;
  decisionsPendingWithManagement: number;
  reviewsNeeded: number;
}

/** The six counts shown instead of any compliance percentage. */
export function clientCounts(c: Client, today: Date = DEMO_TODAY): ClientCounts {
  const iso = today.toISOString().slice(0, 10);
  const deadlines = [
    ...c.cases.filter((k) => k.status === 'open').map((k) => caseDeadline(k).due),
    ...c.actions.filter((a) => a.deadline && !a.caseId).map((a) => new Date(`${a.deadline}T23:59:59Z`)),
  ];
  return {
    openSignificantDeficiencies: c.actions.filter((a) => a.significant && a.legalOutcome === 'deficiency_found' && a.measureStatus !== 'verified').length,
    overdueDeadlines: deadlines.filter((d) => d.getTime() < today.getTime()).length,
    processingNotAssessed: c.processing.filter((p) => !p.assessed).length,
    measuresWithoutEvidence:
      c.actions.filter((a) => (a.measureStatus === 'implemented' || a.measureStatus === 'accepted') && !a.evidence).length +
      (c.dpia?.measures.filter(
        (m) => (m.status === 'implemented' || m.status === 'accepted') && !m.evidence && !c.actions.some((a) => a.measureId === m.id),
      ).length ?? 0),
    decisionsPendingWithManagement: c.actions.filter((a) => a.awaitingManagementDecision && !a.decision).length,
    reviewsNeeded: c.actions.filter((a) => a.nextReview && a.nextReview <= iso).length,
  };
}

export interface Urgency {
  due: Date | null;
  days: number | null;
  /** Date-time precision (breaches) */
  withTime: boolean;
  pendingValidation: boolean;
  kind: 'deadline' | 'review' | 'none';
}

export function urgencyOf(item: AttentionItem, today: Date = DEMO_TODAY): Urgency {
  if (item.caseId) {
    const found = findCase(item.caseId);
    if (found) {
      const d = caseDeadline(found.c);
      return {
        due: d.due,
        days: daysBetween(today, d.due),
        withTime: found.c.triggerDate.length > 10,
        pendingValidation: d.countingPendingValidation,
        kind: 'deadline',
      };
    }
  }
  if (item.reviewDate) {
    const due = new Date(`${item.reviewDate}T12:00:00Z`);
    return { due, days: daysBetween(today, due), withTime: false, pendingValidation: false, kind: 'review' };
  }
  return { due: null, days: null, withTime: false, pendingValidation: false, kind: 'none' };
}
