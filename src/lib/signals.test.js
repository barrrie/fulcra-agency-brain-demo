import { describe, it, expect } from 'vitest';
import {
  heatLevel,
  safeTitle,
  upcomingMeetings,
  nextMeeting,
  formatMeetingTime,
  clientSignals,
  sharedWith
} from './signals.js';
import { buildAccessMap } from './access.js';

// 9:21pm New York on Tue Oct 13
const NOW = new Date('2026-10-14T01:21:00Z');

describe('heatLevel', () => {
  it('maps overdue counts onto calm / warm / hot / on fire at the agreed thresholds', () => {
    expect(heatLevel(0)).toEqual({ key: 'calm', label: 'Calm', step: 1 });
    expect(heatLevel(5).key).toBe('calm');
    expect(heatLevel(6).key).toBe('warm');
    expect(heatLevel(20).key).toBe('warm');
    expect(heatLevel(21).key).toBe('hot');
    expect(heatLevel(60).key).toBe('hot');
    expect(heatLevel(61)).toEqual({ key: 'fire', label: 'On fire', step: 4 });
    expect(heatLevel(122).key).toBe('fire');
  });
  it('returns null for missing or nonsense counts', () => {
    for (const v of [undefined, null, '7', NaN, -1, Infinity]) expect(heatLevel(v)).toBe(null);
  });
});

describe('meetings', () => {
  const meetings = [
    { title: 'Weekly', start: '2026-10-22T11:00:00-04:00', end: '2026-10-22T11:30:00-04:00' },
    { title: 'Last week', start: '2026-10-08T11:00:00-04:00', end: '2026-10-08T11:30:00-04:00' },
    { title: 'Weekly', start: '2026-10-15T11:00:00-04:00', end: '2026-10-15T11:30:00-04:00' }
  ];

  it('skips meetings that have ended and sorts soonest first', () => {
    expect(upcomingMeetings(meetings, NOW).map((m) => m.start)).toEqual([
      '2026-10-15T11:00:00-04:00',
      '2026-10-22T11:00:00-04:00'
    ]);
    expect(nextMeeting(meetings, NOW).start).toBe('2026-10-15T11:00:00-04:00');
  });
  it('keeps a meeting that is in progress', () => {
    const during = new Date('2026-10-15T15:10:00Z'); // 11:10am NY
    expect(nextMeeting(meetings, during).start).toBe('2026-10-15T11:00:00-04:00');
    expect(formatMeetingTime(nextMeeting(meetings, during), during)).toBe('Now');
  });
  it('returns null when nothing is booked', () => {
    expect(nextMeeting([], NOW)).toBe(null);
    expect(nextMeeting(undefined, NOW)).toBe(null);
  });
  it('masks titles that trip the pricing lint', () => {
    expect(safeTitle('Northlight / Quarry Weekly')).toBe('Northlight / Quarry Weekly');
    expect(safeTitle('Retainer renewal chat')).toBe('Meeting');
    expect(safeTitle('Review $8k proposal')).toBe('Meeting');
    expect(safeTitle('')).toBe('Meeting');
    const out = upcomingMeetings(
      [{ title: 'Invoice review', start: '2026-10-15T11:00:00-04:00' }],
      NOW
    );
    expect(out[0].title).toBe('Meeting');
  });
  it('formats times in New York with Today / Tomorrow', () => {
    const at = (iso) => formatMeetingTime({ start: iso }, NOW);
    expect(at('2026-10-13T22:00:00-04:00')).toBe('Today · 10:00 PM');
    expect(at('2026-10-14T12:00:00-04:00')).toBe('Tomorrow · 12:00 PM');
    expect(at('2026-10-15T11:00:00-04:00')).toBe('Thu, Oct 15 · 11:00 AM');
  });
});

