import { json, error } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { DEMO_FIXTURES } from '$lib/server/brains.js';
import { VIEW_COOKIE, demoIdentity } from '$lib/server/demo.js';

/** Demo only: switch between the owner's view and a teammate's. Changes no data. */
export async function POST({ cookies, request }) {
  if (!DEMO_FIXTURES) throw error(404, 'Not found');
  if (!cookies.get('fulcra_access_token')) throw error(401, 'Not authenticated');
  const body = await request.json().catch(() => null);
  const view = body?.view === 'viewer' ? 'viewer' : 'owner';
  cookies.set(VIEW_COOKIE, view, { path: '/', httpOnly: true, sameSite: 'lax', secure: !dev, maxAge: 60 * 60 * 24 * 30 });
  return json(demoIdentity({ get: () => view }));
}
