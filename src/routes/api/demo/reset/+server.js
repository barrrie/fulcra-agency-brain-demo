import { json, error } from '@sveltejs/kit';
import { requireOwner } from '$lib/server/brains.js';
import { DEMO_SANDBOX, getSandbox } from '$lib/server/sandbox.js';

/** Put the sandbox back to its starting shares and team list (owner only). */
export function POST({ cookies }) {
  if (!DEMO_SANDBOX) throw error(404, 'Not found');
  requireOwner(cookies);
  getSandbox().reset();
  return json({ reset: true });
}
