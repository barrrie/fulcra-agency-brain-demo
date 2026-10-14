import { env } from '$env/dynamic/public';
import { error } from '@sveltejs/kit';
import { FulcraAPI } from '$lib/api-client.js';
import { isOwner } from '$lib/server/harness-owner.js';
import { env as privateEnv } from '$env/dynamic/private';
import { SLUG, BRAIN_FILES, slugify, starterFiles, displayName } from '$lib/clients.js';
import { AGENCY_ROOT, CLIENTS_ROOT, DEMO_FIXTURES } from '$lib/server/settings.js';
import { demoView, demoTeammate, demoClients, demoSummaries, demoBrain } from '$lib/server/demo.js';

export { AGENCY_ROOT, CLIENTS_ROOT, DEMO_FIXTURES, BRAIN_FILES, displayName };

/** Throws 401/403 unless the caller is the owner; returns the access token. Use for writes. */
export function requireOwner(cookies) {
  const token = cookies.get('fulcra_access_token');
  if (!token) throw error(401, 'Not authenticated');
  if (DEMO_FIXTURES) throw error(403, 'This is a demo, so nothing is changed. In a real workspace this saves to Fulcra.');
  if (!isOwner(token)) throw error(403, 'Forbidden');
  return token;
}

/**
 * Owner-only reads (access map, Console). In demo mode the owner's view is
 * open to anyone signed in, read-only. Returns { token, demo }.
 */
export function requireOwnerView(cookies) {
  const token = cookies.get('fulcra_access_token');
  if (!token) throw error(401, 'Not authenticated');
  if (DEMO_FIXTURES) {
    if (demoView(cookies) !== 'owner') throw error(403, 'Owner only');
    return { token, demo: true };
  }
  if (!isOwner(token)) throw error(403, 'Forbidden');
  return { token, demo: false };
}

/** Whether this caller sees the owner's screens (nav, Access, Console). */
export function seesOwnerView(cookies) {
  const token = cookies.get('fulcra_access_token');
  if (!token) return false;
  return DEMO_FIXTURES ? demoView(cookies) === 'owner' : isOwner(token);
}

/**
 * Any signed-in caller. Owners read their own files; everyone else reads the
 * owner's files *as a share recipient* (fulcra_userid=<owner>), so Fulcra
 * itself decides what they can see.
 */
export function requireSignedIn(cookies) {
  const token = cookies.get('fulcra_access_token');
  if (!token) throw error(401, 'Not authenticated');
  if (DEMO_FIXTURES) {
    const owner = demoView(cookies) === 'owner';
    return { token, owner, asUser: owner ? null : demoTeammate().fulcra_userid, demo: true };
  }
  const owner = isOwner(token);
  const ownerId = privateEnv.OWNER_USER_ID;
  if (!owner && !ownerId) throw error(500, 'Owner not configured');
  return { token, owner, asUser: owner ? null : ownerId };
}

const asParam = (asUser) => (asUser ? `&fulcra_userid=${encodeURIComponent(asUser)}` : '');

function listFolder(token, path, asUser = null) {
  const api = new FulcraAPI(env.PUBLIC_FULCRA_API_ENDPOINT, token);
  return api.get(`input/v1/file?path=${encodeURIComponent(path)}${asParam(asUser)}`);
}

/** For recipients, "not shared" can surface as 403/404; treat as empty. */
async function listFolderOrEmpty(token, path, asUser) {
  try {
    return await listFolder(token, path, asUser);
  } catch (e) {
    const msg = String(e?.message);
    if (/\b401\b/.test(msg)) throw error(401, 'Session expired or invalid. Sign in again.');
    if (asUser && /\b(403|404)\b/.test(msg)) return { files: [], folders: [] };
    throw e;
  }
}

function folderName(f) {
  if (typeof f === 'string') return f;
  return f?.name ?? f?.path?.split('/').filter(Boolean).pop() ?? null;
}

/** Client slugs under CLIENTS_ROOT, sorted. */
export async function listClients(token, asUser = null) {
  if (DEMO_FIXTURES) return demoClients(asUser);
  const listing = await listFolderOrEmpty(token, CLIENTS_ROOT, asUser);
  return (listing?.folders || [])
    .map(folderName)
    .filter((n) => n && SLUG.test(n))
    .sort();
}

/**
 * Clients with a small summary each: how many of the seven brain files exist
 * and when the brain last changed. One folder listing per client.
 */
export async function listClientSummaries(token, asUser = null) {
  if (DEMO_FIXTURES) return demoSummaries(asUser);
  const slugs = await listClients(token, asUser);
  return Promise.all(
    slugs.map(async (slug) => {
      const listing = await listFolderOrEmpty(token, `${CLIENTS_ROOT}/${slug}`, asUser);
      const files = (listing?.files || []).filter((f) => FILE_NAMES.has(f.name));
      const updatedAt = files.map((f) => f.uploaded_at).filter(Boolean).sort().pop() ?? null;
      return {
        slug,
        name: displayName(slug),
        present: files.map((f) => f.name),
        filesPresent: files.length,
        filesTotal: BRAIN_FILES.length,
        updatedAt
      };
    })
  );
}

/**
 * Create a new client brain: the seven brain files from starter templates.
 * Refuses an existing client rather than overwriting it. Shares nothing.
 */
