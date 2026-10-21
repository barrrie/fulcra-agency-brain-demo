/**
 * Display names: what a signed-in person is called in this app.
 *
 * A person can pick a display name; until they do, we use the name on their
 * Fulcra account. The choice lives in their own browser (keyed by Fulcra ID),
 * not in Fulcra, so a teammate never needs a write route to set it.
 */

import { writable } from 'svelte/store';

export const MAX_DISPLAY_NAME = 60;

/**
 * Trim and collapse whitespace. Throws on an over-long name; empty means "use my Fulcra name".
 * @param {unknown} value
 */
export function cleanDisplayName(value) {
  const clean = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (clean.length > MAX_DISPLAY_NAME) {
    throw new Error(`Keep it under ${MAX_DISPLAY_NAME} characters`);
  }
  return clean;
}

/**
 * The name on the person's Fulcra account, best field first.
 * @param {Record<string, any>} [auth0Info]
 * @param {Record<string, any>} [fulcraInfo]
 */
export function fulcraName(auth0Info = {}, fulcraInfo = {}) {
  const candidates = [
    fulcraInfo?.name,
    fulcraInfo?.display_name,
    auth0Info?.name,
    auth0Info?.nickname,
    auth0Info?.email,
    fulcraInfo?.email
  ];
  return candidates.map((c) => (typeof c === 'string' ? c.trim() : '')).find(Boolean) || null;
}

/**
 * What to show: their display name if they set one, otherwise their Fulcra name.
 * @param {string | null | undefined} displayName
 * @param {Record<string, any>} [auth0Info]
 * @param {Record<string, any>} [fulcraInfo]
 */
export function resolveName(displayName, auth0Info, fulcraInfo) {
  const own = typeof displayName === 'string' ? displayName.trim() : '';
  return own || fulcraName(auth0Info, fulcraInfo) || 'you';
}

/** @param {string} userId */
const keyFor = (userId) => `displayName:${userId}`;

/**
 * Read the saved display name for one Fulcra ID. Storage can be missing or blocked.
 * @param {string | null} userId
 * @param {Pick<Storage, 'getItem'>} [storage]
 */
export function loadDisplayName(userId, storage = globalThis.localStorage) {
  if (!userId) return '';
  try {
    return storage?.getItem(keyFor(userId)) ?? '';
  } catch {
    return '';
  }
}

/**
 * Save (or, when empty, clear) the display name for one Fulcra ID. Returns the cleaned value.
 * @param {string | null} userId
 * @param {unknown} value
 * @param {Pick<Storage, 'setItem' | 'removeItem'>} [storage]
 */
export function saveDisplayName(userId, value, storage = globalThis.localStorage) {
  const clean = cleanDisplayName(value);
  if (!userId) return clean;
  try {
    if (clean) storage?.setItem(keyFor(userId), clean);
    else storage?.removeItem(keyFor(userId));
  } catch {
    /* private window or blocked storage: the name lasts for this page only */
  }
  return clean;
}

/**
 * Saved display names by Fulcra ID, shared so every view (home page, owner
 * nav) updates as soon as one is saved.
 * @param {Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>} [storage]
 */
export function createDisplayNames(storage = globalThis.localStorage) {
  const { subscribe, update } = writable(/** @type {Record<string, string>} */ ({}));
  return {
    subscribe,
    /** @param {string | null} userId */
    load(userId) {
      if (!userId) return;
      update((m) => (userId in m ? m : { ...m, [userId]: loadDisplayName(userId, storage) }));
    },
    /**
     * @param {string | null} userId
     * @param {unknown} value
     */
    save(userId, value) {
      const clean = saveDisplayName(userId, value, storage);
      if (userId) update((m) => ({ ...m, [userId]: clean }));
      return clean;
    }
  };
}

export const displayNames = createDisplayNames();
