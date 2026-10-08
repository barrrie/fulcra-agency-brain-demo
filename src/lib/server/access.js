import { env } from '$env/dynamic/public';
import { FulcraAPI } from '$lib/api-client.js';
import { listClients, CLIENTS_ROOT, AGENCY_ROOT, DEMO_FIXTURES, uploadFile } from '$lib/server/brains.js';
import { env as privateEnv } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
import { buildAccessMap, shareReach, grantBody, revokePlan, UUID, addTeammate } from '$lib/access.js';

export const TEAM_PATH = `${AGENCY_ROOT}/team.json`;

async function readTeamFile(token) {
  const api = new FulcraAPI(env.PUBLIC_FULCRA_API_ENDPOINT, token);
  const listing = await api.get(`input/v1/file?path=${encodeURIComponent(AGENCY_ROOT)}`);
  const meta = (listing?.files || []).find((f) => f.name === 'team.json');
  if (!meta) return { members: [], pending: [] };
  const res = await fetch(`${env.PUBLIC_FULCRA_API_ENDPOINT}input/v1/file/${meta.id}/download`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`Could not read team list (${res.status})`);
  return JSON.parse(await res.text());
}

async function readTeam(token) {
  const api = new FulcraAPI(env.PUBLIC_FULCRA_API_ENDPOINT, token);
  const listing = await api.get(`input/v1/file?path=${encodeURIComponent(AGENCY_ROOT)}`);
  const meta = (listing?.files || []).find((f) => f.name === 'team.json');
  if (!meta) return { members: [], pending: [] };
  const res = await fetch(`${env.PUBLIC_FULCRA_API_ENDPOINT}input/v1/file/${meta.id}/download`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`Could not read team list (${res.status})`);
  const team = JSON.parse(await res.text());
  return { members: team.members || [], pending: team.pending || [] };
}

async function readGroups(token, ids) {
  const api = new FulcraAPI(env.PUBLIC_FULCRA_API_ENDPOINT, token);
  const out = {};
  await Promise.all(
    ids.map(async (id) => {
      const info = {};
      try {
        const g = await api.get(`user/v1/group/${encodeURIComponent(id)}`);
        info.name = g?.name ?? g?.group_name ?? null;
      } catch { /* name stays unknown */ }
      try {
        const p = await api.get(`user/v1/group/${encodeURIComponent(id)}/participants`);
        const list = Array.isArray(p) ? p : p?.participants;
        if (Array.isArray(list)) info.participants = list.map((x) => x.fulcra_userid ?? x.userid ?? x).filter(Boolean);
      } catch { /* membership unknown: treated as outside */ }
      out[id] = info;
    })
  );
  return out;
}

/** Everything the access page needs, read live from Fulcra. */
export async function loadAccessMap(token) {
  if (DEMO_FIXTURES) throw error(403, 'Access management is off in demo mode');
  const api = new FulcraAPI(env.PUBLIC_FULCRA_API_ENDPOINT, token);
  const [clients, shares, team] = await Promise.all([
    listClients(token),
    api.get('user/v1/datashare'),
    readTeam(token)
  ]);
  const shareList = Array.isArray(shares) ? shares : shares?.datashares || [];
  const groupIds = [...new Set(shareList.flatMap((s) => (s.group_permissions || []).map((g) => g.allowed_group_id)))];
  const groups = groupIds.length ? await readGroups(token, groupIds) : {};
  const map = buildAccessMap(clients, shareList, team.members, groups, CLIENTS_ROOT);
  return {
    ...map,
    totalShares: shareList.length,
    team: team.members.map((m) => ({ name: m.name, role: m.role ?? null })),
    pending: team.pending.map((p) => p.name),
    readAt: new Date().toISOString()
  };
}

function checkTarget(clients, slug, kind, id) {
  if (!clients.includes(slug)) throw error(400, 'Unknown client');
  if (kind !== 'user' && kind !== 'group') throw error(400, 'kind must be user or group');
  if (!UUID.test(id || '')) throw error(400, 'Not a valid Fulcra ID');
}

