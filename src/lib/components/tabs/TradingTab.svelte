<script lang="ts">
  import MarketSubTab from './trading/MarketSubTab.svelte';
  import MissionSubTab from './trading/MissionSubTab.svelte';

  type SubTab = 'market' | 'mission';
  let activeSubTab = $state<SubTab>('market');
</script>

<div class="trading-container">
  <div class="sub-tab-bar">
    <button
      class="sub-tab-btn"
      class:active={activeSubTab === 'market'}
      onclick={() => (activeSubTab = 'market')}
    >
      <span class="material-icons" style="font-size:14px">storefront</span>
      Market
    </button>
    <button
      class="sub-tab-btn"
      class:active={activeSubTab === 'mission'}
      onclick={() => (activeSubTab = 'mission')}
    >
      <span class="material-icons" style="font-size:14px">assignment</span>
      Mission
    </button>
  </div>

  <div class="sub-tab-content">
    {#if activeSubTab === 'market'}
      <MarketSubTab />
    {:else if activeSubTab === 'mission'}
      <MissionSubTab />
    {/if}
  </div>
</div>

<style>
  .trading-container {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .sub-tab-bar {
    display: flex;
    gap: 2px;
    margin-bottom: 12px;
    border-bottom: 1px solid rgba(79, 195, 247, 0.12);
    padding-bottom: 0;
  }

  .sub-tab-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: #546e7a;
    font-size: 0.78rem;
    font-family: 'Roboto', sans-serif;
    padding: 8px 16px;
    cursor: pointer;
    transition: all 0.15s;
    position: relative;
    bottom: -1px;
  }

  .sub-tab-btn:hover {
    color: #90a4ae;
    background: rgba(79, 195, 247, 0.04);
  }

  .sub-tab-btn.active {
    color: #4fc3f7;
    border-bottom-color: #4fc3f7;
  }

  .sub-tab-content {
    min-height: 0;
  }
</style>
