import { json, error } from '@sveltejs/kit';
import { requireOwner } from '$lib/server/brains.js';
import { loadAccessMap } from '$lib/server/access.js';

export async function GET({ cookies }) {
  const token = requireOwner(cookies);
  try {
    return json(await loadAccessMap(token));
  } catch (e) {
    console.error('access map failed', e);
    throw error(502, 'Could not read sharing data from Fulcra');
  }
}
