import { json, error } from '@sveltejs/kit';
import { requireOwner, saveFile } from '$lib/server/brains.js';

export async function PUT({ cookies, params, request }) {
  const token = requireOwner(cookies);
  if (!request.headers.get('content-type')?.includes('application/json')) throw error(415, 'JSON only');
  const { content, baseId } = await request.json();
  return json(await saveFile(token, params.slug, params.file, content, baseId));
}
