<script>
  import { APP_NAME, AGENCY_NAME, CLIENTS_PATH } from '$lib/config.js';
  import { user } from '$lib/user';
  import { onMount } from 'svelte';
  import LoginDeviceFlow from '$lib/components/LoginDeviceFlow.svelte';
  import DisplayName from '$lib/components/DisplayName.svelte';

  let map = $state(null);
  let loadError = $state(null);

  // Share form
  let shareSlug = $state('');
  let shareKind = $state('user');
  let shareId = $state('');
  // Add-teammate form
  let mateName = $state('');
  let mateId = $state('');
  let mateSlugs = $state([]);
  // Pending change awaiting confirmation: { type: 'grant'|'revoke', slug, kind, id, label, note }
  let pending = $state(null);
  let busy = $state(false);
  let notice = $state(null); // { ok: boolean, text: string }

  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  onMount(async () => {
    await user.init();
  });

  async function load() {
    loadError = null;
    try {
      const res = await fetch('/api/access');
      if (res.status === 403) {
        loadError = 'This app is owner-only.';
        return;
      }
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      map = await res.json();
      if (!shareSlug && map.clients.length) shareSlug = map.clients[0];
      if (!mateName && map.pending.length) mateName = map.pending[0];
    } catch (e) {
      loadError = e.message;
    }
  }

  $effect(() => {
    if ($user.authenticated && !map && !loadError) load();
  });

  const titleCase = (s) => s.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
  const shortId = (id) => (id.length > 12 ? `${id.slice(0, 8)}…` : id);
  const label = (r) => r.name ?? (r.kind === 'group' ? `Group ${shortId(r.id)}` : `User ${shortId(r.id)}`);

  function askGrant() {
    notice = null;
    const id = shareId.trim();
    if (!UUID.test(id)) {
      notice = { ok: false, text: 'That is not a Fulcra ID. It looks like 8-4-4-4-12 characters, e.g. 1a2b3c4d-5e6f-…' };
      return;
    }
    const existing = map.rows.find((r) => r.kind === shareKind && r.id === id);
    const outside = existing ? !existing.inside : true;
    pending = {
      type: 'grant',
      slug: shareSlug,
      kind: shareKind,
      id,
      label: existing ? label(existing) : `${shareKind === 'group' ? 'Group' : 'User'} ${shortId(id)}`,
      note: outside ? `This person is not on the ${AGENCY_NAME} team list.` : null
    };
    showConfirm();
  }

  function showConfirm() {
    requestAnimationFrame(() =>
      document.querySelector('[data-testid=confirm-panel]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    );
  }

  function askOnboard() {
    notice = null;
    const id = mateId.trim();
    if (!mateName.trim()) {
      notice = { ok: false, text: 'Add their name first.' };
      return;
    }
    if (!UUID.test(id)) {
      notice = { ok: false, text: 'That is not a Fulcra ID. It looks like 8-4-4-4-12 characters, e.g. 1a2b3c4d-5e6f-…' };
      return;
    }
    pending = { type: 'onboard', name: mateName.trim(), id, slugs: [...mateSlugs], label: mateName.trim(), kind: 'user', note: null };
    showConfirm();
  }

  function askRevoke(row, slug) {
    notice = null;
    const via = row.via?.[slug] || [];
    const wider = via.filter((s) => s.allData || s.clients.length > 1);
    const shared = via.filter((s) => s.recipients > 1);
    const notes = [];
    if (wider.length)
      notes.push(
        `${wider.length === 1 ? 'This share also covers' : 'These shares also cover'} ${[
          ...new Set(wider.flatMap((s) => (s.allData ? ['all your data'] : s.clients.filter((c) => c !== slug).map(titleCase))))
        ].join(', ')}, so revoking removes that access too.`
      );
    if (shared.length) notes.push('Other recipients on the same share keep their access.');
    pending = { type: 'revoke', slug, kind: row.kind, id: row.id, label: label(row), note: notes.join(' ') || null };
    showConfirm();
  }

  async function confirm() {
    if (!pending) return;
    busy = true;
    const p = pending;
    try {
      const payload = p.type === 'onboard' ? { name: p.name, id: p.id, slugs: p.slugs } : { slug: p.slug, kind: p.kind, id: p.id };
      const res = await fetch(`/api/access/${p.type}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || `Request failed (${res.status})`);
      if (p.type === 'onboard') {
        const parts = [`Added ${p.name} to the team list.`];
        if (body.shared?.length) parts.push(`Shared ${body.shared.map(titleCase).join(', ')}.`);
        if (body.skipped?.length) parts.push(`Already had ${body.skipped.map(titleCase).join(', ')}.`);
        if (body.failed?.length) parts.push(`Could not share ${body.failed.map(titleCase).join(', ')}. Try those from the form below.`);
        notice = { ok: !body.failed?.length, text: parts.join(' ') };
        mateId = '';
        mateName = '';
        mateSlugs = [];
        pending = null;
        map = null;
        await load();
        return;
      }
      notice = {
        ok: true,
        text:
          p.type === 'grant'
            ? `Shared ${titleCase(p.slug)} with ${p.label}.`
            : `Removed ${p.label}'s access to ${titleCase(p.slug)}.`
      };
      if (p.type === 'grant') shareId = '';
      pending = null;
      map = null;
      await load();
    } catch (e) {
      notice = { ok: false, text: e.message };
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head>
  <title>Access · {APP_NAME}</title>
</svelte:head>

{#if !$user.authenticated}
  <LoginDeviceFlow />
{:else}
  <main class="mx-auto w-full max-w-5xl px-4 py-8">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold text-fulcra-white">Who can see what</h1>
        <p class="mt-1 text-fulcra-gray">Live from your Fulcra shares. You always have access to every brain.</p>
      </div>
      <DisplayName />
    </header>

    {#if loadError}
      <p class="mt-6 rounded-lg border border-red-400/40 bg-red-500/10 p-4 text-red-300">{loadError}</p>
    {:else if !map}
      <p class="mt-6 text-fulcra-gray">Reading shares…</p>
    {:else}
      {#if notice}
        <p
          class="mt-6 rounded-lg p-3 text-sm {notice.ok
            ? 'border border-fulcra-teal/40 bg-fulcra-teal/10 text-fulcra-teal'
            : 'border border-red-400/40 bg-red-500/10 text-red-300'}"
          data-testid="notice"
        >
          {notice.text}
        </p>
      {/if}

      {#if pending}
        <section class="mt-6 rounded-xl border border-amber-400/50 bg-amber-500/10 p-5" data-testid="confirm-panel">
          <p class="font-semibold text-fulcra-white">
            {#if pending.type === 'onboard'}
              Add {pending.label} to the {AGENCY_NAME} team{pending.slugs.length
                ? ` and share ${pending.slugs.map(titleCase).join(', ')}`
                : ''}?
            {:else if pending.type === 'grant'}
              Share the {titleCase(pending.slug)} brain with {pending.label}?
            {:else}
              Remove {pending.label}'s access to {titleCase(pending.slug)}?
            {/if}
          </p>
          <p class="mt-1 font-mono text-xs text-fulcra-gray">{pending.kind} · {pending.id}</p>
          {#if pending.type === 'grant'}
            <p class="mt-2 text-sm text-fulcra-gray">
              They'll be able to read all seven files in {CLIENTS_PATH}/{pending.slug}, including future edits.
            </p>
          {:else if pending.type === 'onboard'}
            <p class="mt-2 text-sm text-fulcra-gray">
              {pending.slugs.length
                ? 'They will be able to read every file in those brains, including future edits. Read-only.'
                : 'No clients ticked, so they will be on the team list but see nothing yet.'}
            </p>
          {/if}
          {#if pending.note}<p class="mt-2 text-sm text-amber-300">{pending.note}</p>{/if}
          <div class="mt-4 flex gap-2">
            <button
              class="rounded-lg bg-amber-400/90 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-300 disabled:opacity-50"
              data-testid="confirm-yes"
              disabled={busy}
              onclick={confirm}>{busy
                ? 'Working…'
                : pending.type === 'onboard'
                  ? 'Yes, add them'
                  : pending.type === 'grant'
                    ? 'Yes, share it'
                    : 'Yes, remove access'}</button
            >
            <button
              class="rounded-lg px-4 py-2 text-sm text-fulcra-gray hover:bg-fulcra-gray/10"
              disabled={busy}
              onclick={() => (pending = null)}>Cancel</button
            >
          </div>
        </section>
      {/if}

      <section class="mt-6 flex flex-wrap gap-3 text-sm" data-testid="summary">
        <span class="rounded-lg bg-fulcra-black/40 px-3 py-2 text-fulcra-gray">{map.clients.length} client brains</span>
        <span class="rounded-lg bg-fulcra-black/40 px-3 py-2 text-fulcra-gray">
          {map.rows.length} {map.rows.length === 1 ? 'person or group' : 'people or groups'} with access
        </span>
        <span
          class="rounded-lg px-3 py-2 {map.outsideCount ? 'bg-amber-500/15 text-amber-300' : 'bg-fulcra-teal/15 text-fulcra-teal'}"
          data-testid="outside-count"
        >
          {map.outsideCount ? `${map.outsideCount} outside ${AGENCY_NAME}` : `Nobody outside ${AGENCY_NAME}`}
        </span>
      </section>

      {#if map.rows.length === 0}
        <div class="mt-6 rounded-xl border border-fulcra-gray/20 bg-fulcra-black/40 p-6" data-testid="empty">
          <p class="text-lg font-semibold text-fulcra-white">Only you can see these brains.</p>
          <p class="mt-1 text-fulcra-gray">
            None of your {map.totalShares} Fulcra {map.totalShares === 1 ? 'share' : 'shares'} reach a client folder.
          </p>
        </div>
      {:else}
        <div class="mt-6 overflow-x-auto rounded-xl border border-fulcra-gray/20">
          <table class="w-full text-left text-sm" data-testid="access-grid">
            <thead class="bg-fulcra-black/50 text-fulcra-gray">
              <tr>
                <th class="px-4 py-3 font-medium">Who</th>
                {#each map.clients as c (c)}<th class="px-4 py-3 font-medium">{titleCase(c)}</th>{/each}
              </tr>
            </thead>
            <tbody>
              {#each map.rows as r (r.key)}
                <tr class="border-t border-fulcra-gray/15" data-inside={r.inside} data-grantee={r.id}>
                  <td class="px-4 py-3">
                    <span class="font-medium text-fulcra-white">{label(r)}</span>
                    {#if !r.inside}
                      <span class="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-xs text-amber-300">Outside KS</span>
                    {/if}
                    {#if r.kind === 'group' && !r.membersKnown}
                      <span class="ml-1 text-xs text-fulcra-gray">(members unknown)</span>
                    {/if}
                    <div class="mt-0.5 font-mono text-xs text-fulcra-gray/70">{r.kind} · {r.id}</div>
                  </td>
                  {#each map.clients as c (c)}
                    <td class="px-4 py-3" data-client={c}>
                      {#if r.access[c]}
                        <span class={r.access[c] === 'full' ? 'text-fulcra-teal' : 'text-amber-300'}>
                          {r.access[c] === 'full' ? '● Full' : '◐ Some files'}
                        </span>
                        <button
                          class="ml-2 rounded px-1.5 py-0.5 text-xs text-red-300 hover:bg-red-500/15"
                          data-testid="revoke"
                          onclick={() => askRevoke(r, c)}>Remove</button
                        >
                      {:else}<span class="text-fulcra-gray/50">–</span>{/if}
                    </td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}

      <section class="mt-8 rounded-xl border border-fulcra-gray/20 bg-fulcra-black/40 p-5" data-testid="share-form">
        <h2 class="font-semibold text-fulcra-white">Share a client brain</h2>
        <p class="mt-1 text-sm text-fulcra-gray">
          Gives one person or group read access to one client folder. Ask them to sign in to this app; it shows them their Fulcra ID.
        </p>
        <div class="mt-4 flex flex-wrap items-end gap-3">
          <label class="text-sm text-fulcra-gray">
            Client
            <select class="mt-1 block rounded-lg bg-fulcra-black px-3 py-2 text-fulcra-white" bind:value={shareSlug} name="slug">
              {#each map.clients as c (c)}<option value={c}>{titleCase(c)}</option>{/each}
            </select>
          </label>
          <label class="text-sm text-fulcra-gray">
            Type
            <select class="mt-1 block rounded-lg bg-fulcra-black px-3 py-2 text-fulcra-white" bind:value={shareKind} name="kind">
              <option value="user">Person</option>
              <option value="group">Group</option>
            </select>
          </label>
          <label class="min-w-72 flex-1 text-sm text-fulcra-gray">
            Fulcra ID
            <input
              class="mt-1 block w-full rounded-lg bg-fulcra-black px-3 py-2 font-mono text-fulcra-white"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              bind:value={shareId}
              name="grantee"
            />
          </label>
          <button
            class="rounded-lg bg-fulcra-teal/20 px-4 py-2 text-sm text-fulcra-teal hover:bg-fulcra-teal/40 disabled:opacity-50"
            data-testid="share-button"
            disabled={!shareId.trim() || busy || !!pending}
            onclick={askGrant}>Review share…</button
          >
        </div>
      </section>

      <section class="mt-8 rounded-xl border border-fulcra-teal/30 bg-fulcra-black/40 p-5" data-testid="onboard-form">
        <h2 class="font-semibold text-fulcra-white">Add a teammate</h2>
        <p class="mt-1 text-sm text-fulcra-gray">
          Ask them to sign in here first. The app shows them their Fulcra ID, and they send it to you. Paste it below,
          tick their clients, and confirm once.
        </p>
        <div class="mt-4 grid gap-3 sm:grid-cols-2">
          <label class="text-sm text-fulcra-gray">
            Name
            <input class="mt-1 block w-full rounded-lg bg-fulcra-black px-3 py-2 text-fulcra-white" bind:value={mateName} name="mate-name" autocomplete="off" />
          </label>
          <label class="text-sm text-fulcra-gray">
            Their Fulcra ID
            <input
              class="mt-1 block w-full rounded-lg bg-fulcra-black px-3 py-2 font-mono text-fulcra-white"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              bind:value={mateId}
              name="mate-id"
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
            />
          </label>
        </div>
        <fieldset class="mt-4">
          <legend class="text-sm text-fulcra-gray">Clients they can read</legend>
          <div class="mt-2 flex flex-wrap gap-2">
            {#each map.clients as c (c)}
              <label class="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-fulcra-gray/25 px-3 py-2 text-sm text-fulcra-white has-[:checked]:border-fulcra-teal/60 has-[:checked]:bg-fulcra-teal/10">
                <input type="checkbox" value={c} bind:group={mateSlugs} class="accent-[#56d6b7]" />
                {titleCase(c)}
              </label>
            {/each}
          </div>
        </fieldset>
        <button
          class="mt-4 min-h-11 rounded-lg bg-fulcra-teal/20 px-4 py-2 text-sm text-fulcra-teal hover:bg-fulcra-teal/40 disabled:opacity-50"
          data-testid="onboard-button"
          disabled={!mateId.trim() || busy || !!pending}
          onclick={askOnboard}>Review…</button
        >
        <p class="mt-4 text-xs text-fulcra-gray">
          On the team list: {map.team.map((t) => t.name).join(', ') || 'nobody'}{map.pending.length
            ? ` · waiting on an ID: ${map.pending.join(', ')}`
            : ''}.
        </p>
      </section>
    {/if}
  </main>
{/if}
