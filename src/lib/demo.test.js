import { describe, it, expect } from 'vitest';
import { zonedTime, nextWeekly, materializeSignals, materialize } from './demo.js';
import { formatMeetingTime } from './signals.js';

describe('zonedTime', () => {
  it('reads wall-clock time in New York across daylight saving', () => {
    expect(zonedTime(2026, 10, 14, 14, 0).toISOString()).toBe('2026-10-14T18:00:00.000Z'); // EDT
    expect(zonedTime(2026, 12, 1, 14, 0).toISOString()).toBe('2026-12-01T19:00:00.000Z'); // EST
  });
});

describe('nextWeekly', () => {
  // Wednesday 14 Oct 2026, 12:00 New York
  const now = new Date('2026-10-14T16:00:00Z');
  it('finds the next matching weekday', () => {
    expect(nextWeekly({ weekday: 4, time: '13:00', minutes: 45 }, now).start).toBe('2026-10-15T17:00:00.000Z');
    expect(nextWeekly({ weekday: 2, time: '14:00' }, now).start).toBe('2026-10-20T18:00:00.000Z');
  });
  it('keeps a meeting today until it ends, then rolls to next week', () => {
    expect(nextWeekly({ weekday: 3, time: '11:30', minutes: 60 }, now).start).toBe('2026-10-14T15:30:00.000Z');
    expect(nextWeekly({ weekday: 3, time: '09:00', minutes: 30 }, now).start).toBe('2026-10-21T13:00:00.000Z');
  });
});

describe('materializeSignals', () => {
  it('produces meetings the cards can format', () => {
    const now = new Date('2026-10-14T16:00:00Z');
    const s = materializeSignals(
      { generatedHoursAgo: 2, clients: { a: { meetings: [{ title: 'Weekly', weekday: 4, time: '11:00' }], asana: { open: 3, overdue: 1 } } } },
      now
    );
    expect(s.generatedAt).toBe('2026-10-14T14:00:00.000Z');
    expect(s.clients.a.asana).toEqual({ open: 3, overdue: 1 });
    expect(formatMeetingTime(s.clients.a.meetings[0], now)).toBe('Tomorrow · 11:00 AM');
  });
});

describe('materialize', () => {
  it('turns hours ago into timestamps and relative paths into rooted ones', () => {
    const now = new Date('2026-10-14T12:00:00Z');
    const out = materialize(
      {
        file_changes: [{ full_name: 'clients/x/log.md', uploaded_at: 3 }, { full_name: '/peer/a.md', uploaded_at: 1 }],
        shares: [{ fulcra_data_types: ['file:clients/x', 'filehistory:/abs', 'HeartRate'] }]
      },
      '/demo-agency',
      now
    );
    expect(out.file_changes[0]).toEqual({ full_name: '/demo-agency/clients/x/log.md', uploaded_at: '2026-10-14T09:00:00.000Z' });
    expect(out.file_changes[1].full_name).toBe('/peer/a.md');
    expect(out.shares[0].fulcra_data_types).toEqual(['file:/demo-agency/clients/x', 'filehistory:/abs', 'HeartRate']);
  });
});
