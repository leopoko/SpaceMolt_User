<script lang="ts">
  import PlayerProfile from './info/PlayerProfile.svelte';
  import ShipCatalog from './info/ShipCatalog.svelte';
  import ItemCatalog from './info/ItemCatalog.svelte';
  import SkillCatalog from './info/SkillCatalog.svelte';
  import RecipeCatalog from './info/RecipeCatalog.svelte';

  interface SubTab {
    id: string;
    label: string;
    icon: string;
  }

  const subTabs: SubTab[] = [
    { id: 'profile', label: 'Player', icon: 'person' },
    { id: 'ships',   label: 'Ships', icon: 'rocket' },
    { id: 'items',   label: 'Items', icon: 'inventory_2' },
    { id: 'skills',  label: 'Skills', icon: 'psychology' },
    { id: 'recipes', label: 'Recipes', icon: 'precision_manufacturing' },
  ];

  let activeSubTab = $state<string>('profile');
</script>

<div class="info-subtabs">
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

<div class="info-content">
  {#if activeSubTab === 'profile'}
    <PlayerProfile />
  {:else if activeSubTab === 'ships'}
    <ShipCatalog />
  {:else if activeSubTab === 'items'}
    <ItemCatalog />
  {:else if activeSubTab === 'skills'}
    <SkillCatalog />
  {:else if activeSubTab === 'recipes'}
    <RecipeCatalog />
  {/if}
</div>

<style>
  .info-subtabs {
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

  .info-content {
    min-height: 200px;
  }
</style>
