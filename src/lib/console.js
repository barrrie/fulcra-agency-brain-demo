/**
 * Pure helpers for the owner-only Console (M6+). No network or Svelte here,
 * so they can be unit-tested against real response shapes.
 */

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Accept an array, or an object wrapping one under a known key. */
export function asList(x, ...keys) {
  if (Array.isArray(x)) return x;
  for (const k of keys) if (Array.isArray(x?.[k])) return x[k];
  return [];
}

/** Shares other people have given this user (drops the "self" entry). */
export function receivedShares(datasets) {
  return asList(datasets, 'datasets', 'results').filter((d) => d && d.grant_type !== 'self' && d.sharing_fulcra_userid);
}

/**
 * A readable name for a sharer. Prefer the account name Fulcra reports; if it
 * is just an ID, fall back to a name in brackets in a share title
 * ("Fulcra Growth Dashboard (Kristina)"), then to a short ID.
 */
export function peerName(uid, shares) {
  const mine = shares.filter((s) => s.sharing_fulcra_userid === uid);
  const named = mine.find((s) => s.sharing_fulcra_user_name && !UUID.test(s.sharing_fulcra_user_name));
  if (named) return named.sharing_fulcra_user_name;
  for (const s of mine) {
    const m = /\(([^)]+)\)\s*$/.exec(s.datashare_name || '');
    if (m) return m[1];
  }
  return `User ${String(uid).slice(0, 8)}`;
}

/** What a share covers, in words. */
export function shareScope(s) {
  const parts = [];
  if (s.share_all_data) parts.push('all data');
  const files = s.file_paths || [];
  const types = s.data_types || [];
  if (files.length) parts.push(`${files.length} file path${files.length > 1 ? 's' : ''}`);
  if (types.length) parts.push(`${types.length} data stream${types.length > 1 ? 's' : ''}`);
  return parts.join(', ') || 'nothing listed';
}

/**
 * Collapse raw file change rows (one per version) into one item per file:
 * New, Updated or Deleted, timed by its latest change.
 */
export function groupFileChanges(changes, owner = null) {
  const byPath = new Map();
  for (const c of asList(changes)) {
    if (!c?.full_name) continue;
    if (!byPath.has(c.full_name)) byPath.set(c.full_name, []);
    byPath.get(c.full_name).push(c);
  }
  const out = [];
  for (const [path, versions] of byPath) {
    const live = versions.find((v) => v.state === 'uploaded' && !v.deleted_at);
    const deleted = versions.some((v) => v.deleted_at);
    const times = versions.flatMap((v) => [v.uploaded_at, v.archived_at, v.deleted_at]).filter(Boolean).sort();
    let kind = 'New';
    if (deleted && !live) kind = 'Deleted';
    else if (versions.length > 1 || versions.some((v) => v.archived_at)) kind = 'Updated';
    out.push({
      path,
      name: path.split('/').pop(),
      owner,
      kind,
      when: times[times.length - 1] ?? null,
      versions: versions.length,
      size: live?.size ?? null
    });
  }
  return out.sort((a, b) => String(b.when).localeCompare(String(a.when)));
}

/** `{type: count}` or `[{data_type, count}]` -> `[{type, count}]`. */
export function streamCounts(dataTypes) {
  if (!dataTypes) return [];
  if (Array.isArray(dataTypes)) {
    return dataTypes
      .map((d) => ({ type: d.data_type ?? d.id ?? d.type, count: d.count ?? d.n ?? 0 }))
      .filter((d) => d.type);
  }
  return Object.entries(dataTypes).map(([type, count]) => ({ type, count: Number(count) || 0 }));
}

/**
 * Walk any catalog-ish response and collect `{id: name}` for every object that
 * carries an id-like key and a name. Catalog shapes differ between endpoints,
 * so this reads them all the same way.
 */
export function collectTypeNames(...sources) {
  const names = {};
  const visit = (x) => {
    if (Array.isArray(x)) return x.forEach(visit);
    if (!x || typeof x !== 'object') return;
    const id = x.data_type_id ?? x.id ?? x.data_type;
    if (typeof id === 'string' && typeof x.name === 'string' && x.name) {
      names[id] = x.name;
      // User-defined types are addressed as "<BaseType>/<uuid>".
      if (UUID.test(id) && typeof x.base_type === 'string') names[`${x.base_type}/${id}`] = x.name;
    }
    Object.values(x).forEach(visit);
  };
  sources.forEach(visit);
  return names;
}

/**
 * Build the Activity view model.
 * @param {{own: object|null, peers: Array<{uid: string, updates: object|null}>, datasets: any, names: object, lastSeen: number}} input
 */
export function buildActivity({ own, peers, datasets, names, lastSeen }) {
  const shares = receivedShares(datasets);
  const seen = (iso) => (iso ? new Date(iso).getTime() <= lastSeen : true);

  const ownFiles = groupFileChanges(own?.file_changes);
  const sharedFiles = peers.flatMap((p) =>
    groupFileChanges(p.updates?.file_changes, p.uid).map((f) => ({ ...f, ownerName: peerName(p.uid, shares) }))
  );
  sharedFiles.sort((a, b) => String(b.when).localeCompare(String(a.when)));

  const streams = [
    ...streamCounts(own?.data_types).map((s) => ({ ...s, owner: null, ownerName: 'You' })),
    ...peers.flatMap((p) =>
      streamCounts(p.updates?.data_types).map((s) => ({ ...s, owner: p.uid, ownerName: peerName(p.uid, shares) }))
    )
  ].map((s) => ({ ...s, name: names[s.type] ?? s.type }));

  const received = shares
    .map((s) => ({
      id: s.datashare_id,
      name: s.datashare_name,
      from: s.sharing_fulcra_userid,
      fromName: peerName(s.sharing_fulcra_userid, shares),
      viaGroup: s.grant_type === 'group',
      scope: shareScope(s),
      filePaths: s.file_paths || [],
      dataTypes: (s.data_types || []).map((t) => ({ id: t, name: names[t] ?? t })),
      when: s.created_at ?? null
    }))
    .sort((a, b) => String(b.when).localeCompare(String(a.when)));

  for (const list of [ownFiles, sharedFiles, received]) for (const it of list) it.unseen = !seen(it.when);

  const unseen = [...ownFiles, ...sharedFiles, ...received].filter((i) => i.unseen).length;
  return { ownFiles, sharedFiles, received, streams, unseen };
}
