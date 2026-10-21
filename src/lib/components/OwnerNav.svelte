<script lang="ts">
  import { user } from '$lib/user';
  import { displayNames, resolveName } from '$lib/display-name.js';

  // The owner's id lives server-side only; ask the backend whether we're the
  // owner (re-checking whenever auth state changes) instead of comparing ids.
  let isOwner = $state(false);

  const userId = $derived($user.auth0UserInfo?.['fulcradynamics.com/userid'] ?? null);
  $effect(() => displayNames.load(userId));
  const shown = $derived(
    resolveName(userId ? $displayNames[userId] : '', $user.auth0UserInfo, $user.fulcraUserInfo)
  );

  async function checkOwner() {
    try {
      const res = await fetch('/api/harness/owner');
      isOwner = res.ok && (await res.json()).isOwner === true;
    } catch (e) {
      isOwner = false;
    }
  }

  $effect(() => {
    if ($user.authenticated) {
      checkOwner();
    } else {
      isOwner = false;
    }
  });
</script>

{#if isOwner}
  <nav class="bg-fulcra-black/50 border-b border-fulcra-gray/20">
    <div class="max-w-7xl mx-auto px-4 py-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-4">
          <a
            href="/"
            class="text-fulcra-teal hover:text-fulcra-teal/80 font-medium"
          >
            Home
          </a>
          <a
            href="/map"
            class="text-fulcra-teal hover:text-fulcra-teal/80 font-medium"
          >
            Map
          </a>
          <a
            href="/access"
            class="text-fulcra-teal hover:text-fulcra-teal/80 font-medium"
          >
            Access
          </a>
          <a
            href="/harness"
            class="text-fulcra-teal hover:text-fulcra-teal/80 font-medium"
          >
            Harness Dashboard
          </a>
        </div>
        <div class="text-fulcra-gray text-sm" data-testid="nav-name">
          <span class="text-fulcra-white">{shown}</span> · Owner
        </div>
      </div>
    </div>
  </nav>
{/if}

<style>
  nav {
    position: sticky;
    top: 0;
    z-index: 50;
  }
</style>
