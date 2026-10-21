/**
 * Demo sandbox state (no I/O), so it can be unit tested.
 *
 * Stands in for Fulcra while presenting: a team list and a list of datashares
 * in the same shape Fulcra returns, changed by the same grant/revoke/onboard
 * rules the real access page uses. Nothing here leaves the server process.
 */
import { buildAccessMap, shareReach, grantBody, revokePlan, addTeammate, UUID } from './access.js';

/**
 * @param {{ team: {members: object[]}, newcomers?: {fulcra_userid:string,name:string}[],
 *           shares?: {client:string,user:string}[], clients: string[], root: string }} seed
 */
export function createSandbox(seed) {
  const { clients, root } = seed;
  const owner = seed.team.members.find((m) => m.role === 'owner');
  if (!owner) throw new Error('Sandbox team needs an owner');
  let state;
  let nextId;

  const share = (slug, kind, id) => ({
    datashare_id: `sandbox-${nextId++}`,
    ...grantBody(slug, kind, id, owner.fulcra_userid, root)
  });

  function reset() {
    nextId = 1;
    state = {
      team: {
        members: seed.team.members.map((m) => ({ ...m })),
        pending: (seed.newcomers || []).map((n) => ({ name: n.name }))
      },
      shares: (seed.shares || [])
        .filter((s) => clients.includes(s.client))
        .map((s) => share(s.client, 'user', s.user))
    };
  }
  reset();

  function checkTarget(slug, kind, id) {
    if (!clients.includes(slug)) throw new Error('Unknown client');
    if (kind !== 'user' && kind !== 'group') throw new Error('kind must be user or group');
    if (!UUID.test(id || '')) throw new Error('Not a valid Fulcra ID');
  }

  const reaches = (s, slug, kind, id) => {
    const [field, key] =
      kind === 'user'
        ? ['permissions', 'allowed_fulcra_userid']
        : ['group_permissions', 'allowed_group_id'];
    return Boolean(shareReach(s, `${root}/${slug}`)) && (s[field] || []).some((p) => p[key] === id);
  };

  return {
    owner,
    reset,

    /** Everyone the presenter can view the app as: the team, then newcomers not yet on it. */
    people() {
      const members = state.team.members.map((m) => ({
        id: m.fulcra_userid,
        name: m.name,
        role: m.role ?? 'strategist'
      }));
      const known = new Set(members.map((m) => m.id));
      const extra = (seed.newcomers || [])
        .filter((n) => !known.has(n.fulcra_userid))
        .map((n) => ({ id: n.fulcra_userid, name: n.name, role: 'newcomer' }));
      return [...members, ...extra];
    },

    /** Client slugs one user can read, in the order given. */
    visibleTo(userId) {
      return clients.filter((slug) => state.shares.some((s) => reaches(s, slug, 'user', userId)));
    },

    /** Same shape as the live access map. */
    accessMap() {
      const map = buildAccessMap(clients, state.shares, state.team.members, {}, root);
      return {
        ...map,
        totalShares: state.shares.length,
        team: state.team.members.map((m) => ({ name: m.name, role: m.role ?? null })),
        pending: state.team.pending.map((p) => p.name),
        readAt: new Date().toISOString()
      };
    },

    grant({ slug, kind, id }) {
      checkTarget(slug, kind, id);
      if (kind === 'user' && id === owner.fulcra_userid) throw new Error('You already have access');
      const created = share(slug, kind, id);
      state.shares.push(created);
      return { created: { id: created.datashare_id, name: created.datashare_name } };
    },

    revoke({ slug, kind, id }) {
      checkTarget(slug, kind, id);
      const hits = state.shares.filter((s) => reaches(s, slug, kind, id));
      if (!hits.length) throw new Error('No share gives that access');
      const done = [];
      for (const s of hits) {
        const plan = revokePlan(s, kind, id);
        if (plan.action === 'delete') state.shares = state.shares.filter((x) => x !== s);
        else Object.assign(s, plan.body);
        done.push({ id: s.datashare_id, name: s.datashare_name, action: plan.action });
      }
      return { revoked: done };
    },

    onboard({ name, id, slugs }) {
      if (!UUID.test(id || '')) throw new Error('Not a valid Fulcra ID');
      if (id === owner.fulcra_userid) throw new Error('That is your own ID');
      const wanted = [...new Set(Array.isArray(slugs) ? slugs : [])];
      if (wanted.some((s) => !clients.includes(s))) throw new Error('Unknown client');
      state.team = addTeammate(state.team, { name, id });
      const result = { teamUpdated: true, shared: [], skipped: [], failed: [] };
      for (const slug of wanted) {
        const has = state.shares.some(
          (s) => shareReach(s, `${root}/${slug}`) === 'full' && reaches(s, slug, 'user', id)
        );
        if (has) result.skipped.push(slug);
        else {
          state.shares.push(share(slug, 'user', id));
          result.shared.push(slug);
        }
      }
      return result;
    }
  };
}
