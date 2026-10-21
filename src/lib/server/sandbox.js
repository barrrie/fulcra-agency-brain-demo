import { env as privateEnv } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
import { createSandbox } from '$lib/sandbox-state.js';
import team from '../../../demo/team.json';
import seed from '../../../demo/sandbox.json';

/**
 * DEMO_SANDBOX=true runs the whole app on the fictional brains with no Fulcra
 * sign-in. Sharing is simulated in memory, so the presenter can add someone to
 * a client, switch to their view, and revoke it, without touching a real
 * account. State lives in this server process and resets on restart.
 */
export const DEMO_SANDBOX = /^(1|true|yes)$/i.test(privateEnv.DEMO_SANDBOX || '');

/** Who the presenter is viewing the app as. Demo identity only, never a real token. */
export const SANDBOX_COOKIE = 'demo_as';
export const SANDBOX_TOKEN = 'demo-sandbox';

const CLIENTS = [
  ...new Set(Object.keys(import.meta.glob('/demo/brains/*/*.md')).map((p) => p.split('/')[3]))
].sort();

/** Same value as CLIENTS_ROOT in brains.js (not imported, to keep the modules independent). */
const ROOT = `${(privateEnv.AGENCY_ROOT || '/demo-agency').replace(/\/+$/, '')}/clients`;

let sandbox = null;

export function getSandbox() {
  if (!sandbox)
    sandbox = createSandbox({
      team,
      newcomers: seed.newcomers,
      shares: seed.shares,
      clients: CLIENTS,
      root: ROOT
    });
  return sandbox;
}

/** The person this browser is viewing as; the owner unless they picked someone else. */
export function personaFor(cookies) {
  const people = getSandbox().people();
  const id = cookies.get(SANDBOX_COOKIE);
  return people.find((p) => p.id === id) ?? people.find((p) => p.role === 'owner');
}

/** Run a sandbox change, turning rule violations into 400s like the live routes. */
export function sandboxCall(fn) {
  try {
    return fn();
  } catch (e) {
    if (e?.status) throw e;
    throw error(400, e?.message || 'Not allowed');
  }
}
