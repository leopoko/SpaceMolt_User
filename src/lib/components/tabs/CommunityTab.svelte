<script lang="ts">
  import PrivateMessageSubTab from './community/PrivateMessageSubTab.svelte';
  import FactionSubTab from './community/FactionSubTab.svelte';
  import ThreadSubTab from './community/ThreadSubTab.svelte';
  import { tradeStore } from '$lib/stores/trade.svelte';

  type SubTab = 'pm' | 'faction' | 'thread';
  let activeSubTab = $state<SubTab>('pm');

  const subTabs: Array<{ id: SubTab; label: string; icon: string }> = [
    { id: 'pm',      label: 'Private Message', icon: 'mail' },
    { id: 'faction',  label: 'Faction',         icon: 'shield' },
    { id: 'thread',   label: 'Thread',          icon: 'forum' },
  ];
</script>

<div class="community-tab">
  <!-- Sub-tab bar -->
  <div class="sub-tab-bar">
    {#each subTabs as tab (tab.id)}
      <button
        class="sub-tab-btn"
        class:active={activeSubTab === tab.id}
        onclick={() => activeSubTab = tab.id}
      >
        <span class="material-icons" style="font-size:15px">{tab.icon}</span>
        <span class="sub-tab-label">{tab.label}</span>
        {#if tab.id === 'pm' && tradeStore.incomingCount > 0}
          <span class="trade-count-badge">{tradeStore.incomingCount}</span>
        {/if}
      </button>
    {/each}
  </div>

  <!-- Sub-tab content -->
  <div class="sub-tab-content">
    {#if activeSubTab === 'pm'}
      <PrivateMessageSubTab />
    {:else if activeSubTab === 'faction'}
      <FactionSubTab />
    {:else if activeSubTab === 'thread'}
      <ThreadSubTab />
    {/if}
  </div>
</div>

<style>
  .community-tab {
    display: flex;
    flex-direction: column;
    gap: 0;
    height: 100%;
  }

  .sub-tab-bar {
    display: flex;
    gap: 2px;
    padding: 0 0 8px 0;
    border-bottom: 1px solid rgba(79, 195, 247, 0.1);
    margin-bottom: 10px;
    flex-shrink: 0;
    flex-wrap: wrap;
  }

  .sub-tab-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(79, 195, 247, 0.1);
    color: #546e7a;
    font-size: 0.72rem;
    padding: 5px 12px;
    border-radius: 4px 4px 0 0;
    cursor: pointer;
    transition: all 0.15s;
  }

  .sub-tab-btn:hover {
    color: #90caf9;
    background: rgba(79, 195, 247, 0.06);
    border-color: rgba(79, 195, 247, 0.2);
  }

  .sub-tab-btn.active {
    color: #4fc3f7;
    background: rgba(79, 195, 247, 0.1);
    border-color: rgba(79, 195, 247, 0.35);
    border-bottom-color: transparent;
  }

  .sub-tab-label {
    white-space: nowrap;
  }

  .trade-count-badge {
    background: #ff9800;
    color: #000;
    font-size: 0.58rem;
    font-weight: 700;
    min-width: 14px;
    height: 14px;
    border-radius: 7px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 3px;
    line-height: 1;
  }

  .sub-tab-content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
</style>
