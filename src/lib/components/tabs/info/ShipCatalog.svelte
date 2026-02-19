<script lang="ts">
  import Card, { Content } from '@smui/card';
  import { catalogStore } from '$lib/stores/catalog.svelte';
  import { ws } from '$lib/services/websocket';
  import CatalogSearch from './CatalogSearch.svelte';
  import CatalogPager from './CatalogPager.svelte';

  const state = $derived(catalogStore.ships);

  function load(page?: number) {
    ws.catalog('ships', {
      search: state.search || undefined,
      category: state.category || undefined,
      page: page ?? state.page,
      page_size: state.pageSize,
    });
  }

  function onSearch(q: string) {
    catalogStore.setSearch('ships', q);
    load(1);
  }

  function onPageChange(p: number) {
    catalogStore.setPage('ships', p);
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
    <span class="material-icons section-icon">rocket</span>
    Ship Catalog
  </p>

  <CatalogSearch search={state.search} total={state.total} loading={state.loading} {onSearch} />

  {#if state.loading && state.items.length === 0}
    <p class="empty-hint">Loading ship catalog...</p>
  {:else if state.items.length === 0}
    <p class="empty-hint">No ships found</p>
  {:else}
    <CatalogPager page={state.page} totalPages={state.totalPages} {onPageChange} />
    <div class="catalog-grid">
      {#each state.items as ship}
        <Card class="space-card">
          <Content>
            <div class="item-header">
              <span class="item-name">{ship.name ?? ship.id}</span>
              {#if ship.class}
                <span class="item-badge">{ship.class}</span>
              {/if}
            </div>
            {#if ship.description}
              <p class="item-desc">{ship.description}</p>
            {/if}
            <div class="stat-grid">
              {#if ship.base_hull != null}
                <div class="stat">
                  <span class="stat-label">Hull</span>
                  <span class="stat-val mono">{ship.base_hull}</span>
                </div>
              {/if}
              {#if ship.base_shields != null || ship.base_shield != null}
                <div class="stat">
                  <span class="stat-label">Shield</span>
                  <span class="stat-val mono">{ship.base_shields ?? ship.base_shield}</span>
                </div>
              {/if}
              {#if ship.base_fuel != null}
                <div class="stat">
                  <span class="stat-label">Fuel</span>
                  <span class="stat-val mono">{ship.base_fuel}</span>
                </div>
              {/if}
              {#if ship.base_cargo != null}
                <div class="stat">
                  <span class="stat-label">Cargo</span>
                  <span class="stat-val mono">{ship.base_cargo}</span>
                </div>
              {/if}
              {#if ship.speed != null}
                <div class="stat">
                  <span class="stat-label">Speed</span>
                  <span class="stat-val mono">{ship.speed}</span>
                </div>
              {/if}
              {#if ship.weapon_slots != null}
                <div class="stat">
                  <span class="stat-label">Weapon Slots</span>
                  <span class="stat-val mono">{ship.weapon_slots}</span>
                </div>
              {/if}
              {#if ship.utility_slots != null}
                <div class="stat">
                  <span class="stat-label">Utility Slots</span>
                  <span class="stat-val mono">{ship.utility_slots}</span>
                </div>
              {/if}
              {#if ship.defense_slots != null}
                <div class="stat">
                  <span class="stat-label">Defense Slots</span>
                  <span class="stat-val mono">{ship.defense_slots}</span>
                </div>
              {/if}
            </div>
            {#if ship.price != null}
              <div class="item-price">
                <span class="mono credits">₡ {Number(ship.price).toLocaleString()}</span>
              </div>
            {/if}
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
    color: #4fc3f7;
    background: rgba(79,195,247,0.1);
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

  .item-price {
    margin-top: 6px;
    text-align: right;
    font-size: 0.78rem;
  }
  .credits { color: #ffd700; }
  .mono { font-family: 'Roboto Mono', monospace; }
</style>