/** Share one client folder with one user or group. */
export async function grantAccess(token, { slug, kind, id }) {
  const api = new FulcraAPI(env.PUBLIC_FULCRA_API_ENDPOINT, token);
  const clients = await listClients(token);
  checkTarget(clients, slug, kind, id);
  const ownerId = privateEnv.OWNER_USER_ID;
  if (kind === 'user' && id === ownerId) throw error(400, 'You already have access');
  const created = await api.post('user/v1/datashare', grantBody(slug, kind, id, ownerId, CLIENTS_ROOT));
  return { created: { id: created?.datashare_id ?? null, name: created?.datashare_name ?? null } };
}

/**
 * Remove one grantee's access to one client folder, across every share that
 * gives it. Single-recipient shares are deleted; others are rewritten.
 */
export async function revokeAccess(token, { slug, kind, id }) {
  const api = new FulcraAPI(env.PUBLIC_FULCRA_API_ENDPOINT, token);
  const clients = await listClients(token);
  checkTarget(clients, slug, kind, id);
  const shares = await api.get('user/v1/datashare');
  const list = Array.isArray(shares) ? shares : shares?.datashares || [];
  const field = kind === 'user' ? 'permissions' : 'group_permissions';
  const key = kind === 'user' ? 'allowed_fulcra_userid' : 'allowed_group_id';
  const hits = list.filter(
    (s) => shareReach(s, `${CLIENTS_ROOT}/${slug}`) && (s[field] || []).some((p) => p[key] === id)
  );
  if (!hits.length) throw error(404, 'No share gives that access');
  const done = [];
  for (const s of hits) {
    const plan = revokePlan(s, kind, id);
    if (plan.action === 'delete') await api.delete(`user/v1/datashare/${s.datashare_id}`);
    else await api.put(`user/v1/datashare/${s.datashare_id}`, plan.body);
    done.push({ id: s.datashare_id, name: s.datashare_name, action: plan.action });
  }
  return { revoked: done };
}

/**
 * Add a teammate in one confirmed step: record them in team.json, then share
 * each chosen client folder with them (one share per client, so each can be
 * removed on its own). Clients they can already read are skipped.
 */
export async function onboardTeammate(token, { name, id, slugs }) {
  if (!UUID.test(id || '')) throw error(400, 'Not a valid Fulcra ID');
  const ownerId = privateEnv.OWNER_USER_ID;
  if (id === ownerId) throw error(400, 'That is your own ID');
  const clients = await listClients(token);
  const wanted = [...new Set(Array.isArray(slugs) ? slugs : [])];
  if (wanted.some((s) => !clients.includes(s))) throw error(400, 'Unknown client');

  let next;
  try {
    next = addTeammate(await readTeamFile(token), { name, id });
  } catch (e) {
    throw error(400, e.message);
  }
  await uploadFile(token, AGENCY_ROOT, 'team.json', JSON.stringify(next, null, 2) + '\n', 'application/json');

  const api = new FulcraAPI(env.PUBLIC_FULCRA_API_ENDPOINT, token);
  const shares = await api.get('user/v1/datashare');
  const list = Array.isArray(shares) ? shares : shares?.datashares || [];
  const result = { teamUpdated: true, shared: [], skipped: [], failed: [] };
  for (const slug of wanted) {
    const has = list.some(
      (s) => shareReach(s, `${CLIENTS_ROOT}/${slug}`) === 'full' && (s.permissions || []).some((p) => p.allowed_fulcra_userid === id)
    );
    if (has) { result.skipped.push(slug); continue; }
    try {
      await api.post('user/v1/datashare', grantBody(slug, 'user', id, ownerId, CLIENTS_ROOT));
      result.shared.push(slug);
    } catch (e) {
      console.error('onboard share failed', slug, e);
      result.failed.push(slug);
    }
  }
  return result;
}
