<script lang="ts">
  import ActiveShip from './ship/ActiveShip.svelte';
  import MyFleet from './ship/MyFleet.svelte';
  import Shipyard from './ship/Shipyard.svelte';

  interface SubTab {
    id: string;
    label: string;
    icon: string;
  }

  const subTabs: SubTab[] = [
    { id: 'active', label: 'Active Ship', icon: 'rocket_launch' },
    { id: 'fleet',  label: 'My Fleet',    icon: 'sailing' },
    { id: 'yard',   label: 'Shipyard',    icon: 'store' },
  ];

  let activeSubTab = $state<string>('active');
</script>

<div class="ship-subtabs">
  {#each subTabs as st}
    <button
      class="subtab"
      class:active={activeSubTab === st.id}
      onclick={() => activeSubTab = st.id}
    >
      <span class="material-icons subtab-icon">{st.icon}</span>
      <span class="subtab-label">{st.label}</span>
    </button>
  {/each}
</div>

<div class="ship-content">
  {#if activeSubTab === 'active'}
    <ActiveShip />
  {:else if activeSubTab === 'fleet'}
    <MyFleet />
  {:else if activeSubTab === 'yard'}
    <Shipyard />
  {/if}
</div>

<style>
  .ship-subtabs {
    display: flex;
    gap: 2px;
    margin-bottom: 12px;
    border-bottom: 1px solid rgba(79,195,247,0.12);
    padding-bottom: 0;
    overflow-x: auto;
  }

  .subtab {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 8px 14px;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: #546e7a;
    font-size: 0.76rem;
    font-family: inherit;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
    white-space: nowrap;
  }

  .subtab:hover {
    color: #90a4ae;
  }

  .subtab.active {
    color: #4fc3f7;
    border-bottom-color: #4fc3f7;
  }

  .subtab-icon {
    font-size: 16px;
  }

  .subtab-label {
    font-size: 0.76rem;
  }

  .ship-content {
    min-height: 200px;
  }
</style>
