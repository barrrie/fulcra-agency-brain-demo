import { env } from '$env/dynamic/public';
import { FulcraAPI } from '$lib/api-client.js';
import { AGENCY_ROOT, DEMO_FIXTURES } from '$lib/server/settings.js';
import { demoSignals } from '$lib/server/demo.js';

/** Owner-only: lives outside every client folder, so client shares never reach it. */
export const SIGNALS_FOLDER = AGENCY_ROOT;
export const SIGNALS_FILE = 'signals.json';

/** Read <AGENCY_ROOT>/signals.json with the owner's token. null when it doesn't exist. */
export async function readSignals(token) {
  if (DEMO_FIXTURES) return demoSignals();
  const api = new FulcraAPI(env.PUBLIC_FULCRA_API_ENDPOINT, token);
  const listing = await api.get(`input/v1/file?path=${encodeURIComponent(SIGNALS_FOLDER)}`);
  const meta = (listing?.files || []).find((f) => f.name === SIGNALS_FILE);
  if (!meta) return null;
  const res = await fetch(`${env.PUBLIC_FULCRA_API_ENDPOINT}input/v1/file/${meta.id}/download`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`Could not read signals (${res.status})`);
  return JSON.parse(await res.text());
}
