import { json, error } from '@sveltejs/kit';
import { requireOwner } from '$lib/server/brains.js';
import { onboardTeammate } from '$lib/server/access.js';

export async function POST({ cookies, request }) {
  const token = requireOwner(cookies);
  if (!request.headers.get('content-type')?.includes('application/json')) throw error(415, 'JSON only');
  const body = await request.json();
  try {
    return json(await onboardTeammate(token, body));
  } catch (e) {
    if (e?.status) throw e;
    console.error('onboard failed', e);
    throw error(502, 'Fulcra rejected the change');
  }
}
