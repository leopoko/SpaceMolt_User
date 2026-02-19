<script lang="ts">
  import Card, { Content } from '@smui/card';
  import { catalogStore } from '$lib/stores/catalog.svelte';
  import { ws } from '$lib/services/websocket';
  import CatalogSearch from './CatalogSearch.svelte';
  import CatalogPager from './CatalogPager.svelte';

  const state = $derived(catalogStore.recipes);

  function load(page?: number) {
    ws.catalog('recipes', {
      search: state.search || undefined,
      category: state.category || undefined,
      page: page ?? state.page,
      page_size: state.pageSize,
    });
  }

  function onSearch(q: string) {
    catalogStore.setSearch('recipes', q);
    load(1);
  }

  function onPageChange(p: number) {
    catalogStore.setPage('recipes', p);
    load(p);
  }

  $effect(() => {
    if (state.items.length === 0 && !state.loading) {
      load(1);
    }
  });
</script>

<div class="catalog">
  <p class="tab-section-title">
    <span class="material-icons section-icon">precision_manufacturing</span>
    Recipe Catalog
  </p>

  <CatalogSearch search={state.search} total={state.total} loading={state.loading} {onSearch} />

  {#if state.loading && state.items.length === 0}
    <p class="empty-hint">Loading recipe catalog...</p>
  {:else if state.items.length === 0}
    <p class="empty-hint">No recipes found</p>
  {:else}
    <CatalogPager page={state.page} totalPages={state.totalPages} {onPageChange} />
    <div class="catalog-grid">
      {#each state.items as recipe}
        <Card class="space-card">
          <Content>
            <div class="item-header">
              <span class="item-name">{recipe.name ?? recipe.id}</span>
              {#if recipe.category}
                <span class="item-badge">{recipe.category}</span>
              {/if}
            </div>
            {#if recipe.description}
              <p class="item-desc">{recipe.description}</p>
            {/if}

            {#if recipe.inputs && recipe.inputs.length > 0}
              <div class="recipe-section">
                <span class="recipe-label">Inputs:</span>
                <div class="recipe-items">
                  {#each recipe.inputs as input}
                    <span class="recipe-item input">
                      {input.quantity ?? 1}x {input.item_name ?? input.item_id ?? input.name ?? '?'}
                    </span>
                  {/each}
                </div>
              </div>
            {/if}

            {#if recipe.output}
              <div class="recipe-section">
                <span class="recipe-label">Output:</span>
                <span class="recipe-item output">
                  {recipe.output.quantity ?? 1}x {recipe.output.item_name ?? recipe.output.item_id ?? recipe.output.name ?? '?'}
                </span>
              </div>
            {/if}

            <div class="stat-grid">
              {#if recipe.craft_time_ticks != null}
                <div class="stat">
                  <span class="stat-label">Craft Time</span>
                  <span class="stat-val mono">{recipe.craft_time_ticks} ticks</span>
                </div>
              {/if}
              {#if recipe.required_skills && recipe.required_skills.length > 0}
                <div class="stat">
                  <span class="stat-label">Required Skills</span>
                  <span class="stat-val">{recipe.required_skills.join(', ')}</span>
                </div>
              {/if}
              {#if recipe.station_types && recipe.station_types.length > 0}
                <div class="stat">
                  <span class="stat-label">Station Types</span>
                  <span class="stat-val">{recipe.station_types.join(', ')}</span>
                </div>
              {/if}
            </div>
          </Content>
        </Card>
      {/each}
    </div>
  {/if}

  <CatalogPager page={state.page} totalPages={state.totalPages} {onPageChange} />
</div>

<style>
  .catalog { margin: 0 auto; max-width: 1100px; }

  .tab-section-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.85rem;
    color: #4fc3f7;
    margin: 0 0 10px;
  }
  .section-icon { font-size: 18px; }

  .empty-hint {
    font-size: 0.75rem;
    color: #263238;
    text-align: center;
    padding: 12px 0;
  }

  .catalog-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
    gap: 8px;
  }

  .item-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }
  .item-name { font-size: 0.85rem; color: #90caf9; font-weight: 500; }
  .item-badge {
    font-size: 0.6rem;
    font-family: 'Roboto Mono', monospace;
    color: #4caf50;
    background: rgba(76,175,80,0.1);
    padding: 2px 6px;
    border-radius: 3px;
  }
  .item-desc { font-size: 0.7rem; color: #546e7a; margin: 0 0 8px; }

  .recipe-section {
    margin: 6px 0;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
  }
  .recipe-label {
    font-size: 0.7rem;
    color: #4a6070;
    margin-right: 4px;
  }
  .recipe-items {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .recipe-item {
    font-size: 0.65rem;
    font-family: 'Roboto Mono', monospace;
    padding: 2px 6px;
    border-radius: 3px;
  }
  .recipe-item.input {
    color: #ff9800;
    background: rgba(255,152,0,0.08);
  }
  .recipe-item.output {
    color: #4caf50;
    background: rgba(76,175,80,0.08);
  }

  .stat-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 4px;
    margin-top: 6px;
  }
  .stat {
    display: flex;
    justify-content: space-between;
    font-size: 0.72rem;
    padding: 2px 0;
    border-bottom: 1px solid rgba(255,255,255,0.03);
  }
  .stat-label { color: #4a6070; }
  .stat-val { color: #90a4ae; }

  .mono { font-family: 'Roboto Mono', monospace; }
</style>
