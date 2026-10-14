<script>
  import { APP_NAME, AGENCY_NAME, OWNER_NAME, AGENCY_PATH } from '$lib/config.js';
  import { user } from '$lib/user';
  import { onMount } from 'svelte';
  import LoginDeviceFlow from '$lib/components/LoginDeviceFlow.svelte';
  import { initials, BRAIN_FILES } from '$lib/clients.js';
  import { resolve } from '$app/paths';
  import { heatLevel, formatMeetingTime } from '$lib/signals.js';

  const HEAT_FILL = { calm: 'bg-fulcra-gray', warm: 'bg-fulcra-yellow', hot: 'bg-fulcra-orange', fire: 'bg-fulcra-red' };
  const HEAT_TEXT = { calm: 'text-fulcra-gray', warm: 'text-fulcra-yellow', hot: 'text-fulcra-orange', fire: 'text-fulcra-red' };

  let clients = $state(null);
  let role = $state(null);
  let signalsAt = $state(null);
  // Re-evaluated every minute so a meeting that has ended rolls over to the next one.
  let now = $state(Date.now());
  let loadError = $state(null);
  let copied = $state(false);
  const myId = $derived($user.auth0UserInfo?.['fulcradynamics.com/userid'] ?? 'unavailable');

  onMount(() => {
    user.init();
    const tick = setInterval(() => (now = Date.now()), 60_000);
    return () => clearInterval(tick);
  });

  async function loadClients() {
    loadError = null;
    try {
      const res = await fetch('/api/clients');
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const body = await res.json();
      role = body.role;
      signalsAt = body.signalsAt ?? null;
      clients = body.clients;
    } catch (e) {
      loadError = e.message;
    }
  }


  const ago = (iso) => {
    if (!iso) return null;
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (Number.isNaN(s)) return null;
    if (s < 3600) return 'just now';
    if (s < 86400) return `${Math.round(s / 3600)}h ago`;
    if (s < 86400 * 30) return `${Math.round(s / 86400)}d ago`;
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  async function copyId() {
    await navigator.clipboard.writeText(myId);
    copied = true;
  }

  $effect(() => {
    if ($user.authenticated && clients === null && !loadError) loadClients();
  });
</script>

<svelte:head>
  <title>{APP_NAME}</title>
</svelte:head>

{#if !$user.authenticated}
  <LoginDeviceFlow />
{:else}
  <main class="mx-auto w-full max-w-5xl px-4 py-8 sm:py-10">
    <header class="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-3xl font-semibold tracking-[-0.02em] text-fulcra-white">Client brains</h1>
        <p class="mt-1 text-fulcra-gray">What an account strategist needs to know, per client.</p>
      </div>
    </header>

    {#if loadError}
      <p class="rounded-lg border border-red-400/40 bg-red-500/10 p-4 text-red-300">{loadError}</p>
    {:else if clients === null}
      <ul class="grid grid-cols-6 gap-3" aria-hidden="true">
        {#each [0, 1, 2] as i (i)}<li class="col-span-full h-44 animate-pulse rounded-2xl bg-fulcra-black-50 sm:col-span-3 lg:col-span-2"></li>{/each}
      </ul>
    {:else if role === 'viewer' && clients.length === 0}
      <section class="rounded-xl border border-fulcra-gray/20 bg-fulcra-black/40 p-6" data-testid="not-owner">
        <p class="text-lg font-semibold text-fulcra-white">You're signed in, but nothing has been shared with you here yet.</p>
        <p class="mt-2 text-fulcra-gray">Send this Fulcra ID to {OWNER_NAME} to get access:</p>
        <div class="mt-3 flex flex-wrap items-center gap-2">
          <code class="rounded-lg bg-fulcra-black px-3 py-2 font-mono text-brand" data-testid="my-id">{myId}</code>
          <button
            class="rounded-lg bg-brand/20 px-3 py-2 text-sm text-brand hover:bg-brand/40"
            onclick={copyId}>{copied ? 'Copied' : 'Copy'}</button
          >
        </div>
        <p class="mt-5 text-sm text-fulcra-gray">Once your clients are shared, refresh this page.</p>
      </section>
    {:else}
      <ul class="grid grid-cols-6 gap-3" data-testid="client-list">
        {#each clients as c (c.slug)}
          {@const complete = c.filesPresent === c.filesTotal}
          {#if role === 'owner'}
            {@const meeting = c.signals?.meetings?.find((m) => Date.parse(m.end ?? m.start) > now) ?? null}
            {@const heat = heatLevel(c.signals?.asana?.overdue)}
            <li class="col-span-full sm:col-span-3 lg:col-span-2">
              <div
                class="group relative flex h-full flex-col gap-5 rounded-2xl border border-fulcra-black-25 bg-fulcra-black-50 p-5 transition focus-within:border-brand/60 hover:-translate-y-px hover:border-brand/60"
                data-testid="client-card"
              >
                <div class="flex items-center gap-4">
                  <span
                    class="relative ml-2 grid size-12 shrink-0 place-items-center rounded-full border border-white/10 text-sm font-semibold text-brand before:absolute before:-inset-2 before:rounded-full before:border before:border-white/5 group-hover:border-brand/50"
                    >{initials(c.name)}</span
                  >
                  <h2 class="min-w-0 flex-1 truncate text-lg font-semibold text-fulcra-white">
                    <!-- Stretched link: the whole card opens the brain; avatars sit above it. -->
                    <a href={resolve('/clients/[slug]', { slug: c.slug })} class="outline-none after:absolute after:inset-0 after:rounded-2xl">{c.name}</a>
                  </h2>
                  <span class="text-fulcra-gray transition group-hover:translate-x-0.5 group-hover:text-brand" aria-hidden="true">→</span>
                </div>

                <dl class="grid grid-cols-[5.5rem_1fr] items-start gap-x-3 gap-y-3 border-t border-white/5 pt-4 text-sm">
                  <dt class="pt-px text-xs tracking-wide text-fulcra-gray uppercase">Next meeting</dt>
                  <dd class="min-w-0" data-testid="next-meeting">
                    {#if c.signalsError}
                      <span class="text-fulcra-gray">Unavailable</span>
                    {:else if !c.signals}
                      <span class="text-fulcra-gray">No data for this client</span>
                    {:else if meeting}
                      <span class="block text-fulcra-white">{formatMeetingTime(meeting, new Date(now))}</span>
                      <span class="block truncate text-xs text-fulcra-gray" title={meeting.title}>{meeting.title}</span>
                    {:else}
                      <span class="text-amber-300">No meeting booked</span>
                    {/if}
                  </dd>

                  <dt class="pt-px text-xs tracking-wide text-fulcra-gray uppercase">Shared with</dt>
                  <dd class="min-w-0" data-testid="shared-with">
                    {#if c.sharedWith === null}
                      <span class="text-fulcra-gray">Unavailable</span>
                    {:else if c.sharedWith.length === 0}
                      <span class="text-fulcra-gray">Not shared</span>
                    {:else}
                      <ul class="-my-1 flex flex-wrap gap-1.5">
                        {#each c.sharedWith as p (p.key)}
                          <li class="group/av relative z-10">
                            <span
                              tabindex="0"
                              role="img"
                              aria-label="{p.name}, {p.inside ? `inside ${AGENCY_NAME}` : `outside ${AGENCY_NAME}`}, {p.kind}, {p.access} access"
                              class="grid size-7 cursor-default place-items-center rounded-full text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-brand {p.inside
                                ? 'bg-white/10 text-fulcra-white'
                                : 'bg-fulcra-orange/20 text-fulcra-orange ring-1 ring-fulcra-orange/60'}">{p.letter}</span
                            >
                            <span
                              class="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-max max-w-56 -translate-x-1/2 rounded-lg border border-white/10 bg-fulcra-black px-3 py-2 text-xs shadow-lg group-focus-within/av:block group-hover/av:block"
                              data-testid="avatar-tip"
                            >
                              <span class="block font-semibold text-fulcra-white">{p.name}</span>
                              <span class="block {p.inside ? 'text-fulcra-gray' : 'text-fulcra-orange'}"
                                >{p.inside ? AGENCY_NAME : `Outside ${AGENCY_NAME}`}</span
                              >
                              <span class="block text-fulcra-gray"
                                >{p.kind === 'group' ? 'Group' : 'Person'} · {p.access === 'full' ? 'Whole brain' : 'Some files'}</span
                              >
                            </span>
                          </li>
                        {/each}
                      </ul>
                    {/if}
                  </dd>

                  <dt class="pt-px text-xs tracking-wide text-fulcra-gray uppercase">Heat</dt>
                  <dd class="min-w-0" data-testid="heat">
                    {#if c.signalsError}
                      <span class="text-fulcra-gray">Unavailable</span>
                    {:else if !c.signals}
                      <span class="text-fulcra-gray">No data for this client</span>
                    {:else if heat}
                      <span class="flex items-center gap-2">
                        <span class="flex gap-0.5" aria-hidden="true">
                          {#each [1, 2, 3, 4] as s (s)}
                            <span class="h-3 w-1.5 rounded-sm {s <= heat.step ? HEAT_FILL[heat.key] : 'bg-white/10'}"></span>
                          {/each}
                        </span>
                        <span class="font-medium {HEAT_TEXT[heat.key]}">{heat.label}</span>
                      </span>
                      <span class="block text-xs text-fulcra-gray tabular-nums"
                        >{c.signals.asana.overdue} overdue · {c.signals.asana.open} open</span
                      >
                    {:else}
                      <span class="text-fulcra-gray">No Asana data</span>
                    {/if}
                  </dd>
                </dl>
              </div>
            </li>
          {:else}
          <li class="col-span-full sm:col-span-3 lg:col-span-2">
            <a
              href={resolve('/clients/[slug]', { slug: c.slug })}
              class="group flex h-full flex-col justify-between gap-8 rounded-2xl border border-fulcra-black-25 bg-fulcra-black-50 p-5 transition hover:-translate-y-px hover:border-brand/60"
              data-testid="client-card"
            >
              <div class="flex items-start justify-between gap-3">
                <span
                  class="relative ml-2 mt-2 grid size-12 shrink-0 place-items-center rounded-full border border-white/10 text-sm font-semibold text-brand before:absolute before:-inset-2 before:rounded-full before:border before:border-white/5 group-hover:border-brand/50"
                  >{initials(c.name)}</span
                >
                <span class="text-fulcra-gray transition group-hover:translate-x-0.5 group-hover:text-brand" aria-hidden="true">→</span>
              </div>
              <div class="space-y-3">
                <div>
                  <h2 class="truncate text-lg font-semibold text-fulcra-white">{c.name}</h2>
                  <p class="mt-0.5 flex flex-wrap gap-x-1.5 text-xs text-fulcra-gray">
                    <span class={complete ? 'text-brand' : 'text-amber-300'}
                      >{complete ? 'All 7 sections' : `${c.filesPresent} of ${c.filesTotal} sections`}</span
                    >
                    {#if ago(c.updatedAt)}<span aria-hidden="true">·</span><span>Updated {ago(c.updatedAt)}</span>{/if}
                  </p>
                </div>
                <div class="flex gap-1" aria-hidden="true">
                  {#each BRAIN_FILES as b (b.file)}
                    {@const has = c.present ? c.present.includes(b.file) : complete}
                    <span class="h-1.5 flex-1 rounded-full {has ? 'bg-brand' : 'bg-white/10'}" title="{b.label}{has ? '' : ' (missing)'}"></span>
                  {/each}
                </div>
              </div>
            </a>
          </li>
          {/if}
        {/each}
      </ul>
      {#if role === 'owner'}
        <p class="mt-4 text-xs text-fulcra-gray" data-testid="signals-at">
          {#if signalsAt}
            Meetings and Asana heat as of {ago(signalsAt)}. Heat counts overdue open tasks.
          {:else}
            Meetings and Asana heat are unavailable: <code class="font-mono">{AGENCY_PATH}/signals.json</code> could not be read.
          {/if}
        </p>
      {/if}
      {#if role === 'owner' && clients.length === 0}
        <p class="mt-4 text-sm text-fulcra-gray">No client brains yet.</p>
      {/if}
      {#if role === 'viewer'}
        <p class="mt-6 text-xs text-fulcra-gray" data-testid="viewer-note">
          Read-only. Your Fulcra ID: <code class="font-mono text-brand">{myId}</code>
          <button class="ml-1 underline hover:text-brand" onclick={copyId}>{copied ? 'copied' : 'copy'}</button>
        </p>
      {/if}
    {/if}
  </main>
{/if}
