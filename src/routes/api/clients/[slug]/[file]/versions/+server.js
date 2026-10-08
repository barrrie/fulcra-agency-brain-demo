import { json } from '@sveltejs/kit';
import { requireOwner, listVersions } from '$lib/server/brains.js';

export async function GET({ cookies, params }) {
  const token = requireOwner(cookies);
  return json({ versions: await listVersions(token, params.slug, params.file) });
}
