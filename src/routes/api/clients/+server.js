import { json } from '@sveltejs/kit';
import { requireSignedIn, listClients, displayName } from '$lib/server/brains.js';

export async function GET({ cookies }) {
  const { token, owner, asUser } = requireSignedIn(cookies);
  const slugs = await listClients(token, asUser);
  return json({
    role: owner ? 'owner' : 'viewer',
    clients: slugs.map((slug) => ({ slug, name: displayName(slug) }))
  });
}
