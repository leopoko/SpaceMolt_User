<script lang="ts">
  import { loopStore } from '$lib/stores/loop.svelte';
  import StationSubTab from './base/StationSubTab.svelte';
  import LoopSubTab from './base/LoopSubTab.svelte';

  let activeSubTab = $state<'station' | 'loop'>('station');
</script>

<div class="base-container">
  <div class="sub-tab-bar">
    <button
      class="sub-tab"
      class:active={activeSubTab === 'station'}
      onclick={() => (activeSubTab = 'station')}
    >
      <span class="material-icons sub-tab-icon">apartment</span>
      Station
    </button>
    <button
      class="sub-tab"
      class:active={activeSubTab === 'loop'}
      onclick={() => (activeSubTab = 'loop')}
    >
      <span class="material-icons sub-tab-icon">repeat</span>
      Loop
      {#if loopStore.isRecording}
        <span class="rec-indicator"></span>
      {:else if loopStore.isPlaying}
        <span class="play-indicator"></span>
      {/if}
    </button>
  </div>

  <div class="sub-tab-content">
    {#if activeSubTab === 'station'}
      <StationSubTab />
    {:else}
      <LoopSubTab />
    {/if}
  </div>
</div>

<style>
  .base-container {
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

  .rec-indicator {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #f44336;
    animation: blink 1s ease-in-out infinite;
  }

  .play-indicator {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #4caf50;
    animation: blink 1.5s ease-in-out infinite;
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  .sub-tab-content {
    flex: 1;
    overflow-y: auto;
  }
</style>
