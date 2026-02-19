<script lang="ts">
  import CurrentSystemSubTab from './nav/CurrentSystemSubTab.svelte';
  import MemoSubTab from './nav/MemoSubTab.svelte';

  let activeSubTab = $state<'current' | 'memo'>('current');
</script>

<div class="nav-container">
  <div class="sub-tab-bar">
    <button
      class="sub-tab"
      class:active={activeSubTab === 'current'}
      onclick={() => (activeSubTab = 'current')}
    >
      <span class="material-icons sub-tab-icon">explore</span>
      Current
    </button>
    <button
      class="sub-tab"
      class:active={activeSubTab === 'memo'}
      onclick={() => (activeSubTab = 'memo')}
    >
      <span class="material-icons sub-tab-icon">folder_open</span>
      Memo
    </button>
  </div>

  <div class="sub-tab-content">
    {#if activeSubTab === 'current'}
      <CurrentSystemSubTab />
    {:else}
      <MemoSubTab />
    {/if}
  </div>
</div>

<style>
  .nav-container {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .sub-tab-bar {
    display: flex;
    gap: 2px;
    padding: 0 8px;
    margin-bottom: 8px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }

  .sub-tab {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 8px 16px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: #546e7a;
    font-size: 0.78rem;
    cursor: pointer;
    transition: all 0.15s;
    position: relative;
  }

  .sub-tab:hover {
    color: #78909c;
    background: rgba(255,255,255,0.02);
  }

  .sub-tab.active {
    color: #4fc3f7;
    border-bottom-color: #4fc3f7;
  }

  .sub-tab-icon {
    font-size: 16px;
  }

  .sub-tab-content {
    flex: 1;
    overflow-y: auto;
  }
</style>
