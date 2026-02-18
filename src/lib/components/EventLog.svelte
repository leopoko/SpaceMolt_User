<script lang="ts">
  import { eventsStore } from '$lib/stores/events.svelte';
  import type { EventType } from '$lib/types/game';

  const filters: Array<{ label: string; value: EventType | 'all' }> = [
    { label: 'All',    value: 'all' },
    { label: 'Combat', value: 'combat' },
    { label: 'Trade',  value: 'trade' },
    { label: 'Nav',    value: 'nav' },
    { label: 'System', value: 'system' },
    { label: 'Error',  value: 'error' }
  ];

  function formatTime(ts: number): string {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
  }
</script>

<div class="event-log">
  <div class="log-header">
    <span class="log-title">EVENT LOG</span>
    <div class="filters">
      {#each filters as f}
        <button
          class="filter-btn"
          class:active={eventsStore.filter === f.value}
          onclick={() => eventsStore.setFilter(f.value)}
        >
          {f.label}
        </button>
      {/each}
    </div>
  </div>

  <div class="log-entries">
    {#each eventsStore.filtered as entry (entry.id)}
      <div class="entry event-{entry.type}">
        <span class="ts">{formatTime(entry.timestamp)}</span>
        <span class="msg">{entry.message}</span>
      </div>
    {:else}
      <div class="empty">No events</div>
    {/each}
  </div>
</div>

<style>
  .event-log {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: rgba(4, 8, 18, 0.9);
    border: 1px solid rgba(79, 195, 247, 0.12);
    border-radius: 4px;
    overflow: hidden;
  }

  .log-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 8px;
    border-bottom: 1px solid rgba(79, 195, 247, 0.1);
    flex-shrink: 0;
  }

  .log-title {
    font-size: 0.65rem;
    letter-spacing: 0.1em;
    color: #37474f;
    font-weight: 500;
  }

  .filters {
    display: flex;
    gap: 2px;
  }

  .filter-btn {
    background: none;
    border: 1px solid rgba(255,255,255,0.06);
    color: #4a6070;
    font-size: 0.6rem;
    padding: 1px 6px;
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .filter-btn:hover { color: #90caf9; border-color: rgba(144,202,249,0.3); }
  .filter-btn.active { color: #4fc3f7; border-color: rgba(79,195,247,0.5); background: rgba(79,195,247,0.08); }

  .log-entries {
    flex: 1;
    overflow-y: auto;
    padding: 4px 6px;
  }

  .entry {
    display: flex;
    gap: 6px;
    font-size: 0.68rem;
    line-height: 1.5;
    padding: 1px 0;
    border-bottom: 1px solid rgba(255,255,255,0.03);
  }

  .ts {
    font-family: 'Roboto Mono', monospace;
    color: #2e4050;
    flex-shrink: 0;
    font-size: 0.63rem;
  }

  .msg { color: #7a9ab8; }

  /* event type colours */
  .event-combat .msg { color: #ff7043; }
  .event-trade  .msg { color: #66bb6a; }
  .event-nav    .msg { color: #42a5f5; }
  .event-system .msg { color: #ab47bc; }
  .event-error  .msg { color: #ef5350; }
  .event-info   .msg { color: #607d8b; }

  .empty {
    font-size: 0.68rem;
    color: #263238;
    padding: 8px;
    text-align: center;
  }
</style>
