import { lintBrain } from './lint.js';

/**
 * Asana tasks merged into a brain live in <client>/asana.json:
 *   { project, merged_at, tasks: [{ gid, name, due_on, completed, assignee, section, url }],
 *     left_out: [{ gid, reason }] }
 * left_out is what the merge skipped (wrong project, internal admin, ...). Only
 * the reason is kept, never the task name.
 */

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Local YYYY-MM-DD for a Date. */
export function isoDay(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Normalize asana.json and count it. Tasks that trip the pricing guardrail are
 * moved to left out here too, so a bad merge can't leak commercial terms.
 */
export function summarizeAsana(data, today = isoDay(new Date())) {
  const tasks = [];
  const leftOut = (Array.isArray(data?.left_out) ? data.left_out : []).map((t) => ({
    reason: String(t?.reason || 'Not merged')
  }));

  for (const t of Array.isArray(data?.tasks) ? data.tasks : []) {
    const name = String(t?.name ?? '').trim();
    if (!name) continue;
    if (lintBrain(`${name}\n${t?.notes ?? ''}`).length) {
      leftOut.push({ reason: 'Mentions pricing or commercial terms' });
      continue;
    }
    const due = DAY.test(t?.due_on ?? '') ? t.due_on : null;
    const completed = Boolean(t?.completed);
    const status = completed ? 'done' : !due ? 'undated' : due < today ? 'overdue' : 'upcoming';
    tasks.push({
      gid: String(t?.gid ?? name),
      name,
      due,
      completed,
      status,
      assignee: t?.assignee ? String(t.assignee) : null,
      section: t?.section ? String(t.section) : null,
      url: /^https:\/\/app\.asana\.com\//.test(t?.url ?? '') ? t.url : null
    });
  }

  // Dated tasks first by due date, undated last.
  tasks.sort(
    (a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999') || a.name.localeCompare(b.name)
  );

  const count = (s) => tasks.filter((t) => t.status === s).length;
  const reasons = {};
  for (const { reason } of leftOut) reasons[reason] = (reasons[reason] || 0) + 1;

  return {
    project: data?.project ? String(data.project) : null,
    mergedAt: data?.merged_at ?? null,
    tasks,
    counts: {
      merged: tasks.length,
      upcoming: count('upcoming'),
      overdue: count('overdue'),
      undated: count('undated'),
      done: count('done'),
      leftOut: leftOut.length
    },
    leftOutReasons: Object.entries(reasons)
      .map(([reason, n]) => ({ reason, n }))
      .sort((a, b) => b.n - a.n)
  };
}

/**
 * Monday-first weeks for one month (month is 0-11). Each day:
 * { day: 'YYYY-MM-DD', inMonth, tasks }.
 */
export function calendarMonth(year, month, tasks = []) {
  const byDay = {};
  for (const t of tasks) if (t.due) (byDay[t.due] ||= []).push(t);

  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - ((first.getDay() + 6) % 7));
  const last = new Date(year, month + 1, 0);
  const end = new Date(year, month, last.getDate() + ((7 - last.getDay()) % 7));

  const weeks = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === 1) weeks.push([]);
    const day = isoDay(d);
    weeks[weeks.length - 1].push({ day, inMonth: d.getMonth() === month, tasks: byDay[day] || [] });
  }
  return weeks;
}

/**
 * asana.json minus anything the guardrail drops, in the same shape. The server
 * sends this so pricing never leaves it; the browser summarizes with its own date.
 */
export function sanitizeAsana(data) {
  if (!data || typeof data !== 'object') return null;
  const s = summarizeAsana(data);
  return {
    project: s.project,
    merged_at: s.mergedAt,
    tasks: s.tasks.map(({ gid, name, due, completed, assignee, section, url }) => ({
      gid,
      name,
      due_on: due,
      completed,
      assignee,
      section,
      url
    })),
    left_out: s.leftOutReasons.flatMap(({ reason, n }) =>
      Array.from({ length: n }, () => ({ reason }))
    )
  };
}
