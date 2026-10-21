import { env } from '$env/dynamic/public';
import { error } from '@sveltejs/kit';
import { FulcraAPI } from '$lib/api-client.js';
import { isOwner } from '$lib/server/harness-owner.js';
import { env as privateEnv } from '$env/dynamic/private';
import { sanitizeAsana } from '$lib/asana.js';

/** Agency folder in Fulcra (team.json lives here). Override with AGENCY_ROOT. */
export const AGENCY_ROOT = (privateEnv.AGENCY_ROOT || '/demo-agency').replace(/\/+$/, '');

/** Root folder in Fulcra that holds one sub-folder per client brain. */
export const CLIENTS_ROOT = `${AGENCY_ROOT}/clients`;

/**
 * DEMO_FIXTURES=true serves the fictional brains bundled in /demo/brains,
 * read-only, to anyone signed in. No Fulcra files or shares are needed.
 */
export const DEMO_FIXTURES = /^(1|true|yes)$/i.test(privateEnv.DEMO_FIXTURES || '');

const FIXTURES = import.meta.glob('/demo/brains/*/*.md', { query: '?raw', import: 'default', eager: true });
const ASANA_FIXTURES = import.meta.glob('/demo/brains/*/asana.json', { import: 'default', eager: true });

function fixtureClients() {
  return [...new Set(Object.keys(FIXTURES).map((p) => p.split('/')[3]))].sort();
}

function fixtureBrain(slug) {
  if (!fixtureClients().includes(slug)) throw error(404, 'Client not found');
  const sections = BRAIN_FILES.map(({ file, label }) => ({
    file,
    label,
    content: FIXTURES[`/demo/brains/${slug}/${file}`] ?? null,
    versionId: null,
    uploadedAt: null
  }));
  const asana = sanitizeAsana(ASANA_FIXTURES[`/demo/brains/${slug}/asana.json`]);
  return { slug, name: displayName(slug), sections, asana, readOnly: true, demo: true };
}

/** The seven brain files, in reading order. */
export const BRAIN_FILES = [
  { file: 'brief.md', label: 'Brief' },
  { file: 'people.md', label: 'People' },
  { file: 'voice-and-guardrails.md', label: 'Voice & guardrails' },
  { file: 'playbook.md', label: 'Playbook' },
  { file: 'decisions.md', label: 'Decisions' },
  { file: 'log.md', label: 'Log' },
  { file: 'links.md', label: 'Links' }
];

/** Asana tasks merged into the brain by the sync. Read-only here; Asana is the source. */
export const ASANA_FILE = 'asana.json';

const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** Throws 401/403 unless the caller is the owner; returns the access token. */
export function requireOwner(cookies) {
  const token = cookies.get('fulcra_access_token');
  if (!token) throw error(401, 'Not authenticated');
  if (DEMO_FIXTURES) throw error(403, 'Demo mode is read-only');
  if (!isOwner(token)) throw error(403, 'Forbidden');
  return token;
}

/**
 * Any signed-in caller. Owners read their own files; everyone else reads the
 * owner's files *as a share recipient* (fulcra_userid=<owner>), so Fulcra
 * itself decides what they can see.
 */
export function requireSignedIn(cookies) {
  const token = cookies.get('fulcra_access_token');
  if (!token) throw error(401, 'Not authenticated');
  if (DEMO_FIXTURES) return { token, owner: false, asUser: 'demo' };
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
  if (DEMO_FIXTURES) return fixtureClients();
  const listing = await listFolderOrEmpty(token, CLIENTS_ROOT, asUser);
  return (listing?.folders || [])
    .map(folderName)
    .filter((n) => n && SLUG.test(n))
    .sort();
}

/** Names that title-casing the slug gets wrong. */
const DISPLAY_NAMES = { mcdonalds: "McDonald's" };

/** Turn a slug into a display name ("delta-air-lines" -> "Delta Air Lines"). */
export function displayName(slug) {
  if (DISPLAY_NAMES[slug]) return DISPLAY_NAMES[slug];
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Read one client brain. Returns the seven sections in order; a missing file
 * comes back with content null rather than failing the whole brain.
 */
export async function readBrain(token, slug, asUser = null) {
  if (!SLUG.test(slug)) throw error(400, 'Invalid client');
  if (DEMO_FIXTURES) return fixtureBrain(slug);
  const folder = `${CLIENTS_ROOT}/${slug}`;
  const listing = await listFolderOrEmpty(token, folder, asUser);
  const files = listing?.files || [];
  if (!files.length && !(listing?.folders || []).length) throw error(404, 'Client not found');

  const q = asUser ? `?fulcra_userid=${encodeURIComponent(asUser)}` : '';
  const download = async (meta) => {
    const res = await fetch(`${env.PUBLIC_FULCRA_API_ENDPOINT}input/v1/file/${meta.id}/download${q}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw error(502, `Could not read ${meta.name}`);
    return res.text();
  };

  const sections = await Promise.all(
    BRAIN_FILES.map(async ({ file, label }) => {
      const meta = files.find((f) => f.name === file);
      if (!meta) return { file, label, content: null, versionId: null, uploadedAt: null };
      const content = await download(meta);
      return {
        file,
        label,
        content,
        // Viewers never get version ids (no editing, no history).
        versionId: asUser ? null : meta.id,
        uploadedAt: meta.uploaded_at ?? null
      };
    })
  );
  // A missing or unreadable asana.json just means an empty Asana tab.
  const asanaMeta = files.find((f) => f.name === ASANA_FILE);
  let asana = null;
  if (asanaMeta) {
    try {
      asana = sanitizeAsana(JSON.parse(await download(asanaMeta)));
    } catch {
      asana = null;
    }
  }
  return { slug, name: displayName(slug), sections, asana, readOnly: Boolean(asUser) };
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
