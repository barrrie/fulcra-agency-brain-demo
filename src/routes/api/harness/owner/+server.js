import { json } from '@sveltejs/kit';
import { GET_owner } from '$lib/server/harness-api.js';
import { DEMO_SANDBOX, personaFor } from '$lib/server/sandbox.js';

export function GET(event) {
  if (DEMO_SANDBOX) return json({ isOwner: personaFor(event.cookies).role === 'owner' });
  return GET_owner(event);
}
