import { json, error } from '@sveltejs/kit';
import { requireOwnerView } from '$lib/server/brains.js';
import { loadActivityInputs } from '$lib/server/console.js';
import { buildActivity, collectTypeNames } from '$lib/console.js';
import { demoActivity } from '$lib/server/demo.js';

const DAY = 86_400_000;

/**
 * GET /api/console/activity?seen=<epoch ms>
 * Owner-only. The window starts at the last "mark seen" time (at least 24 hours,
 * at most 30 days back) and ends now.
 */
export async function GET({ cookies, url }) {
  const { token, demo } = requireOwnerView(cookies);
  const now = Date.now();
  const raw = Number(url.searchParams.get('seen'));
  const lastSeen = Number.isFinite(raw) && raw > 0 ? Math.min(raw, now) : now - 3 * DAY;
  const startMs = Math.max(Math.min(lastSeen, now - DAY), now - 30 * DAY);
  const start = new Date(startMs).toISOString();
  const end = new Date(now).toISOString();
  if (demo) return json(demoActivity(lastSeen, start, end));

  const input = await loadActivityInputs(token, start, end);
  if (input.errors.updates && /\b401\b/.test(input.errors.updates)) throw error(401, 'Session expired. Sign in again.');

  const { catalog, defined, shared } = input.catalogs;
  const names = collectTypeNames(catalog, defined, ...shared);
  const view = buildActivity({ own: input.own, peers: input.peers, datasets: input.datasets, names, lastSeen });
  return json({ window: { start, end, lastSeen: new Date(lastSeen).toISOString() }, ...view, errors: input.errors });
}
