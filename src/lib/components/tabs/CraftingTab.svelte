<script lang="ts">
  import Button, { Label } from '@smui/button';
  import Card, { Content } from '@smui/card';
  import Textfield from '@smui/textfield';
  import LinearProgress from '@smui/linear-progress';
  import { craftingStore } from '$lib/stores/crafting.svelte';
  import { shipStore } from '$lib/stores/ship.svelte';
  import { baseStore } from '$lib/stores/base.svelte';
  import { playerStore } from '$lib/stores/player.svelte';
  import { ws } from '$lib/services/websocket';
  import type { Recipe } from '$lib/types/game';

  type BrowseMode = 'recipes' | 'cargo' | 'facilities';

  let browseMode = $state<BrowseMode>('recipes');
  let searchText = $state('');
  let selectedCargoItemId = $state<string | null>(null);
  let selectedFacility = $state<string | null>(null);
  let showSuggestions = $state(false);
  let blurTimeout: ReturnType<typeof setTimeout>;

  const cargo = $derived(shipStore.cargo);
  const facilities = $derived(baseStore.currentBase?.facilities ?? []);
  const allRecipes = $derived(craftingStore.recipes);

  // Autocomplete suggestions (recipe search mode only)
  const suggestions = $derived.by(() => {
    if (browseMode !== 'recipes' || searchText.length === 0) return [];
    const q = searchText.toLowerCase();
    return allRecipes.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.output.item_name.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q)
    ).slice(0, 8);
  });

  // Filtered recipes based on browse mode
  const filteredRecipes = $derived.by(() => {
    if (browseMode === 'cargo' && selectedCargoItemId) {
      return allRecipes.filter(r =>
        r.inputs.some(i => i.item_id === selectedCargoItemId)
      );
    }
    if (browseMode === 'facilities' && selectedFacility) {
      const sel = selectedFacility.toLowerCase();
      return allRecipes.filter(r =>
        r.station_types.some(st => st.toLowerCase() === sel)
      );
    }
    if (browseMode === 'recipes') {
      if (searchText) {
        const q = searchText.toLowerCase();
        return allRecipes.filter(r =>
          r.name.toLowerCase().includes(q) ||
          r.output.item_name.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q)
        );
      }
      return allRecipes;
    }
    return [];
  });

  // Show recipe list in cargo/facilities mode?
  const showRecipeList = $derived(
    browseMode === 'recipes' ||
    (browseMode === 'cargo' && selectedCargoItemId !== null) ||
    (browseMode === 'facilities' && selectedFacility !== null)
  );

  function hasMaterial(itemId: string, required: number): boolean {
    const found = shipStore.cargo.find(c => c.item_id === itemId);
    return (found?.quantity ?? 0) >= required;
  }

  function canCraft(recipe: Recipe): boolean {
    return recipe.inputs.every(i => hasMaterial(i.item_id, i.quantity * craftingStore.craftQuantity));
  }

  function doCraft() {
    if (!craftingStore.selectedRecipe) return;
    ws.craft(craftingStore.selectedRecipe.id, craftingStore.craftQuantity);
  }

  function loadRecipes() {
    ws.getRecipes();
  }

  function onSearchFocus() {
    clearTimeout(blurTimeout);
    showSuggestions = true;
  }

  function onSearchBlur() {
    blurTimeout = setTimeout(() => { showSuggestions = false; }, 150);
  }

  function selectSuggestion(recipe: Recipe) {
    clearTimeout(blurTimeout);
    craftingStore.selectRecipe(recipe);
    searchText = recipe.name;
    showSuggestions = false;
  }

  function selectCargoItem(itemId: string) {
    selectedCargoItemId = selectedCargoItemId === itemId ? null : itemId;
    craftingStore.selectRecipe(null);
  }

  function selectFacility(facility: string) {
    selectedFacility = selectedFacility === facility ? null : facility;
    craftingStore.selectRecipe(null);
  }

  function switchMode(mode: BrowseMode) {
    browseMode = mode;
    searchText = '';
    selectedCargoItemId = null;
    selectedFacility = null;
    showSuggestions = false;
  }

  function getItemName(itemId: string): string {
    const cargoItem = cargo.find(c => c.item_id === itemId);
    if (cargoItem?.name) return cargoItem.name;
    // Try to find from recipe inputs/outputs
    for (const r of allRecipes) {
      for (const inp of r.inputs) {
        if (inp.item_id === itemId && inp.item_name) return inp.item_name;
      }
      if (r.output.item_id === itemId && r.output.item_name) return r.output.item_name;
    }
    return itemId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  function formatFacility(f: string): string {
    return f.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  function recipeCountForItem(itemId: string): number {
    return allRecipes.filter(r => r.inputs.some(i => i.item_id === itemId)).length;
  }

  function recipeCountForFacility(facility: string): number {
    const f = facility.toLowerCase();
    return allRecipes.filter(r => r.station_types.some(st => st.toLowerCase() === f)).length;
  }
</script>

<!-- Sub-tab bar -->
<div class="craft-subtabs">
  <button class="subtab" class:active={browseMode === 'recipes'} onclick={() => switchMode('recipes')}>
    <span class="material-icons subtab-icon">precision_manufacturing</span>
    <span class="subtab-label">Recipes</span>
  </button>
  <button class="subtab" class:active={browseMode === 'cargo'} onclick={() => switchMode('cargo')}>
    <span class="material-icons subtab-icon">inventory_2</span>
    <span class="subtab-label">Cargo</span>
    {#if cargo.length > 0}
      <span class="badge">{cargo.length}</span>
    {/if}
  </button>
  <button class="subtab" class:active={browseMode === 'facilities'} onclick={() => switchMode('facilities')}>
    <span class="material-icons subtab-icon">factory</span>
    <span class="subtab-label">Facilities</span>
    {#if facilities.length > 0}
      <span class="badge">{facilities.length}</span>
    {/if}
  </button>
</div>

<div class="two-col">
  <!-- Left: Browser -->
  <Card class="space-card">
    <Content>
      <div class="section-head">
        <span class="tab-section-title">
          {#if browseMode === 'recipes'}Recipes
          {:else if browseMode === 'cargo'}Cargo Items
          {:else}Station Facilities
          {/if}
        </span>
        <button class="icon-btn" onclick={loadRecipes} title="Refresh recipes">↻</button>
      </div>

      {#if browseMode === 'recipes'}
        <!-- Autocomplete search -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="search-wrapper"
          onfocusin={onSearchFocus}
          onfocusout={onSearchBlur}
        >
          <Textfield
            bind:value={searchText}
            label="Search recipes..."
            variant="outlined"
            style="width:100%"
          />
          {#if showSuggestions && suggestions.length > 0}
            <div class="suggestions-dropdown">
              {#each suggestions as s}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="suggestion-item"
                  onmousedown={(e) => { e.preventDefault(); selectSuggestion(s); }}
                >
                  <span class="suggestion-name">{s.name}</span>
                  <span class="suggestion-output mono">→ {s.output.item_name}</span>
                </div>
              {/each}
            </div>
          {/if}
        </div>

      {:else if browseMode === 'cargo'}
        {#if cargo.length > 0}
          <div class="item-chips">
            {#each cargo as item}
              <button
                class="item-chip"
                class:selected={selectedCargoItemId === item.item_id}
                onclick={() => selectCargoItem(item.item_id)}
              >
                <span class="chip-name">{getItemName(item.item_id)}</span>
                <span class="chip-qty mono">×{item.quantity}</span>
                {#if allRecipes.length > 0}
                  {@const count = recipeCountForItem(item.item_id)}
                  {#if count > 0}
                    <span class="chip-recipe-count">{count}</span>
                  {/if}
                {/if}
              </button>
            {/each}
          </div>
        {:else}
          <p class="empty-hint">Cargo is empty</p>
        {/if}

        {#if selectedCargoItemId}
          <p class="filter-label">
            Recipes using <strong>{getItemName(selectedCargoItemId)}</strong>
          </p>
        {/if}

      {:else if browseMode === 'facilities'}
        {#if playerStore.isDocked}
          {#if facilities.length > 0}
            <div class="item-chips">
              {#each facilities as f}
                <button
                  class="item-chip facility"
                  class:selected={selectedFacility === f}
                  onclick={() => selectFacility(f)}
                >
                  <span class="material-icons chip-icon">factory</span>
                  <span class="chip-name">{formatFacility(f)}</span>
                  {#if allRecipes.length > 0}
                    {@const count = recipeCountForFacility(f)}
                    {#if count > 0}
                      <span class="chip-recipe-count">{count}</span>
                    {/if}
                  {/if}
                </button>
              {/each}
            </div>
          {:else}
            <p class="empty-hint">No facilities at this station</p>
          {/if}
        {:else}
          <p class="empty-hint">Dock at a station to see facilities</p>
        {/if}

        {#if selectedFacility}
          <p class="filter-label">
            Recipes at <strong>{formatFacility(selectedFacility)}</strong>
          </p>
        {/if}
      {/if}

      <!-- Recipe list -->
      {#if showRecipeList && filteredRecipes.length > 0}
        <div class="recipe-list">
          {#each filteredRecipes as recipe}
            <div
              class="recipe-item"
              class:selected={craftingStore.selectedRecipe?.id === recipe.id}
              onclick={() => craftingStore.selectRecipe(recipe)}
              role="button"
              tabindex="0"
              onkeydown={(e) => e.key === 'Enter' && craftingStore.selectRecipe(recipe)}
            >
              <div class="recipe-info">
                <span class="recipe-name">{recipe.name}</span>
                <span class="recipe-output mono">
                  → {recipe.output.quantity}x {recipe.output.item_name}
                </span>
              </div>
              {#if canCraft(recipe)}
                <span class="can-craft">✓</span>
              {:else}
                <span class="cannot-craft">✗</span>
              {/if}
            </div>
          {/each}
        </div>
      {:else if showRecipeList && allRecipes.length === 0}
        <p class="empty-hint">No recipes loaded. Click ↻ to load.</p>
      {:else if browseMode === 'cargo' && !selectedCargoItemId}
        <p class="empty-hint">Select a cargo item to see related recipes</p>
      {:else if browseMode === 'facilities' && !selectedFacility}
        <p class="empty-hint">Select a facility to see its recipes</p>
      {:else if showRecipeList}
        <p class="empty-hint">No matching recipes</p>
      {/if}
    </Content>
  </Card>

  <!-- Right: Recipe Detail + Craft -->
  <Card class="space-card">
    <Content>
      {#if craftingStore.selectedRecipe}
        {@const recipe = craftingStore.selectedRecipe}
        <p class="tab-section-title">Recipe Detail</p>
        <h3 class="recipe-title">{recipe.name}</h3>
        {#if recipe.description}
          <p class="recipe-desc">{recipe.description}</p>
        {/if}

        <p class="tab-section-title" style="margin-top:12px">Required Materials</p>
        <div class="materials">
          {#each recipe.inputs as input}
            {@const needed = input.quantity * craftingStore.craftQuantity}
            {@const have = hasMaterial(input.item_id, needed)}
            <div class="material-row" class:ok={have} class:missing={!have}>
              <span class="mat-name">{input.item_name}</span>
              <span class="mat-qty mono">
                × {needed}
                {#if !have}
                  <span class="missing-badge">missing</span>
                {:else}
                  <span class="ok-badge">✓</span>
                {/if}
              </span>
            </div>
          {/each}
        </div>

        <p class="tab-section-title" style="margin-top:12px">Output</p>
        <div class="output-row">
          <span class="mat-name">{recipe.output.item_name}</span>
          <span class="mat-qty mono credits">× {recipe.output.quantity * craftingStore.craftQuantity}</span>
        </div>

        {#if recipe.required_skills.length > 0}
          <p class="tab-section-title" style="margin-top:12px">Required Skills</p>
          <p class="skills-list">{recipe.required_skills.join(', ')}</p>
        {/if}

        {#if recipe.station_types.length > 0}
          <p class="tab-section-title" style="margin-top:12px">Station Types</p>
          <div class="station-types">
            {#each recipe.station_types as st}
              <span class="station-type-badge">{formatFacility(st)}</span>
            {/each}
          </div>
        {/if}

        <div class="craft-controls">
          <Textfield
            bind:value={craftingStore.craftQuantity}
            type="number"
            label="Quantity"
            variant="outlined"
            style="width:80px"
            input$min="1"
          />

          {#if craftingStore.craftingInProgress}
            <div style="flex:1">
              <LinearProgress indeterminate style="--mdc-theme-primary:#7c4dff" />
              <span class="crafting-label">Crafting...</span>
            </div>
          {:else}
            <Button
              variant="raised"
              onclick={doCraft}
              disabled={!canCraft(recipe) || craftingStore.craftingInProgress}
              style="flex:1; --mdc-theme-primary:#7c4dff"
            >
              <Label>Craft</Label>
            </Button>
          {/if}
        </div>

        {#if craftingStore.lastResult}
          <p class="craft-result">{craftingStore.lastResult}</p>
        {/if}
      {:else}
        <p class="empty-hint">Select a recipe to view details</p>
      {/if}
    </Content>
  </Card>
</div>

<style>
  /* Sub-tabs */
  .craft-subtabs {
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

  .subtab:hover { color: #90a4ae; }
  .subtab.active { color: #4fc3f7; border-bottom-color: #4fc3f7; }
  .subtab-icon { font-size: 16px; }
  .subtab-label { font-size: 0.76rem; }

  .badge {
    font-size: 0.6rem;
    font-family: 'Roboto Mono', monospace;
    background: rgba(79,195,247,0.15);
    color: #4fc3f7;
    padding: 1px 5px;
    border-radius: 8px;
    min-width: 16px;
    text-align: center;
  }

  /* Section head */
  .section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .icon-btn {
    background: none;
    border: none;
    color: #546e7a;
    cursor: pointer;
    font-size: 1rem;
    padding: 2px 4px;
  }

  /* Search / Autocomplete */
  .search-wrapper {
    position: relative;
    margin-bottom: 10px;
  }

  .suggestions-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    z-index: 10;
    background: #0d1525;
    border: 1px solid rgba(79,195,247,0.25);
    border-top: none;
    border-radius: 0 0 4px 4px;
    max-height: 240px;
    overflow-y: auto;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
  }

  .suggestion-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    cursor: pointer;
    transition: background 0.1s;
    border-bottom: 1px solid rgba(255,255,255,0.03);
  }

  .suggestion-item:hover {
    background: rgba(79,195,247,0.08);
  }

  .suggestion-name {
    font-size: 0.78rem;
    color: #b0bec5;
  }

  .suggestion-output {
    font-size: 0.65rem;
    color: #546e7a;
  }

  /* Item chips (cargo & facilities) */
  .item-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 10px;
  }

  .item-chip {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 5px 10px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 16px;
    color: #90a4ae;
    font-size: 0.72rem;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.15s;
  }

  .item-chip:hover {
    background: rgba(255,255,255,0.06);
    border-color: rgba(79,195,247,0.2);
  }

  .item-chip.selected {
    background: rgba(79,195,247,0.1);
    border-color: rgba(79,195,247,0.4);
    color: #4fc3f7;
  }

  .item-chip.facility {
    border-color: rgba(124,77,255,0.15);
  }

  .item-chip.facility.selected {
    background: rgba(124,77,255,0.1);
    border-color: rgba(124,77,255,0.4);
    color: #b39ddb;
  }

  .chip-icon { font-size: 14px; }
  .chip-name { font-size: 0.72rem; }

  .chip-qty {
    font-family: 'Roboto Mono', monospace;
    font-size: 0.65rem;
    color: #78909c;
  }

  .chip-recipe-count {
    font-size: 0.55rem;
    font-family: 'Roboto Mono', monospace;
    background: rgba(79,195,247,0.12);
    color: #4fc3f7;
    padding: 0 4px;
    border-radius: 6px;
    min-width: 14px;
    text-align: center;
  }

  .filter-label {
    font-size: 0.72rem;
    color: #546e7a;
    margin: 4px 0 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }

  .filter-label strong {
    color: #4fc3f7;
  }

  /* Recipe list */
  .empty-hint {
    font-size: 0.75rem;
    color: #263238;
    text-align: center;
    padding: 12px 0;
  }

  .recipe-list { display: flex; flex-direction: column; gap: 4px; max-height: 480px; overflow-y: auto; }

  .recipe-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 7px 10px;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.05);
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .recipe-item:hover { background: rgba(255,255,255,0.05); }
  .recipe-item.selected { border-color: rgba(124,77,255,0.5); background: rgba(124,77,255,0.08); }

  .recipe-info { display: flex; flex-direction: column; }
  .recipe-name { font-size: 0.8rem; color: #b0bec5; }
  .recipe-output { font-size: 0.65rem; color: #546e7a; }

  .can-craft { color: #4caf50; font-size: 0.9rem; }
  .cannot-craft { color: #37474f; font-size: 0.9rem; }

  /* Recipe detail */
  .recipe-title { font-size: 1rem; font-weight: 300; color: #b0bec5; margin: 0 0 4px; }
  .recipe-desc { font-size: 0.73rem; color: #546e7a; margin: 0 0 8px; }

  .materials { display: flex; flex-direction: column; gap: 4px; }

  .material-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 8px;
    border-radius: 3px;
    font-size: 0.78rem;
  }

  .material-row.ok { background: rgba(76,175,80,0.06); }
  .material-row.missing { background: rgba(244,67,54,0.06); }

  .mat-name { color: #90a4ae; }
  .mat-qty { font-family: 'Roboto Mono', monospace; font-size: 0.72rem; display: flex; align-items: center; gap: 4px; }

  .ok-badge { color: #4caf50; font-size: 0.8rem; }
  .missing-badge {
    font-size: 0.6rem;
    color: #ef5350;
    background: rgba(244,67,54,0.15);
    border-radius: 2px;
    padding: 0 4px;
  }

  .output-row {
    display: flex;
    justify-content: space-between;
    padding: 4px 8px;
    background: rgba(124,77,255,0.08);
    border-radius: 3px;
    font-size: 0.78rem;
  }

  .credits { color: #ffd700; }
  .mono { font-family: 'Roboto Mono', monospace; }

  .station-types {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .station-type-badge {
    font-size: 0.65rem;
    font-family: 'Roboto Mono', monospace;
    color: #b39ddb;
    background: rgba(124,77,255,0.1);
    padding: 2px 8px;
    border-radius: 3px;
  }

  .skills-list { font-size: 0.72rem; color: #546e7a; margin: 0; }

  .craft-controls {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 16px;
  }

  .crafting-label { font-size: 0.72rem; color: #b39ddb; margin-top: 4px; display: block; }
  .craft-result { font-size: 0.78rem; color: #66bb6a; margin-top: 8px; text-align: center; }
</style>
