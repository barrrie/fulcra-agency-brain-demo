import { json } from '@sveltejs/kit';
import { DEMO_SANDBOX, getSandbox, personaFor } from '$lib/server/sandbox.js';

/** Whether the sandbox is on, who this browser is viewing as, and who else it could be. */
export function GET({ cookies }) {
  if (!DEMO_SANDBOX) return json({ sandbox: false });
  return json({ sandbox: true, as: personaFor(cookies), people: getSandbox().people() });
}
