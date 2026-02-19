<script lang="ts">
  import Button, { Label } from '@smui/button';
  import Card, { Content } from '@smui/card';
  import Textfield from '@smui/textfield';
  import { craftingStore } from '$lib/stores/crafting.svelte';
  import { shipStore } from '$lib/stores/ship.svelte';
  import { baseStore } from '$lib/stores/base.svelte';
  import { playerStore } from '$lib/stores/player.svelte';
  import { actionQueueStore } from '$lib/stores/actionQueue.svelte';
  import { ws } from '$lib/services/websocket';
  import type { Recipe } from '$lib/types/game';

  let searchText = $state('');
  let searchMode = $state<'all' | 'input' | 'output'>('all');
  let selectedCategory = $state('');
  let cargoOnly = $state(false);
  let repeatCount = $state(1);

  const allRecipes = $derived(craftingStore.recipes);
  const categories = $derived(craftingStore.categories);
  const cargo = $derived(shipStore.cargo);
  const storage = $derived(baseStore.items);
  const isDocked = $derived(playerStore.isDocked);

  // Set of item_ids available (cargo + storage) for fast lookup
  const availableItemIds = $derived(new Set([
    ...cargo.map(c => c.item_id),
    ...storage.map(s => s.item_id),
  ]));

  const filteredRecipes = $derived.by(() => {
    let list = allRecipes;

    // Category filter
    if (selectedCategory) {
      list = list.filter(r => r.category === selectedCategory);
    }

    // Text search (filtered by searchMode)
    if (searchText) {
      const q = searchText.toLowerCase();
      list = list.filter(r => {
        const nameMatch = r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q) || (r.description ?? '').toLowerCase().includes(q);
        if (searchMode === 'input') {
          return (r.inputs ?? []).some(i => i.item_id.toLowerCase().includes(q));
        } else if (searchMode === 'output') {
          return (r.outputs ?? []).some(o => o.item_id.toLowerCase().includes(q));
        }
        // 'all' mode: match any field
        return nameMatch ||
          (r.inputs ?? []).some(i => i.item_id.toLowerCase().includes(q)) ||
          (r.outputs ?? []).some(o => o.item_id.toLowerCase().includes(q));
      });
    }

    // Material filter: only recipes where at least one input is available (cargo or storage)
    if (cargoOnly) {
      list = list.filter(r =>
        (r.inputs ?? []).some(i => availableItemIds.has(i.item_id))
      );
    }

    return list;
  });

  function formatItemId(id: string): string {
    return id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  function formatSkillName(id: string): string {
    return id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  function getCargoQty(itemId: string): number {
    return cargo.find(c => c.item_id === itemId)?.quantity ?? 0;
  }

  function getStorageQty(itemId: string): number {
    return storage.find(s => s.item_id === itemId)?.quantity ?? 0;
  }

  /** Total available = cargo + storage (server pulls from both) */
  function getAvailableQty(itemId: string): number {
    return getCargoQty(itemId) + (isDocked ? getStorageQty(itemId) : 0);
  }

  function hasMaterial(itemId: string, required: number): boolean {
    return getAvailableQty(itemId) >= required;
  }

  /** Clamp count to 1-10 */
  const clampedCount = $derived(Math.max(1, Math.min(craftingStore.craftCount, 10)));
  const clampedRepeat = $derived(Math.max(1, repeatCount));
  /** Total materials needed = per-craft × count × repeat */
  const totalMultiplier = $derived(clampedCount * clampedRepeat);

  function canCraft(recipe: Recipe): boolean {
    if (!recipe.inputs?.length) return false;
    // Check if we have enough for at least one action (count only)
    return recipe.inputs.every(i => hasMaterial(i.item_id, i.quantity * clampedCount));
  }

  function doCraft() {
    if (!craftingStore.selectedRecipe) return;
    const recipe = craftingStore.selectedRecipe;
    const count = clampedCount;
    const n = clampedRepeat;
    for (let i = 0; i < n; i++) {
      const label = n > 1
        ? `Craft ${recipe.name} ×${count} [${i + 1}/${n}]`
        : `Craft ${recipe.name} ×${count}`;
      actionQueueStore.enqueue(label, () => ws.craft(recipe.id, count));
    }
  }

  function loadRecipes() {
    ws.getRecipes();
  }

  // Load recipes when tab is first opened (if not already loaded)
  $effect(() => {
    if (allRecipes.length === 0) {
      loadRecipes();
    }
  });
</script>

<div class="two-col">
  <!-- Left: Recipe Browser -->
  <Card class="space-card">
    <Content>
      <div class="section-head">
        <span class="tab-section-title">Recipes</span>
        <span class="recipe-count mono">{filteredRecipes.length}/{allRecipes.length}</span>
        <button class="icon-btn" onclick={loadRecipes} title="Refresh recipes">↻</button>
      </div>

      <!-- Search -->
      <div class="search-row">
        <Textfield
          bind:value={searchText}
          label="Search..."
          variant="outlined"
          style="width:100%"
        />
        <div class="search-mode-toggle">
          <button class="mode-chip" class:active={searchMode === 'all'} onclick={() => searchMode = 'all'}>All</button>
          <button class="mode-chip" class:active={searchMode === 'input'} onclick={() => searchMode = 'input'}>Input</button>
          <button class="mode-chip" class:active={searchMode === 'output'} onclick={() => searchMode = 'output'}>Output</button>
        </div>
      </div>

      <!-- Filters -->
      <div class="filter-row">
        <!-- Category chips -->
        <div class="category-chips">
          <button
            class="cat-chip"
            class:active={selectedCategory === ''}
            onclick={() => selectedCategory = ''}
          >All</button>
          {#each categories as cat}
            <button
              class="cat-chip"
              class:active={selectedCategory === cat}
              onclick={() => selectedCategory = selectedCategory === cat ? '' : cat}
            >{cat}</button>
          {/each}
        </div>

        <!-- Cargo filter toggle -->
        <button
          class="cargo-toggle"
          class:active={cargoOnly}
          onclick={() => cargoOnly = !cargoOnly}
          title="Show only recipes with available materials"
        >
          <span class="material-icons toggle-icon">inventory_2</span>
          <span class="toggle-label">Materials</span>
        </button>
      </div>

      <!-- Recipe list -->
      {#if allRecipes.length === 0}
        <p class="empty-hint">Loading recipes...</p>
      {:else if filteredRecipes.length === 0}
        <p class="empty-hint">No matching recipes</p>
      {:else}
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
                <div class="recipe-top">
                  <span class="recipe-name">{recipe.name}</span>
                  {#if recipe.category}
                    <span class="recipe-cat">{recipe.category}</span>
                  {/if}
                </div>
                <span class="recipe-output mono">
                  → {(recipe.outputs ?? []).map(o => `${o.quantity}x ${formatItemId(o.item_id)}`).join(', ')}
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
        {#if recipe.category}
          <span class="detail-cat">{recipe.category}</span>
        {/if}
        {#if recipe.description}
          <p class="recipe-desc">{recipe.description}</p>
        {/if}

        <p class="tab-section-title" style="margin-top:12px">
          Inputs
          {#if clampedRepeat > 1}
            <span class="total-hint">(×{clampedCount} × {clampedRepeat}回 = {totalMultiplier}倍)</span>
          {:else if clampedCount > 1}
            <span class="total-hint">(×{clampedCount})</span>
          {/if}
        </p>
        <div class="materials">
          {#each recipe.inputs ?? [] as input}
            {@const needed = input.quantity * totalMultiplier}
            {@const neededPerAction = input.quantity * clampedCount}
            {@const have = hasMaterial(input.item_id, neededPerAction)}
            {@const cargoQty = getCargoQty(input.item_id)}
            {@const storageQty = isDocked ? getStorageQty(input.item_id) : 0}
            {@const totalQty = cargoQty + storageQty}
            <div class="material-row" class:ok={have} class:missing={!have}>
              <span class="mat-name">
                {formatItemId(input.item_id)}
                {#if storageQty > 0}
                  <span class="source-hint">({cargoQty}+{storageQty})</span>
                {/if}
              </span>
              <span class="mat-qty mono">
                {totalQty}/{needed}
                {#if totalQty >= needed}
                  <span class="ok-badge">✓</span>
                {:else if have}
                  <span class="ok-badge">~</span>
                {:else}
                  <span class="missing-badge">-{needed - totalQty}</span>
                {/if}
              </span>
            </div>
          {/each}
        </div>

        <p class="tab-section-title" style="margin-top:12px">Output</p>
        {#each recipe.outputs ?? [] as output}
          <div class="output-row">
            <span class="mat-name">{formatItemId(output.item_id)}</span>
            <span class="mat-qty mono output-qty">
              × {output.quantity * totalMultiplier}
              {#if output.quality_mod}
                <span class="quality-badge">Q</span>
              {/if}
            </span>
          </div>
        {/each}

        {#if recipe.required_skills && Object.keys(recipe.required_skills).length > 0}
          <p class="tab-section-title" style="margin-top:12px">Required Skills</p>
          <div class="skills-list">
            {#each Object.entries(recipe.required_skills) as [skill, level]}
              <span class="skill-badge">{formatSkillName(skill)} Lv.{level}</span>
            {/each}
          </div>
        {/if}

        <div class="stats-row">
          {#if recipe.crafting_time}
            <span class="stat-item">
              <span class="material-icons stat-icon">schedule</span>
              <span class="mono">{recipe.crafting_time}t</span>
            </span>
          {/if}
          {#if recipe.base_quality}
            <span class="stat-item">
              <span class="material-icons stat-icon">grade</span>
              <span class="mono">Q{recipe.base_quality}</span>
              {#if recipe.skill_quality_mod}
                <span class="mono stat-sub">+{recipe.skill_quality_mod}/skill</span>
              {/if}
            </span>
          {/if}
        </div>

        <div class="craft-controls">
          <div class="count-field">
            <label class="field-label">Count</label>
            <input
              type="number"
              class="repeat-input"
              min="1"
              max="10"
              bind:value={craftingStore.craftCount}
            />
          </div>
          <div class="count-field">
            <label class="field-label">Repeat</label>
            <input
              type="number"
              class="repeat-input"
              min="1"
              max="999"
              bind:value={repeatCount}
            />
          </div>
          <Button
            variant="raised"
            onclick={doCraft}
            disabled={!canCraft(recipe)}
            style="flex:1; --mdc-theme-primary:#7c4dff"
          >
            <Label>⚒ Craft ×{clampedCount}{clampedRepeat > 1 ? ` (${clampedRepeat}回)` : ''}</Label>
          </Button>
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
  /* Section head */
  .section-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .recipe-count {
    font-size: 0.65rem;
    color: #546e7a;
    margin-left: auto;
  }

  .icon-btn {
    background: none;
    border: none;
    color: #546e7a;
    cursor: pointer;
    font-size: 1rem;
    padding: 2px 4px;
  }

  /* Search */
  .search-row {
    margin-bottom: 8px;
  }

  .search-mode-toggle {
    display: flex;
    gap: 4px;
    margin-top: 6px;
  }

  .mode-chip {
    padding: 2px 10px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    color: #78909c;
    font-size: 0.65rem;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.15s;
  }

  .mode-chip:hover { background: rgba(255,255,255,0.06); }
  .mode-chip.active {
    background: rgba(124,77,255,0.1);
    border-color: rgba(124,77,255,0.35);
    color: #b388ff;
  }

  /* Filters */
  .filter-row {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 10px;
  }

  .category-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    flex: 1;
  }

  .cat-chip {
    padding: 3px 10px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    color: #78909c;
    font-size: 0.68rem;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.15s;
  }

  .cat-chip:hover { background: rgba(255,255,255,0.06); }
  .cat-chip.active {
    background: rgba(79,195,247,0.1);
    border-color: rgba(79,195,247,0.35);
    color: #4fc3f7;
  }

  .cargo-toggle {
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 3px 10px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    color: #78909c;
    font-size: 0.68rem;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }

  .cargo-toggle:hover { background: rgba(255,255,255,0.06); }
  .cargo-toggle.active {
    background: rgba(255,152,0,0.1);
    border-color: rgba(255,152,0,0.35);
    color: #ff9800;
  }

  .toggle-icon { font-size: 14px; }
  .toggle-label { font-size: 0.68rem; }

  /* Recipe list */
  .empty-hint {
    font-size: 0.75rem;
    color: #263238;
    text-align: center;
    padding: 12px 0;
  }

  .recipe-list {
    display: flex;
    flex-direction: column;
    gap: 3px;
    max-height: 520px;
    overflow-y: auto;
  }

  .recipe-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 10px;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.05);
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .recipe-item:hover { background: rgba(255,255,255,0.05); }
  .recipe-item.selected { border-color: rgba(124,77,255,0.5); background: rgba(124,77,255,0.08); }

  .recipe-info { display: flex; flex-direction: column; min-width: 0; flex: 1; }

  .recipe-top {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .recipe-name { font-size: 0.78rem; color: #b0bec5; }

  .recipe-cat {
    font-size: 0.55rem;
    font-family: 'Roboto Mono', monospace;
    color: #78909c;
    background: rgba(255,255,255,0.05);
    padding: 0 5px;
    border-radius: 3px;
  }

  .recipe-output {
    font-size: 0.63rem;
    color: #546e7a;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .can-craft { color: #4caf50; font-size: 0.9rem; flex-shrink: 0; margin-left: 6px; }
  .cannot-craft { color: #37474f; font-size: 0.9rem; flex-shrink: 0; margin-left: 6px; }

  /* Recipe detail */
  .recipe-title { font-size: 1rem; font-weight: 300; color: #b0bec5; margin: 0 0 4px; }
  .recipe-desc { font-size: 0.73rem; color: #546e7a; margin: 0 0 8px; }

  .detail-cat {
    display: inline-block;
    font-size: 0.6rem;
    font-family: 'Roboto Mono', monospace;
    color: #4fc3f7;
    background: rgba(79,195,247,0.1);
    padding: 1px 8px;
    border-radius: 3px;
    margin-bottom: 6px;
  }

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

  .mat-name { color: #90a4ae; display: flex; flex-direction: column; gap: 1px; }

  .source-hint {
    font-size: 0.55rem;
    color: #546e7a;
    font-family: 'Roboto Mono', monospace;
  }
  .mat-qty {
    font-family: 'Roboto Mono', monospace;
    font-size: 0.72rem;
    display: flex;
    align-items: center;
    gap: 4px;
  }

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
    margin-bottom: 2px;
  }

  .output-qty { color: #ce93d8; }

  .quality-badge {
    font-size: 0.55rem;
    color: #ffd700;
    background: rgba(255,215,0,0.15);
    padding: 0 4px;
    border-radius: 2px;
  }

  .mono { font-family: 'Roboto Mono', monospace; }

  .skills-list {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .skill-badge {
    font-size: 0.65rem;
    font-family: 'Roboto Mono', monospace;
    color: #4fc3f7;
    background: rgba(79,195,247,0.08);
    padding: 2px 8px;
    border-radius: 3px;
  }

  .stats-row {
    display: flex;
    gap: 16px;
    margin-top: 12px;
    padding: 6px 0;
    border-top: 1px solid rgba(255,255,255,0.05);
  }

  .stat-item {
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: 0.72rem;
    color: #78909c;
  }

  .stat-icon { font-size: 14px; color: #546e7a; }
  .stat-sub { font-size: 0.6rem; color: #546e7a; }

  .total-hint {
    font-size: 0.6rem;
    color: #546e7a;
    font-weight: 400;
    margin-left: 4px;
  }

  .craft-controls {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    margin-top: 16px;
  }

  .count-field {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .field-label {
    font-size: 0.6rem;
    color: #546e7a;
    letter-spacing: 0.05em;
  }

  .repeat-input {
    width: 60px;
    padding: 6px 6px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(79,195,247,0.2);
    border-radius: 4px;
    color: #b0bec5;
    font-family: 'Roboto Mono', monospace;
    font-size: 0.75rem;
    text-align: center;
  }

  .repeat-input:focus {
    outline: none;
    border-color: rgba(79,195,247,0.5);
  }

  .craft-result { font-size: 0.78rem; color: #66bb6a; margin-top: 8px; text-align: center; }
</style>
