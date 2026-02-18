<script lang="ts">
  import Button, { Label } from '@smui/button';
  import Card, { Content } from '@smui/card';
  import Textfield from '@smui/textfield';
  import LinearProgress from '@smui/linear-progress';
  import { craftingStore } from '$lib/stores/crafting.svelte';
  import { shipStore } from '$lib/stores/ship.svelte';
  import { ws } from '$lib/services/websocket';

  let searchText = $state('');

  const filtered = $derived(
    craftingStore.recipes.filter(r =>
      r.name.toLowerCase().includes(searchText.toLowerCase())
    )
  );

  function hasMaterial(itemId: string, required: number): boolean {
    const found = shipStore.cargo.find(c => c.item_id === itemId);
    return (found?.quantity ?? 0) >= required;
  }

  function canCraft(recipe: typeof craftingStore.recipes[0]): boolean {
    return recipe.inputs.every(i => hasMaterial(i.item_id, i.quantity * craftingStore.craftQuantity));
  }

  function doCraft() {
    if (!craftingStore.selectedRecipe) return;
    ws.craft(craftingStore.selectedRecipe.id, craftingStore.craftQuantity);
  }

  function loadRecipes() {
    ws.getRecipes();
  }
</script>

<div class="two-col">
  <!-- Recipe Browser -->
  <Card class="space-card">
    <Content>
      <div class="section-head">
        <span class="tab-section-title">Recipes</span>
        <button class="icon-btn" onclick={loadRecipes} title="Refresh">↻</button>
      </div>

      <div style="margin-bottom:10px">
        <Textfield
          bind:value={searchText}
          label="Search recipes"
          variant="outlined"
          style="width:100%"
        />
      </div>

      {#if filtered.length > 0}
        <div class="recipe-list">
          {#each filtered as recipe}
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
      {:else}
        <p class="empty-hint">
          {craftingStore.recipes.length === 0 ? 'No recipes loaded. Click ↻ to load.' : 'No matching recipes'}
        </p>
      {/if}
    </Content>
  </Card>

  <!-- Recipe Detail + Craft -->
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
              <Label>⚙ Craft</Label>
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
