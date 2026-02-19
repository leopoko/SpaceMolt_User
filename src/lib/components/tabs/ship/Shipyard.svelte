<script lang="ts">
  import Button, { Label } from '@smui/button';
  import Card, { Content } from '@smui/card';
  import LinearProgress from '@smui/linear-progress';
  import { shipStore } from '$lib/stores/ship.svelte';
  import { playerStore } from '$lib/stores/player.svelte';
  import { ws } from '$lib/services/websocket';

  // Auto-refresh catalog when this sub-tab mounts (only when docked)
  $effect(() => {
    if (playerStore.isDocked) {
      ws.getShipCatalog();
    }
  });

  // Category color/icon mapping
  const categoryStyle: Record<string, { color: string; icon: string }> = {
    Mining:    { color: '#ff9800', icon: 'hardware' },
    Combat:    { color: '#f44336', icon: 'gps_fixed' },
    Trade:     { color: '#ffd700', icon: 'local_shipping' },
    Explorer:  { color: '#4fc3f7', icon: 'explore' },
    Capital:   { color: '#ce93d8', icon: 'shield' },
    Stealth:   { color: '#78909c', icon: 'visibility_off' },
    Support:   { color: '#66bb6a', icon: 'healing' },
    Industrial: { color: '#ff9800', icon: 'precision_manufacturing' },
    Hybrid:    { color: '#26c6da', icon: 'auto_awesome' },
  };

  function getCatStyle(cls: string) {
    return categoryStyle[cls] ?? { color: '#90a4ae', icon: 'rocket_launch' };
  }

  // Unique categories from catalog
  let categories = $derived.by(() => {
    const set = new Set<string>();
    for (const s of shipStore.catalog) set.add(s.class);
    return ['All', ...Array.from(set).sort()];
  });

  let selectedCategory = $state<string>('All');

  // Budget filter
  let budgetMode = $state<'all' | 'affordable' | 'custom'>('all');
  let customBudget = $state<number>(0);

  let filteredCatalog = $derived.by(() => {
    let list = selectedCategory === 'All'
      ? shipStore.catalog
      : shipStore.catalog.filter(s => s.class === selectedCategory);

    if (budgetMode === 'affordable') {
      list = list.filter(s => s.price <= playerStore.credits);
    } else if (budgetMode === 'custom' && customBudget > 0) {
      list = list.filter(s => s.price <= customBudget);
    }

    return list;
  });

  // Find max values in catalog for stat bars
  let maxStats = $derived.by(() => {
    const c = shipStore.catalog;
    if (c.length === 0) return { hull: 1, shield: 1, cargo: 1, speed: 1, fuel: 1 };
    return {
      hull: Math.max(...c.map(s => s.base_hull)),
      shield: Math.max(...c.map(s => s.base_shields)),
      cargo: Math.max(...c.map(s => s.base_cargo)),
      speed: Math.max(...c.map(s => s.base_speed ?? 0)),
      fuel: Math.max(...c.map(s => s.base_fuel)),
    };
  });

  function buyShip(shipType: string, shipName: string) {
    if (confirm(`Buy ${shipName}?`)) ws.buyShip(shipType);
  }
</script>

