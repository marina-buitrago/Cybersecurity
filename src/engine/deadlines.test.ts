import { describe, expect, it } from 'vitest';
import {
  CANDIDATE_REGIMES,
  DEADLINE_RULES,
  MissingTriggerError,
  RULE_BY_ID,
  computeDeadline,
  provisionalMonths,
} from './deadlines';

const rule = (id: string) => RULE_BY_ID.get(id)!;
const day = (d: Date) => d.toISOString().slice(0, 10);

describe('deadline rules', () => {
  it('has the five procedures of the brief, each with every field', () => {
    expect(DEADLINE_RULES.map((r) => r.source)).toEqual([
      'Art. 12(3) GDPR',
      'Art. 37(1) LOPDGDD',
      'Art. 37(2) LOPDGDD',
      'Art. 33(1) GDPR',
      'Art. 34(3) LOPDGDD',
    ]);
    for (const r of DEADLINE_RULES) {
      expect(r.id && r.procedure && r.source && r.triggeringEvent).toBeTruthy();
      expect(r.duration.amount).toBeGreaterThan(0);
      expect(['hours', 'days', 'months']).toContain(r.duration.unit);
      expect(r).toHaveProperty('countingRegime');
      expect(r).toHaveProperty('validated');
    }
  });

  it('labels every result "counting pending legal validation" until a regime is chosen', () => {
    for (const r of DEADLINE_RULES) {
      expect(r.validated).toBe(false);
      expect(computeDeadline(r, '2026-10-06').countingPendingValidation).toBe(true);
    }
    expect(CANDIDATE_REGIMES.every((c) => !c.implemented)).toBe(true);
  });
});

describe('computation', () => {
  it('rights request: 1 calendar month, never 30 days', () => {
    expect(day(computeDeadline(rule('rights-request'), '2026-01-31').due)).toBe('2026-02-28');
    expect(day(computeDeadline(rule('rights-request'), '2026-10-06').due)).toBe('2026-11-06');
    // 30 days from 31 Jan would be 2 Mar: not used.
    expect(day(computeDeadline(rule('rights-request'), '2026-01-31').due)).not.toBe('2026-03-02');
  });

  it('rights request extension: 2 further months, counted from the same start', () => {
    const d = computeDeadline(rule('rights-request'), '2026-01-31');
    expect(day(d.extendedDue!)).toBe('2026-04-30');
  });

  it('complaint to the DPO is a separate procedure and never extends a rights request', () => {
    const rights = computeDeadline(rule('rights-request'), '2026-03-10');
    const complaint = computeDeadline(rule('complaint-to-dpo'), '2026-03-10');
    expect(day(rights.due)).toBe('2026-04-10');
    expect(day(complaint.due)).toBe('2026-05-10');
    expect(complaint.extendedDue).toBeUndefined();
    expect(rights.ruleId).not.toBe(complaint.ruleId);
  });

  it('complaint forwarded by the authority: 1 month', () => {
    expect(day(computeDeadline(rule('complaint-forwarded'), '2026-10-20').due)).toBe('2026-11-20');
  });

  it('breach: 72 hours from becoming aware, to the minute', () => {
    const d = computeDeadline(rule('breach-notification'), '2026-11-02T09:30:00Z');
    expect(d.due.toISOString()).toBe('2026-11-05T09:30:00.000Z');
  });

  it('DPO appointment: 10 days (calendar days, provisionally)', () => {
    expect(day(computeDeadline(rule('dpo-appointment'), '2026-12-28').due)).toBe('2027-01-07');
  });

  it('requires the triggering event: no default start date (e.g. never the upload date)', () => {
    expect(() => computeDeadline(rule('rights-request'), undefined)).toThrow(MissingTriggerError);
    expect(() => computeDeadline(rule('rights-request'), '')).toThrow(MissingTriggerError);
    expect(() => computeDeadline(rule('rights-request'), 'not a date')).toThrow(MissingTriggerError);
  });

  it('month arithmetic handles leap years and year ends', () => {
    const add = (d: string, n: number) => day(provisionalMonths.addMonths(new Date(`${d}T00:00:00Z`), n));
    expect(add('2028-01-31', 1)).toBe('2028-02-29');
    expect(add('2026-11-30', 3)).toBe('2027-02-28');
    expect(add('2026-12-15', 1)).toBe('2027-01-15');
  });
});
