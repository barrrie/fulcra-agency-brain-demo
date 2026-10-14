<script>
  import { user } from '$lib/user';
  import { lastSeen, unseenCount, markSeen } from '$lib/console-seen.js';

  let data = $state(null);
  let loadError = $state(null);
  let loading = $state(false);

  async function load() {
    loading = true;
    loadError = null;
    try {
      const res = await fetch(`/api/console/activity?seen=${$lastSeen}`);
      if (res.status === 403) throw new Error('The Console is owner-only.');
      if (res.status === 401) throw new Error('Your session expired. Sign out and sign in again.');
      if (!res.ok) throw new Error(`Couldn't load activity (${res.status}).`);
      data = await res.json();
      unseenCount.set(data.unseen);
    } catch (e) {
      loadError = e.message;
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if ($user.authenticated && !data && !loadError && !loading) load();
  });

  function seenAll() {
    markSeen();
    for (const list of [data.ownFiles, data.sharedFiles, data.received]) for (const it of list) it.unseen = false;
    data.unseen = 0;
  }

  const fmt = (iso) =>
    iso
      ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
      : '';
  const ago = (iso) => {
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (!iso || Number.isNaN(s)) return '';
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.round(s / 60)}m ago`;
    if (s < 86400) return `${Math.round(s / 3600)}h ago`;
    return fmt(iso);
  };
  const kindClass = (k) =>
    k === 'New' ? 'bg-brand/20 text-brand' : k === 'Deleted' ? 'bg-red-500/20 text-red-300' : 'bg-fulcra-lavender-100/25 text-fulcra-lavender-50';
  const errorList = $derived(data ? Object.entries(data.errors || {}) : []);
</script>

{#if loadError}
  <p class="rounded-lg border border-red-400/40 bg-red-500/10 p-4 text-red-300" data-testid="console-error">{loadError}</p>
{:else if !data}
  <p class="text-fulcra-gray">Reading your Fulcra…</p>
{:else}
  <section class="flex flex-wrap items-end justify-between gap-3">
    <p class="text-sm text-fulcra-gray">
      Since <span class="text-fulcra-white">{fmt(data.window.start)}</span> ·
      <span class="text-fulcra-white" data-testid="unseen-count">{data.unseen}</span> unseen
    </p>
    <div class="flex gap-2">
      <button class="rounded-lg border border-fulcra-gray/30 px-3 py-1.5 text-sm text-fulcra-white hover:border-brand" onclick={load} disabled={loading}>
        {loading ? 'Refreshing…' : 'Refresh'}
      </button>
      <button
        class="rounded-lg bg-brand/20 px-3 py-1.5 text-sm text-brand hover:bg-brand/40 disabled:opacity-40"
        onclick={seenAll}
        disabled={!data.unseen}
        data-testid="mark-seen">Mark all seen</button
      >
    </div>
  </section>

  {#if errorList.length}
    <p class="mt-4 rounded-lg border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-200">
      Some parts couldn't be read: {errorList.map(([k]) => k).join(', ')}. The rest is shown.
    </p>
  {/if}

  {#snippet fileRow(f, showOwner)}
    <li class="flex gap-3 border-t border-fulcra-gray/15 px-4 py-3 first:border-t-0" data-testid="file-change">
      <span class="mt-2 h-2 w-2 shrink-0 rounded-full {f.unseen ? 'bg-fulcra-orange' : 'bg-fulcra-gray/30'}" title={f.unseen ? 'Unseen' : 'Seen'}></span>
      <div class="min-w-0 flex-1">
        <p class="text-fulcra-white">
          <span class="mr-1 rounded-full px-2 py-0.5 text-xs font-semibold {kindClass(f.kind)}">{f.kind}</span>
          <span class="font-medium">{f.name}</span>
          {#if showOwner}<span class="text-sm text-fulcra-gray"> · from {f.ownerName}</span>{/if}
          {#if f.versions > 1}<span class="text-sm text-fulcra-gray"> · {f.versions} versions</span>{/if}
        </p>
        <p class="truncate font-mono text-xs text-fulcra-gray" title={f.path}>{f.path}</p>
      </div>
      <span class="shrink-0 text-xs text-fulcra-gray tabular-nums" title={fmt(f.when)}>{ago(f.when)}</span>
    </li>
  {/snippet}

  <section class="mt-6 rounded-xl border border-fulcra-gray/20 bg-fulcra-black/40" data-testid="shared-files">
    <h2 class="border-b border-fulcra-gray/20 px-4 py-2.5 text-xs font-semibold tracking-wider text-fulcra-gray uppercase">
      Shared with you · {data.sharedFiles.length} files changed
    </h2>
    {#if data.sharedFiles.length}
      <ul>{#each data.sharedFiles as f (f.owner + f.path)}{@render fileRow(f, true)}{/each}</ul>
    {:else}
      <p class="px-4 py-6 text-sm text-fulcra-gray">No changes in files shared with you in this window.</p>
    {/if}
  </section>

  <section class="mt-4 rounded-xl border border-fulcra-gray/20 bg-fulcra-black/40" data-testid="received-shares">
    <h2 class="border-b border-fulcra-gray/20 px-4 py-2.5 text-xs font-semibold tracking-wider text-fulcra-gray uppercase">
      Shares you've received · {data.received.length}
    </h2>
    {#if data.received.length}
      <ul>
        {#each data.received as s (s.id + (s.viaGroup ? 'g' : 'u'))}
          <li class="flex gap-3 border-t border-fulcra-gray/15 px-4 py-3 first:border-t-0" data-testid="received-share">
            <span class="mt-2 h-2 w-2 shrink-0 rounded-full {s.unseen ? 'bg-fulcra-orange' : 'bg-fulcra-gray/30'}"></span>
            <div class="min-w-0 flex-1">
              <p class="text-fulcra-white">
                <span class="font-medium">{s.fromName}</span>
                <span class="text-fulcra-gray">shared “{s.name}”</span>
                {#if s.viaGroup}<span class="text-xs text-fulcra-gray"> · via a group</span>{/if}
              </p>
              <p class="text-sm text-fulcra-gray">{s.scope}</p>
              {#if s.filePaths.length || s.dataTypes.length}
                <p class="mt-1 font-mono text-xs break-all text-fulcra-gray">
                  {[...s.filePaths, ...s.dataTypes.map((t) => t.name)].join(' · ')}
                </p>
              {/if}
            </div>
            <span class="shrink-0 text-xs text-fulcra-gray tabular-nums">{fmt(s.when)}</span>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="px-4 py-6 text-sm text-fulcra-gray">Nobody shares anything with you yet.</p>
    {/if}
  </section>

  <section class="mt-4 rounded-xl border border-fulcra-gray/20 bg-fulcra-black/40" data-testid="own-files">
    <h2 class="border-b border-fulcra-gray/20 px-4 py-2.5 text-xs font-semibold tracking-wider text-fulcra-gray uppercase">
      Your files · {data.ownFiles.length} changed
    </h2>
    {#if data.ownFiles.length}
      <ul>{#each data.ownFiles as f (f.path)}{@render fileRow(f, false)}{/each}</ul>
    {:else}
      <p class="px-4 py-6 text-sm text-fulcra-gray">None of your files changed in this window.</p>
    {/if}
  </section>

  <section class="mt-4 rounded-xl border border-fulcra-gray/20 bg-fulcra-black/40" data-testid="streams">
    <h2 class="border-b border-fulcra-gray/20 px-4 py-2.5 text-xs font-semibold tracking-wider text-fulcra-gray uppercase">
      New records in data streams
    </h2>
    {#if data.streams.length}
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="text-left text-xs text-fulcra-gray uppercase">
            <tr><th class="px-4 py-2 font-semibold">Stream</th><th class="px-4 py-2 font-semibold">From</th><th class="px-4 py-2 text-right font-semibold">Records</th></tr>
          </thead>
          <tbody>
            {#each data.streams as s (s.owner + s.type)}
              <tr class="border-t border-fulcra-gray/15">
                <td class="px-4 py-2 text-fulcra-white">{s.name}<span class="block font-mono text-xs text-fulcra-gray">{s.type}</span></td>
                <td class="px-4 py-2 text-fulcra-gray">{s.ownerName}</td>
                <td class="px-4 py-2 text-right text-fulcra-white tabular-nums">{s.count}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      <p class="px-4 py-6 text-sm text-fulcra-gray">No new records in this window.</p>
    {/if}
  </section>
{/if}
