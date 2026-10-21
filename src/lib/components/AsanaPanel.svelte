<script>
  import { summarizeAsana, calendarMonth, isoDay } from '$lib/asana.js';

  let { data } = $props();

  const today = isoDay(new Date());
  const summary = $derived(summarizeAsana(data, today));

  let view = $state('list'); // 'list' | 'calendar'
  let cursor = $state(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  const weeks = $derived(calendarMonth(cursor.getFullYear(), cursor.getMonth(), summary.tasks));
  const monthLabel = $derived(
    cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  );
  const undated = $derived(summary.tasks.filter((t) => !t.due));

  const groups = $derived([
    {
      key: 'overdue',
      label: 'Overdue',
      tasks: summary.tasks.filter((t) => t.status === 'overdue')
    },
    {
      key: 'upcoming',
      label: 'Coming up',
      tasks: summary.tasks.filter((t) => t.status === 'upcoming')
    },
    { key: 'undated', label: 'No due date', tasks: undated },
    {
      key: 'done',
      label: 'Done',
      tasks: summary.tasks.filter((t) => t.status === 'done').reverse()
    }
  ]);

  const shortDate = (d) =>
    new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const fmt = (t) => (t ? new Date(t).toLocaleString() : '');

  const CHIP = {
    overdue: 'bg-red-500/15 text-red-300',
    upcoming: 'bg-fulcra-teal/20 text-fulcra-teal',
    undated: 'bg-fulcra-gray/15 text-fulcra-gray',
    done: 'bg-fulcra-gray/10 text-fulcra-gray line-through'
  };

  function shiftMonth(n) {
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + n, 1);
  }
</script>

