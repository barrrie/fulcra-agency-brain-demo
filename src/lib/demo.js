import { writable } from 'svelte/store';

/** Demo sandbox status for the UI: on/off, who this browser is viewing as, and the people it can switch to. */
export const demo = writable({ sandbox: false, as: null, people: [] });

export async function loadDemo() {
  try {
    const res = await fetch('/api/demo');
    if (res.ok) demo.set({ as: null, people: [], ...(await res.json()) });
  } catch {
    /* not in the sandbox */
  }
}

/** Become someone else and start again from the home page, as they would. */
export async function viewAs(id) {
  const res = await fetch('/api/demo/as', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id })
  });
  if (res.ok) location.assign('/');
}

export async function resetDemo() {
  const res = await fetch('/api/demo/reset', { method: 'POST' });
  if (res.ok) location.reload();
}
