/**
 * Pure helpers for the owner's client-card preview (m5-5): next meeting,
 * who a brain is shared with, and Asana heat. No network or Svelte here.
 *
 * Meetings and Asana counts come from <AGENCY_ROOT>/signals.json, written by
 * an agent with the owner's Calendar and Asana connectors. It holds counts
 * only, never task names (those can carry pricing).
 */
import { lintBrain } from './lint.js';

export const SIGNALS_TZ = 'America/New_York';

/** Overdue open tasks -> heat. `max` is inclusive. */
export const HEAT_LEVELS = [
  { key: 'calm', label: 'Calm', max: 5 },
  { key: 'warm', label: 'Warm', max: 20 },
  { key: 'hot', label: 'Hot', max: 60 },
  { key: 'fire', label: 'On fire', max: Infinity }
];

/** { key, label, step: 1-4 } for an overdue count, or null when unknown. */
export function heatLevel(overdue) {
  if (typeof overdue !== 'number' || !Number.isFinite(overdue) || overdue < 0) return null;
  const i = HEAT_LEVELS.findIndex((h) => overdue <= h.max);
  return { key: HEAT_LEVELS[i].key, label: HEAT_LEVELS[i].label, step: i + 1 };
}

/** A meeting title safe to show: "Meeting" if it trips the pricing lint. */
export function safeTitle(title) {
  const t = String(title ?? '').trim();
  if (!t || lintBrain(t).length) return 'Meeting';
  return t;
}

/**
 * The meetings still worth showing (not yet ended), soonest first, with titles
 * masked. Runs server-side so an unsafe title never reaches the browser.
 */
export function upcomingMeetings(meetings, now = new Date(), limit = 3) {
  const t = now.getTime();
  return (Array.isArray(meetings) ? meetings : [])
    .filter((m) => m && !Number.isNaN(Date.parse(m.start)))
    .filter((m) => Date.parse(m.end ?? m.start) > t)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
    .slice(0, limit)
    .map((m) => ({ title: safeTitle(m.title), start: m.start, end: m.end ?? null }));
}

/** The next meeting from an upcoming list, or null. */
export function nextMeeting(meetings, now = new Date()) {
  return upcomingMeetings(meetings, now, 1)[0] ?? null;
}

const dayKey = (d) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: SIGNALS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);

/** "Now", "Today · 12:00 PM", "Tomorrow · 11:00 AM" or "Thu, Oct 15 · 1:00 PM" (New York time). */
export function formatMeetingTime(meeting, now = new Date()) {
  const start = new Date(meeting.start);
  if (start <= now) return 'Now';
  const time = new Intl.DateTimeFormat('en-US', {
    timeZone: SIGNALS_TZ,
    hour: 'numeric',
    minute: '2-digit'
  }).format(start);
  const today = dayKey(now);
  // Next calendar day in New York, not now + 24h (wrong on clock-change days).
  const [y, m, d] = today.split('-').map(Number);
  const tomorrow = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  const day = dayKey(start);
  if (day === today) return `Today · ${time}`;
  if (day === tomorrow) return `Tomorrow · ${time}`;
  const date = new Intl.DateTimeFormat('en-US', {
    timeZone: SIGNALS_TZ,
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  }).format(start);
  return `${date} · ${time}`;
}

/**
 * One client's card signals from signals.json, for the API response.
 * Returns { asana: {open, overdue} | null, meetings: [...] } or null when the
 * client isn't in the file.
 */
export function clientSignals(signals, slug, now = new Date()) {
  const c = signals?.clients?.[slug];
  if (!c) return null;
  const a = c.asana;
  const asana =
    a && Number.isFinite(a.open) && Number.isFinite(a.overdue)
      ? { open: a.open, overdue: a.overdue }
      : null;
  return { asana, meetings: upcomingMeetings(c.meetings, now) };
}

/**
 * Who can see one client folder, from the access map (buildAccessMap rows):
 * a letter avatar each, with details for the hover card.
 */
export function sharedWith(rows, slug) {
  return (rows || [])
    .filter((r) => r.access?.[slug])
    .map((r) => {
      const name = r.name || null;
      return {
        key: r.key,
        letter: name ? name.trim().charAt(0).toUpperCase() : '?',
        name: name ?? `${r.kind === 'group' ? 'Group' : 'User'} ${String(r.id).slice(0, 8)}`,
        named: Boolean(name),
        kind: r.kind,
        inside: Boolean(r.inside),
        access: r.access[slug]
      };
    });
}
