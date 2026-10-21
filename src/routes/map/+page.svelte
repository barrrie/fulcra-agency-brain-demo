<script>
  import { APP_NAME, AGENCY_NAME } from '$lib/config.js';
  import { user } from '$lib/user';
  import { onMount } from 'svelte';
  import LoginDeviceFlow from '$lib/components/LoginDeviceFlow.svelte';
  import BrainMap from '$lib/components/BrainMap.svelte';

  // Fulcra brand colours first, then softer companions so twelve regions stay distinct.
  const PALETTE = [
    '#56d6b7',
    '#9c88ff',
    '#ffcc00',
    '#ff9500',
    '#5aa9ff',
    '#ff6f91',
    '#34c759',
    '#bdb0ff',
    '#ff7a59',
    '#5ad8f5',
    '#c6e86b',
    '#abebdb'
  ];
  const MODES = [
    { id: 'region', label: 'Themes', chips: 'Regions' },
    { id: 'client', label: 'Clients', chips: 'Clients' },
    { id: 'section', label: 'Sections', chips: 'Sections' }
  ];

  let data = $state(null);
  let loadError = $state(null);
  let mode = $state('region');
  let query = $state('');
  let applied = $state('');
  let focus = $state(null); // a group key picked from the chips
  let zoom = $state(1);
  let resetKey = $state(0);
  let pinned = $state(null);
  let listLimit = $state(60);

  onMount(async () => {
    await user.init();
  });

  async function load() {
    loadError = null;
    try {
      const res = await fetch('/api/map');
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      data = await res.json();
    } catch (e) {
      loadError = e.message;
    }
  }

  $effect(() => {
    if ($user.authenticated && !data && !loadError) load();
  });

  const keyOf = (m) => (mode === 'region' ? m.region : mode === 'client' ? m.client : m.section);

  /** Groups for the current colour mode, biggest first, each with a colour. */
  const groups = $derived.by(() => {
    if (!data) return [];
    const byKey = new Map();
    for (const m of data.memories) {
      const k = keyOf(m);
      if (!byKey.has(k)) {
        const name =
          mode === 'region'
            ? data.regions[m.region].name
            : mode === 'client'
              ? m.clientName
              : m.section;
        byKey.set(k, { key: k, name, members: [] });
      }
      byKey.get(k).members.push(m);
    }
    const list = [...byKey.values()].sort((a, b) => b.members.length - a.members.length);
    list.forEach((g, i) => {
      g.colour = PALETTE[i % PALETTE.length];
      g.count = g.members.length;
      g.pos = [0, 1, 2].map((d) => g.members.reduce((s, m) => s + m.pos[d], 0) / g.count);
      g.title = mode === 'region' ? data.regions[g.key].terms.join(', ') : '';
    });
    return list;
  });

  const colourByKey = $derived(new Map(groups.map((g) => [g.key, g.colour])));
  const colourOf = $derived((m) => colourByKey.get(keyOf(m)) ?? PALETTE[0]);

  const matches = $derived.by(() => {
    if (!data) return [];
    const words = applied.toLowerCase().split(/\s+/).filter(Boolean);
    return data.memories.filter((m) => {
      if (focus !== null && keyOf(m) !== focus) return false;
      if (!words.length) return true;
      const hay = `${m.text} ${m.heading ?? ''} ${m.clientName} ${m.section}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  });

  const filtering = $derived(focus !== null || applied.trim() !== '');
  const highlight = $derived(filtering ? new Set(matches.map((m) => m.id)) : null);

  function search(e) {
    e?.preventDefault();
    applied = query;
    listLimit = 60;
  }

  function clearSearch() {
    query = '';
    applied = '';
  }

  function setMode(id) {
    mode = id;
    focus = null;
  }

  function toggleFocus(key) {
    focus = focus === key ? null : key;
    listLimit = 60;
  }

  function recentre() {
    zoom = 1;
    resetKey++;
    pinned = null;
  }

  const modeInfo = $derived(MODES.find((m) => m.id === mode));
  const plural = (n, one, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;
</script>

<svelte:head>
  <title>Map · {APP_NAME}</title>
</svelte:head>

{#if !$user.authenticated}
  <LoginDeviceFlow />
{:else}
  <main class="mx-auto w-full max-w-7xl px-2 py-4 sm:px-4">
    <section class="brain-panel rounded-3xl border border-white/5 p-5 sm:p-7">
      <header class="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div class="max-w-2xl">
          <a
            href="/"
            class="text-xs tracking-[0.18em] text-fulcra-teal/80 uppercase hover:text-fulcra-teal"
          >
            {AGENCY_NAME} · {APP_NAME}
          </a>
          <h1 class="mt-1 text-3xl font-semibold text-fulcra-white">Map</h1>
          <p class="mt-2 text-fulcra-gray">
            Everything the brain knows about your clients, as one field. Memories that sit near each
            other say similar things, and that is the only thing a position here means.
          </p>
        </div>
        <form class="flex w-full gap-2 lg:w-[30rem]" onsubmit={search}>
          <label class="relative flex-1">
            <span class="sr-only">Search memories</span>
            <svg
              class="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-fulcra-gray"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg
            >
            <input
              class="w-full rounded-xl border border-white/10 bg-white/5 py-3 pr-9 pl-11 text-fulcra-white placeholder:text-fulcra-gray/80 focus:border-fulcra-teal/60 focus:outline-none"
              placeholder="Search everything the brain knows"
              bind:value={query}
            />
            {#if applied}
              <button
                type="button"
                class="absolute top-1/2 right-3 -translate-y-1/2 text-fulcra-gray hover:text-fulcra-white"
                onclick={clearSearch}
                aria-label="Clear search">×</button
              >
            {/if}
          </label>
          <button
            class="rounded-xl bg-fulcra-teal/15 px-5 font-medium text-fulcra-teal hover:bg-fulcra-teal/30"
            >Search</button
          >
        </form>
      </header>

      {#if loadError}
        <p class="mt-6 rounded-lg border border-red-400/40 bg-red-500/10 p-4 text-red-300">
          {loadError}
        </p>
      {:else if !data}
        <p class="mt-6 text-fulcra-gray">Mapping the brain…</p>
      {:else if !data.memories.length}
        <p class="mt-6 text-fulcra-gray">
          Nothing to map yet. Once client brains have content, it shows up here.
        </p>
      {:else}
        <div class="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p class="text-fulcra-white/90">
            {#if filtering}
              {plural(matches.length, 'memory', 'memories')} lit up, of {data.memories.length.toLocaleString()}.
            {:else}
              {plural(data.memories.length, 'memory', 'memories')} from {plural(
                data.clients.length,
                'client brain'
              )}, in {plural(data.regions.length, 'region')} named from what they say.
            {/if}
          </p>
          <div class="flex items-center gap-1 text-fulcra-white/90">
            <button
              class="icon-btn"
              onclick={() => (zoom = Math.max(0.5, zoom / 1.25))}
              aria-label="Zoom out"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                ><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5M8 11h6" /></svg
              >
            </button>
            <button
              class="icon-btn"
              onclick={() => (zoom = Math.min(4, zoom * 1.25))}
              aria-label="Zoom in"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                ><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5M8 11h6M11 8v6" /></svg
              >
            </button>
            <button
              class="ml-2 flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5"
              onclick={recentre}
            >
              <svg
                class="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg
              >
              Recentre
            </button>
          </div>
        </div>

        <div class="field relative mt-4 h-[62vh] min-h-[420px] overflow-hidden rounded-2xl">
          <BrainMap
            memories={data.memories}
            labels={groups.filter((g) => focus === null || g.key === focus)}
            {colourOf}
            {highlight}
            {zoom}
            {resetKey}
            bind:pinned
          />
          <p class="pointer-events-none absolute bottom-4 left-5 text-xs text-fulcra-gray/80">
            Drag to turn it. Click a memory to keep its card open. Zoom with the buttons above.
          </p>
        </div>

        <div class="mt-5 flex flex-wrap items-center gap-2">
          <span class="mr-1 text-xs tracking-[0.14em] text-fulcra-gray uppercase"
            >{modeInfo.chips}</span
          >
          {#each groups as g (g.key)}
            <button
              class="chip"
              class:chip-on={focus === g.key}
              class:chip-off={focus !== null && focus !== g.key}
              title={g.title}
              onclick={() => toggleFocus(g.key)}
            >
              <span class="h-2.5 w-2.5 rounded-full" style:background={g.colour}></span>
              {g.name}
              <span class="font-mono text-fulcra-gray">{g.count.toLocaleString()}</span>
            </button>
          {/each}
          <div
            class="ml-auto flex rounded-lg border border-white/10 p-0.5 text-sm"
            role="group"
            aria-label="Colour by"
          >
            {#each MODES as m (m.id)}
              <button
                class="rounded-md px-3 py-1 {mode === m.id
                  ? 'bg-fulcra-teal/20 text-fulcra-teal'
                  : 'text-fulcra-gray hover:text-fulcra-white'}"
                aria-pressed={mode === m.id}
                onclick={() => setMode(m.id)}>{m.label}</button
              >
            {/each}
          </div>
        </div>

        <div class="mt-8 flex items-baseline justify-between">
          <h2 class="text-lg font-semibold text-fulcra-white">
            {filtering ? 'Matching memories' : 'Every memory'} ({matches.length.toLocaleString()})
          </h2>
          <a href="/" class="text-sm text-fulcra-gray hover:text-fulcra-teal"
            >Manage what it remembers</a
          >
        </div>
        <ul class="mt-3 divide-y divide-white/5 rounded-xl border border-white/5 bg-black/10">
          {#each matches.slice(0, listLimit) as m (m.id)}
            <li>
              <button
                class="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-white/5 {pinned?.id ===
                m.id
                  ? 'bg-white/5'
                  : ''}"
                onclick={() => (pinned = pinned?.id === m.id ? null : m)}
              >
                <span class="mt-1.5 h-2 w-2 shrink-0 rounded-full" style:background={colourOf(m)}
                ></span>
                <span class="min-w-0 flex-1">
                  <span class="block text-sm text-fulcra-white">{m.text}</span>
                  <span class="mt-0.5 block text-xs text-fulcra-gray">
                    {m.clientName} · {m.section}{m.heading ? ` · ${m.heading}` : ''}
                  </span>
                </span>
              </button>
            </li>
          {:else}
            <li class="px-4 py-6 text-sm text-fulcra-gray">Nothing matches. Try fewer words.</li>
          {/each}
        </ul>
        {#if matches.length > listLimit}
          <button
            class="mt-3 text-sm text-fulcra-teal hover:underline"
            onclick={() => (listLimit += 100)}
          >
            Show more ({(matches.length - listLimit).toLocaleString()} left)
          </button>
        {/if}
      {/if}
    </section>
  </main>
{/if}

<style>
  .brain-panel {
    background:
      radial-gradient(120% 80% at 0% 0%, rgba(86, 214, 183, 0.08), transparent 55%),
      linear-gradient(180deg, #13232c 0%, #101a22 45%, #16161d 100%);
  }
  .field {
    background: radial-gradient(70% 70% at 50% 45%, #10303a 0%, #0c1c24 55%, #0a1218 100%);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04);
  }
  .icon-btn {
    display: grid;
    place-items: center;
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 0.5rem;
  }
  .icon-btn:hover {
    background: rgba(255, 255, 255, 0.05);
  }
  .icon-btn svg {
    width: 1.15rem;
    height: 1.15rem;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    border-radius: 9999px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.03);
    padding: 0.35rem 0.85rem;
    font-size: 0.875rem;
    color: var(--color-fulcra-white);
    transition:
      opacity 0.15s,
      border-color 0.15s;
  }
  .chip:hover {
    border-color: rgba(86, 214, 183, 0.5);
  }
  .chip-on {
    border-color: var(--color-fulcra-teal);
    background: rgba(86, 214, 183, 0.1);
  }
  .chip-off {
    opacity: 0.45;
  }
</style>
