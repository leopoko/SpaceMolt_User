<script lang="ts">
  import { actionQueueStore } from '$lib/stores/actionQueue.svelte';
</script>

<div class="aq-panel">
  <div class="aq-header">
    <span class="aq-title">ACTION QUEUE</span>
    <div class="aq-header-right">
      <span class="aq-count">{actionQueueStore.items.length}</span>
      {#if actionQueueStore.items.length > 0}
        <button class="aq-clear" onclick={() => actionQueueStore.clear()} title="全て削除">✕ ALL</button>
      {/if}
    </div>
  </div>

  <div class="aq-list">
    {#if actionQueueStore.currentAction}
      <div class="aq-item aq-current" class:aq-holding={actionQueueStore.holding}>
        <div class="aq-item-label">
          <span class="aq-current-badge">{actionQueueStore.holding ? 'JUMP' : 'NOW'}</span>
          <span class="aq-label">{actionQueueStore.currentAction}</span>
        </div>
      </div>
    {/if}

    {#if actionQueueStore.items.length === 0 && !actionQueueStore.currentAction}
      <div class="aq-empty">Queue is empty</div>
    {:else}
      {#each actionQueueStore.items as item, i (item.id)}
        <div class="aq-item" class:aq-next={i === 0}>
          <div class="aq-item-label">
            {#if i === 0}
              <span class="aq-next-badge">NEXT</span>
            {:else}
              <span class="aq-index">{i + 1}</span>
            {/if}
            <span class="aq-label" title={item.label}>{item.label}</span>
          </div>
          <div class="aq-controls">
            <button
              class="aq-btn"
              disabled={i === 0}
              onclick={() => actionQueueStore.moveUp(item.id)}
              title="上へ"
            >▲</button>
            <button
              class="aq-btn"
              disabled={i === actionQueueStore.items.length - 1}
              onclick={() => actionQueueStore.moveDown(item.id)}
              title="下へ"
            >▼</button>
            <button
              class="aq-btn aq-btn-del"
              onclick={() => actionQueueStore.remove(item.id)}
              title="削除"
            >✕</button>
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .aq-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: rgba(4, 8, 18, 0.9);
    border: 1px solid rgba(79, 195, 247, 0.12);
    border-radius: 4px;
    overflow: hidden;
  }

  .aq-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 8px;
    border-bottom: 1px solid rgba(79, 195, 247, 0.1);
    flex-shrink: 0;
  }

  .aq-title {
    font-size: 0.65rem;
    letter-spacing: 0.1em;
    color: #37474f;
    font-weight: 500;
  }

  .aq-header-right {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .aq-count {
    font-family: 'Roboto Mono', monospace;
    font-size: 0.65rem;
    color: #4fc3f7;
    background: rgba(79, 195, 247, 0.1);
    border-radius: 3px;
    padding: 0 5px;
    min-width: 18px;
    text-align: center;
  }

  .aq-clear {
    background: none;
    border: 1px solid rgba(239, 83, 80, 0.3);
    color: #546e7a;
    font-size: 0.58rem;
    padding: 1px 5px;
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .aq-clear:hover {
    color: #ef5350;
    border-color: rgba(239, 83, 80, 0.6);
  }

  .aq-list {
    flex: 1;
    overflow-y: auto;
    padding: 3px 4px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .aq-empty {
    font-size: 0.65rem;
    color: #263238;
    text-align: center;
    padding: 12px 0;
  }

  .aq-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 3px 5px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 3px;
    gap: 4px;
  }

  .aq-item.aq-next {
    background: rgba(79, 195, 247, 0.06);
    border-color: rgba(79, 195, 247, 0.25);
  }

  .aq-item.aq-current {
    background: rgba(255, 152, 0, 0.1);
    border-color: rgba(255, 152, 0, 0.4);
  }

  .aq-item.aq-holding {
    background: rgba(33, 150, 243, 0.1);
    border-color: rgba(33, 150, 243, 0.4);
  }

  .aq-item.aq-holding .aq-current-badge {
    color: #2196f3;
    background: rgba(33, 150, 243, 0.15);
    border-color: rgba(33, 150, 243, 0.4);
  }

  .aq-item.aq-holding .aq-label {
    color: #64b5f6;
  }

  .aq-item-label {
    display: flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
    flex: 1;
  }

  .aq-current-badge {
    font-size: 0.55rem;
    font-family: 'Roboto Mono', monospace;
    font-weight: 700;
    color: #ff9800;
    background: rgba(255, 152, 0, 0.15);
    border: 1px solid rgba(255, 152, 0, 0.4);
    border-radius: 2px;
    padding: 0 3px;
    flex-shrink: 0;
    animation: pulse 1.4s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .aq-next-badge {
    font-size: 0.55rem;
    font-family: 'Roboto Mono', monospace;
    font-weight: 700;
    color: #4fc3f7;
    background: rgba(79, 195, 247, 0.15);
    border: 1px solid rgba(79, 195, 247, 0.4);
    border-radius: 2px;
    padding: 0 3px;
    flex-shrink: 0;
    animation: blink 1.2s ease-in-out infinite;
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .aq-index {
    font-size: 0.6rem;
    font-family: 'Roboto Mono', monospace;
    color: #37474f;
    flex-shrink: 0;
    width: 14px;
    text-align: right;
  }

  .aq-label {
    font-size: 0.68rem;
    color: #78909c;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .aq-item.aq-next .aq-label {
    color: #90caf9;
  }

  .aq-item.aq-current .aq-label {
    color: #ffb74d;
  }

  .aq-controls {
    display: flex;
    align-items: center;
    gap: 1px;
    flex-shrink: 0;
  }

  .aq-btn {
    background: none;
    border: none;
    color: #37474f;
    font-size: 0.6rem;
    padding: 1px 3px;
    cursor: pointer;
    border-radius: 2px;
    line-height: 1;
    transition: color 0.1s;
  }

  .aq-btn:hover:not(:disabled) { color: #90caf9; }
  .aq-btn:disabled { opacity: 0.2; cursor: default; }
  .aq-btn-del:hover:not(:disabled) { color: #ef5350; }
</style>
