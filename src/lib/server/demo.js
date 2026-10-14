/**
 * Demo mode: the fictional agency in /demo, served in the same shapes the
 * real Fulcra reads return. Read-only; nothing here calls Fulcra.
 *
 * Anyone signed in sees the owner's view by default and can switch to a
 * teammate's view (the demo_view cookie) to show what sharing hides.
 */
import { error } from '@sveltejs/kit';
import { BRAIN_FILES, displayName } from '$lib/clients.js';
import { buildAccessMap } from '$lib/access.js';
import { buildActivity, collectTypeNames } from '$lib/console.js';
import { materialize, materializeSignals } from '$lib/demo.js';
import { AGENCY_ROOT, CLIENTS_ROOT } from '$lib/server/settings.js';

const BRAINS = import.meta.glob('/demo/brains/*/*.md', { query: '?raw', import: 'default', eager: true });
const DATA = import.meta.glob('/demo/*.json', { import: 'default', eager: true });
const fixture = (name) => DATA[`/demo/${name}.json`];

export const VIEW_COOKIE = 'demo_view';

const team = () => fixture('team');
const owner = () => team().members.find((m) => m.role === 'owner');
/** The teammate whose view the switcher shows: the first non-owner on the team. */
export const demoTeammate = () => team().members.find((m) => m.role !== 'owner');

/** 'owner' or 'viewer'. */
export function demoView(cookies) {
  return cookies.get(VIEW_COOKIE) === 'viewer' ? 'viewer' : 'owner';
}

export function demoIdentity(cookies) {
  const view = demoView(cookies);
  const who = view === 'viewer' ? demoTeammate() : owner();
  return { view, name: who?.name ?? null, teammate: demoTeammate()?.name ?? null };
}

const allClients = () => [...new Set(Object.keys(BRAINS).map((p) => p.split('/')[3]))].sort();

function shares() {
  return materialize(fixture('shares').shares, AGENCY_ROOT);
}

export function demoAccessMap() {
  const clients = allClients();
  const list = shares();
  const { groups = {} } = fixture('shares');
  const map = buildAccessMap(clients, list, team().members, groups, CLIENTS_ROOT);
  return {
    ...map,
    totalShares: list.length,
    team: team().members.map((m) => ({ name: m.name, role: m.role ?? null })),
    pending: (team().pending || []).map((p) => p.name),
    readAt: new Date().toISOString(),
    demo: true
  };
}

/** Clients `asUser` can read: everything for the owner (null), else what the shares give them. */
export function demoClients(asUser = null) {
  if (!asUser) return allClients();
  const { rows } = demoAccessMap();
  const theirs = rows.filter(
    (r) => (r.kind === 'user' && r.id === asUser) || (r.kind === 'group' && groupHas(r.id, asUser))
  );
  return allClients().filter((c) => theirs.some((r) => r.access[c] === 'full'));
}

function groupHas(groupId, userId) {
  return (fixture('shares').groups?.[groupId]?.participants || []).includes(userId);
}

/** Latest change per client, from the fictional Console activity. */
function lastUpdated(slug) {
  const prefix = `${CLIENTS_ROOT}/${slug}/`;
  const own = materialize(fixture('activity').own, AGENCY_ROOT);
  return (
    (own.file_changes || [])
      .filter((f) => f.full_name.startsWith(prefix) && f.state === 'uploaded')
      .map((f) => f.uploaded_at)
      .sort()
      .pop() ?? null
  );
}

export function demoSummaries(asUser = null) {
  return demoClients(asUser).map((slug) => {
    const present = BRAIN_FILES.map((b) => b.file).filter((f) => BRAINS[`/demo/brains/${slug}/${f}`] != null);
    return {
      slug,
      name: displayName(slug),
      present,
      filesPresent: present.length,
      filesTotal: BRAIN_FILES.length,
      updatedAt: lastUpdated(slug)
    };
  });
}

export function demoBrain(slug, asUser = null) {
  if (!demoClients(asUser).includes(slug)) throw error(404, 'Client not found');
  const updatedAt = lastUpdated(slug);
  const sections = BRAIN_FILES.map(({ file, label }) => ({
    file,
    label,
    content: BRAINS[`/demo/brains/${slug}/${file}`] ?? null,
    versionId: null,
    uploadedAt: updatedAt
  }));
  return { slug, name: displayName(slug), sections, readOnly: true, demo: true };
}

export function demoSignals() {
  return materializeSignals(fixture('signals'));
}

/** The Console activity view model, as /api/console/activity returns it. */
export function demoActivity(lastSeen, start, end) {
  const a = materialize(fixture('activity'), AGENCY_ROOT);
  const names = collectTypeNames(Object.entries(a.names || {}).map(([id, name]) => ({ id, name })));
  const view = buildActivity({ own: a.own, peers: a.peers, datasets: a.datasets, names, lastSeen });
  return { window: { start, end, lastSeen: new Date(lastSeen).toISOString() }, ...view, errors: {}, demo: true };
}
