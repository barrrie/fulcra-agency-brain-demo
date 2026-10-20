<script>
  import { APP_NAME, OWNER_NAME, CLIENTS_PATH } from '$lib/config.js';
  import { user } from '$lib/user';
  import { onMount } from 'svelte';
  import LoginDeviceFlow from '$lib/components/LoginDeviceFlow.svelte';

  let clients = $state(null);
  let role = $state(null);
  let loadError = $state(null);
  let copied = $state(false);
  const myId = $derived($user.auth0UserInfo?.['fulcradynamics.com/userid'] ?? 'unavailable');

  onMount(async () => {
    await user.init();
  });

  async function loadClients() {
    loadError = null;
    try {
      const res = await fetch('/api/clients');
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const body = await res.json();
      role = body.role;
      clients = body.clients;
    } catch (e) {
      loadError = e.message;
    }
  }

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
  <main class="mx-auto w-full max-w-4xl px-4 py-8">
    <header class="mb-8 flex items-end justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold text-fulcra-white">Client brains</h1>
        <p class="mt-1 text-fulcra-gray">What an account strategist needs to know, per client.</p>
      </div>
      <div class="flex gap-2">
        <a
          href="/map"
          class="rounded-lg border border-fulcra-teal/30 px-4 py-2 text-sm text-fulcra-teal hover:bg-fulcra-teal/20">Map</a
        >
        <button
          class="rounded-lg bg-fulcra-teal/20 px-4 py-2 text-sm text-fulcra-teal hover:bg-fulcra-teal/50"
          onclick={user.logout}>Sign out</button
        >
      </div>
    </header>

    {#if loadError}
      <p class="rounded-lg border border-red-400/40 bg-red-500/10 p-4 text-red-300">{loadError}</p>
    {:else if clients === null}
      <p class="text-fulcra-gray">Loading clients…</p>
    {:else if role === 'viewer' && clients.length === 0}
      <section class="rounded-xl border border-fulcra-gray/20 bg-fulcra-black/40 p-6" data-testid="not-owner">
        <p class="text-lg font-semibold text-fulcra-white">You're signed in, but nothing has been shared with you here yet.</p>
        <p class="mt-2 text-fulcra-gray">Send this Fulcra ID to {OWNER_NAME} to get access:</p>
        <div class="mt-3 flex flex-wrap items-center gap-2">
          <code class="rounded-lg bg-fulcra-black px-3 py-2 font-mono text-fulcra-teal" data-testid="my-id">{myId}</code>
          <button
            class="rounded-lg bg-fulcra-teal/20 px-3 py-2 text-sm text-fulcra-teal hover:bg-fulcra-teal/40"
            onclick={copyId}>{copied ? 'Copied' : 'Copy'}</button
          >
        </div>
        <p class="mt-5 text-sm text-fulcra-gray">Once your clients are shared, refresh this page.</p>
      </section>
    {:else if clients.length === 0}
      <p class="text-fulcra-gray">No client brains yet. Add folders under {CLIENTS_PATH} in Fulcra.</p>
    {:else}
      <ul class="grid gap-3 sm:grid-cols-2">
        {#each clients as c (c.slug)}
          <li>
            <a
              href={`/clients/${c.slug}`}
              class="block rounded-xl border border-fulcra-gray/20 bg-fulcra-black/40 p-5 transition hover:border-fulcra-teal/60 hover:bg-fulcra-black/60"
            >
              <span class="block text-lg font-semibold text-fulcra-white">{c.name}</span>
              <span class="mt-1 block text-sm text-fulcra-gray">{CLIENTS_PATH}/{c.slug}</span>
            </a>
          </li>
        {/each}
      </ul>
      {#if role === 'viewer'}
        <p class="mt-6 text-xs text-fulcra-gray" data-testid="viewer-note">
          Read-only. Your Fulcra ID: <code class="font-mono text-fulcra-teal">{myId}</code>
          <button class="ml-1 underline hover:text-fulcra-teal" onclick={copyId}>{copied ? 'copied' : 'copy'}</button>
        </p>
      {/if}
    {/if}
  </main>
{/if}
