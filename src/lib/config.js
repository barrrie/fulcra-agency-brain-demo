import { env } from '$env/dynamic/public';

/** Display settings. All are optional; the defaults describe the fictional demo agency. */
export const APP_NAME = env.PUBLIC_APP_NAME || 'Agency Brain';
export const AGENCY_NAME = env.PUBLIC_AGENCY_NAME || 'Kind Stranger';
export const OWNER_NAME = env.PUBLIC_OWNER_NAME || 'the agency owner';
/** Shown in the UI only. Keep it in step with the server-side AGENCY_ROOT. */
export const CLIENTS_PATH = `${(env.PUBLIC_AGENCY_ROOT || '/demo-agency').replace(/\/+$/, '')}/clients`;
