import { env as privateEnv } from '$env/dynamic/private';

/** Agency folder in Fulcra (team.json and signals.json live here). Override with AGENCY_ROOT. */
export const AGENCY_ROOT = (privateEnv.AGENCY_ROOT || '/demo-agency').replace(/\/+$/, '');

/** Root folder in Fulcra that holds one sub-folder per client brain. */
export const CLIENTS_ROOT = `${AGENCY_ROOT}/clients`;

/**
 * DEMO_FIXTURES=true serves the fictional agency bundled in /demo, read-only,
 * to anyone signed in. No Fulcra files or shares are needed.
 */
export const DEMO_FIXTURES = /^(1|true|yes)$/i.test(privateEnv.DEMO_FIXTURES || '');
