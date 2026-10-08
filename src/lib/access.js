/**
 * Pure access-map logic (no I/O), so it can be unit tested.
 *
 * Fulcra file shares are datashares whose fulcra_data_types include
 * "file:<prefix>" or "filehistory:<prefix>". A share reaches a client folder
 * when its prefix is the folder or one of its ancestors ("full"), or a path
 * inside the folder ("partial": some files only). share_all_data reaches
 * everything ("full").
 */

const norm = (p) => '/' + p.split('/').filter(Boolean).join('/');

/** How a single datashare reaches one folder: 'full' | 'partial' | null. */
export function shareReach(share, folder) {
  if (share?.share_all_data) return 'full';
  const target = norm(folder);
  let reach = null;
  for (const t of share?.fulcra_data_types || []) {
    const m = /^(file|filehistory):(.*)$/.exec(t);
    if (!m) continue;
    const prefix = norm(m[2]);
    if (prefix === '/' || target === prefix || target.startsWith(prefix + '/')) return 'full';
    if (prefix.startsWith(target + '/')) reach = 'partial';
  }
  return reach;
}

/**
 * Build the client × grantee map.
 * @param {string[]} clients   client slugs
 * @param {object[]} shares    datashares from GET /user/v1/datashare
 * @param {{fulcra_userid:string,name:string}[]} team  inside-the-agency team list
 * @param {Record<string,{name?:string, participants?:string[]}>} groups  group info by id
 * @param {string} root        folder that holds the client folders
 */
export function buildAccessMap(clients, shares, team, groups = {}, root = '/demo-agency/clients') {
  const teamById = new Map(team.map((m) => [m.fulcra_userid, m]));
  const grantees = new Map(); // key -> grantee row

  const rowFor = (kind, id) => {
    const key = `${kind}:${id}`;
    if (!grantees.has(key)) {
      if (kind === 'user') {
        const member = teamById.get(id);
        grantees.set(key, {
          key, kind, id,
          name: member?.name ?? null,
          inside: Boolean(member),
          access: {}
        });
      } else {
        const g = groups[id] || {};
        const participants = g.participants ?? null;
        const inside = Array.isArray(participants) && participants.length > 0
          ? participants.every((p) => teamById.has(p))
          : false; // unknown membership counts as outside
        grantees.set(key, {
          key, kind, id,
          name: g.name ?? null,
          inside,
          membersKnown: Array.isArray(participants),
          access: {}
        });
      }
    }
    return grantees.get(key);
  };

  for (const share of shares || []) {
    const reach = Object.fromEntries(
      clients.map((c) => [c, shareReach(share, `${root}/${c}`)]).filter(([, r]) => r)
    );
    if (!Object.keys(reach).length) continue;
    const targets = [
      ...(share.permissions || []).map((p) => ['user', p.allowed_fulcra_userid]),
      ...(share.group_permissions || []).map((p) => ['group', p.allowed_group_id])
    ].filter(([, id]) => id);
    const ref = {
      id: share.datashare_id,
      name: share.datashare_name || share.datashare_id,
      recipients: targets.length,
      clients: Object.keys(reach),
      allData: Boolean(share.share_all_data)
    };
    for (const [kind, id] of targets) {
      const row = rowFor(kind, id);
      row.via = row.via || {};
      for (const [client, r] of Object.entries(reach)) {
        const prev = row.access[client];
        const level = prev === 'full' || r === 'full' ? 'full' : 'partial';
        row.access[client] = level;
        row.via[client] = [...(row.via[client] || []), ref];
        row.shares = [...new Set([...(row.shares || []), ref.name])];
      }
    }
  }

  const rows = [...grantees.values()].sort(
    (a, b) => Number(a.inside) - Number(b.inside) || (a.name || a.id).localeCompare(b.name || b.id)
  );
  const outsideCount = rows.filter((r) => !r.inside).length;
  return { clients, rows, outsideCount };
}

/**
 * New team.json after adding one teammate: drops any pending entry with the
 * same name (case-insensitive), and updates in place if the ID is already a member.
 */
export function addTeammate(team, { name, id, role = 'strategist' }) {
  const clean = String(name || '').trim();
  if (!clean || clean.length > 60) throw new Error('Name is required (max 60 characters)');
  if (!UUID.test(id || '')) throw new Error('Not a valid Fulcra ID');
  const members = [...(team.members || [])];
  const at = members.findIndex((m) => m.fulcra_userid === id);
  if (at >= 0 && members[at].role === 'owner') throw new Error('That ID is the owner');
  const entry = { fulcra_userid: id, name: clean, role };
  if (at >= 0) members[at] = { ...members[at], ...entry };
  else members.push(entry);
  const pending = (team.pending || []).filter((p) => p.name?.toLowerCase() !== clean.toLowerCase());
  return { ...team, members, pending };
}

export const UUID =/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Body for a new datashare giving one grantee the whole client folder. */
export function grantBody(slug, kind, id, ownerId, root = '/demo-agency/clients') {
  return {
    datashare_name: `KS brain: ${slug} -> ${kind} ${id.slice(0, 8)}`,
    fulcra_user_name: ownerId,
    time_start: null,
    time_end: null,
    fulcra_data_types: [`file:${root}/${slug}`],
    share_all_data: false,
    permissions: kind === 'user' ? [{ allowed_fulcra_userid: id }] : [],
    group_permissions: kind === 'group' ? [{ allowed_group_id: id }] : []
  };
}

/**
 * How to remove one grantee from one share: delete the whole share when the
 * grantee is its only recipient, otherwise rewrite its recipient lists.
 */
export function revokePlan(share, kind, id) {
  const users = (share.permissions || []).map((p) => p.allowed_fulcra_userid);
  const groups = (share.group_permissions || []).map((p) => p.allowed_group_id);
  const keepUsers = kind === 'user' ? users.filter((u) => u !== id) : users;
  const keepGroups = kind === 'group' ? groups.filter((g) => g !== id) : groups;
  if (keepUsers.length + keepGroups.length === 0) return { action: 'delete' };
  return {
    action: 'update',
    body: {
      permissions: keepUsers.map((u) => ({ allowed_fulcra_userid: u })),
      group_permissions: keepGroups.map((g) => ({ allowed_group_id: g }))
    }
  };
}