export async function createClient(token, name) {
  const clean = typeof name === 'string' ? name.trim() : '';
  if (!clean || clean.length > 80) throw error(400, 'Give the client a name (up to 80 characters).');
  const slug = slugify(clean);
  if (!SLUG.test(slug)) throw error(400, 'That name has no letters or numbers to make a folder from.');
  // The clients root may not exist yet before the very first client.
  const existing = await listClients(token).catch((e) => {
    if (/\b404\b/.test(String(e?.message))) return [];
    throw e;
  });
  if (existing.includes(slug)) throw error(409, `A client called ${displayName(slug)} already exists.`);

  const folder = `${CLIENTS_ROOT}/${slug}`;
  const files = starterFiles(displayName(slug));
  let done = 0;
  for (const { file } of BRAIN_FILES) {
    try {
      await uploadFile(token, folder, file, files[file], 'text/markdown');
    } catch {
      // A retry would hit 409, so say what exists. Empty sections can be filled in with Edit.
      throw error(
        502,
        done
          ? `Fulcra stopped after ${done} of 7 files. Open ${displayName(slug)} and fill the empty sections with Edit.`
          : 'Fulcra did not accept the new files. Nothing was created.'
      );
    }
    done++;
  }
  return { slug, name: displayName(slug), folder, files: BRAIN_FILES.map((f) => f.file) };
}

/**
 * Read one client brain. Returns the seven sections in order; a missing file
 * comes back with content null rather than failing the whole brain.
 */
export async function readBrain(token, slug, asUser = null) {
  if (!SLUG.test(slug)) throw error(400, 'Invalid client');
  if (DEMO_FIXTURES) return demoBrain(slug, asUser);
  const folder = `${CLIENTS_ROOT}/${slug}`;
  const listing = await listFolderOrEmpty(token, folder, asUser);
  const files = listing?.files || [];
  if (!files.length && !(listing?.folders || []).length) throw error(404, 'Client not found');

  const sections = await Promise.all(
    BRAIN_FILES.map(async ({ file, label }) => {
      const meta = files.find((f) => f.name === file);
      if (!meta) return { file, label, content: null, versionId: null, uploadedAt: null };
      const q = asUser ? `?fulcra_userid=${encodeURIComponent(asUser)}` : '';
      const res = await fetch(`${env.PUBLIC_FULCRA_API_ENDPOINT}input/v1/file/${meta.id}/download${q}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw error(502, `Could not read ${file}`);
      return {
        file,
        label,
        content: await res.text(),
        // Viewers never get version ids (no editing, no history).
        versionId: asUser ? null : meta.id,
        uploadedAt: meta.uploaded_at ?? null
      };
    })
  );
  return { slug, name: displayName(slug), sections, readOnly: Boolean(asUser) };
}

const FILE_NAMES = new Set(BRAIN_FILES.map((f) => f.file));

function checkFile(slug, file) {
  if (DEMO_FIXTURES) throw error(403, 'Demo data is read-only');
  if (!SLUG.test(slug)) throw error(400, 'Invalid client');
  if (!FILE_NAMES.has(file)) throw error(400, 'Not a brain file');
  return { folder: `${CLIENTS_ROOT}/${slug}`, name: file };
}

/** All versions of one brain file, newest first. */
export async function listVersions(token, slug, file) {
  const { folder, name } = checkFile(slug, file);
  const api = new FulcraAPI(env.PUBLIC_FULCRA_API_ENDPOINT, token);
  const q = `path=${encodeURIComponent(folder)}&name=${encodeURIComponent(name)}&state=${encodeURIComponent('uploaded,archived')}`;
  const res = await api.get(`input/v1/file_upload?${q}`);
  return (res?.files || [])
    .map((f) => ({ id: f.id, state: f.state, uploadedAt: f.uploaded_at, size: f.content_length ?? f.size ?? null }))
    .sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt)));
}

/**
 * Save a new version of a brain file. `baseId` is the version the editor
 * started from; if someone saved in between, refuse rather than overwrite.
 */
export async function saveFile(token, slug, file, content, baseId) {
  const { folder, name } = checkFile(slug, file);
  if (typeof content !== 'string' || !content.trim()) throw error(400, 'Content is empty');
  if (content.length > 200_000) throw error(413, 'File too large');
  const versions = await listVersions(token, slug, file);
  const current = versions.find((v) => v.state === 'uploaded');
  if (current && baseId && current.id !== baseId) throw error(409, 'This file changed since you opened it. Reload and try again.');

  const up = await uploadFile(token, folder, name, content, 'text/markdown');
  return { id: up.id, previousId: current?.id ?? null, bytes: up.bytes };
}

/** Write a new version of any file in the caller's own Fulcra store. */
export async function uploadFile(token, folder, name, content, contentType) {
  const bytes = new TextEncoder().encode(content);
  const api = new FulcraAPI(env.PUBLIC_FULCRA_API_ENDPOINT, token);
  const created = await api.post('input/v1/file_upload', {
    content_length: bytes.length,
    content_type: contentType,
    name,
    path: folder
  });
  if (!created?.url) throw error(502, 'Fulcra did not return an upload URL');
  const up = await fetch(created.url, {
    method: 'POST',
    headers: { 'Content-Type': contentType, 'Content-Length': String(bytes.length) },
    body: bytes
  });
  if (!up.ok) throw error(502, `Upload failed (${up.status})`);
  return { id: created.id ?? null, bytes: bytes.length };
}

/** Make an older version current again (Fulcra keeps the replaced one as a version). */
export async function restoreVersion(token, slug, file, versionId) {
  checkFile(slug, file);
  const versions = await listVersions(token, slug, file);
  if (!versions.some((v) => v.id === versionId)) throw error(404, 'Version not found for this file');
  const api = new FulcraAPI(env.PUBLIC_FULCRA_API_ENDPOINT, token);
  return api.post(`input/v1/file_upload/${encodeURIComponent(versionId)}/restore`);
}