{#if !playerStore.isDocked}
  <div class="not-docked">
    <span class="material-icons" style="font-size:48px;color:#263238">store</span>
    <p>Dock at a station with a shipyard to browse ships.</p>
  </div>
{:else if shipStore.catalog.length > 0}
  <!-- Category filter -->
  <div class="category-bar">
    {#each categories as cat}
      <button
        class="cat-chip"
        class:active={selectedCategory === cat}
        style={cat !== 'All' ? `--cat-color:${getCatStyle(cat).color}` : ''}
        onclick={() => selectedCategory = cat}
      >
        {#if cat !== 'All'}
          <span class="material-icons cat-icon" style="color:{getCatStyle(cat).color}">{getCatStyle(cat).icon}</span>
        {/if}
        {cat}
        {#if cat !== 'All'}
          <span class="cat-count">{shipStore.catalog.filter(s => s.class === cat).length}</span>
        {:else}
          <span class="cat-count">{shipStore.catalog.length}</span>
        {/if}
      </button>
    {/each}
  </div>

  <!-- Budget filter -->
  <div class="budget-bar">
    <span class="budget-label">Budget:</span>
    <button class="budget-chip" class:active={budgetMode === 'all'} onclick={() => budgetMode = 'all'}>
      All
    </button>
    <button class="budget-chip affordable" class:active={budgetMode === 'affordable'} onclick={() => budgetMode = 'affordable'}>
      Affordable (₡{playerStore.credits.toLocaleString()})
    </button>
    <button class="budget-chip" class:active={budgetMode === 'custom'} onclick={() => budgetMode = 'custom'}>
      Max
    </button>
    {#if budgetMode === 'custom'}
      <input
        class="budget-input mono"
        type="number"
        min="0"
        placeholder="Max price"
        bind:value={customBudget}
      />
    {/if}
    <span class="result-count mono">{filteredCatalog.length} ships</span>
  </div>

  <div class="catalog-list">
    {#each filteredCatalog as ship}
      {@const style = getCatStyle(ship.class)}
      <Card class="space-card">
        <Content>
          <div class="ship-card">
            <!-- Header -->
            <div class="ship-header">
              <div class="ship-title">
                <span class="material-icons ship-icon" style="color:{style.color}">{style.icon}</span>
                <div>
                  <span class="ship-name">{ship.name}</span>
                  <span class="class-badge" style="border-color:{style.color}; color:{style.color}">{ship.class}</span>
                </div>
              </div>
              <div class="ship-price-area">
                {#if ship.price === 0}
                  <span class="price-free">FREE</span>
                {:else}
                  <span class="price-val">₡{ship.price.toLocaleString()}</span>
                {/if}
              </div>
            </div>

            <p class="ship-desc">{ship.description}</p>

            <!-- Stats grid -->
            <div class="stats-grid">
              <div class="stat-item">
                <div class="stat-header">
                  <span class="stat-label">Hull</span>
                  <span class="stat-value mono">{ship.base_hull}</span>
                </div>
                <LinearProgress progress={ship.base_hull / maxStats.hull} class="progress-hull" />
              </div>
              <div class="stat-item">
                <div class="stat-header">
                  <span class="stat-label">Shield</span>
                  <span class="stat-value mono">{ship.base_shields}</span>
                </div>
                <LinearProgress progress={ship.base_shields / maxStats.shield} class="progress-shield" />
              </div>
              <div class="stat-item">
                <div class="stat-header">
                  <span class="stat-label">Cargo</span>
                  <span class="stat-value mono">{ship.base_cargo} m³</span>
                </div>
                <LinearProgress progress={ship.base_cargo / maxStats.cargo} style="--mdc-theme-primary:#ff9800" />
              </div>
              <div class="stat-item">
                <div class="stat-header">
                  <span class="stat-label">Fuel</span>
                  <span class="stat-value mono">{ship.base_fuel}</span>
                </div>
                <LinearProgress progress={ship.base_fuel / maxStats.fuel} style="--mdc-theme-primary:#66bb6a" />
              </div>
            </div>

            <!-- Slots & extras -->
            <div class="slot-row">
              {#if ship.weapon_slots}
                <span class="slot-chip weapon" title="Weapon slots">
                  <span class="material-icons slot-icon">gps_fixed</span>{ship.weapon_slots}
                </span>
              {/if}
              {#if ship.defense_slots}
                <span class="slot-chip defense" title="Defense slots">
                  <span class="material-icons slot-icon">shield</span>{ship.defense_slots}
                </span>
              {/if}
              {#if ship.utility_slots}
                <span class="slot-chip utility" title="Utility slots">
                  <span class="material-icons slot-icon">build</span>{ship.utility_slots}
                </span>
              {/if}
              {#if ship.base_armor}
                <span class="slot-chip armor" title="Armor">
                  <span class="material-icons slot-icon">security</span>{ship.base_armor}
                </span>
              {/if}
              {#if ship.base_speed}
                <span class="slot-chip speed" title="Speed">
                  <span class="material-icons slot-icon">speed</span>{ship.base_speed}
                </span>
              {/if}
              {#if ship.cpu_capacity}
                <span class="slot-chip cpu" title="CPU">CPU {ship.cpu_capacity}</span>
              {/if}
              {#if ship.power_capacity}
                <span class="slot-chip power" title="Power">PWR {ship.power_capacity}</span>
              {/if}
            </div>

            {#if ship.required_skills && Object.keys(ship.required_skills).length > 0}
              <div class="req-skills">
                <span class="req-label">Required:</span>
                {#each Object.entries(ship.required_skills) as [skill, level]}
                  <span class="req-chip">{skill} Lv{level}</span>
                {/each}
              </div>
            {/if}

            <!-- Buy button -->
            <button class="buy-btn" onclick={() => buyShip(ship.id, ship.name)}>
              <span class="material-icons buy-icon">shopping_cart</span>
              {#if ship.price === 0}
                Claim Free Ship
              {:else}
                Buy for ₡{ship.price.toLocaleString()}
              {/if}
            </button>
          </div>
        </Content>
      </Card>
    {/each}
  </div>
{:else}
  <div class="not-docked">
    <p class="empty-hint">No ships in catalog</p>
    <Button variant="outlined" onclick={() => ws.getShipCatalog()} style="margin-top:8px">
      <Label>Load Catalog</Label>
    </Button>
  </div>
{/if}

<style>
  .not-docked {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 200px;
    gap: 12px;
    color: #37474f;
  }
  .not-docked p { font-size: 0.85rem; }

  .empty-hint {
    font-size: 0.75rem;
    color: #263238;
    text-align: center;
    padding: 12px 0;
  }

  /* Category filter bar */
  .category-bar {
    display: flex;
    gap: 4px;
    margin-bottom: 12px;
    overflow-x: auto;
    padding-bottom: 4px;
  }

  .cat-chip {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 5px 10px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 16px;
    color: #78909c;
    font-size: 0.7rem;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }

  .cat-chip:hover { background: rgba(255,255,255,0.06); }

  .cat-chip.active {
    background: rgba(79,195,247,0.1);
    border-color: var(--cat-color, #4fc3f7);
    color: var(--cat-color, #4fc3f7);
  }

  .cat-icon { font-size: 14px; }

  .cat-count {
    font-size: 0.58rem;
    color: #546e7a;
    background: rgba(255,255,255,0.05);
    border-radius: 8px;
    padding: 1px 5px;
    font-family: 'Roboto Mono', monospace;
  }

  /* Budget filter */
  .budget-bar {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 12px;
    flex-wrap: wrap;
  }

  .budget-label {
    font-size: 0.68rem;
    color: #546e7a;
    margin-right: 4px;
  }

  .budget-chip {
    padding: 4px 10px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px;
    color: #78909c;
    font-size: 0.68rem;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }

  .budget-chip:hover { background: rgba(255,255,255,0.06); }

  .budget-chip.active {
    background: rgba(255,215,0,0.1);
    border-color: rgba(255,215,0,0.35);
    color: #ffd700;
  }

  .budget-chip.affordable.active {
    background: rgba(76,175,80,0.1);
    border-color: rgba(76,175,80,0.35);
    color: #66bb6a;
  }

  .budget-input {
    width: 100px;
    padding: 4px 8px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,215,0,0.3);
    border-radius: 4px;
    color: #ffd700;
    font-size: 0.7rem;
    outline: none;
  }

  .budget-input:focus { border-color: rgba(255,215,0,0.5); }

  .result-count {
    font-size: 0.62rem;
    color: #546e7a;
    margin-left: auto;
  }

  /* Catalog list — responsive grid up to 3 columns */
  .catalog-list {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }

  @media (max-width: 960px) {
    .catalog-list { grid-template-columns: repeat(2, 1fr); }
  }

  @media (max-width: 600px) {
    .catalog-list { grid-template-columns: 1fr; }
  }

  .ship-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /* Header */
  .ship-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .ship-title {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .ship-icon { font-size: 22px; }

  .ship-name {
    font-size: 0.95rem;
    font-weight: 400;
    color: #cfd8dc;
    display: block;
  }

  .class-badge {
    font-size: 0.58rem;
    font-family: 'Roboto Mono', monospace;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 1px 6px;
    border: 1px solid;
    border-radius: 3px;
  }

  .ship-price-area {
    text-align: right;
    flex-shrink: 0;
  }

  .price-val {
    font-family: 'Roboto Mono', monospace;
    font-size: 1rem;
    font-weight: 500;
    color: #ffd700;
  }

  .price-free {
    font-family: 'Roboto Mono', monospace;
    font-size: 0.85rem;
    font-weight: 500;
    color: #66bb6a;
    background: rgba(76,175,80,0.12);
    border: 1px solid rgba(76,175,80,0.3);
    border-radius: 3px;
    padding: 2px 8px;
  }

  .ship-desc {
    font-size: 0.72rem;
    color: #546e7a;
    margin: 0;
    line-height: 1.4;
  }

  /* Stats grid — 2x2 */
  .stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 16px;
  }

  .stat-item { display: flex; flex-direction: column; gap: 2px; }

  .stat-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .stat-label { font-size: 0.65rem; color: #4a6070; text-transform: uppercase; letter-spacing: 0.05em; }
  .stat-value { font-size: 0.72rem; color: #b0bec5; }

  /* Slot chips */
  .slot-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .slot-chip {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-size: 0.62rem;
    font-family: 'Roboto Mono', monospace;
    padding: 2px 6px;
    border-radius: 3px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    color: #78909c;
  }

  .slot-icon { font-size: 12px; }
  .slot-chip.weapon { border-color: rgba(244,67,54,0.25); color: #ef5350; }
  .slot-chip.defense { border-color: rgba(33,150,243,0.25); color: #42a5f5; }
  .slot-chip.utility { border-color: rgba(255,152,0,0.25); color: #ffa726; }
  .slot-chip.armor { border-color: rgba(158,158,158,0.25); color: #bdbdbd; }
  .slot-chip.speed { border-color: rgba(79,195,247,0.25); color: #4fc3f7; }
  .slot-chip.cpu { border-color: rgba(206,147,216,0.2); color: #ce93d8; }
  .slot-chip.power { border-color: rgba(255,213,79,0.2); color: #ffd54f; }

  /* Required skills */
  .req-skills {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
  }

  .req-label {
    font-size: 0.62rem;
    color: #546e7a;
  }

  .req-chip {
    font-size: 0.58rem;
    font-family: 'Roboto Mono', monospace;
    padding: 1px 6px;
    border-radius: 3px;
    background: rgba(255,152,0,0.08);
    border: 1px solid rgba(255,152,0,0.2);
    color: #ff9800;
  }

  /* Buy button — prominent */
  .buy-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    padding: 10px 16px;
    margin-top: 4px;
    background: rgba(76,175,80,0.1);
    border: 1px solid rgba(76,175,80,0.4);
    border-radius: 6px;
    color: #66bb6a;
    font-size: 0.82rem;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.2s;
  }

  .buy-btn:hover {
    background: rgba(76,175,80,0.2);
    border-color: rgba(76,175,80,0.6);
    color: #81c784;
  }

  .buy-icon { font-size: 18px; }

  .mono { font-family: 'Roboto Mono', monospace; }
</style>
