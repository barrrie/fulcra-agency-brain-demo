import { json, error } from '@sveltejs/kit';
import { requireOwner, restoreVersion } from '$lib/server/brains.js';

export async function POST({ cookies, params, request }) {
  const token = requireOwner(cookies);
  if (!request.headers.get('content-type')?.includes('application/json')) throw error(415, 'JSON only');
  const { versionId } = await request.json();
  await restoreVersion(token, params.slug, params.file, versionId);
  return json({ restored: versionId });
}
