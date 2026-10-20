import { describe, it, expect } from 'vitest';
import { summarizeAsana, calendarMonth, sanitizeAsana } from './asana.js';

const data = {
  project: 'Client: Reddit',
  merged_at: '2026-10-18T09:00:00Z',
  tasks: [
    { gid: '1', name: 'Draft comment', due_on: '2026-10-25' },
    { gid: '2', name: 'Kickoff deck', due_on: '2026-09-01', completed: true },
    { gid: '3', name: 'Follow up on photos', due_on: '2026-10-10' },
    { gid: '4', name: 'Someday idea' },
    { gid: '5', name: 'Send invoice', due_on: '2026-10-30' },
    { gid: '6', name: 'Check thread', due_on: '2026-10-20' }
  ],
  left_out: [
    { gid: '9', reason: 'Internal admin' },
    { gid: '10', reason: 'Internal admin' }
  ]
};

describe('summarizeAsana', () => {
  const s = summarizeAsana(data, '2026-10-20');

  it('counts merged, upcoming, overdue and left out', () => {
    expect(s.counts).toEqual({
      merged: 5,
      upcoming: 2,
      overdue: 1,
      undated: 1,
      done: 1,
      leftOut: 3
    });
  });
  it('moves tasks that mention pricing to left out without keeping the name', () => {
    expect(s.tasks.map((t) => t.name)).not.toContain('Send invoice');
    expect(s.leftOutReasons).toEqual([
      { reason: 'Internal admin', n: 2 },
      { reason: 'Mentions pricing or commercial terms', n: 1 }
    ]);
  });
  it('sorts by due date with undated last', () => {
    expect(s.tasks.map((t) => t.gid)).toEqual(['2', '3', '6', '1', '4']);
  });
  it('handles a missing file', () => {
    expect(summarizeAsana(null).counts.merged).toBe(0);
  });
});

describe('calendarMonth', () => {
  it('builds Monday-first full weeks and places tasks on their day', () => {
    const weeks = calendarMonth(2026, 9, summarizeAsana(data, '2026-10-20').tasks);
    expect(weeks[0][0].day).toBe('2026-09-28');
    expect(weeks.at(-1).at(-1).day).toBe('2026-11-01');
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    const oct25 = weeks.flat().find((d) => d.day === '2026-10-25');
    expect(oct25.tasks.map((t) => t.gid)).toEqual(['1']);
  });
});

describe('sanitizeAsana', () => {
  it('drops guarded tasks and round-trips through summarizeAsana', () => {
    const clean = sanitizeAsana(data);
    expect(JSON.stringify(clean)).not.toContain('invoice');
    expect(summarizeAsana(clean, '2026-10-20').counts).toEqual(
      summarizeAsana(data, '2026-10-20').counts
    );
  });
});
