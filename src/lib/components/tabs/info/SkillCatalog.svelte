<script lang="ts">
  import Card, { Content } from '@smui/card';
  import { catalogStore } from '$lib/stores/catalog.svelte';
  import { ws } from '$lib/services/websocket';
  import CatalogSearch from './CatalogSearch.svelte';
  import CatalogPager from './CatalogPager.svelte';

  const state = $derived(catalogStore.skills);

  function load(page?: number) {
    ws.catalog('skills', {
      search: state.search || undefined,
      category: state.category || undefined,
      page: page ?? state.page,
      page_size: state.pageSize,
    });
  }

  function onSearch(q: string) {
    catalogStore.setSearch('skills', q);
    load(1);
  }

  function onPageChange(p: number) {
    catalogStore.setPage('skills', p);
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
    <span class="material-icons section-icon">psychology</span>
    Skill Catalog
  </p>

  <CatalogSearch search={state.search} total={state.total} loading={state.loading} {onSearch} />

  {#if state.loading && state.items.length === 0}
    <p class="empty-hint">Loading skill catalog...</p>
  {:else if state.items.length === 0}
    <p class="empty-hint">No skills found</p>
  {:else}
    <div class="catalog-grid">
      {#each state.items as skill}
        <Card class="space-card">
          <Content>
            <div class="item-header">
              <span class="item-name">{skill.name ?? skill.id}</span>
              {#if skill.category}
                <span class="item-badge">{skill.category}</span>
              {/if}
            </div>
            {#if skill.description}
              <p class="item-desc">{skill.description}</p>
            {/if}
            <div class="stat-grid">
              {#if skill.max_level != null}
                <div class="stat">
                  <span class="stat-label">Max Level</span>
                  <span class="stat-val mono">{skill.max_level}</span>
                </div>
              {/if}
              {#if skill.rank != null}
                <div class="stat">
                  <span class="stat-label">Rank</span>
                  <span class="stat-val mono">{skill.rank}</span>
                </div>
              {/if}
            </div>
            {#if skill.prerequisites && skill.prerequisites.length > 0}
              <div class="prereqs">
                <span class="prereq-label">Prerequisites:</span>
                {#each skill.prerequisites as prereq}
                  <span class="prereq-item">{prereq}</span>
                {/each}
              </div>
            {/if}
            {#if skill.effects && skill.effects.length > 0}
              <div class="effects">
                <span class="effect-label">Effects:</span>
                {#each skill.effects as effect}
                  <span class="effect-item">{effect}</span>
                {/each}
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
    color: #7c4dff;
    background: rgba(124,77,255,0.1);
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

  .prereqs, .effects {
    margin-top: 6px;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
  }
  .prereq-label, .effect-label {
    font-size: 0.68rem;
    color: #4a6070;
  }
  .prereq-item {
    font-size: 0.62rem;
    font-family: 'Roboto Mono', monospace;
    color: #ff9800;
    background: rgba(255,152,0,0.08);
    padding: 1px 5px;
    border-radius: 3px;
  }
  .effect-item {
    font-size: 0.62rem;
    font-family: 'Roboto Mono', monospace;
    color: #4caf50;
    background: rgba(76,175,80,0.08);
    padding: 1px 5px;
    border-radius: 3px;
  }
  .mono { font-family: 'Roboto Mono', monospace; }
</style>
