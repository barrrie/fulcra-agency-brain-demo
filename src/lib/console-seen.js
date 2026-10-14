import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const KEY = 'console:lastSeen';
const DEFAULT = () => Date.now() - 3 * 86_400_000;

function read() {
  if (!browser) return DEFAULT();
  try {
    const v = Number(localStorage.getItem(KEY));
    return Number.isFinite(v) && v > 0 ? v : DEFAULT();
  } catch {
    return DEFAULT();
  }
}

/** When the owner last pressed "Mark all seen" (per browser). */
export const lastSeen = writable(read());

/** Unseen count, shared by the Console page and the nav badge. */
export const unseenCount = writable(0);

export function markSeen() {
  const now = Date.now();
  try {
    localStorage.setItem(KEY, String(now));
  } catch {
    /* storage blocked: still clears for this visit */
  }
  lastSeen.set(now);
  unseenCount.set(0);
}
