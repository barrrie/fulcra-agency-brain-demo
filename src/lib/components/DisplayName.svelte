<script>
  import { user } from '$lib/user';
  import { MAX_DISPLAY_NAME, fulcraName, resolveName, displayNames } from '$lib/display-name.js';

  const userId = $derived($user.auth0UserInfo?.['fulcradynamics.com/userid'] ?? null);
  const accountName = $derived(fulcraName($user.auth0UserInfo, $user.fulcraUserInfo));

  $effect(() => displayNames.load(userId));
  const displayName = $derived((userId && $displayNames[userId]) || '');
  let editing = $state(false);
  let draft = $state('');
  let problem = $state(/** @type {string | null} */ (null));

  const shown = $derived(resolveName(displayName, $user.auth0UserInfo, $user.fulcraUserInfo));

  function edit() {
    draft = displayName;
    problem = null;
    editing = true;
  }

  /** @param {SubmitEvent} e */
  function save(e) {
    e.preventDefault();
    try {
      displayNames.save(userId, draft);
      editing = false;
    } catch (err) {
      problem = err instanceof Error ? err.message : String(err);
    }
  }
</script>

{#if editing}
  <form
    class="flex w-80 max-w-full flex-wrap items-center justify-end gap-2 text-right text-sm"
    onsubmit={save}
    data-testid="display-name-form"
  >
    <label class="text-fulcra-gray">
      <span class="sr-only">Display name</span>
      <input
        class="w-44 rounded-lg bg-fulcra-black px-3 py-1.5 text-fulcra-white"
        bind:value={draft}
        placeholder={accountName ?? 'Your name'}
        maxlength={MAX_DISPLAY_NAME}
        autocomplete="nickname"
        name="display-name"
      />
    </label>
    <button
      class="rounded-lg bg-fulcra-teal/20 px-3 py-1.5 text-fulcra-teal hover:bg-fulcra-teal/40"
      >Save</button
    >
    <button
      type="button"
      class="px-1 text-fulcra-gray underline hover:text-fulcra-teal"
      onclick={() => (editing = false)}>Cancel</button
    >
    <span class="w-full text-xs text-fulcra-gray">
      Leave blank to use your Fulcra name{accountName ? ` (${accountName})` : ''}. Saved in this
      browser only.
    </span>
    {#if problem}<span class="w-full text-xs text-red-300">{problem}</span>{/if}
  </form>
{:else}
  <p class="text-sm text-fulcra-gray" data-testid="display-name">
    Signed in as <span class="font-medium text-fulcra-white">{shown}</span>
    <button class="ml-1 underline hover:text-fulcra-teal" onclick={edit}>change</button>
  </p>
{/if}