{#if !data}
  <p class="mt-6 text-fulcra-gray" data-testid="asana-empty">
    Nothing from Asana yet. When the sync merges this client's Asana project, tasks land in
    <code>asana.json</code> in this brain's folder and show up here.
  </p>
{:else}
  <section class="mt-6" data-testid="asana">
    <p class="text-sm text-fulcra-gray">
      From Asana{#if summary.project}: <span class="text-fulcra-white">{summary.project}</span>{/if}
      {#if summary.mergedAt}· merged into Fulcra {fmt(summary.mergedAt)}{/if}
    </p>

    <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div class="rounded-xl border border-fulcra-gray/20 p-4" data-testid="asana-merged">
        <p class="text-2xl font-bold text-fulcra-white">{summary.counts.merged}</p>
        <p class="text-sm text-fulcra-gray">Merged into Fulcra</p>
      </div>
      <div
        class="rounded-xl border border-fulcra-teal/40 bg-fulcra-teal/5 p-4"
        data-testid="asana-upcoming"
      >
        <p class="text-2xl font-bold text-fulcra-teal">{summary.counts.upcoming}</p>
        <p class="text-sm text-fulcra-gray">Coming up</p>
      </div>
      <div class="rounded-xl border border-red-400/30 p-4" data-testid="asana-overdue">
        <p class="text-2xl font-bold text-red-300">{summary.counts.overdue}</p>
        <p class="text-sm text-fulcra-gray">Overdue</p>
      </div>
      <div class="rounded-xl border border-amber-400/30 p-4" data-testid="asana-left-out">
        <p class="text-2xl font-bold text-amber-300">{summary.counts.leftOut}</p>
        <p class="text-sm text-fulcra-gray">Left out of the merge</p>
      </div>
    </div>

    {#if summary.leftOutReasons.length}
      <p class="mt-3 text-sm text-fulcra-gray">
        Left out:
        {#each summary.leftOutReasons as r, i (r.reason)}{i ? ' · ' : ''}{r.reason} ({r.n}){/each}
      </p>
    {/if}

    <div class="mt-6 flex items-center justify-between gap-2">
      <div class="flex gap-1 rounded-lg bg-fulcra-gray/10 p-1 text-sm" role="tablist">
        {#each [['list', 'List'], ['calendar', 'Calendar']] as [key, label] (key)}
          <button
            class="rounded-md px-3 py-1 {view === key
              ? 'bg-fulcra-teal/25 text-fulcra-teal'
              : 'text-fulcra-gray hover:text-fulcra-white'}"
            role="tab"
            aria-selected={view === key}
            data-testid="asana-view-{key}"
            onclick={() => (view = key)}>{label}</button
          >
        {/each}
      </div>
      {#if view === 'calendar'}
        <div class="flex items-center gap-2 text-sm">
          <button
            class="rounded px-2 py-1 text-fulcra-gray hover:bg-fulcra-gray/10"
            aria-label="Previous month"
            onclick={() => shiftMonth(-1)}>←</button
          >
          <span class="min-w-32 text-center text-fulcra-white" data-testid="asana-month"
            >{monthLabel}</span
          >
          <button
            class="rounded px-2 py-1 text-fulcra-gray hover:bg-fulcra-gray/10"
            aria-label="Next month"
            onclick={() => shiftMonth(1)}>→</button
          >
        </div>
      {/if}
    </div>

    {#if view === 'list'}
      {#each groups.filter((g) => g.tasks.length) as g (g.key)}
        <h3 class="mt-5 text-sm font-semibold tracking-wide text-fulcra-gray uppercase">
          {g.label} ({g.tasks.length})
        </h3>
        <ul
          class="mt-2 divide-y divide-fulcra-gray/10 rounded-xl border border-fulcra-gray/20"
          data-group={g.key}
        >
          {#each g.tasks as t (t.gid)}
            <li class="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span class={t.completed ? 'text-fulcra-gray line-through' : 'text-fulcra-white'}>
                <!-- eslint-disable svelte/no-navigation-without-resolve -- external Asana link -->
                {#if t.url}<a
                    href={t.url}
                    target="_blank"
                    rel="noopener"
                    class="hover:text-fulcra-teal">{t.name}</a
                  >{:else}{t.name}{/if}
                <!-- eslint-enable svelte/no-navigation-without-resolve -->
                {#if t.section}<span class="ml-2 text-xs text-fulcra-gray">{t.section}</span>{/if}
              </span>
              <span class="flex shrink-0 items-center gap-2 text-xs text-fulcra-gray">
                {#if t.assignee}<span>{t.assignee}</span>{/if}
                {#if t.due}<span class="rounded px-1.5 py-0.5 {CHIP[t.status]}"
                    >{shortDate(t.due)}</span
                  >{/if}
              </span>
            </li>
          {/each}
        </ul>
      {/each}
    {:else}
      <div class="mt-4 overflow-x-auto" data-testid="asana-calendar">
        <div
          class="grid min-w-[42rem] grid-cols-7 gap-px overflow-hidden rounded-xl border border-fulcra-gray/20 bg-fulcra-gray/20 text-xs"
        >
          {#each ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as d (d)}
            <div class="bg-fulcra-black px-2 py-1.5 text-fulcra-gray">{d}</div>
          {/each}
          {#each weeks.flat() as cell (cell.day)}
            <div
              class="min-h-24 bg-fulcra-black p-1.5 {cell.inMonth ? '' : 'opacity-40'}"
              data-day={cell.day}
            >
              <div
                class="mb-1 text-right {cell.day === today
                  ? 'font-bold text-fulcra-teal'
                  : 'text-fulcra-gray'}"
              >
                {Number(cell.day.slice(8))}
              </div>
              {#each cell.tasks as t (t.gid)}
                <div
                  class="mb-1 line-clamp-2 rounded px-1 py-0.5 leading-snug {CHIP[t.status]}"
                  title="{t.name}{t.assignee ? ` · ${t.assignee}` : ''}"
                >
                  {t.name}
                </div>
              {/each}
            </div>
          {/each}
        </div>
      </div>
      {#if undated.length}
        <p class="mt-3 text-sm text-fulcra-gray">
          Not on the calendar (no due date): {undated.map((t) => t.name).join(' · ')}
        </p>
      {/if}
    {/if}
  </section>
{/if}
