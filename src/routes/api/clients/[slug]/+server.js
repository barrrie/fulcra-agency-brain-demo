import { json } from '@sveltejs/kit';
import { requireSignedIn, readBrain } from '$lib/server/brains.js';

export async function GET({ cookies, params }) {
  const { token, asUser } = requireSignedIn(cookies);
  return json(await readBrain(token, params.slug, asUser));
}