describe('clientSignals', () => {
  const file = {
    clients: {
      'quarry-climbing': {
        asana: { projectGid: '1', open: 78, overdue: 28 },
        meetings: [
          {
            title: 'Northlight / Quarry Weekly',
            start: '2026-10-15T11:30:00-04:00',
            end: '2026-10-15T12:00:00-04:00'
          }
        ]
      },
      'fusion-academy': { asana: { open: 31 }, meetings: [] }
    }
  };
  it('returns counts and upcoming meetings for the client only', () => {
    expect(clientSignals(file, 'quarry-climbing', NOW)).toEqual({
      asana: { open: 78, overdue: 28 },
      meetings: [
        {
          title: 'Northlight / Quarry Weekly',
          start: '2026-10-15T11:30:00-04:00',
          end: '2026-10-15T12:00:00-04:00'
        }
      ]
    });
  });
  it('drops incomplete Asana data and unknown clients', () => {
    expect(clientSignals(file, 'fusion-academy', NOW)).toEqual({ asana: null, meetings: [] });
    expect(clientSignals(file, 'nobody', NOW)).toBe(null);
    expect(clientSignals(null, 'quarry-climbing', NOW)).toBe(null);
  });
});

describe('sharedWith', () => {
  const team = [
    { fulcra_userid: 'me', name: 'Morgan' },
    { fulcra_userid: 'priya', name: 'Priya' }
  ];
  const shares = [
    {
      datashare_id: 's1',
      fulcra_data_types: ['file:/demo-agency/clients/quarry-climbing'],
      permissions: [{ allowed_fulcra_userid: 'priya' }]
    },
    {
      datashare_id: 's2',
      fulcra_data_types: ['file:/demo-agency/clients/quarry-climbing/brief.md'],
      permissions: [{ allowed_fulcra_userid: 'a1b2c3d4-0000-0000-0000-000000000000' }]
    },
    {
      datashare_id: 's3',
      fulcra_data_types: ['file:/demo-agency/clients/quarry-climbing'],
      group_permissions: [{ allowed_group_id: 'g1' }]
    }
  ];
  const map = buildAccessMap(['quarry-climbing', 'corvid-analytics'], shares, team, {
    g1: { name: 'Strategists', participants: ['priya'] }
  });

  it('gives one avatar per grantee with a letter, inside/outside and access level', () => {
    const out = sharedWith(map.rows, 'quarry-climbing');
    const byName = Object.fromEntries(out.map((p) => [p.name, p]));
    expect(byName.Priya).toMatchObject({
      letter: 'P',
      kind: 'user',
      inside: true,
      access: 'full',
      named: true
    });
    expect(byName.Strategists).toMatchObject({
      letter: 'S',
      kind: 'group',
      inside: true,
      access: 'full'
    });
    expect(byName['User a1b2c3d4']).toMatchObject({
      letter: '?',
      inside: false,
      access: 'partial',
      named: false
    });
  });
  it('is empty for a client nobody can see', () => {
    expect(sharedWith(map.rows, 'corvid-analytics')).toEqual([]);
    expect(sharedWith([], 'quarry-climbing')).toEqual([]);
  });
});

describe('formatMeetingTime across clock changes', () => {
  it('uses the next New York calendar day for Tomorrow, not now + 24h', () => {
    // 23:30 NY on Sat Mar 13 2027; clocks spring forward that night
    const springEve = new Date('2027-03-14T04:30:00Z');
    expect(formatMeetingTime({ start: '2027-03-14T10:00:00-04:00' }, springEve)).toBe(
      'Tomorrow · 10:00 AM'
    );
    expect(formatMeetingTime({ start: '2027-03-15T10:00:00-04:00' }, springEve)).toBe(
      'Mon, Mar 15 · 10:00 AM'
    );
    // 00:30 NY on Sun Nov 1 2026, the 25-hour day
    const fallBack = new Date('2026-11-01T04:30:00Z');
    expect(formatMeetingTime({ start: '2026-11-02T10:00:00-05:00' }, fallBack)).toBe(
      'Tomorrow · 10:00 AM'
    );
  });
});
