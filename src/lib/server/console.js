import { env } from '$env/dynamic/public';
import { FulcraAPI } from '$lib/api-client.js';
import { receivedShares } from '$lib/console.js';

/** Fulcra client for the owner's token. */
export const fulcra = (token) => new FulcraAPI(env.PUBLIC_FULCRA_API_ENDPOINT, token);

/** Run a read and keep going if it fails, so one bad call can't blank the page. */
export async function soft(promise, errors, key) {
  try {
    return await promise;
  } catch (e) {
    errors[key] = String(e?.message || e);
    return null;
  }
}

/** Every catalog source we can read, for naming data streams. */
export async function loadCatalogSources(api, errors, peerIds = []) {
  const [catalog, defined, ...shared] = await Promise.all([
    soft(api.get('data/v1/catalog'), errors, 'catalog'),
    soft(api.get('input/v1/data_type'), errors, 'data_types'),
    ...peerIds.map((uid) => soft(api.get(`user/v1/shared/${encodeURIComponent(uid)}/data_types`), {}, uid))
  ]);
  return { catalog, defined, shared };
}

/**
 * Everything the Activity view needs between `start` and `end`: the owner's own
 * updates, each sharer's updates, received shares, and stream names.
 */
export async function loadActivityInputs(token, start, end) {
  const api = fulcra(token);
  const errors = {};
  const q = `start_time=${encodeURIComponent(start)}&end_time=${encodeURIComponent(end)}`;
  const datasets = await soft(api.get('user/v1/dataset'), errors, 'shares');
  const peerIds = [...new Set(receivedShares(datasets).map((s) => s.sharing_fulcra_userid))];

  const [own, peerUpdates, catalogs] = await Promise.all([
    soft(api.get(`data/v1/updates?${q}`), errors, 'updates'),
    Promise.all(
      peerIds.map(async (uid) => ({
        uid,
        updates: await soft(api.get(`data/v1/updates?${q}&fulcra_userid=${encodeURIComponent(uid)}`), errors, `updates:${uid}`)
      }))
    ),
    loadCatalogSources(api, errors, peerIds)
  ]);
  return { own, peers: peerUpdates, datasets, catalogs, errors };
}
