#!/usr/bin/env node
/**
 * Copy the fictional demo brains into YOUR OWN Fulcra file store, so you can
 * try the real flow (editing, version history, sharing) instead of demo mode.
 *
 *   FULCRA_ACCESS_TOKEN=... node scripts/seed-fulcra.mjs [--root /demo-agency]
 *
 * Writes <root>/clients/<slug>/<file> for every file in demo/brains (markdown plus asana.json), plus
 * <root>/team.json. Existing files get a new version; nothing is deleted.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const demoDir = join(here, '..', 'demo');
const api = (process.env.PUBLIC_FULCRA_API_ENDPOINT || 'https://api.fulcradynamics.com/').replace(/\/?$/, '/');
const token = process.env.FULCRA_ACCESS_TOKEN;
const rootArg = process.argv.indexOf('--root');
const root = (rootArg > -1 ? process.argv[rootArg + 1] : process.env.AGENCY_ROOT || '/demo-agency').replace(/\/+$/, '');

if (!token) {
  console.error('Set FULCRA_ACCESS_TOKEN to your own Fulcra access token.');
  process.exit(1);
}

async function upload(folder, name, content, contentType) {
  const bytes = new TextEncoder().encode(content);
  const res = await fetch(`${api}input/v1/file_upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ content_length: bytes.length, content_type: contentType, name, path: folder })
  });
  if (!res.ok) throw new Error(`${folder}/${name}: create failed (${res.status})`);
  const { url } = await res.json();
  const put = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': contentType, 'Content-Length': String(bytes.length) },
    body: bytes
  });
  if (!put.ok) throw new Error(`${folder}/${name}: upload failed (${put.status})`);
  console.log(`  ${folder}/${name}`);
}

console.log(`Seeding fictional brains into ${root}`);
for (const slug of await readdir(join(demoDir, 'brains'))) {
  for (const file of await readdir(join(demoDir, 'brains', slug))) {
    const text = await readFile(join(demoDir, 'brains', slug, file), 'utf8');
    const type = file.endsWith('.json') ? 'application/json' : 'text/markdown';
    await upload(`${root}/clients/${slug}`, file, text, type);
  }
}
await upload(root, 'team.json', await readFile(join(demoDir, 'team.json'), 'utf8'), 'application/json');
console.log('Done. Replace the placeholder IDs in team.json with real Fulcra IDs before sharing.');
