/**
 * Deadline engine: programmed rules, never a language model.
 *
 * - Each procedure has its own rule; periods of different procedures never combine
 *   (e.g. the 2 months of a complaint to the DPO never extend the 1 month of a rights request).
 * - Months are calendar months, never converted to 30 days; days are not assumed to be working days.
 * - The start is always the triggering event of the rule. There is no default start date
 *   (in particular, never the date a document was uploaded).
 * - Month arithmetic and the day regime are pluggable per rule. The legal team will choose the regime
 *   for each rule; until then the provisional arithmetic is used and the result is labelled
 *   "Counting pending legal validation".
 */

export type Unit = 'hours' | 'days' | 'months';

export interface Duration {
  amount: number;
  unit: Unit;
}

export interface DeadlineRule {
  id: string;
  procedure: string;
  source: string;
  triggeringEvent: string;
  duration: Duration;
  /** Free-text qualifier from the source (e.g. "without undue delay"). */
  qualifier?: string;
  /** Counting regime chosen by the legal team; null until chosen. */
  countingRegime: CountingRegimeId | null;
  extension?: Duration & { note: string };
  validated: boolean;
}

export type CountingRegimeId = 'eu-1182-71' | 'es-law-39-2015-art-30';

/** Candidate regimes the legal team will choose from. Not implemented until chosen and specified. */
export const CANDIDATE_REGIMES: { id: CountingRegimeId; label: string; scope: string; implemented: boolean }[] = [
  { id: 'eu-1182-71', label: 'Regulation (EEC, Euratom) No 1182/71', scope: 'Periods under EU law', implemented: false },
  { id: 'es-law-39-2015-art-30', label: 'Art. 30 of Spanish Law 39/2015', scope: 'Spanish administrative periods', implemented: false },
];

export const DEADLINE_RULES: DeadlineRule[] = [
  {
    id: 'rights-request',
    procedure: 'Data subject rights request',
    source: 'Art. 12(3) GDPR',
    triggeringEvent: 'Receipt of the request',
    duration: { amount: 1, unit: 'months' },
    extension: { amount: 2, unit: 'months', note: 'Extendable by 2 months, informing the data subject within the first month.' },
    countingRegime: null,
    validated: false,
  },
  {
    id: 'complaint-to-dpo',
    procedure: 'Prior complaint to the DPO',
    source: 'Art. 37(1) LOPDGDD',
    triggeringEvent: 'Receipt of the complaint',
    duration: { amount: 2, unit: 'months' },
    countingRegime: null,
    validated: false,
  },
  {
    id: 'complaint-forwarded',
    procedure: 'Complaint forwarded to the DPO by the authority',
    source: 'Art. 37(2) LOPDGDD',
    triggeringEvent: 'Receipt of the complaint forwarded by the authority',
    duration: { amount: 1, unit: 'months' },
    countingRegime: null,
    validated: false,
  },
  {
    id: 'breach-notification',
    procedure: 'Breach notifiable to the authority',
    source: 'Art. 33(1) GDPR',
    triggeringEvent: 'Becoming aware of the breach',
    duration: { amount: 72, unit: 'hours' },
    qualifier: 'Without undue delay and, where feasible, within 72 hours of becoming aware',
    countingRegime: null,
    validated: false,
  },
  {
    id: 'dpo-appointment',
    procedure: 'Appointment or removal of the DPO (Spain)',
    source: 'Art. 34(3) LOPDGDD',
    triggeringEvent: 'Appointment or removal of the DPO',
    duration: { amount: 10, unit: 'days' },
    countingRegime: null,
    validated: false,
  },
];

export const RULE_BY_ID = new Map(DEADLINE_RULES.map((r) => [r.id, r]));

// ------------------------------------------------------------------ pluggable arithmetic
export interface MonthArithmetic {
  id: string;
  addMonths(start: Date, months: number): Date;
}
export interface DayRegime {
  id: string;
  addDays(start: Date, days: number): Date;
}

/**
 * Provisional: same day number in the target month, or the last day of that month when it does not
 * exist (31 Jan + 1 month = 28/29 Feb). Never "30 days". Not a legal choice.
 */
export const provisionalMonths: MonthArithmetic = {
  id: 'provisional-calendar-months',
  addMonths(start, months) {
    const y = start.getUTCFullYear();
    const m = start.getUTCMonth() + months;
    const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const d = new Date(start);
    d.setUTCFullYear(y, m, Math.min(start.getUTCDate(), lastDay));
    return d;
  },
};

/** Provisional: calendar days. Not a legal choice (working days are not assumed). */
export const provisionalDays: DayRegime = {
  id: 'provisional-calendar-days',
  addDays(start, days) {
    return new Date(start.getTime() + days * 86_400_000);
  },
};

export interface Arithmetic {
  months: MonthArithmetic;
  days: DayRegime;
}

/** Registry of implemented regimes, filled once the legal team specifies them. */
const REGIMES = new Map<CountingRegimeId, Arithmetic>();

export function registerRegime(id: CountingRegimeId, arithmetic: Arithmetic) {
  REGIMES.set(id, arithmetic);
}

function arithmeticFor(rule: DeadlineRule): { arithmetic: Arithmetic; pending: boolean } {
  const chosen = rule.countingRegime ? REGIMES.get(rule.countingRegime) : undefined;
  if (chosen && rule.validated) return { arithmetic: chosen, pending: false };
  return { arithmetic: { months: provisionalMonths, days: provisionalDays }, pending: true };
}

function add(start: Date, d: Duration, a: Arithmetic): Date {
  switch (d.unit) {
    case 'hours':
      return new Date(start.getTime() + d.amount * 3_600_000);
    case 'days':
      return a.days.addDays(start, d.amount);
    case 'months':
      return a.months.addMonths(start, d.amount);
  }
}

export class MissingTriggerError extends Error {
  constructor(rule: DeadlineRule) {
    super(`A deadline for "${rule.procedure}" needs the date of the triggering event (${rule.triggeringEvent}).`);
    this.name = 'MissingTriggerError';
  }
}

export interface ComputedDeadline {
  ruleId: string;
  /** ISO date-time of the triggering event used as start. */
  start: string;
  due: Date;
  /** Due date if the rule's extension is applied (counted from the same start). */
  extendedDue?: Date;
  /** True until the legal team validates the rule and its counting regime. */
  countingPendingValidation: boolean;
}

/**
 * Compute a deadline from the triggering event. `triggerDate` is required: ISO date
 * ("2026-10-06") or date-time ("2026-11-02T09:30:00Z").
 */
export function computeDeadline(rule: DeadlineRule, triggerDate: string | null | undefined): ComputedDeadline {
  if (!triggerDate) throw new MissingTriggerError(rule);
  const start = new Date(triggerDate.length === 10 ? `${triggerDate}T00:00:00Z` : triggerDate);
  if (Number.isNaN(start.getTime())) throw new MissingTriggerError(rule);
  const { arithmetic, pending } = arithmeticFor(rule);
  const due = add(start, rule.duration, arithmetic);
  const extendedDue =
    rule.extension && rule.duration.unit === rule.extension.unit
      ? add(start, { amount: rule.duration.amount + rule.extension.amount, unit: rule.duration.unit }, arithmetic)
      : undefined;
  return { ruleId: rule.id, start: start.toISOString(), due, extendedDue, countingPendingValidation: pending };
}

/** Whole days between `from` and `to` (UTC dates); negative when overdue. */
export function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.round((b - a) / 86_400_000);
}
