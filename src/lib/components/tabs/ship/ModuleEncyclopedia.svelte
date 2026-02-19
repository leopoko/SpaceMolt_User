<script lang="ts">
  import Card, { Content } from '@smui/card';
  import Button, { Label } from '@smui/button';
  import LinearProgress from '@smui/linear-progress';
  import { catalogStore } from '$lib/stores/catalog.svelte';
  import { uiStore } from '$lib/stores/ui.svelte';
  import { ws } from '$lib/services/websocket';
  import type { CatalogEntry, CatalogResponse } from '$lib/types/game';

  const PAGE_SIZE = 50;

  interface ModuleInfo {
    type_id: string;
    name: string;
    description: string;
    type: string; // weapon, defense, utility
    cpu_usage: number;
    power_usage: number;
    base_value: number;
    hidden?: boolean;
    // weapon fields
    damage?: number;
    damage_type?: string;
    range?: number;
    reach?: number;
    cooldown?: number;
    ammo_type?: string;
    magazine_size?: number;
    special?: string;
    // defense fields
    shield_bonus?: number;
    armor_bonus?: number;
    hull_bonus?: number;
    shield_recharge_bonus?: number;
    resistance_em?: number;
    resistance_thermal?: number;
    resistance_kinetic?: number;
    resistance_explosive?: number;
    // utility fields
    cargo_bonus?: number;
    fuel_bonus?: number;
    speed_bonus?: number;
    mining_bonus?: number;
    mining_yield?: number;
    scan_bonus?: number;
    cloak_strength?: number;
    survey_power?: number;
    survey_range?: number;
    tracking_bonus?: number;
    accuracy_bonus?: number;
    signature_bonus?: number;
    // raw entry for any extra fields
    _raw: CatalogEntry;
  }

  let modules = $state<ModuleInfo[]>([]);
  let loading = $state(false);
  let loaded = $state(false);
  let progress = $state(0);
  let totalItems = $state(0);
  let filterType = $state<string>('all');
  let searchText = $state('');

  function toModule(item: CatalogEntry): ModuleInfo {
    return {
      type_id: item.type_id ?? item.id ?? '',
      name: item.name ?? '',
      description: item.description ?? '',
      type: item.type ?? 'unknown',
      cpu_usage: item.cpu_usage ?? 0,
      power_usage: item.power_usage ?? 0,
      base_value: item.base_value ?? 0,
      hidden: item.hidden,
      damage: item.damage,
      damage_type: item.damage_type,
      range: item.range,
      reach: item.reach,
      cooldown: item.cooldown,
      ammo_type: item.ammo_type,
      magazine_size: item.magazine_size,
      special: item.special,
      shield_bonus: item.shield_bonus,
      armor_bonus: item.armor_bonus,
      hull_bonus: item.hull_bonus,
      shield_recharge_bonus: item.shield_recharge_bonus,
      resistance_em: item.resistance_em,
      resistance_thermal: item.resistance_thermal,
      resistance_kinetic: item.resistance_kinetic,
      resistance_explosive: item.resistance_explosive,
      cargo_bonus: item.cargo_bonus,
      fuel_bonus: item.fuel_bonus,
      speed_bonus: item.speed_bonus,
      mining_bonus: item.mining_bonus,
      mining_yield: item.mining_yield,
      scan_bonus: item.scan_bonus,
      cloak_strength: item.cloak_strength,
      survey_power: item.survey_power,
      survey_range: item.survey_range,
      tracking_bonus: item.tracking_bonus,
      accuracy_bonus: item.accuracy_bonus,
      signature_bonus: item.signature_bonus,
      _raw: item,
    };
  }

  function startFetch() {
    modules = [];
    loading = true;
    loaded = false;
    progress = 0;
    totalItems = 0;

    const accumulated: ModuleInfo[] = [];

    catalogStore.onItemsBulkResponse = (resp: CatalogResponse) => {
      // Filter items with cpu_usage or power_usage
      const mods = (resp.items ?? [])
        .filter(i => i.cpu_usage != null || i.power_usage != null)
        .map(toModule);
      accumulated.push(...mods);
      totalItems = resp.total;
      progress = resp.page / resp.total_pages;

      if (resp.page < resp.total_pages) {
        // Fetch next page
        ws.catalog('items', { page: resp.page + 1, page_size: PAGE_SIZE });
      } else {
        // Done
        modules = accumulated;
        loading = false;
        loaded = true;
        catalogStore.onItemsBulkResponse = null;
      }
    };

    ws.catalog('items', { page: 1, page_size: PAGE_SIZE });
  }

  function goToCrafting(typeId: string) {
    uiStore.navigateToCrafting(typeId, 'output');
  }

  // Filtered & sorted list
  let filtered = $derived.by(() => {
    let list = modules;
    if (filterType !== 'all') {
      list = list.filter(m => m.type === filterType);
    }
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      list = list.filter(m =>
        m.name.toLowerCase().includes(q) ||
        m.type_id.toLowerCase().includes(q) ||
        (m.description ?? '').toLowerCase().includes(q) ||
        (m.special ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  });

  // Count by type
  let typeCount = $derived.by(() => {
    const counts: Record<string, number> = {};
    for (const m of modules) {
      counts[m.type] = (counts[m.type] ?? 0) + 1;
    }
    return counts;
  });

  let types = $derived(Object.keys(typeCount).sort());

  // Slot type label/color
  const typeLabel: Record<string, string> = {
    weapon: 'Weapon',
    defense: 'Defense',
    utility: 'Utility',
  };
  const typeColor: Record<string, string> = {
    weapon: '#ef5350',
    defense: '#42a5f5',
    utility: '#ffa726',
  };
</script>

<div class="enc-page">
  {#if !loaded && !loading}
    <Card class="space-card">
      <Content>
        <div class="load-prompt">
          <p class="tab-section-title">
            <span class="material-icons section-icon">menu_book</span>
            Module Encyclopedia
          </p>
          <p class="desc">Fetch all items from the catalog and list modules (equipment with CPU/Power usage).</p>
          <p class="desc warn">This will send multiple requests to retrieve all catalog pages.</p>
          <Button variant="outlined" onclick={startFetch}>
            <Label>Load Module Encyclopedia</Label>
          </Button>
        </div>
      </Content>
    </Card>
  {:else if loading}
    <Card class="space-card">
      <Content>
        <p class="tab-section-title">
          <span class="material-icons section-icon">menu_book</span>
          Loading Module Encyclopedia...
        </p>
        <div class="progress-area">
          <LinearProgress progress={progress} />
          <p class="progress-text mono">
            {Math.round(progress * 100)}% — {modules.length} modules found
            {#if totalItems > 0}(scanning {totalItems} items){/if}
          </p>
        </div>
      </Content>
    </Card>
  {:else}
    <!-- Loaded: filters + list -->
    <Card class="space-card">
      <Content>
        <p class="tab-section-title">
          <span class="material-icons section-icon">menu_book</span>
          Module Encyclopedia
          <span class="badge mono">{modules.length} modules</span>
          <button class="reload-btn" title="Reload" onclick={startFetch}>
            <span class="material-icons">refresh</span>
          </button>
        </p>

        <div class="filter-bar">
          <button
            class="type-chip"
            class:active={filterType === 'all'}
            onclick={() => filterType = 'all'}
          >All ({modules.length})</button>
          {#each types as t}
            <button
              class="type-chip"
              class:active={filterType === t}
              style="--chip-color: {typeColor[t] ?? '#78909c'}"
              onclick={() => filterType = t}
            >{typeLabel[t] ?? t} ({typeCount[t]})</button>
          {/each}
        </div>

        <div class="search-bar">
          <span class="material-icons search-icon">search</span>
          <input
            type="text"
            class="search-input"
            placeholder="Search modules..."
            bind:value={searchText}
          />
          {#if searchText}
            <button class="clear-btn" onclick={() => searchText = ''}>
              <span class="material-icons">close</span>
            </button>
          {/if}
          <span class="result-count mono">{filtered.length} results</span>
        </div>
      </Content>
    </Card>

    {#if filtered.length === 0}
      <p class="empty-hint">No modules match the filter</p>
    {:else}
      <div class="mod-grid">
        {#each filtered as mod}
          <Card class="space-card mod-card">
            <Content>
              <div class="mod-header">
                <span class="mod-name">{mod.name}</span>
                <span class="mod-type-badge" style="color: {typeColor[mod.type] ?? '#78909c'}; border-color: {typeColor[mod.type] ?? '#78909c'}">
                  {typeLabel[mod.type] ?? mod.type}
                </span>
              </div>
              <span class="mod-id mono">{mod.type_id}</span>
              {#if mod.hidden}
                <span class="hidden-badge">HIDDEN</span>
              {/if}
              {#if mod.description}
                <p class="mod-desc">{mod.description}</p>
              {/if}

              <!-- CPU / Power -->
              <div class="fit-row">
                <span class="fit-item cpu">
                  <span class="fit-label">CPU</span>
                  <span class="fit-val mono">{mod.cpu_usage}</span>
                </span>
                <span class="fit-item pwr">
                  <span class="fit-label">PWR</span>
                  <span class="fit-val mono">{mod.power_usage}</span>
                </span>
                {#if mod.base_value > 0}
                  <span class="fit-item val">
                    <span class="fit-label">Value</span>
                    <span class="fit-val mono">₡{mod.base_value.toLocaleString()}</span>
                  </span>
                {/if}
              </div>

              <!-- Weapon stats -->
              {#if mod.type === 'weapon'}
                <div class="stat-grid">
                  {#if mod.damage != null}
                    <div class="stat"><span class="sl">Damage</span><span class="sv mono">{mod.damage}{#if mod.damage_type} <span class="dmg-type">{mod.damage_type}</span>{/if}</span></div>
                  {/if}
                  {#if mod.range != null}
                    <div class="stat"><span class="sl">Range</span><span class="sv mono">{mod.range}</span></div>
                  {/if}
                  {#if mod.reach != null && mod.reach > 1}
                    <div class="stat"><span class="sl">Reach</span><span class="sv mono">{mod.reach}</span></div>
                  {/if}
                  {#if mod.cooldown != null}
                    <div class="stat"><span class="sl">Cooldown</span><span class="sv mono">{mod.cooldown}t</span></div>
                  {/if}
                  {#if mod.ammo_type}
                    <div class="stat"><span class="sl">Ammo</span><span class="sv mono">{mod.ammo_type}</span></div>
                  {/if}
                  {#if mod.magazine_size != null}
                    <div class="stat"><span class="sl">Magazine</span><span class="sv mono">{mod.magazine_size}</span></div>
                  {/if}
                </div>
              {/if}

              <!-- Defense stats -->
              {#if mod.type === 'defense'}
                <div class="stat-grid">
                  {#if mod.shield_bonus != null}
                    <div class="stat"><span class="sl">Shield</span><span class="sv mono">+{mod.shield_bonus}</span></div>
                  {/if}
                  {#if mod.armor_bonus != null}
                    <div class="stat"><span class="sl">Armor</span><span class="sv mono">+{mod.armor_bonus}</span></div>
                  {/if}
                  {#if mod.hull_bonus != null}
                    <div class="stat"><span class="sl">Hull</span><span class="sv mono">+{mod.hull_bonus}</span></div>
                  {/if}
                  {#if mod.shield_recharge_bonus != null}
                    <div class="stat"><span class="sl">Recharge</span><span class="sv mono">+{mod.shield_recharge_bonus}</span></div>
                  {/if}
                  {#if mod.resistance_em != null}
                    <div class="stat"><span class="sl">EM Res</span><span class="sv mono">{mod.resistance_em}%</span></div>
                  {/if}
                  {#if mod.resistance_thermal != null}
                    <div class="stat"><span class="sl">Therm Res</span><span class="sv mono">{mod.resistance_thermal}%</span></div>
                  {/if}
                  {#if mod.resistance_kinetic != null}
                    <div class="stat"><span class="sl">Kine Res</span><span class="sv mono">{mod.resistance_kinetic}%</span></div>
                  {/if}
                  {#if mod.resistance_explosive != null}
                    <div class="stat"><span class="sl">Explo Res</span><span class="sv mono">{mod.resistance_explosive}%</span></div>
                  {/if}
                </div>
              {/if}

              <!-- Utility stats -->
              {#if mod.type === 'utility'}
                <div class="stat-grid">
                  {#if mod.cargo_bonus != null}
                    <div class="stat"><span class="sl">Cargo</span><span class="sv mono">+{mod.cargo_bonus}</span></div>
                  {/if}
                  {#if mod.fuel_bonus != null}
                    <div class="stat"><span class="sl">Fuel</span><span class="sv mono">+{mod.fuel_bonus}</span></div>
                  {/if}
                  {#if mod.speed_bonus != null}
                    <div class="stat"><span class="sl">Speed</span><span class="sv mono">+{mod.speed_bonus}</span></div>
                  {/if}
                  {#if mod.mining_bonus != null}
                    <div class="stat"><span class="sl">Mining</span><span class="sv mono">+{mod.mining_bonus}</span></div>
                  {/if}
                  {#if mod.mining_yield != null}
                    <div class="stat"><span class="sl">Yield</span><span class="sv mono">+{mod.mining_yield}</span></div>
                  {/if}
                  {#if mod.scan_bonus != null}
                    <div class="stat"><span class="sl">Scan</span><span class="sv mono">+{mod.scan_bonus}</span></div>
                  {/if}
                  {#if mod.cloak_strength != null}
                    <div class="stat"><span class="sl">Cloak</span><span class="sv mono">{mod.cloak_strength}</span></div>
                  {/if}
                  {#if mod.survey_power != null}
                    <div class="stat"><span class="sl">Survey PWR</span><span class="sv mono">{mod.survey_power}</span></div>
                  {/if}
                  {#if mod.survey_range != null}
                    <div class="stat"><span class="sl">Survey RNG</span><span class="sv mono">{mod.survey_range}</span></div>
                  {/if}
                  {#if mod.tracking_bonus != null}
                    <div class="stat"><span class="sl">Tracking</span><span class="sv mono">+{mod.tracking_bonus}</span></div>
                  {/if}
                  {#if mod.accuracy_bonus != null}
                    <div class="stat"><span class="sl">Accuracy</span><span class="sv mono">+{mod.accuracy_bonus}</span></div>
                  {/if}
                  {#if mod.signature_bonus != null}
                    <div class="stat"><span class="sl">Sig Bonus</span><span class="sv mono">+{mod.signature_bonus}</span></div>
                  {/if}
                </div>
              {/if}

              <!-- Special -->
              {#if mod.special}
                <div class="special-row">
                  <span class="material-icons sp-icon">auto_awesome</span>
                  <span class="special-text mono">{mod.special}</span>
                </div>
              {/if}

              <!-- Actions -->
              <div class="action-row">
                <button class="action-btn craft" title="Find recipe in Crafting" onclick={() => goToCrafting(mod.type_id)}>
                  <span class="material-icons">precision_manufacturing</span>
                  <span>Recipe</span>
                </button>
              </div>
            </Content>
          </Card>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .enc-page {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .load-prompt {
    text-align: center;
    padding: 16px 0;
  }
  .load-prompt .desc {
    font-size: 0.72rem;
    color: #546e7a;
    margin: 6px 0;
  }
  .load-prompt .warn {
    color: #78909c;
    font-size: 0.65rem;
    margin-bottom: 14px;
  }

  .tab-section-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.85rem;
    color: #4fc3f7;
    margin: 0 0 8px;
  }
  .section-icon { font-size: 18px; }

  .badge {
    font-size: 0.58rem;
    color: #546e7a;
    background: rgba(255,255,255,0.05);
    border-radius: 8px;
    padding: 1px 6px;
    margin-left: 4px;
  }

  .reload-btn {
    margin-left: auto;
    display: flex;
    align-items: center;
    background: none;
    border: 1px solid rgba(79,195,247,0.2);
    border-radius: 4px;
    color: #4fc3f7;
    cursor: pointer;
    padding: 2px;
    transition: all 0.15s;
  }
  .reload-btn:hover { background: rgba(79,195,247,0.1); }
  .reload-btn .material-icons { font-size: 16px; }

  /* Progress */
  .progress-area {
    margin-top: 12px;
  }
  .progress-text {
    font-size: 0.68rem;
    color: #78909c;
    text-align: center;
    margin-top: 8px;
  }

  /* Filter bar */
  .filter-bar {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    margin-bottom: 8px;
  }

  .type-chip {
    font-size: 0.65rem;
    font-family: 'Roboto Mono', monospace;
    padding: 3px 10px;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.1);
    background: transparent;
    color: #78909c;
    cursor: pointer;
    transition: all 0.15s;
  }
  .type-chip:hover {
    border-color: rgba(255,255,255,0.2);
    color: #b0bec5;
  }
  .type-chip.active {
    background: rgba(79,195,247,0.1);
    border-color: var(--chip-color, #4fc3f7);
    color: var(--chip-color, #4fc3f7);
  }

  /* Search */
  .search-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 4px;
    padding: 4px 8px;
  }
  .search-icon { font-size: 16px; color: #546e7a; }
  .search-input {
    flex: 1;
    background: none;
    border: none;
    color: #b0bec5;
    font-size: 0.73rem;
    outline: none;
    font-family: inherit;
  }
  .search-input::placeholder { color: #37474f; }
  .clear-btn {
    background: none;
    border: none;
    color: #546e7a;
    cursor: pointer;
    display: flex;
    padding: 0;
  }
  .clear-btn .material-icons { font-size: 15px; }
  .result-count {
    font-size: 0.6rem;
    color: #546e7a;
    white-space: nowrap;
  }

  /* Module grid */
  .mod-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 8px;
  }

  .mod-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 6px;
  }
  .mod-name {
    font-size: 0.82rem;
    color: #b0bec5;
    font-weight: 500;
  }
  .mod-type-badge {
    font-size: 0.56rem;
    font-family: 'Roboto Mono', monospace;
    padding: 1px 6px;
    border-radius: 3px;
    border: 1px solid;
    opacity: 0.8;
    white-space: nowrap;
  }
  .mod-id {
    font-size: 0.58rem;
    color: #4a6070;
    display: block;
    margin-bottom: 2px;
  }
  .hidden-badge {
    font-size: 0.5rem;
    font-family: 'Roboto Mono', monospace;
    color: #78909c;
    background: rgba(255,255,255,0.04);
    padding: 0 4px;
    border-radius: 2px;
  }
  .mod-desc {
    font-size: 0.68rem;
    color: #546e7a;
    margin: 4px 0 6px;
    line-height: 1.35;
  }

  /* Fitting row */
  .fit-row {
    display: flex;
    gap: 10px;
    margin: 6px 0;
    flex-wrap: wrap;
  }
  .fit-item {
    display: flex;
    gap: 4px;
    align-items: center;
    font-size: 0.68rem;
  }
  .fit-label { color: #4a6070; }
  .fit-val { font-size: 0.7rem; }
  .fit-item.cpu .fit-val { color: #ce93d8; }
  .fit-item.pwr .fit-val { color: #ffd54f; }
  .fit-item.val .fit-val { color: #ffd700; }

  /* Stat grid */
  .stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: 2px 10px;
    margin-top: 4px;
  }
  .stat {
    display: flex;
    justify-content: space-between;
    font-size: 0.66rem;
    padding: 2px 0;
    border-bottom: 1px solid rgba(255,255,255,0.02);
  }
  .sl { color: #4a6070; }
  .sv { color: #90a4ae; }

  .dmg-type {
    font-size: 0.58rem;
    color: #78909c;
    text-transform: capitalize;
  }

  /* Special */
  .special-row {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 6px;
    padding: 3px 6px;
    background: rgba(255,215,0,0.04);
    border: 1px solid rgba(255,215,0,0.1);
    border-radius: 3px;
  }
  .sp-icon { font-size: 13px; color: #ffd700; }
  .special-text { font-size: 0.6rem; color: #ffd700; word-break: break-all; }

  /* Actions */
  .action-row {
    display: flex;
    gap: 6px;
    margin-top: 8px;
    justify-content: flex-end;
  }
  .action-btn {
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: 0.62rem;
    font-family: inherit;
    padding: 3px 8px;
    border-radius: 3px;
    border: 1px solid;
    background: transparent;
    cursor: pointer;
    transition: all 0.15s;
  }
  .action-btn .material-icons { font-size: 14px; }
  .action-btn.craft {
    color: #4fc3f7;
    border-color: rgba(79,195,247,0.25);
  }
  .action-btn.craft:hover {
    background: rgba(79,195,247,0.1);
    border-color: rgba(79,195,247,0.45);
  }

  .empty-hint {
    font-size: 0.75rem;
    color: #263238;
    text-align: center;
    padding: 12px 0;
  }

  .mono { font-family: 'Roboto Mono', monospace; }
</style>
