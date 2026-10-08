<script>
  import { APP_NAME } from '$lib/config.js';
  import { user } from '$lib/user';
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import LoginDeviceFlow from '$lib/components/LoginDeviceFlow.svelte';
  import { renderMarkdown } from '$lib/markdown.js';
  import { lintBrain } from '$lib/lint.js';

  let brain = $state(null);
  let loadError = $state(null);
  let active = $state('brief.md');

  // Editing
  let editing = $state(false);
  let draft = $state('');
  let baseId = $state(null);
  let warnings = $state([]); // lint warnings awaiting "save anyway"
  let saving = $state(false);
  let notice = $state(null); // { ok, text }

  // History
  let showHistory = $state(false);
  let versions = $state(null);
  let restoreTarget = $state(null);

  onMount(async () => {
    await user.init();
  });

  async function loadBrain(slug) {
    loadError = null;
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(slug)}`);
      if (res.status === 403) {
        loadError = 'This app is owner-only.';
        return;
      }
      if (res.status === 404) {
        loadError = 'No brain found for this client.';
        return;
      }
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      brain = await res.json();
    } catch (e) {
      loadError = e.message;
    }
  }

  $effect(() => {
    if ($user.authenticated && !brain && !loadError) loadBrain(page.params.slug);
  });

  const current = $derived(brain?.sections.find((s) => s.file === active));
  const fmt = (t) => (t ? new Date(t).toLocaleString() : '');

  function selectTab(file) {
    if (editing && draft !== (current?.content ?? '')) {
      notice = { ok: false, text: 'Save or cancel your edit before switching sections.' };
      return;
    }
    editing = false;
    showHistory = false;
    versions = null;
    restoreTarget = null;
    warnings = [];
    notice = null;
    active = file;
  }

  function startEdit() {
    notice = null;
    warnings = [];
    draft = current?.content ?? '';
    baseId = current?.versionId ?? null;
    editing = true;
  }

  async function save(force = false) {
    if (!force) {
      const w = lintBrain(draft);
      if (w.length) {
        warnings = w;
        return;
      }
    }
    warnings = [];
    saving = true;
    try {
      const res = await fetch(`/api/clients/${brain.slug}/${active}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: draft, baseId })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || `Save failed (${res.status})`);
      editing = false;
      notice = { ok: true, text: `Saved a new version of ${current.label}. The previous version is in History.` };
      await refresh();
    } catch (e) {
      notice = { ok: false, text: e.message };
    } finally {
      saving = false;
    }
  }

  async function refresh() {
    const keep = active;
    brain = null;
    await loadBrain(page.params.slug);
    active = keep;
    if (showHistory) await loadVersions();
  }

  async function loadVersions() {
    versions = null;
    const res = await fetch(`/api/clients/${brain.slug}/${active}/versions`);
    versions = res.ok ? (await res.json()).versions : [];
  }

  async function toggleHistory() {
    showHistory = !showHistory;
    restoreTarget = null;
    if (showHistory) await loadVersions();
  }

  async function restore() {
    saving = true;
    try {
      const res = await fetch(`/api/clients/${brain.slug}/${active}/restore`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ versionId: restoreTarget.id })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || `Restore failed (${res.status})`);
      notice = { ok: true, text: `Restored the version from ${fmt(restoreTarget.uploadedAt)}.` };
      restoreTarget = null;
      await refresh();
    } catch (e) {
      notice = { ok: false, text: e.message };
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>{brain ? `${brain.name} · ${APP_NAME}` : APP_NAME}</title>
</svelte:head>

{#if !$user.authenticated}
  <LoginDeviceFlow />
{:else}
  <main class="mx-auto w-full max-w-4xl px-4 py-8">
    <a href="/" class="text-sm text-fulcra-gray hover:text-fulcra-teal">← All clients</a>

    {#if loadError}
      <p class="mt-6 rounded-lg border border-red-400/40 bg-red-500/10 p-4 text-red-300">{loadError}</p>
    {:else if !brain}
      <p class="mt-6 text-fulcra-gray">Loading brain…</p>
    {:else}
      <h1 class="mt-3 text-3xl font-bold text-fulcra-white">{brain.name}</h1>

      <nav class="mt-6 flex flex-wrap gap-2 border-b border-fulcra-gray/20 pb-3" aria-label="Brain sections">
        {#each brain.sections as s (s.file)}
          <button
            class="rounded-lg px-3 py-1.5 text-sm transition {active === s.file
              ? 'bg-fulcra-teal/25 text-fulcra-teal'
              : 'text-fulcra-gray hover:bg-fulcra-gray/10 hover:text-fulcra-white'}"
            aria-current={active === s.file ? 'page' : undefined}
            data-file={s.file}
            onclick={() => selectTab(s.file)}>{s.label}</button
          >
        {/each}
      </nav>

      {#if notice}
        <p
          class="mt-4 rounded-lg p-3 text-sm {notice.ok
            ? 'border border-fulcra-teal/40 bg-fulcra-teal/10 text-fulcra-teal'
            : 'border border-red-400/40 bg-red-500/10 text-red-300'}"
          data-testid="notice"
        >
          {notice.text}
        </p>
      {/if}

      <div class="mt-4 flex items-center justify-between gap-2 text-sm text-fulcra-gray">
        <span data-testid="version-info">
          {#if current?.uploadedAt}Last saved {fmt(current.uploadedAt)}{/if}
        </span>
        {#if brain?.readOnly}
          <span class="rounded-lg bg-fulcra-gray/10 px-3 py-1.5" data-testid="read-only">Read-only</span>
        {:else if !editing}
          <div class="flex gap-2">
            <button class="rounded-lg px-3 py-1.5 hover:bg-fulcra-gray/10" data-testid="history-toggle" onclick={toggleHistory}
              >{showHistory ? 'Hide history' : 'History'}</button
            >
            <button
              class="rounded-lg bg-fulcra-teal/20 px-3 py-1.5 text-fulcra-teal hover:bg-fulcra-teal/40"
              data-testid="edit"
              onclick={startEdit}>Edit</button
            >
          </div>
        {/if}
      </div>

      {#if showHistory && !editing}
        <section class="mt-3 rounded-xl border border-fulcra-gray/20 bg-fulcra-black/40 p-4" data-testid="history">
          {#if versions === null}
            <p class="text-sm text-fulcra-gray">Loading versions…</p>
          {:else if versions.length === 0}
            <p class="text-sm text-fulcra-gray">No versions found.</p>
          {:else}
            <ul class="space-y-2 text-sm">
              {#each versions as v (v.id)}
                <li class="flex items-center justify-between gap-2" data-version={v.id} data-state={v.state}>
                  <span class="text-fulcra-white">
                    {fmt(v.uploadedAt)}
                    {#if v.state === 'uploaded'}<span class="ml-2 rounded bg-fulcra-teal/20 px-1.5 text-xs text-fulcra-teal">current</span>{/if}
                  </span>
                  {#if v.state !== 'uploaded'}
                    <button
                      class="rounded px-2 py-1 text-xs text-fulcra-teal hover:bg-fulcra-teal/15"
                      data-testid="restore"
                      onclick={() => (restoreTarget = v)}>Restore</button
                    >
                  {/if}
                </li>
              {/each}
            </ul>
          {/if}
          {#if restoreTarget}
            <div class="mt-4 rounded-lg border border-amber-400/50 bg-amber-500/10 p-4" data-testid="restore-confirm">
              <p class="text-fulcra-white">
                Restore {current.label} to the version from {fmt(restoreTarget.uploadedAt)}?
              </p>
              <p class="mt-1 text-sm text-fulcra-gray">The current version stays in History, so this can be undone.</p>
              <div class="mt-3 flex gap-2">
                <button
                  class="rounded-lg bg-amber-400/90 px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-50"
                  data-testid="restore-yes"
                  disabled={saving}
                  onclick={restore}>{saving ? 'Restoring…' : 'Yes, restore'}</button
                >
                <button class="rounded-lg px-3 py-1.5 text-sm text-fulcra-gray" onclick={() => (restoreTarget = null)}>Cancel</button>
              </div>
            </div>
          {/if}
        </section>
      {/if}

      {#if editing}
        <section class="mt-3" data-testid="editor">
          <textarea
            class="h-[28rem] w-full rounded-xl border border-fulcra-gray/30 bg-fulcra-black p-4 font-mono text-sm leading-relaxed text-fulcra-white"
            bind:value={draft}
            spellcheck="true"
            aria-label="Edit {current?.label}"
          ></textarea>
          {#if warnings.length}
            <div class="mt-3 rounded-lg border border-amber-400/50 bg-amber-500/10 p-4" data-testid="lint-warning">
              {#each warnings as w}<p class="text-sm text-amber-300">{w}</p>{/each}
              <div class="mt-3 flex gap-2">
                <button class="rounded-lg px-3 py-1.5 text-sm text-fulcra-white hover:bg-fulcra-gray/10" onclick={() => (warnings = [])}
                  >Fix it</button
                >
                <button
                  class="rounded-lg px-3 py-1.5 text-sm text-amber-300 hover:bg-amber-500/15"
                  data-testid="save-anyway"
                  disabled={saving}
                  onclick={() => save(true)}>Save anyway</button
                >
              </div>
            </div>
          {/if}
          <div class="mt-3 flex gap-2">
            <button
              class="rounded-lg bg-fulcra-teal/25 px-4 py-2 text-sm font-semibold text-fulcra-teal hover:bg-fulcra-teal/40 disabled:opacity-50"
              data-testid="save"
              disabled={saving || draft === (current?.content ?? '')}
              onclick={() => save(false)}>{saving ? 'Saving…' : 'Save new version'}</button
            >
            <button
              class="rounded-lg px-4 py-2 text-sm text-fulcra-gray hover:bg-fulcra-gray/10"
              disabled={saving}
              onclick={() => {
                editing = false;
                warnings = [];
              }}>Cancel</button
            >
          </div>
        </section>
      {:else}
        <article class="brain-md mt-6" data-section={current?.file}>
          {#if current?.content}
            {@html renderMarkdown(current.content)}
          {:else}
            <p class="text-fulcra-gray">This section is empty. Nothing at {current?.file} yet.</p>
          {/if}
        </article>
      {/if}
    {/if}
  </main>
{/if}

<style>
  .brain-md :global(h1) { font-size: 1.6rem; font-weight: 700; margin: 0 0 1rem; color: var(--color-fulcra-white, #fff); }
  .brain-md :global(h2) { font-size: 1.2rem; font-weight: 650; margin: 1.6rem 0 0.6rem; color: var(--color-fulcra-white, #fff); }
  .brain-md :global(h3) { font-size: 1.05rem; font-weight: 600; margin: 1.2rem 0 0.4rem; }
  .brain-md :global(p), .brain-md :global(li) { line-height: 1.6; color: #d4d4d8; }
  .brain-md :global(ul) { list-style: disc; padding-left: 1.25rem; margin: 0.4rem 0 0.8rem; }
  .brain-md :global(ol) { list-style: decimal; padding-left: 1.25rem; margin: 0.4rem 0 0.8rem; }
  .brain-md :global(li) { margin: 0.2rem 0; }
  .brain-md :global(a) { color: #5eead4; text-decoration: underline; word-break: break-all; }
  .brain-md :global(strong) { color: #fafafa; }
  .brain-md :global(code) { background: rgba(255,255,255,0.08); padding: 0.1rem 0.3rem; border-radius: 4px; font-size: 0.9em; }
  .brain-md :global(table) { width: 100%; border-collapse: collapse; margin: 0.8rem 0 1.2rem; font-size: 0.92rem; display: block; overflow-x: auto; }
  .brain-md :global(th), .brain-md :global(td) { border: 1px solid rgba(255,255,255,0.12); padding: 0.45rem 0.6rem; text-align: left; vertical-align: top; color: #d4d4d8; }
  .brain-md :global(th) { background: rgba(255,255,255,0.05); color: #fafafa; }
</style>
