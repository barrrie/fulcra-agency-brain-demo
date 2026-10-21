import { json, error } from '@sveltejs/kit';
import { DEMO_SANDBOX, SANDBOX_COOKIE, getSandbox } from '$lib/server/sandbox.js';

/**
 * Switch which demo persona this browser views the app as. It sets a cookie and
 * changes no brain or sharing data, so it can't use requireOwner (a teammate
 * view has to be able to switch back). It doesn't exist outside the sandbox.
 */
export async function POST({ cookies, request }) {
  if (!DEMO_SANDBOX) throw error(404, 'Not found');
  if (!request.headers.get('content-type')?.includes('application/json'))
    throw error(415, 'JSON only');
  const { id } = await request.json();
  const person = getSandbox()
    .people()
    .find((p) => p.id === id);
  if (!person) throw error(400, 'Unknown demo person');
  cookies.set(SANDBOX_COOKIE, person.id, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: false
  });
  return json({ as: person });
}
