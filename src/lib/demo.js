/**
 * Pure helpers that turn the fictional fixtures in /demo into live-looking
 * data: times stored as "hours ago" or "next Tuesday 2pm" become real
 * timestamps relative to now, so the demo never goes stale. No I/O here.
 */
import { SIGNALS_TZ } from './signals.js';

const HOUR = 3_600_000;

/** Milliseconds `tz` is ahead of UTC at instant `t`. */
function tzOffset(t, tz) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric'
  }).formatToParts(new Date(t));
  const p = Object.fromEntries(parts.map((x) => [x.type, Number(x.value)]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(t / 1000) * 1000;
}

/** A wall-clock time in `tz` as a Date. */
export function zonedTime(y, month, d, h, min, tz = SIGNALS_TZ) {
  const guess = Date.UTC(y, month - 1, d, h, min);
  const first = guess - tzOffset(guess, tz);
  // Re-check once in case the guess and the answer sit either side of a clock change.
  return new Date(guess - tzOffset(first, tz));
}

/**
 * The next time a weekly meeting happens that hasn't ended yet.
 * `weekday` is 0 (Sun) to 6 (Sat); `time` is "HH:MM" in `tz`.
 */
export function nextWeekly({ weekday, time, minutes = 30 }, now = new Date(), tz = SIGNALS_TZ) {
  const [h, min] = String(time).split(':').map(Number);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(now)
    .split('-')
    .map(Number);
  for (let k = 0; k <= 7; k++) {
    const day = new Date(Date.UTC(today[0], today[1] - 1, today[2] + k));
    if (day.getUTCDay() !== weekday) continue;
    const start = zonedTime(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), h, min, tz);
    const end = new Date(start.getTime() + minutes * 60_000);
    if (end > now) return { start: start.toISOString(), end: end.toISOString() };
  }
  return null;
}

/** signals.json fixture -> the shape readSignals returns. */
export function materializeSignals(fixture, now = new Date()) {
  const clients = {};
  for (const [slug, c] of Object.entries(fixture?.clients || {})) {
    const meetings = (c.meetings || [])
      .map((m) => {
        const at = nextWeekly(m, now);
        return at && { title: m.title, ...at };
      })
      .filter(Boolean);
    clients[slug] = { meetings, asana: c.asana ?? null };
  }
  const generatedAt = new Date(now.getTime() - (fixture?.generatedHoursAgo ?? 0) * HOUR).toISOString();
  return { generatedAt, clients };
}

const TIME_KEYS = new Set(['uploaded_at', 'archived_at', 'deleted_at', 'created_at']);

/** Paths in fixtures are relative to the agency root unless they start with "/". */
export const underRoot = (root, p) => (String(p).startsWith('/') ? p : `${root}/${p}`);

/**
 * Deep-copy a fixture, turning hour counts in time fields into ISO strings and
 * relative paths (full_name, file:<path>) into paths under `root`.
 */
export function materialize(x, root, now = new Date()) {
  if (Array.isArray(x)) return x.map((v) => materialize(v, root, now));
  if (!x || typeof x !== 'object') return x;
  const out = {};
  for (const [k, v] of Object.entries(x)) {
    if (TIME_KEYS.has(k) && typeof v === 'number') out[k] = new Date(now.getTime() - v * HOUR).toISOString();
    else if (k === 'full_name' && typeof v === 'string') out[k] = underRoot(root, v);
    else if (k === 'fulcra_data_types' && Array.isArray(v))
      out[k] = v.map((t) => t.replace(/^(file|filehistory):(?!\/)(.*)$/, (_, kind, p) => `${kind}:${root}/${p}`));
    else out[k] = materialize(v, root, now);
  }
  return out;
}
