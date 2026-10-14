import { json, error } from '@sveltejs/kit';
import { requireSignedIn, requireOwner, listClientSummaries, createClient } from '$lib/server/brains.js';
import { readSignals } from '$lib/server/signals.js';
import { loadAccessMap } from '$lib/server/access.js';
import { clientSignals, sharedWith } from '$lib/signals.js';

export async function GET({ cookies }) {
  const { token, owner, asUser } = requireSignedIn(cookies);
  const clients = await listClientSummaries(token, asUser);
  if (!owner) return json({ role: 'viewer', clients });

  // Owner-only card preview (m5-5). Either source failing must not break the list.
  const [signals, access] = await Promise.all([
    readSignals(token).catch((e) => (console.error('signals read failed', e), undefined)),
    loadAccessMap(token).catch((e) => (console.error('access map failed', e), undefined))
  ]);
  const now = new Date();
  return json({
    role: 'owner',
    signalsAt: signals?.generatedAt ?? null,
    clients: clients.map((c) => ({
      ...c,
      // signalsError: no readable signals.json at all; signals null: the file has nothing for this client
      signals: signals ? clientSignals(signals, c.slug, now) : null,
      signalsError: !signals,
      sharedWith: access ? sharedWith(access.rows, c.slug) : null
    }))
  });
}

/** Owner only: create a new client brain from the starter templates. */
export async function POST({ cookies, request }) {
  const token = requireOwner(cookies);
  if (!request.headers.get('content-type')?.includes('application/json')) throw error(415, 'JSON only');
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') throw error(400, 'Send a JSON object with a name.');
  const { name } = body;
  return json(await createClient(token, name), { status: 201 });
}
