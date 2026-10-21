<script>
  import { onMount } from 'svelte';
  import { demo, loadDemo, viewAs, resetDemo } from '$lib/demo.js';

  onMount(loadDemo);

  const roleLabel = (p) =>
    p.role === 'owner' ? 'owner' : p.role === 'newcomer' ? 'not on the team yet' : p.role;
</script>

{#if $demo.sandbox}
  <div class="border-b border-amber-400/30 bg-amber-500/10 text-xs" data-testid="demo-bar">
    <div class="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2">
      <span class="font-semibold text-amber-300">Demo sandbox</span>
      <span class="text-fulcra-gray">Fictional data. Nothing touches Fulcra.</span>
      <span class="ml-auto text-fulcra-gray">View as</span>
      {#each $demo.people as p (p.id)}
        <button
          class="rounded-md px-2.5 py-1 transition {$demo.as?.id === p.id
            ? 'bg-amber-400/90 font-semibold text-black'
            : 'text-fulcra-white hover:bg-amber-500/20'}"
          aria-pressed={$demo.as?.id === p.id}
          title={roleLabel(p)}
          data-persona={p.id}
          onclick={() => viewAs(p.id)}>{p.name}</button
        >
      {/each}
      {#if $demo.as?.role === 'owner'}
        <button
          class="rounded-md px-2.5 py-1 text-fulcra-gray underline hover:text-amber-300"
          data-testid="demo-reset"
          onclick={resetDemo}>Reset</button
        >
      {/if}
    </div>
  </div>
{/if}
