<script>
  import { APP_NAME } from '$lib/config.js';
  import { user } from '$lib/user';
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import LoginDeviceFlow from '$lib/components/LoginDeviceFlow.svelte';

  let { children } = $props();

  onMount(async () => {
    await user.init();
  });

  // Tabs grow one milestone at a time.
  const tabs = [{ href: '/console', label: 'Activity' }];

  const active = (href) =>
    href === '/console' ? page.url.pathname === '/console' : page.url.pathname.startsWith(href);
</script>

<svelte:head>
  <title>Console · {APP_NAME}</title>
</svelte:head>

{#if !$user.authenticated}
  <LoginDeviceFlow />
{:else}
  <main class="mx-auto w-full max-w-5xl px-4 py-8">
    <header class="mb-6">
      <p class="text-xs font-semibold tracking-widest text-brand uppercase">Console</p>
      <h1 class="mt-1 text-3xl font-bold text-fulcra-white">Your Fulcra</h1>
      <p class="mt-1 text-fulcra-gray">Everything in your account and everything shared with you. Read-only.</p>
      <nav class="mt-5 flex flex-wrap gap-1 border-b border-fulcra-gray/20" aria-label="Console sections">
        {#each tabs as t (t.href)}
          <a
            href={t.href}
            class="-mb-px border-b-2 px-3 py-2 text-sm font-medium {active(t.href)
              ? 'border-brand text-brand'
              : 'border-transparent text-fulcra-gray hover:text-fulcra-white'}"
            aria-current={active(t.href) ? 'page' : undefined}>{t.label}</a
          >
        {/each}
      </nav>
    </header>
    {@render children()}
  </main>
{/if}
