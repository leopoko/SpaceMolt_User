<script lang="ts">
  import Card, { Content } from '@smui/card';
  import LinearProgress from '@smui/linear-progress';
  import { shipStore } from '$lib/stores/ship.svelte';
  import { playerStore } from '$lib/stores/player.svelte';
  import { shipCatalogStore } from '$lib/stores/shipCatalog.svelte';
  import { ws } from '$lib/services/websocket';
  import type { ShowroomShip, CommissionOrder, ShipListing, ShipCatalogEntry } from '$lib/types/game';

  // ---- Sub-section tabs ----
  type Section = 'catalog' | 'showroom' | 'commission' | 'exchange';
  let activeSection = $state<Section>('catalog');

  const sections: { id: Section; label: string; icon: string }[] = [
    { id: 'catalog',    label: 'Catalog',    icon: 'auto_stories' },
    { id: 'showroom',   label: 'Showroom',   icon: 'storefront' },
    { id: 'commission', label: 'Commission', icon: 'precision_manufacturing' },
    { id: 'exchange',   label: 'Exchange',   icon: 'swap_horiz' },
  ];

  // ---- Auto-refresh ----
  $effect(() => {
    if (playerStore.isDocked) {
      ws.shipyardShowroom();
    }
  });

  // Auto-fetch catalog on first visit
  $effect(() => {
    if (activeSection === 'catalog' && !shipCatalogStore.loaded && !shipCatalogStore.loading) {
      shipCatalogStore.fetchCatalog();
    }
  });

  // ---- Catalog ----

  const scaleLabel: Record<number, string> = {
    1: 'Personal', 2: 'Small', 3: 'Medium', 4: 'Large', 5: 'Capital',
  };

  const empireColors: Record<string, string> = {
    solarian: '#ffd700',
    voidborn: '#7c4dff',
    crimson: '#f44336',
    nebula: '#4fc3f7',
    outerrim: '#ff9800',
  };

  function getEmpireColor(empire: string): string {
    return empireColors[empire] ?? '#90a4ae';
  }

  function commissionFromCatalog(ship: ShipCatalogEntry) {
    quoteShipClass = ship.id;
    activeSection = 'commission';
    loadCommissions();
    ws.commissionQuote(ship.id);
  }

  // ---- Showroom ----

  const categoryStyle: Record<string, { color: string; icon: string }> = {
    Mining:      { color: '#ff9800', icon: 'hardware' },
    Combat:      { color: '#f44336', icon: 'gps_fixed' },
    Trade:       { color: '#ffd700', icon: 'local_shipping' },
    Commercial:  { color: '#ffd700', icon: 'local_shipping' },
    Explorer:    { color: '#4fc3f7', icon: 'explore' },
    Exploration: { color: '#4fc3f7', icon: 'explore' },
    Capital:     { color: '#ce93d8', icon: 'shield' },
    Stealth:     { color: '#78909c', icon: 'visibility_off' },
    Support:     { color: '#66bb6a', icon: 'healing' },
    Industrial:  { color: '#ff9800', icon: 'precision_manufacturing' },
    Hybrid:      { color: '#26c6da', icon: 'auto_awesome' },
  };

  function getCatStyle(cls: string) {
    return categoryStyle[cls] ?? { color: '#90a4ae', icon: 'rocket_launch' };
  }

  let showroomCategories = $derived.by(() => {
    const set = new Set<string>();
    for (const s of shipStore.showroom) if (s.category) set.add(s.category);
    return ['All', ...Array.from(set).sort()];
  });

  let selectedCategory = $state<string>('All');

  let filteredShowroom = $derived.by(() => {
    if (selectedCategory === 'All') return shipStore.showroom;
    return shipStore.showroom.filter(s => s.category === selectedCategory);
  });

  let showroomMaxStats = $derived.by(() => {
    const c = shipStore.showroom;
    if (c.length === 0) return { hull: 1, shield: 1, cargo: 1, fuel: 1 };
    return {
      hull: Math.max(1, ...c.map(s => s.hull ?? 0)),
      shield: Math.max(1, ...c.map(s => s.shield ?? 0)),
      cargo: Math.max(1, ...c.map(s => s.cargo_capacity ?? 0)),
      fuel: Math.max(1, ...c.map(s => s.fuel ?? 0)),
    };
  });

  function buyFromShowroom(ship: ShowroomShip) {
    if (confirm(`Buy ${ship.name} for ₡${ship.price.toLocaleString()}?`)) {
      ws.buyShip(ship.ship_class);
    }
  }

  // ---- Commission ----

  let quoteShipClass = $state('');
  let commissionProvideMaterials = $state(false);

  function loadCommissions() {
    ws.commissionStatus();
  }

  function requestQuote() {
    if (!quoteShipClass.trim()) return;
    ws.commissionQuote(quoteShipClass.trim());
  }

  function placeCommission() {
    const q = shipStore.commissionQuote;
    if (!q) return;
    const mode = commissionProvideMaterials ? 'provide materials' : 'credits only';
    if (confirm(`Commission ${q.ship_name ?? q.ship_class}? (${mode})`)) {
      ws.commissionShip(q.ship_class, commissionProvideMaterials);
    }
  }

  function claimCommission(order: CommissionOrder) {
    ws.claimCommission(order.commission_id);
  }

  function cancelCommission(order: CommissionOrder) {
    if (confirm(`Cancel commission for ${order.ship_name ?? order.ship_class}? (50% refund)`)) {
      ws.cancelCommission(order.commission_id);
    }
  }

  // Ship list for commission dropdown — from REST API catalog
  let availableShipClasses = $derived.by(() => {
    if (shipCatalogStore.ships.length > 0) {
      return shipCatalogStore.ships.map(s => ({ id: s.id, name: s.name }));
    }
    // Unique from showroom as fallback
    const seen = new Set<string>();
    return shipStore.showroom.filter(s => {
      if (seen.has(s.ship_class)) return false;
      seen.add(s.ship_class);
      return true;
    }).map(s => ({ id: s.ship_class, name: s.name }));
  });

  // ---- Exchange ----

  function loadExchange() {
    ws.browseShips();
  }

  function buyListed(listing: ShipListing) {
    if (confirm(`Buy ${listing.ship_name ?? listing.ship_class} for ₡${listing.price.toLocaleString()}?`)) {
      ws.buyListedShip(listing.listing_id);
    }
  }

  let listShipId = $state('');
  let listShipPrice = $state(0);

  function listForSale() {
    if (!listShipId || listShipPrice <= 0) return;
    if (confirm(`List ship for ₡${listShipPrice.toLocaleString()}?`)) {
      ws.listShipForSale(listShipId, listShipPrice);
      listShipId = '';
      listShipPrice = 0;
    }
  }

  let inactiveFleetShips = $derived.by(() => {
    return shipStore.fleet.filter(s => s.id !== shipStore.activeShipId);
  });
</script>

