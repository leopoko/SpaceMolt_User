<script lang="ts">
  import Card, { Content } from '@smui/card';
  import { catalogStore } from '$lib/stores/catalog.svelte';
  import { ws } from '$lib/services/websocket';
  import CatalogSearch from './CatalogSearch.svelte';
  import CatalogPager from './CatalogPager.svelte';

  const state = $derived(catalogStore.items);

  function load(page?: number) {
    ws.catalog('items', {
      search: state.search || undefined,
      category: state.category || undefined,
      page: page ?? state.page,
      page_size: state.pageSize,
    });
  }

  function onSearch(q: string) {
    catalogStore.setSearch('items', q);
    load(1);
  }

  function onPageChange(p: number) {
    catalogStore.setPage('items', p);
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
    <span class="material-icons section-icon">inventory_2</span>
    Item Catalog
  </p>

  <CatalogSearch search={state.search} total={state.total} loading={state.loading} {onSearch} />

  {#if state.loading && state.items.length === 0}
    <p class="empty-hint">Loading item catalog...</p>
  {:else if state.items.length === 0}
    <p class="empty-hint">No items found</p>
  {:else}
    <div class="catalog-grid">
      {#each state.items as item}
        <Card class="space-card">
          <Content>
            <div class="item-header">
              <span class="item-name">{item.name ?? item.id}</span>
              {#if item.category}
                <span class="item-badge">{item.category}</span>
              {/if}
            </div>
            {#if item.description}
              <p class="item-desc">{item.description}</p>
            {/if}
            <div class="stat-grid">
              {#if item.size != null}
                <div class="stat">
                  <span class="stat-label">Size</span>
                  <span class="stat-val mono">{item.size}</span>
                </div>
              {/if}
              {#if item.base_value != null}
                <div class="stat">
                  <span class="stat-label">Base Value</span>
                  <span class="stat-val mono credits">₡ {Number(item.base_value).toLocaleString()}</span>
                </div>
              {/if}
              {#if item.rarity}
                <div class="stat">
                  <span class="stat-label">Rarity</span>
                  <span class="stat-val rarity-{item.rarity}">{item.rarity}</span>
                </div>
              {/if}
              {#if item.tradeable != null}
                <div class="stat">
                  <span class="stat-label">Tradeable</span>
                  <span class="stat-val">{item.tradeable ? 'Yes' : 'No'}</span>
                </div>
              {/if}
              {#if item.stackable != null}
                <div class="stat">
                  <span class="stat-label">Stackable</span>
                  <span class="stat-val">{item.stackable ? 'Yes' : 'No'}</span>
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
  .catalog { max-width: 900px; }

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
    display: flex;
    flex-direction: column;
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
    color: #ff9800;
    background: rgba(255,152,0,0.1);
    padding: 2px 6px;
    border-radius: 3px;
  }
  .item-desc { font-size: 0.7rem; color: #546e7a; margin: 0 0 8px; }

  .stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 4px 12px;
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

  .credits { color: #ffd700; }
  .mono { font-family: 'Roboto Mono', monospace; }

  :global(.rarity-common) { color: #90a4ae; }
  :global(.rarity-uncommon) { color: #4caf50; }
  :global(.rarity-rare) { color: #2196f3; }
  :global(.rarity-epic) { color: #7c4dff; }
  :global(.rarity-legendary) { color: #ffd700; }
</style>
