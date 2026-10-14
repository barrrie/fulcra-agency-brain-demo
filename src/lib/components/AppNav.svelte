<script>
  import { APP_NAME, AGENCY_NAME } from '$lib/config.js';
  import { initials } from '$lib/clients.js';
  import { user } from '$lib/user';
  import { page } from '$app/state';
  import { lastSeen, unseenCount } from '$lib/console-seen.js';

  // From /api/session: owner screens, harness link, and the demo's current view.
  let isOwner = $state(false);
  let harness = $state(false);
  let demo = $state(null);
  let switching = $state(false);

  async function loadSession() {
    try {
      const res = await fetch('/api/session');
      const s = res.ok ? await res.json() : {};
      isOwner = s.owner === true;
      harness = s.harness === true;
      demo = s.demo ?? null;
    } catch {
      isOwner = false;
    }
    if (isOwner) loadBadge();
  }

  async function loadBadge() {
    try {
      const res = await fetch(`/api/console/activity?seen=${$lastSeen}`);
      if (res.ok) unseenCount.set((await res.json()).unseen ?? 0);
    } catch {
      /* badge is optional */
    }
  }

  /** Demo only: show the app as the owner or as a teammate. Reloads from the client list. */
  async function switchView(view) {
    if (switching || demo?.view === view) return;
    switching = true;
    try {
      await fetch('/api/demo/view', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ view })
      });
    } finally {
      window.location.href = '/';
    }
  }

  $effect(() => {
    if ($user.authenticated) loadSession();
    else isOwner = false;
  });

  const links = [
    { href: '/', label: 'Clients', match: (p) => p === '/' || p.startsWith('/clients') },
    { href: '/console', label: 'Console', match: (p) => p.startsWith('/console'), badge: true },
    { href: '/access', label: 'Access', match: (p) => p.startsWith('/access') }
  ];
</script>

{#if $user.authenticated}
  <nav
    class="app-nav border-b border-fulcra-black-25 bg-fulcra-black/80 backdrop-blur"
    aria-label="Main"
  >
    <!-- Phones: links get their own row under the brand bar so nothing is squeezed. -->
    <div class="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 px-4 sm:h-14 sm:flex-nowrap">
      <a href="/" class="flex h-14 shrink-0 items-center gap-2" aria-label="{APP_NAME} home">
        <span
          class="grid h-7 w-7 place-items-center rounded-md bg-brand text-[13px] font-bold text-fulcra-black"
          >{initials(AGENCY_NAME)}</span
        >
        <span
          class="hidden text-[15px] font-semibold tracking-[-0.01em] text-fulcra-white sm:inline"
          >{AGENCY_NAME}</span
        >
      </a>

      {#if isOwner}
        <div
          class="no-scrollbar order-last -mx-1 flex w-full min-w-0 items-center gap-1 overflow-x-auto pb-2 sm:order-none sm:mx-0 sm:ml-4 sm:w-auto sm:flex-1 sm:pb-0"
        >
          {#each links as l (l.href)}
            {@const on = l.match(page.url.pathname)}
            <a
              href={l.href}
              class="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors {on
                ? 'bg-fulcra-white/10 text-fulcra-white'
                : 'text-fulcra-gray hover:text-fulcra-white'}"
              aria-current={on ? 'page' : undefined}
              data-testid={l.badge ? 'nav-console' : undefined}
            >
              {l.label}
              {#if l.badge && $unseenCount > 0}
                <span
                  class="rounded-full bg-fulcra-orange px-1.5 text-[11px] leading-[18px] font-semibold text-fulcra-black tabular-nums"
                  data-testid="nav-badge">{$unseenCount}</span
                >
              {/if}
            </a>
          {/each}
          {#if harness}
            <a
              href="/harness"
              class="shrink-0 rounded-md px-2.5 py-1.5 text-xs text-fulcra-gray hover:text-fulcra-white md:hidden"
              >Harness</a
            >
          {/if}
        </div>
      {:else}
        <div class="flex-1"></div>
      {/if}

      <div class="ml-auto flex shrink-0 items-center gap-1 sm:ml-0">
        {#if demo}
          <div
            class="flex items-center rounded-lg border border-white/10 p-0.5 text-xs"
            role="group"
            aria-label="Demo: view the app as"
            data-testid="demo-view"
          >
            <span class="hidden px-2 text-fulcra-gray lg:inline">Demo · view as</span>
            {#each [{ view: 'owner', label: 'Owner' }, { view: 'viewer', label: demo.teammate ?? 'Teammate' }] as v (v.view)}
              <button
                class="rounded-md px-2 py-1 transition-colors {demo.view === v.view
                  ? 'bg-brand/20 text-brand'
                  : 'text-fulcra-gray hover:text-fulcra-white'}"
                aria-pressed={demo.view === v.view}
                disabled={switching}
                onclick={() => switchView(v.view)}>{v.label}</button
              >
            {/each}
          </div>
        {/if}
        {#if harness}
          <a
            href="/harness"
            class="hidden rounded-md px-2.5 py-1.5 text-xs text-fulcra-gray hover:text-fulcra-white md:inline"
            title="Build harness">Harness</a
          >
        {/if}
        <button
          class="rounded-md px-2.5 py-1.5 text-sm text-fulcra-gray hover:bg-fulcra-white/5 hover:text-fulcra-white"
          onclick={user.logout}>Sign out</button
        >
      </div>
    </div>
  </nav>
{/if}

<style>
  .app-nav {
    position: sticky;
    top: 0;
    z-index: 50;
  }
  .no-scrollbar {
    scrollbar-width: none;
  }
  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }
</style>