<!-- Not docked: catalog still works, others need dock -->
<div class="section-tabs">
  {#each sections as sec}
    <button
      class="sec-tab"
      class:active={activeSection === sec.id}
      onclick={() => {
        activeSection = sec.id;
        if (sec.id === 'commission') loadCommissions();
        if (sec.id === 'exchange') loadExchange();
      }}
    >
      <span class="material-icons sec-icon">{sec.icon}</span>
      {sec.label}
    </button>
  {/each}
</div>

<!-- ========== CATALOG ========== -->
{#if activeSection === 'catalog'}
  <div class="section-head">
    <span class="tab-section-title">Ship Catalog</span>
    <span class="catalog-count mono">{shipCatalogStore.filteredShips.length} ships</span>
  </div>

  <!-- Search & Filters -->
  <div class="catalog-filters">
    <input
      class="search-input"
      type="text"
      placeholder="Search ships..."
      value={shipCatalogStore.searchQuery}
      oninput={(e) => shipCatalogStore.setSearch((e.target as HTMLInputElement).value)}
    />
    <div class="filter-row">
      <!-- Category -->
      <select class="filter-select" value={shipCatalogStore.filterCategory} onchange={(e) => shipCatalogStore.setFilter('category', (e.target as HTMLSelectElement).value)}>
        <option value="All">All Categories</option>
        {#each shipCatalogStore.categories as cat}
          <option value={cat}>{cat}</option>
        {/each}
      </select>
      <!-- Empire -->
      <select class="filter-select" value={shipCatalogStore.filterEmpire} onchange={(e) => shipCatalogStore.setFilter('empire', (e.target as HTMLSelectElement).value)}>
        <option value="All">All Empires</option>
        {#each shipCatalogStore.empires as emp}
          <option value={emp.id}>{emp.name}</option>
        {/each}
      </select>
      <!-- Tier -->
      <select class="filter-select" value={shipCatalogStore.filterTier} onchange={(e) => shipCatalogStore.setTierFilter(Number((e.target as HTMLSelectElement).value))}>
        <option value={0}>All Tiers</option>
        {#each shipCatalogStore.tiers as t}
          <option value={t}>Tier {t}</option>
        {/each}
      </select>
      <!-- Scale -->
      <select class="filter-select" value={shipCatalogStore.filterScale} onchange={(e) => shipCatalogStore.setScaleFilter(Number((e.target as HTMLSelectElement).value))}>
        <option value={0}>All Scales</option>
        {#each shipCatalogStore.scales as s}
          <option value={s}>{scaleLabel[s] ?? `Scale ${s}`}</option>
        {/each}
      </select>
      {#if shipCatalogStore.hasActiveFilters}
        <button class="clear-filters-btn" onclick={() => shipCatalogStore.clearFilters()}>
          <span class="material-icons" style="font-size:14px">close</span> Clear
        </button>
      {/if}
    </div>
    <!-- Price filter -->
    <div class="price-filter-row">
      <span class="material-icons price-filter-icon">payments</span>
      <span class="price-filter-label">Max Price:</span>
      <input
        class="price-filter-input mono"
        type="number"
        min="0"
        placeholder="No limit"
        value={shipCatalogStore.filterMaxPrice || ''}
        oninput={(e) => shipCatalogStore.setPriceFilter(Number((e.target as HTMLInputElement).value) || 0)}
      />
      <button
        class="price-preset-btn"
        class:active={shipCatalogStore.filterMaxPrice === playerStore.credits && playerStore.credits > 0}
        onclick={() => shipCatalogStore.setPriceFilter(playerStore.credits)}
        title="Filter to ships you can afford"
      >
        <span class="material-icons" style="font-size:13px">account_balance_wallet</span>
        My Credits <span class="mono">₡{playerStore.credits.toLocaleString()}</span>
      </button>
      {#if shipCatalogStore.filterMaxPrice > 0}
        <button class="price-clear-btn" onclick={() => shipCatalogStore.setPriceFilter(0)} title="Clear price filter">
          <span class="material-icons" style="font-size:12px">close</span>
        </button>
      {/if}
    </div>
  </div>

  {#if shipCatalogStore.loading}
    <LinearProgress indeterminate />
  {:else if shipCatalogStore.error}
    <div class="empty-state">
      <span class="material-icons" style="font-size:36px;color:#f44336">error</span>
      <p>Failed to load ship catalog: {shipCatalogStore.error}</p>
      <button class="action-btn" onclick={() => shipCatalogStore.fetchCatalog()}>Retry</button>
    </div>
  {:else if shipCatalogStore.selectedShip}
    <!-- ====== Ship Detail View ====== -->
    {@const ship = shipCatalogStore.selectedShip}
    {@const cs = getCatStyle(ship.category)}
    {@const maxS = shipCatalogStore.maxStats}
    <div class="detail-view">
      <button class="back-btn" onclick={() => shipCatalogStore.selectShip(null)}>
        <span class="material-icons" style="font-size:16px">arrow_back</span> Back to List
      </button>

      <Card class="space-card detail-card">
        <Content>
          <div class="detail-header">
            <div class="detail-title-row">
              <span class="material-icons detail-icon" style="color:{cs.color}">{cs.icon}</span>
              <div>
                <h2 class="detail-name">{ship.name}</h2>
                <div class="detail-meta">
                  <span class="class-badge" style="border-color:{cs.color};color:{cs.color}">{ship.category}</span>
                  <span class="class-badge" style="border-color:{getEmpireColor(ship.empire)};color:{getEmpireColor(ship.empire)}">{ship.empire_name}</span>
                  <span class="tier-badge">T{ship.tier}</span>
                  <span class="scale-badge">{scaleLabel[ship.scale] ?? `Scale ${ship.scale}`}</span>
                </div>
              </div>
            </div>
            <div class="detail-price">
              <span class="price-val">₡{ship.price.toLocaleString()}</span>
              <span class="detail-class-id mono">{ship.class} &middot; {ship.id}</span>
            </div>
          </div>

          <p class="detail-desc">{ship.description}</p>

          {#if ship.lore}
            <div class="lore-block">
              <span class="material-icons lore-icon">menu_book</span>
              <p class="lore-text">{ship.lore}</p>
            </div>
          {/if}

          <!-- Stats -->
          <div class="detail-stats">
            <div class="stat-item">
              <div class="stat-header"><span class="stat-label">Hull</span><span class="stat-value mono">{ship.base_hull}</span></div>
              <LinearProgress progress={ship.base_hull / maxS.hull} class="progress-hull" />
            </div>
            <div class="stat-item">
              <div class="stat-header"><span class="stat-label">Shield</span><span class="stat-value mono">{ship.base_shield}</span></div>
              <LinearProgress progress={maxS.shield > 0 ? ship.base_shield / maxS.shield : 0} class="progress-shield" />
            </div>
            <div class="stat-item">
              <div class="stat-header"><span class="stat-label">Armor</span><span class="stat-value mono">{ship.base_armor}</span></div>
              <LinearProgress progress={maxS.armor > 0 ? ship.base_armor / maxS.armor : 0} style="--mdc-theme-primary:#b0bec5" />
            </div>
            <div class="stat-item">
              <div class="stat-header"><span class="stat-label">Speed</span><span class="stat-value mono">{ship.base_speed}</span></div>
              <LinearProgress progress={ship.base_speed / maxS.speed} style="--mdc-theme-primary:#e040fb" />
            </div>
            <div class="stat-item">
              <div class="stat-header"><span class="stat-label">Cargo</span><span class="stat-value mono">{ship.cargo_capacity} m³</span></div>
              <LinearProgress progress={ship.cargo_capacity / maxS.cargo} style="--mdc-theme-primary:#ff9800" />
            </div>
            <div class="stat-item">
              <div class="stat-header"><span class="stat-label">Fuel</span><span class="stat-value mono">{ship.base_fuel}</span></div>
              <LinearProgress progress={ship.base_fuel / maxS.fuel} style="--mdc-theme-primary:#66bb6a" />
            </div>
            {#if ship.base_shield_recharge}
              <div class="stat-item">
                <div class="stat-header"><span class="stat-label">Shield Regen</span><span class="stat-value mono">{ship.base_shield_recharge}/tick</span></div>
              </div>
            {/if}
          </div>

          <!-- Slots & Fitting -->
          <div class="detail-section-label">Fitting</div>
          <div class="slot-row detail-slots">
            {#if ship.weapon_slots}
              <span class="slot-chip weapon" title="Weapon slots"><span class="material-icons slot-icon">gps_fixed</span>{ship.weapon_slots} Weapon</span>
            {/if}
            {#if ship.defense_slots}
              <span class="slot-chip defense" title="Defense slots"><span class="material-icons slot-icon">shield</span>{ship.defense_slots} Defense</span>
            {/if}
            {#if ship.utility_slots}
              <span class="slot-chip utility" title="Utility slots"><span class="material-icons slot-icon">build</span>{ship.utility_slots} Utility</span>
            {/if}
            <span class="slot-chip cpu" title="CPU capacity">CPU {ship.cpu_capacity}</span>
            <span class="slot-chip power" title="Power capacity">PWR {ship.power_capacity}</span>
          </div>

          <!-- Build Materials -->
          {#if ship.build_materials && ship.build_materials.length > 0}
            <div class="detail-section-label">Build Materials</div>
            <div class="materials-list">
              {#each ship.build_materials as mat}
                <div class="mat-row">
                  <span class="mat-name">{mat.item_name ?? mat.item_id}</span>
                  <span class="mat-qty mono">x{mat.quantity}</span>
                </div>
              {/each}
            </div>
          {/if}

          <!-- Flavor Tags -->
          {#if ship.flavor_tags && ship.flavor_tags.length > 0}
            <div class="tags-row">
              {#each ship.flavor_tags as tag}
                <span class="flavor-tag">#{tag}</span>
              {/each}
            </div>
          {/if}

          <!-- Shipyard Tier -->
          {#if ship.shipyard_tier > 0}
            <span class="yard-req">Requires Shipyard Tier {ship.shipyard_tier}</span>
          {/if}

          <!-- Commission button -->
          {#if playerStore.isDocked}
            <button class="buy-btn commission-btn" onclick={() => commissionFromCatalog(ship)}>
              <span class="material-icons buy-icon">precision_manufacturing</span>
              Get Commission Quote
            </button>
          {:else}
            <div class="dock-hint">
              <span class="material-icons" style="font-size:14px">info</span>
              Dock at a shipyard to commission this ship
            </div>
          {/if}
        </Content>
      </Card>
    </div>
  {:else}
    <!-- ====== Ship Grid ====== -->
    {@const maxS = shipCatalogStore.maxStats}
    <div class="catalog-grid">
      {#each shipCatalogStore.filteredShips as ship (ship.id)}
        {@const cs = getCatStyle(ship.category)}
        <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
        <div class="catalog-card" onclick={() => shipCatalogStore.selectShip(ship.id)} role="button" tabindex="0" onkeydown={(e) => { if (e.key === 'Enter') shipCatalogStore.selectShip(ship.id); }}>
          <div class="cc-header">
            <span class="material-icons cc-icon" style="color:{cs.color}">{cs.icon}</span>
            <div class="cc-title">
              <span class="cc-name">{ship.name}</span>
              <div class="cc-badges">
                <span class="class-badge" style="border-color:{cs.color};color:{cs.color}">{ship.category}</span>
                <span class="empire-dot" style="background:{getEmpireColor(ship.empire)}" title={ship.empire_name}></span>
                <span class="tier-badge">T{ship.tier}</span>
              </div>
            </div>
            <span class="cc-price mono">₡{ship.price.toLocaleString()}</span>
          </div>

          <p class="cc-desc">{ship.description}</p>

          <!-- Compact stats -->
          <div class="cc-stats">
            <div class="cc-stat">
              <span class="cc-stat-label">HP</span>
              <div class="cc-bar-wrap"><div class="cc-bar hull-bar" style="width:{(ship.base_hull / maxS.hull) * 100}%"></div></div>
              <span class="cc-stat-val mono">{ship.base_hull}</span>
            </div>
            {#if ship.base_shield > 0}
              <div class="cc-stat">
                <span class="cc-stat-label">SH</span>
                <div class="cc-bar-wrap"><div class="cc-bar shield-bar" style="width:{(ship.base_shield / maxS.shield) * 100}%"></div></div>
                <span class="cc-stat-val mono">{ship.base_shield}</span>
              </div>
            {/if}
            <div class="cc-stat">
              <span class="cc-stat-label">CRG</span>
              <div class="cc-bar-wrap"><div class="cc-bar cargo-bar" style="width:{(ship.cargo_capacity / maxS.cargo) * 100}%"></div></div>
              <span class="cc-stat-val mono">{ship.cargo_capacity}</span>
            </div>
          </div>

          <!-- Slot summary -->
          <div class="cc-slots">
            {#if ship.weapon_slots}<span class="mini-slot weapon">{ship.weapon_slots}W</span>{/if}
            {#if ship.defense_slots}<span class="mini-slot defense">{ship.defense_slots}D</span>{/if}
            {#if ship.utility_slots}<span class="mini-slot utility">{ship.utility_slots}U</span>{/if}
          </div>

          {#if ship.flavor_tags && ship.flavor_tags.length > 0}
            <div class="cc-tags">
              {#each ship.flavor_tags.slice(0, 3) as tag}
                <span class="mini-tag">#{tag}</span>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>

    {#if shipCatalogStore.filteredShips.length === 0 && shipCatalogStore.loaded}
      <div class="empty-state">
        <span class="material-icons" style="font-size:36px;color:#37474f">search_off</span>
        <p>No ships match your filters.</p>
        <button class="action-btn" onclick={() => shipCatalogStore.clearFilters()}>Clear Filters</button>
      </div>
    {/if}
  {/if}

<!-- ========== SHOWROOM ========== -->
{:else if activeSection === 'showroom'}
  {#if !playerStore.isDocked}
    <div class="not-docked">
      <span class="material-icons" style="font-size:48px;color:#263238">store</span>
      <p>Dock at a station with a shipyard to see the showroom.</p>
    </div>
  {:else}
    <div class="section-head">
      <span class="tab-section-title">Showroom — In Stock</span>
      <button class="icon-btn" onclick={() => ws.shipyardShowroom()} title="Refresh">
        <span class="material-icons" style="font-size:16px">refresh</span>
      </button>
    </div>

    {#if shipStore.showroomLoading}
      <LinearProgress indeterminate />
    {:else if shipStore.showroom.length === 0}
      <Card class="space-card">
        <Content>
          <div class="empty-state">
            <span class="material-icons" style="font-size:36px;color:#37474f">inventory_2</span>
            <p class="empty-title">No ships in stock</p>
            {#if shipStore.showroomTip}
              <p class="empty-tip">{shipStore.showroomTip}</p>
            {:else}
              <p class="empty-tip">Use the <strong>Commission</strong> tab to order a custom build.</p>
            {/if}
            {#if shipStore.showroomLevel > 0}
              <span class="yard-level mono">Shipyard Level {shipStore.showroomLevel}</span>
            {/if}
          </div>
        </Content>
      </Card>
    {:else}
      {#if showroomCategories.length > 2}
        <div class="category-bar">
          {#each showroomCategories as cat}
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
            </button>
          {/each}
        </div>
      {/if}

      <div class="catalog-list">
        {#each filteredShowroom as ship}
          {@const style = getCatStyle(ship.category ?? '')}
          <Card class="space-card">
            <Content>
              <div class="ship-card">
                <div class="ship-header">
                  <div class="ship-title">
                    <span class="material-icons ship-icon" style="color:{style.color}">{style.icon}</span>
                    <div>
                      <span class="ship-name">{ship.name}</span>
                      {#if ship.category}
                        <span class="class-badge" style="border-color:{style.color}; color:{style.color}">{ship.category}</span>
                      {/if}
                    </div>
                  </div>
                  <div class="ship-price-area">
                    <span class="price-val">₡{ship.price.toLocaleString()}</span>
                    {#if ship.stock != null}
                      <span class="stock-label">{ship.stock} in stock</span>
                    {/if}
                  </div>
                </div>

                {#if ship.description}
                  <p class="ship-desc">{ship.description}</p>
                {/if}

                <div class="stats-grid">
                  {#if ship.hull}
                    <div class="stat-item">
                      <div class="stat-header"><span class="stat-label">Hull</span><span class="stat-value mono">{ship.hull}</span></div>
                      <LinearProgress progress={ship.hull / showroomMaxStats.hull} class="progress-hull" />
                    </div>
                  {/if}
                  {#if ship.shield}
                    <div class="stat-item">
                      <div class="stat-header"><span class="stat-label">Shield</span><span class="stat-value mono">{ship.shield}</span></div>
                      <LinearProgress progress={ship.shield / showroomMaxStats.shield} class="progress-shield" />
                    </div>
                  {/if}
                  {#if ship.cargo_capacity}
                    <div class="stat-item">
                      <div class="stat-header"><span class="stat-label">Cargo</span><span class="stat-value mono">{ship.cargo_capacity} m³</span></div>
                      <LinearProgress progress={ship.cargo_capacity / showroomMaxStats.cargo} style="--mdc-theme-primary:#ff9800" />
                    </div>
                  {/if}
                  {#if ship.fuel}
                    <div class="stat-item">
                      <div class="stat-header"><span class="stat-label">Fuel</span><span class="stat-value mono">{ship.fuel}</span></div>
                      <LinearProgress progress={ship.fuel / showroomMaxStats.fuel} style="--mdc-theme-primary:#66bb6a" />
                    </div>
                  {/if}
                </div>

                <div class="slot-row">
                  {#if ship.weapon_slots}<span class="slot-chip weapon" title="Weapon slots"><span class="material-icons slot-icon">gps_fixed</span>{ship.weapon_slots}</span>{/if}
                  {#if ship.defense_slots}<span class="slot-chip defense" title="Defense slots"><span class="material-icons slot-icon">shield</span>{ship.defense_slots}</span>{/if}
                  {#if ship.utility_slots}<span class="slot-chip utility" title="Utility slots"><span class="material-icons slot-icon">build</span>{ship.utility_slots}</span>{/if}
                  {#if ship.cpu_capacity}<span class="slot-chip cpu" title="CPU">CPU {ship.cpu_capacity}</span>{/if}
                  {#if ship.power_capacity}<span class="slot-chip power" title="Power">PWR {ship.power_capacity}</span>{/if}
                </div>

                <button class="buy-btn" onclick={() => buyFromShowroom(ship)}>
                  <span class="material-icons buy-icon">shopping_cart</span>
                  Buy for ₡{ship.price.toLocaleString()}
                </button>
              </div>
            </Content>
          </Card>
        {/each}
      </div>
    {/if}
  {/if}

<!-- ========== COMMISSION ========== -->
{:else if activeSection === 'commission'}
  {#if !playerStore.isDocked}
    <div class="not-docked">
      <span class="material-icons" style="font-size:48px;color:#263238">precision_manufacturing</span>
      <p>Dock at a station with a shipyard to commission ships.</p>
    </div>
  {:else}
    <div class="section-head">
      <span class="tab-section-title">Ship Commission</span>
      <button class="icon-btn" onclick={loadCommissions} title="Refresh">
        <span class="material-icons" style="font-size:16px">refresh</span>
      </button>
    </div>

    <!-- Quote request -->
    <Card class="space-card">
      <Content>
        <div class="commission-form">
          <span class="form-label">Get a Build Quote</span>
          <div class="quote-row">
            <select class="quote-select" bind:value={quoteShipClass}>
              <option value="">Select ship class...</option>
              {#each availableShipClasses as sc}
                <option value={sc.id}>{sc.name} ({sc.id})</option>
              {/each}
            </select>
            <button class="action-btn quote-btn" onclick={requestQuote} disabled={!quoteShipClass}>
              <span class="material-icons" style="font-size:14px">calculate</span>
              Get Quote
            </button>
          </div>
          {#if !availableShipClasses.length}
            <div class="hint" style="margin-top:6px">
              <button class="action-btn" onclick={() => shipCatalogStore.fetchCatalog()} style="font-size:0.65rem">
                Load Ship Catalog
              </button>
            </div>
          {/if}
        </div>
      </Content>
    </Card>

    <!-- Quote result -->
    {#if shipStore.commissionQuoteLoading}
      <LinearProgress indeterminate />
    {:else if shipStore.commissionQuote}
      {@const q = shipStore.commissionQuote}
      <Card class="space-card">
        <Content>
          <div class="quote-result">
            <div class="quote-header">
              <span class="ship-name">{q.ship_name ?? q.ship_class}</span>
              <div class="quote-header-right">
                {#if q.build_time}
                  <span class="build-time">
                    <span class="material-icons" style="font-size:14px">schedule</span>
                    {q.build_time} ticks
                  </span>
                {/if}
                {#if q.player_credits != null}
                  <span class="player-credits mono">Your credits: ₡{q.player_credits.toLocaleString()}</span>
                {/if}
              </div>
            </div>

            {#if q.blockers && q.blockers.length > 0}
              <div class="blockers">
                {#each q.blockers as b}
                  <span class="blocker-chip">
                    <span class="material-icons" style="font-size:12px">warning</span> {b}
                  </span>
                {/each}
              </div>
            {/if}

            {#if q.shipyard_tier_required != null && q.shipyard_tier_here != null}
              <div class="tier-info">
                <span class="tier-label">Shipyard here: Tier {q.shipyard_tier_here}</span>
                <span class="tier-label">Required: Tier {q.shipyard_tier_required}</span>
                {#if q.shipyard_tier_here >= q.shipyard_tier_required}
                  <span class="tier-ok"><span class="material-icons" style="font-size:12px">check_circle</span></span>
                {:else}
                  <span class="tier-bad"><span class="material-icons" style="font-size:12px">cancel</span> Tier too low</span>
                {/if}
              </div>
            {/if}

            <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
            <div class="quote-modes">
              <div class="quote-mode" class:selected={!commissionProvideMaterials} class:affordable={q.can_afford_credits_only} onclick={() => commissionProvideMaterials = false} role="button" tabindex="0" onkeydown={(e) => { if (e.key === 'Enter') commissionProvideMaterials = false; }}>
                <span class="mode-label">Credits Only</span>
                <span class="mode-price mono">₡{(q.credits_only_total ?? 0).toLocaleString()}</span>
                {#if q.material_cost != null && q.labor_cost != null}
                  <span class="mode-breakdown mono">Materials ₡{q.material_cost.toLocaleString()} + Labor ₡{q.labor_cost.toLocaleString()}</span>
                {/if}
                <span class="mode-desc">Pay full price — station supplies materials</span>
                {#if q.can_afford_credits_only === false}
                  <span class="cannot-afford"><span class="material-icons" style="font-size:11px">block</span> Can't afford</span>
                {/if}
              </div>
              <div class="quote-mode" class:selected={commissionProvideMaterials} class:affordable={q.can_afford_provide_materials} onclick={() => commissionProvideMaterials = true} role="button" tabindex="0" onkeydown={(e) => { if (e.key === 'Enter') commissionProvideMaterials = true; }}>
                <span class="mode-label">Provide Materials</span>
                <span class="mode-price mono">₡{(q.provide_materials_total ?? 0).toLocaleString()}</span>
                <span class="mode-desc">Supply materials yourself — pay labor only</span>
                {#if q.can_afford_provide_materials === false}
                  <span class="cannot-afford"><span class="material-icons" style="font-size:11px">block</span> Can't afford</span>
                {/if}
              </div>
            </div>

            {#if commissionProvideMaterials && q.build_materials && q.build_materials.length > 0}
              <div class="materials-list">
                <span class="form-label">Required Materials:</span>
                {#each q.build_materials as mat}
                  <div class="mat-row">
                    <span class="mat-name">{mat.name ?? mat.item_id}</span>
                    <span class="mat-qty mono">x{mat.quantity}</span>
                  </div>
                {/each}
              </div>
            {/if}

            {#if q.message}
              <p class="quote-msg">{q.message}</p>
            {/if}

            <button
              class="buy-btn commission-btn"
              onclick={placeCommission}
              disabled={!q.can_commission}
            >
              <span class="material-icons buy-icon">precision_manufacturing</span>
              Commission Build
            </button>
          </div>
        </Content>
      </Card>
    {/if}

    <!-- Active commissions -->
    <div class="section-head" style="margin-top:16px">
      <span class="tab-section-title">My Commissions</span>
    </div>

    {#if shipStore.commissionsLoading}
      <LinearProgress indeterminate />
    {:else if shipStore.commissions.length > 0}
      <div class="commissions-list">
        {#each shipStore.commissions as order}
          <Card class="space-card">
            <Content>
              <div class="commission-item">
                <div class="commission-info">
                  <span class="ship-name">{order.ship_name ?? order.ship_class}</span>
                  <div class="commission-meta">
                    <span class="status-badge status-{order.status}">{order.status.toUpperCase()}</span>
                    {#if order.base_name}
                      <span class="commission-location">{order.base_name}</span>
                    {/if}
                    {#if order.progress != null && order.status === 'building'}
                      <span class="commission-progress mono">{order.progress}%</span>
                    {/if}
                  </div>
                  {#if order.status === 'building' && order.progress != null}
                    <LinearProgress progress={order.progress / 100} style="margin-top:4px" />
                  {/if}
                  {#if order.message}
                    <span class="commission-msg">{order.message}</span>
                  {/if}
                </div>
                <div class="commission-btns">
                  {#if order.status === 'ready'}
                    <button class="action-btn claim-btn" onclick={() => claimCommission(order)}>
                      <span class="material-icons" style="font-size:14px">download</span> Claim
                    </button>
                  {/if}
                  {#if order.status === 'pending' || order.status === 'building'}
                    <button class="action-btn cancel-btn" onclick={() => cancelCommission(order)}>
                      Cancel
                    </button>
                  {/if}
                </div>
              </div>
            </Content>
          </Card>
        {/each}
      </div>
    {:else}
      <p class="empty-hint">No active commissions</p>
    {/if}
  {/if}

<!-- ========== EXCHANGE ========== -->
{:else if activeSection === 'exchange'}
  {#if !playerStore.isDocked}
    <div class="not-docked">
      <span class="material-icons" style="font-size:48px;color:#263238">swap_horiz</span>
      <p>Dock at a station to browse the ship exchange.</p>
    </div>
  {:else}
    <div class="section-head">
      <span class="tab-section-title">Player Ship Exchange</span>
      <button class="icon-btn" onclick={loadExchange} title="Refresh">
        <span class="material-icons" style="font-size:16px">refresh</span>
      </button>
    </div>

    {#if inactiveFleetShips.length > 0}
      <Card class="space-card">
        <Content>
          <div class="list-form">
            <span class="form-label">List a Ship for Sale</span>
            <div class="list-row">
              <select class="quote-select" bind:value={listShipId}>
                <option value="">Select ship...</option>
                {#each inactiveFleetShips as ship}
                  <option value={ship.id}>{ship.name} ({ship.type})</option>
                {/each}
              </select>
              <input class="price-input mono" type="number" min="1" placeholder="Price ₡" bind:value={listShipPrice} />
              <button class="action-btn list-btn" onclick={listForSale} disabled={!listShipId || listShipPrice <= 0}>
                List
              </button>
            </div>
          </div>
        </Content>
      </Card>
    {/if}

    {#if shipStore.shipListingsLoading}
      <LinearProgress indeterminate />
    {:else if shipStore.shipListings.length > 0}
      <div class="listings-grid">
        {#each shipStore.shipListings as listing}
          <Card class="space-card">
            <Content>
              <div class="listing-item">
                <div class="listing-info">
                  <span class="ship-name">{listing.ship_name ?? listing.ship_class ?? 'Ship'}</span>
                  {#if listing.ship_class}<span class="listing-class mono">{listing.ship_class}</span>{/if}
                  {#if listing.seller_name}<span class="listing-seller">Seller: {listing.seller_name}</span>{/if}
                  {#if listing.hull}<span class="listing-hull">Hull: {listing.hull}</span>{/if}
                </div>
                <div class="listing-right">
                  <span class="price-val">₡{listing.price.toLocaleString()}</span>
                  <button class="action-btn buy-listing-btn" onclick={() => buyListed(listing)}>
                    <span class="material-icons" style="font-size:14px">shopping_cart</span> Buy
                  </button>
                </div>
              </div>
            </Content>
          </Card>
        {/each}
      </div>
    {:else}
      <div class="empty-state">
        <span class="material-icons" style="font-size:32px;color:#263238">storefront</span>
        <p>No ships listed for sale at this station.</p>
      </div>
    {/if}
  {/if}
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

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 24px;
    gap: 6px;
    color: #37474f;
  }
  .empty-state p { font-size: 0.8rem; margin: 0; }
  .empty-title { font-size: 0.9rem !important; color: #546e7a; font-weight: 500; }
  .empty-tip { font-size: 0.72rem !important; color: #455a64; max-width: 500px; text-align: center; line-height: 1.5; }
  .yard-level { font-size: 0.65rem; color: #4fc3f7; margin-top: 4px; }
  .empty-hint { font-size: 0.75rem; color: #263238; text-align: center; padding: 12px 0; }

  /* Section tabs */
  .section-tabs {
    display: flex;
    gap: 2px;
    margin-bottom: 12px;
    border-bottom: 1px solid rgba(79,195,247,0.12);
  }
  .sec-tab {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 8px 16px;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: #546e7a;
    font-size: 0.76rem;
    font-family: inherit;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
  }
  .sec-tab:hover { color: #90a4ae; }
  .sec-tab.active { color: #4fc3f7; border-bottom-color: #4fc3f7; }
  .sec-icon { font-size: 16px; }

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
    padding: 2px 4px;
  }
  .icon-btn:hover { color: #90caf9; }

  /* ===== CATALOG ===== */
  .catalog-count { font-size: 0.65rem; color: #546e7a; }

  .catalog-filters {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 12px;
  }
  .search-input {
    width: 100%;
    padding: 7px 10px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(79,195,247,0.2);
    border-radius: 4px;
    color: #b0bec5;
    font-size: 0.75rem;
    font-family: inherit;
    outline: none;
  }
  .search-input::placeholder { color: #455a64; }
  .search-input:focus { border-color: rgba(79,195,247,0.5); }

  .filter-row {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    align-items: center;
  }
  .filter-select {
    padding: 5px 6px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 4px;
    color: #90a4ae;
    font-size: 0.68rem;
    font-family: inherit;
    outline: none;
    min-width: 100px;
  }
  .filter-select option { background: #0d1525; color: #b0bec5; }

  .clear-filters-btn {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px 8px;
    background: none;
    border: 1px solid rgba(244,67,54,0.3);
    border-radius: 4px;
    color: #ef5350;
    font-size: 0.62rem;
    font-family: inherit;
    cursor: pointer;
  }
  .clear-filters-btn:hover { background: rgba(244,67,54,0.08); }

  /* Price filter */
  .price-filter-row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .price-filter-icon { font-size: 15px; color: #546e7a; }
  .price-filter-label { font-size: 0.66rem; color: #546e7a; white-space: nowrap; }
  .price-filter-input {
    width: 110px;
    padding: 4px 7px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,215,0,0.2);
    border-radius: 4px;
    color: #ffd700;
    font-size: 0.68rem;
    outline: none;
  }
  .price-filter-input::placeholder { color: #455a64; }
  .price-filter-input:focus { border-color: rgba(255,215,0,0.45); }
  /* hide spinner arrows */
  .price-filter-input::-webkit-inner-spin-button,
  .price-filter-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
  .price-filter-input { -moz-appearance: textfield; }

  .price-preset-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    background: rgba(255,215,0,0.04);
    border: 1px solid rgba(255,215,0,0.18);
    border-radius: 4px;
    color: #8d8040;
    font-size: 0.62rem;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }
  .price-preset-btn:hover { background: rgba(255,215,0,0.1); border-color: rgba(255,215,0,0.35); color: #ffd700; }
  .price-preset-btn.active { background: rgba(255,215,0,0.12); border-color: rgba(255,215,0,0.4); color: #ffd700; }

  .price-clear-btn {
    display: flex;
    align-items: center;
    padding: 3px;
    background: none;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 3px;
    color: #546e7a;
    cursor: pointer;
  }
  .price-clear-btn:hover { color: #ef5350; border-color: rgba(244,67,54,0.3); }

  /* Catalog Grid */
  .catalog-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  @media (max-width: 960px) { .catalog-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 600px) { .catalog-grid { grid-template-columns: 1fr; } }

  .catalog-card {
    padding: 12px;
    background: rgba(13,21,37,0.8);
    border: 1px solid rgba(79,195,247,0.1);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .catalog-card:hover {
    border-color: rgba(79,195,247,0.35);
    background: rgba(13,21,37,1);
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(0,0,0,0.3);
  }

  .cc-header { display: flex; align-items: flex-start; gap: 8px; }
  .cc-icon { font-size: 20px; flex-shrink: 0; margin-top: 2px; }
  .cc-title { flex: 1; min-width: 0; }
  .cc-name { font-size: 0.85rem; color: #cfd8dc; font-weight: 500; display: block; }
  .cc-badges { display: flex; align-items: center; gap: 4px; margin-top: 2px; flex-wrap: wrap; }
  .cc-price { font-family: 'Roboto Mono', monospace; font-size: 0.8rem; color: #ffd700; flex-shrink: 0; }
  .cc-desc { font-size: 0.66rem; color: #546e7a; margin: 0; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

  /* Compact stats */
  .cc-stats { display: flex; flex-direction: column; gap: 3px; }
  .cc-stat { display: flex; align-items: center; gap: 4px; }
  .cc-stat-label { font-size: 0.55rem; color: #4a6070; width: 24px; text-align: right; text-transform: uppercase; }
  .cc-bar-wrap { flex: 1; height: 4px; background: rgba(255,255,255,0.05); border-radius: 2px; overflow: hidden; }
  .cc-bar { height: 100%; border-radius: 2px; transition: width 0.3s; }
  .hull-bar { background: #4caf50; }
  .shield-bar { background: #2196f3; }
  .cargo-bar { background: #ff9800; }
  .cc-stat-val { font-size: 0.6rem; color: #78909c; width: 40px; }

  /* Compact slots */
  .cc-slots { display: flex; gap: 3px; }
  .mini-slot {
    font-size: 0.55rem;
    font-family: 'Roboto Mono', monospace;
    padding: 1px 4px;
    border-radius: 2px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
  }
  .mini-slot.weapon { color: #ef5350; border-color: rgba(244,67,54,0.2); }
  .mini-slot.defense { color: #42a5f5; border-color: rgba(33,150,243,0.2); }
  .mini-slot.utility { color: #ffa726; border-color: rgba(255,152,0,0.2); }

  .cc-tags { display: flex; gap: 3px; flex-wrap: wrap; }
  .mini-tag { font-size: 0.52rem; color: #455a64; font-style: italic; }

  .empire-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; flex-shrink: 0; }

  .tier-badge { font-size: 0.52rem; color: #78909c; font-family: 'Roboto Mono', monospace; }
  .scale-badge { font-size: 0.52rem; color: #546e7a; }

  /* ===== DETAIL VIEW ===== */
  .detail-view { display: flex; flex-direction: column; gap: 8px; }
  .back-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    background: none;
    border: 1px solid rgba(79,195,247,0.2);
    border-radius: 4px;
    color: #4fc3f7;
    font-size: 0.72rem;
    font-family: inherit;
    cursor: pointer;
    width: fit-content;
  }
  .back-btn:hover { background: rgba(79,195,247,0.08); }

  .detail-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
  .detail-title-row { display: flex; align-items: flex-start; gap: 10px; }
  .detail-icon { font-size: 32px; margin-top: 2px; }
  .detail-name { font-size: 1.3rem; color: #e0e0e0; font-weight: 500; margin: 0; }
  .detail-meta { display: flex; align-items: center; gap: 6px; margin-top: 4px; flex-wrap: wrap; }
  .detail-price { text-align: right; }
  .detail-class-id { font-size: 0.6rem; color: #455a64; display: block; margin-top: 2px; }
  .detail-desc { font-size: 0.8rem; color: #78909c; line-height: 1.5; margin: 4px 0 0; }

  .lore-block {
    display: flex;
    gap: 8px;
    padding: 10px 12px;
    background: rgba(255,152,0,0.04);
    border-left: 3px solid rgba(255,152,0,0.3);
    border-radius: 0 4px 4px 0;
    margin-top: 4px;
  }
  .lore-icon { font-size: 18px; color: #ff9800; flex-shrink: 0; margin-top: 1px; }
  .lore-text { font-size: 0.7rem; color: #8d6e63; line-height: 1.6; margin: 0; font-style: italic; }

  .detail-stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 20px;
    margin-top: 4px;
  }

  .detail-section-label {
    font-size: 0.65rem;
    color: #546e7a;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-top: 8px;
    margin-bottom: 4px;
  }

  .detail-slots { margin-top: 0; }

  .tags-row { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 4px; }
  .flavor-tag { font-size: 0.6rem; color: #546e7a; font-style: italic; }

  .yard-req { font-size: 0.62rem; color: #ff9800; font-family: 'Roboto Mono', monospace; margin-top: 4px; }

  .dock-hint {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.7rem;
    color: #546e7a;
    padding: 10px;
    background: rgba(255,255,255,0.02);
    border-radius: 4px;
    margin-top: 4px;
  }

  /* ===== SHARED ===== */
  .category-bar { display: flex; gap: 4px; margin-bottom: 12px; overflow-x: auto; padding-bottom: 4px; }
  .cat-chip {
    display: flex; align-items: center; gap: 4px; padding: 5px 10px;
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 16px; color: #78909c; font-size: 0.7rem;
    font-family: inherit; cursor: pointer; transition: all 0.15s; white-space: nowrap;
  }
  .cat-chip:hover { background: rgba(255,255,255,0.06); }
  .cat-chip.active { background: rgba(79,195,247,0.1); border-color: var(--cat-color, #4fc3f7); color: var(--cat-color, #4fc3f7); }
  .cat-icon { font-size: 14px; }

  .catalog-list { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  @media (max-width: 960px) { .catalog-list { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 600px) { .catalog-list { grid-template-columns: 1fr; } }

  .ship-card { display: flex; flex-direction: column; gap: 8px; }
  .ship-header { display: flex; justify-content: space-between; align-items: flex-start; }
  .ship-title { display: flex; align-items: center; gap: 8px; }
  .ship-icon { font-size: 22px; }
  .ship-name { font-size: 0.95rem; font-weight: 400; color: #cfd8dc; display: block; }
  .class-badge {
    font-size: 0.58rem; font-family: 'Roboto Mono', monospace;
    text-transform: uppercase; letter-spacing: 0.06em;
    padding: 1px 6px; border: 1px solid; border-radius: 3px;
  }
  .ship-price-area { text-align: right; flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
  .price-val { font-family: 'Roboto Mono', monospace; font-size: 1rem; font-weight: 500; color: #ffd700; }
  .stock-label { font-size: 0.6rem; color: #66bb6a; font-family: 'Roboto Mono', monospace; }
  .ship-desc { font-size: 0.72rem; color: #546e7a; margin: 0; line-height: 1.4; }

  .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; }
  .stat-item { display: flex; flex-direction: column; gap: 2px; }
  .stat-header { display: flex; justify-content: space-between; align-items: baseline; }
  .stat-label { font-size: 0.65rem; color: #4a6070; text-transform: uppercase; letter-spacing: 0.05em; }
  .stat-value { font-size: 0.72rem; color: #b0bec5; }

  .slot-row { display: flex; flex-wrap: wrap; gap: 4px; }
  .slot-chip {
    display: inline-flex; align-items: center; gap: 2px;
    font-size: 0.62rem; font-family: 'Roboto Mono', monospace;
    padding: 2px 6px; border-radius: 3px;
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); color: #78909c;
  }
  .slot-icon { font-size: 12px; }
  .slot-chip.weapon { border-color: rgba(244,67,54,0.25); color: #ef5350; }
  .slot-chip.defense { border-color: rgba(33,150,243,0.25); color: #42a5f5; }
  .slot-chip.utility { border-color: rgba(255,152,0,0.25); color: #ffa726; }
  .slot-chip.cpu { border-color: rgba(206,147,216,0.2); color: #ce93d8; }
  .slot-chip.power { border-color: rgba(255,213,79,0.2); color: #ffd54f; }

  .buy-btn {
    display: flex; align-items: center; justify-content: center; gap: 6px;
    width: 100%; padding: 10px 16px; margin-top: 4px;
    background: rgba(76,175,80,0.1); border: 1px solid rgba(76,175,80,0.4);
    border-radius: 6px; color: #66bb6a; font-size: 0.82rem; font-weight: 500;
    font-family: inherit; cursor: pointer; transition: all 0.2s;
  }
  .buy-btn:hover { background: rgba(76,175,80,0.2); border-color: rgba(76,175,80,0.6); color: #81c784; }
  .buy-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .buy-icon { font-size: 18px; }

  /* Commission */
  .commission-form { display: flex; flex-direction: column; gap: 8px; }
  .form-label { font-size: 0.72rem; color: #78909c; font-weight: 500; }
  .quote-row, .list-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }

  .quote-select {
    flex: 1; min-width: 160px; padding: 6px 8px;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(79,195,247,0.2);
    border-radius: 4px; color: #b0bec5; font-size: 0.72rem; font-family: inherit; outline: none;
  }
  .quote-select:focus { border-color: rgba(79,195,247,0.4); }
  .quote-select option { background: #0d1525; color: #b0bec5; }

  .price-input {
    width: 100px; padding: 6px 8px;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,215,0,0.3);
    border-radius: 4px; color: #ffd700; font-size: 0.72rem; outline: none;
  }
  .price-input:focus { border-color: rgba(255,215,0,0.5); }

  .action-btn {
    background: none; border: 1px solid rgba(255,255,255,0.12);
    color: #78909c; font-size: 0.7rem; font-family: inherit;
    padding: 5px 12px; border-radius: 4px; cursor: pointer;
    display: flex; align-items: center; gap: 4px; transition: all 0.15s; white-space: nowrap;
  }
  .action-btn:hover { background: rgba(255,255,255,0.05); }
  .action-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .quote-btn { border-color: rgba(79,195,247,0.3); color: #4fc3f7; }
  .quote-btn:hover { background: rgba(79,195,247,0.1); }
  .list-btn { border-color: rgba(76,175,80,0.3); color: #66bb6a; }
  .list-btn:hover { background: rgba(76,175,80,0.1); }
  .claim-btn { border-color: rgba(76,175,80,0.4); color: #66bb6a; }
  .claim-btn:hover { background: rgba(76,175,80,0.15); }
  .cancel-btn { border-color: rgba(244,67,54,0.3); color: #ef5350; }
  .cancel-btn:hover { background: rgba(244,67,54,0.1); }
  .buy-listing-btn { border-color: rgba(76,175,80,0.3); color: #66bb6a; }
  .buy-listing-btn:hover { background: rgba(76,175,80,0.1); }

  /* Quote result */
  .quote-result { display: flex; flex-direction: column; gap: 10px; }
  .quote-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px; }
  .quote-header-right { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
  .player-credits { font-size: 0.62rem; color: #78909c; }
  .build-time { display: flex; align-items: center; gap: 4px; font-size: 0.7rem; color: #ff9800; font-family: 'Roboto Mono', monospace; }
  .blockers { display: flex; flex-wrap: wrap; gap: 4px; }
  .blocker-chip {
    display: inline-flex; align-items: center; gap: 3px;
    font-size: 0.62rem; padding: 2px 8px;
    background: rgba(244,67,54,0.08); border: 1px solid rgba(244,67,54,0.25);
    border-radius: 3px; color: #ef5350;
  }

  .tier-info { display: flex; align-items: center; gap: 8px; font-size: 0.62rem; color: #78909c; flex-wrap: wrap; }
  .tier-label { font-family: 'Roboto Mono', monospace; }
  .tier-ok { color: #66bb6a; display: flex; align-items: center; }
  .tier-bad { color: #ef5350; display: flex; align-items: center; gap: 2px; }

  .quote-modes { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .quote-mode {
    padding: 10px; border: 1px solid rgba(255,255,255,0.08);
    border-radius: 6px; cursor: pointer; transition: all 0.15s;
    display: flex; flex-direction: column; gap: 4px;
  }
  .quote-mode:hover { background: rgba(255,255,255,0.03); }
  .quote-mode.selected { border-color: rgba(79,195,247,0.4); background: rgba(79,195,247,0.06); }
  .mode-label { font-size: 0.72rem; color: #b0bec5; font-weight: 500; }
  .mode-price { font-size: 1rem; color: #ffd700; }
  .mode-breakdown { font-size: 0.58rem; color: #546e7a; }
  .mode-desc { font-size: 0.6rem; color: #546e7a; }
  .cannot-afford { font-size: 0.56rem; color: #ef5350; display: flex; align-items: center; gap: 2px; margin-top: 2px; }

  .materials-list {
    display: flex; flex-direction: column; gap: 4px;
    padding: 8px; background: rgba(255,255,255,0.02); border-radius: 4px;
  }
  .mat-row { display: flex; justify-content: space-between; font-size: 0.68rem; }
  .mat-name { color: #90a4ae; }
  .mat-qty { color: #ff9800; }
  .quote-msg { font-size: 0.68rem; color: #546e7a; margin: 0; font-style: italic; }

  .commission-btn { background: rgba(79,195,247,0.1); border-color: rgba(79,195,247,0.4); color: #4fc3f7; }
  .commission-btn:hover { background: rgba(79,195,247,0.2); border-color: rgba(79,195,247,0.6); }

  /* Commissions list */
  .commissions-list { display: flex; flex-direction: column; gap: 6px; }
  .commission-item { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  .commission-info { flex: 1; display: flex; flex-direction: column; gap: 3px; }
  .commission-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .status-badge { font-size: 0.56rem; font-family: 'Roboto Mono', monospace; padding: 1px 6px; border-radius: 2px; letter-spacing: 0.04em; }
  .status-pending { background: rgba(255,152,0,0.12); color: #ff9800; border: 1px solid rgba(255,152,0,0.3); }
  .status-building { background: rgba(79,195,247,0.12); color: #4fc3f7; border: 1px solid rgba(79,195,247,0.3); }
  .status-ready { background: rgba(76,175,80,0.12); color: #66bb6a; border: 1px solid rgba(76,175,80,0.3); }
  .status-cancelled { background: rgba(158,158,158,0.12); color: #9e9e9e; border: 1px solid rgba(158,158,158,0.3); }
  .commission-location { font-size: 0.6rem; color: #546e7a; }
  .commission-progress { font-size: 0.6rem; color: #4fc3f7; }
  .commission-msg { font-size: 0.62rem; color: #546e7a; font-style: italic; }
  .commission-btns { display: flex; gap: 4px; }

  /* Exchange */
  .list-form { display: flex; flex-direction: column; gap: 8px; }
  .listings-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
  @media (max-width: 700px) { .listings-grid { grid-template-columns: 1fr; } }
  .listing-item { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  .listing-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
  .listing-class { font-size: 0.6rem; color: #546e7a; }
  .listing-seller { font-size: 0.58rem; color: #4a6070; }
  .listing-hull { font-size: 0.58rem; color: #4a6070; }
  .listing-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }

  .hint { font-size: 0.65rem; color: #455a64; }
  .mono { font-family: 'Roboto Mono', monospace; }
</style>
