<script lang="ts">
  import Button, { Label } from '@smui/button';
  import Card, { Content } from '@smui/card';
  import Textfield from '@smui/textfield';
  import LinearProgress from '@smui/linear-progress';
  import { facilityStore } from '$lib/stores/facility.svelte';
  import { craftingStore } from '$lib/stores/crafting.svelte';
  import { playerStore } from '$lib/stores/player.svelte';
  import { uiStore } from '$lib/stores/ui.svelte';
  import { actionQueueStore } from '$lib/stores/actionQueue.svelte';
  import { ws } from '$lib/services/websocket';
  import type { FacilityInstance, FacilityType, FacilityUpgrade, FacilityLockedUpgrade } from '$lib/types/game';

  // --- State ---
  let section = $state<'list' | 'catalog' | 'upgrades' | 'quarters'>('list');
  let categoryFilter = $state('');
  let nameSearch = $state('');
  let catalogSearchMode = $state<'name' | 'recipe'>('name');
  let recipeSearch = $state('');
  let catalogPage = $state(1);
  let expandedFacIds = $state(new Set<string>());

  // Transfer dialog
  let transferTarget = $state<FacilityInstance | null>(null);
  let transferDirection = $state<'to_faction' | 'to_player'>('to_faction');
  let transferPlayerId = $state('');

  // Personal quarters decorate
  let decorateDesc = $state('');
  let decorateAccess = $state<'public' | 'private'>('public');
  let visitUsername = $state('');

  // --- Auto-load facility list when visible ---
  $effect(() => {
    if (uiStore.activeTab.label === 'Base' && playerStore.isDocked) {
      ws.facilityList();
    }
  });

  // --- Auto-load catalog categories when switching to catalog section ---
  $effect(() => {
    if (section === 'catalog' && Object.keys(facilityStore.categories).length === 0 && !facilityStore.typesLoading) {
      ws.facilityTypes();
    }
  });

  // --- Cross-tab navigation: facility detail from CraftingTab ---
  $effect(() => {
    if (uiStore.facilityDetailId) {
      const id = uiStore.facilityDetailId;
      uiStore.facilityDetailId = '';
      viewTypeDetail(id);
    }
  });

  // --- Auto-start recipe mapping when switching to catalog ---
  $effect(() => {
    if (section === 'catalog' && facilityStore.recipeMappingStatus === 'idle') {
      facilityStore.startRecipeMapping();
      ws.fetchRecipeMappingPage(1);
    }
  });

  // --- Recipe search results (client-side filter of craftingStore.recipes) ---
  const recipeSearchResults = $derived.by(() => {
    if (catalogSearchMode !== 'recipe' || !recipeSearch.trim()) return [];
    const q = recipeSearch.trim().toLowerCase();
    return craftingStore.recipes.filter(r => {
      // Match recipe name
      if (r.name.toLowerCase().includes(q)) return true;
      // Match output item_id (with underscore → space)
      if ((r.outputs ?? []).some(o =>
        o.item_id.toLowerCase().includes(q) ||
        o.item_id.replace(/_/g, ' ').toLowerCase().includes(q)
      )) return true;
      // Match input item_id
      if ((r.inputs ?? []).some(i =>
        i.item_id.toLowerCase().includes(q) ||
        i.item_id.replace(/_/g, ' ').toLowerCase().includes(q)
      )) return true;
      return false;
    }).slice(0, 50); // Limit to 50 results
  });

  function formatItemId(id: string): string {
    return id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  // --- Helpers ---
  function formatCategory(cat: string): string {
    return cat.charAt(0).toUpperCase() + cat.slice(1);
  }

  const myPlayerId = $derived(playerStore.data?.id ?? '');

  // Split player_facilities into mine vs others
  let myFacilities = $derived(
    facilityStore.playerFacilities.filter(f => f.owner_id === myPlayerId)
  );
  let otherPlayerFacilities = $derived(
    facilityStore.playerFacilities.filter(f => f.owner_id && f.owner_id !== myPlayerId)
  );

  function toggleExpand(facId: string) {
    const next = new Set(expandedFacIds);
    if (next.has(facId)) next.delete(facId);
    else next.add(facId);
    expandedFacIds = next;
  }

  // --- Catalog browsing ---
  function browseTypes(category?: string) {
    section = 'catalog';
    categoryFilter = category ?? '';
    catalogPage = 1;
    fetchTypes();
  }

  function fetchTypes() {
    const opts: Record<string, unknown> = { per_page: 20, page: catalogPage };
    if (categoryFilter) opts.category = categoryFilter;
    if (nameSearch.trim()) opts.name = nameSearch.trim();
    ws.facilityTypes(opts as never);
  }

  function viewTypeDetail(typeId: string) {
    ws.facilityTypes({ facility_type: typeId });
  }

  function closeDetail() {
    facilityStore.setSelectedType(null);
  }

  function prevPage() {
    if (catalogPage > 1) { catalogPage--; fetchTypes(); }
  }
  function nextPage() {
    if (catalogPage < facilityStore.typesTotalPages) { catalogPage++; fetchTypes(); }
  }

  // --- Actions (use ActionQueue for mutations) ---
  function toggleFacility(fac: FacilityInstance) {
    const facId = fac.facility_id;
    actionQueueStore.enqueue(`Toggle ${fac.name}`, () => ws.facilityToggle(facId));
  }

  function handleBuild(ft: FacilityType) {
    const typeId = ft.id;
    const label = `Build ${ft.name}`;
    if (ft.category === 'personal') {
      actionQueueStore.enqueue(label, () => ws.facilityPersonalBuild(typeId));
    } else if (ft.category === 'faction') {
      actionQueueStore.enqueue(label, () => ws.facilityFactionBuild(typeId));
    } else {
      actionQueueStore.enqueue(label, () => ws.facilityBuild(typeId));
    }
  }

  function handleUpgrade(u: FacilityUpgrade) {
    const facId = u.facility_id;
    const upType = u.upgrade_type;
    actionQueueStore.enqueue(`Upgrade → ${u.upgrade_name}`, () => ws.facilityUpgrade(facId, upType));
  }

  function openTransfer(fac: FacilityInstance) {
    transferTarget = fac;
    transferDirection = 'to_faction';
    transferPlayerId = '';
  }

  function submitTransfer() {
    if (!transferTarget) return;
    const facId = transferTarget.facility_id;
    const dir = transferDirection;
    const pid = transferPlayerId || undefined;
    actionQueueStore.enqueue(`Transfer ${transferTarget.name}`, () => ws.facilityTransfer(facId, dir, pid));
    transferTarget = null;
  }

  function submitDecorate() {
    if (!decorateDesc.trim()) return;
    const desc = decorateDesc.trim();
    const acc = decorateAccess;
    actionQueueStore.enqueue('Decorate Quarters', () => ws.facilityPersonalDecorate(desc, acc));
  }

  function visitQuarters(username?: string) {
    ws.facilityPersonalVisit(username || undefined);
  }

  // Search on enter
  function handleSearchKey(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      catalogPage = 1;
      fetchTypes();
    }
  }

  // Derived: category summary
  let categoryEntries = $derived(Object.entries(facilityStore.categories));

  // Catalog: need category to be selected before showing types
  let catalogNeedsFilter = $derived(
    facilityStore.types.length === 0 && !facilityStore.typesLoading && !categoryFilter && !nameSearch.trim()
  );

  // Has personal quarters
  let hasQuarters = $derived(
    facilityStore.playerFacilities.some(f => f.owner_id === myPlayerId && f.personal_service === 'quarters')
  );
</script>

<div class="facility-container">
  <!-- Section Switch -->
  <div class="section-switch">
    <button class="switch-btn" class:active={section === 'list'} onclick={() => (section = 'list')}>
      <span class="material-icons" style="font-size:15px">list</span> Facilities
    </button>
    <button class="switch-btn" class:active={section === 'catalog'} onclick={() => browseTypes()}>
      <span class="material-icons" style="font-size:15px">category</span> Catalog
    </button>
    <button class="switch-btn" class:active={section === 'upgrades'} onclick={() => { section = 'upgrades'; ws.facilityUpgrades(); }}>
      <span class="material-icons" style="font-size:15px">upgrade</span> Upgrades
    </button>
    <button class="switch-btn" class:active={section === 'quarters'} onclick={() => { section = 'quarters'; }}>
      <span class="material-icons" style="font-size:15px">home</span> Quarters
    </button>
  </div>

  <!-- ===== TYPE DETAIL OVERLAY (shows on any section) ===== -->
  {#if facilityStore.selectedType}
    {@const ft = facilityStore.selectedType}
    <Card class="space-card detail-card">
      <Content>
        <div class="detail-header">
          <p class="tab-section-title">{ft.name}</p>
          <button class="close-btn" onclick={closeDetail}>
            <span class="material-icons" style="font-size:18px">close</span>
          </button>
        </div>
        {#if ft.description}
          <p class="detail-desc">{ft.description}</p>
        {/if}
        {#if ft.hint}
          <p class="hint-text" style="font-style:italic;color:#78909c">{ft.hint}</p>
        {/if}
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">Category</span>
            <span class="cat-badge cat-{ft.category}">{formatCategory(ft.category)}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Level</span>
            <span class="mono">{ft.level}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Build Cost</span>
            <span class="mono credits">₡{ft.build_cost?.toLocaleString()}</span>
          </div>
          {#if ft.build_time}
            <div class="detail-item">
              <span class="detail-label">Build Time</span>
              <span class="mono">{ft.build_time} ticks</span>
            </div>
          {/if}
          {#if ft.rent_per_cycle}
            <div class="detail-item">
              <span class="detail-label">Rent</span>
              <span class="mono">₡{ft.rent_per_cycle}/cycle</span>
            </div>
          {/if}
          {#if ft.labor_cost}
            <div class="detail-item">
              <span class="detail-label">Labor Cost</span>
              <span class="mono">₡{ft.labor_cost}</span>
            </div>
          {/if}
          {#if ft.personal_service}
            <div class="detail-item">
              <span class="detail-label">Service</span>
              <span>{ft.personal_service}</span>
            </div>
          {/if}
          {#if ft.bonus_type}
            <div class="detail-item">
              <span class="detail-label">Bonus</span>
              <span class="bonus-badge">+{ft.bonus_value}% {ft.bonus_type}</span>
            </div>
          {/if}
          {#if ft.upgrades_to_name}
            <div class="detail-item">
              <span class="detail-label">Upgrades To</span>
              <span>{ft.upgrades_to_name}</span>
            </div>
          {/if}
        </div>

        {#if ft.build_materials && ft.build_materials.length > 0}
          <p class="tab-section-title" style="margin-top:10px">Build Materials</p>
          <div class="materials-list">
            {#each ft.build_materials as mat}
              <span class="mat-chip">{mat.name} x{mat.quantity}</span>
            {/each}
          </div>
        {/if}

        {#if ft.recipe}
          <p class="tab-section-title" style="margin-top:10px">Recipe: {ft.recipe.name}</p>
          <div class="recipe-flow">
            <div class="recipe-side">
              {#each ft.recipe.inputs as inp}
                <span class="mat-chip input-chip">{inp.name} x{inp.quantity}</span>
              {/each}
            </div>
            <span class="material-icons recipe-arrow">arrow_forward</span>
            <div class="recipe-side">
              {#each ft.recipe.outputs as out}
                <span class="mat-chip output-chip">{out.name} x{out.quantity}</span>
              {/each}
            </div>
          </div>
        {/if}

        {#if ft.buildable}
          <div style="margin-top:12px">
            <Button variant="raised" dense onclick={() => handleBuild(ft)}>
              <Label>Build (₡{ft.build_cost?.toLocaleString()})</Label>
            </Button>
          </div>
        {/if}
      </Content>
    </Card>
  {/if}

  {#if !playerStore.isDocked}
    <p class="empty-hint">Dock at a station to manage facilities.</p>

  <!-- ===== FACILITY LIST ===== -->
  {:else if section === 'list'}

    <!-- Quick Actions (top) -->
    <div class="quick-actions">
      <Button variant="outlined" dense onclick={() => ws.facilityList()}>
        <Label>Refresh</Label>
      </Button>
      <Button variant="outlined" dense onclick={() => browseTypes('production')}>
        <Label>Build Production</Label>
      </Button>
      <Button variant="outlined" dense onclick={() => browseTypes('personal')}>
        <Label>Build Personal</Label>
      </Button>
      {#if playerStore.faction_id}
        <Button variant="outlined" dense onclick={() => browseTypes('faction')}>
          <Label>Build Faction</Label>
        </Button>
        <Button variant="outlined" dense onclick={() => ws.facilityFactionList()}>
          <Label>Faction List</Label>
        </Button>
      {/if}
    </div>

    {#if facilityStore.loading}
      <LinearProgress indeterminate />
    {/if}

    <!-- My Facilities (owned by current player) -->
    {#if myFacilities.length > 0}
      <Card class="space-card">
        <Content>
          <p class="tab-section-title">My Facilities</p>
          <div class="fac-list">
            {#each myFacilities as fac}
              {@const isExpanded = expandedFacIds.has(fac.facility_id)}
              <button class="fac-row" class:expanded={isExpanded} onclick={() => toggleExpand(fac.facility_id)}>
                <div class="fac-top">
                  <div class="fac-info">
                    <span class="fac-name">{fac.name}</span>
                    <span class="fac-meta">
                      <span class="cat-badge cat-{fac.category}">{formatCategory(fac.category)}</span>
                      {#if fac.recipe_id}
                        <span class="recipe-badge">{fac.recipe_id}</span>
                      {/if}
                      {#if fac.personal_service}
                        <span class="personal-badge">{fac.personal_service}</span>
                      {/if}
                      {#if fac.bonus_type}
                        <span class="bonus-badge">+{fac.bonus_value}% {fac.bonus_type}</span>
                      {/if}
                    </span>
                  </div>
                  <div class="fac-actions">
                    {#if !fac.maintenance_satisfied}
                      <span class="maint-warn" title="Maintenance not satisfied">
                        <span class="material-icons" style="font-size:14px;color:#ff9800">warning</span>
                      </span>
                    {/if}
                    {#if fac.rent_per_cycle}
                      <span class="rent-label mono">₡{fac.rent_per_cycle}/cycle</span>
                    {/if}
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <span
                      class="toggle-btn"
                      class:active={fac.active}
                      role="switch"
                      aria-checked={fac.active}
                      tabindex="0"
                      onclick={(e: MouseEvent) => { e.stopPropagation(); toggleFacility(fac); }}
                      title={fac.active ? 'Disable' : 'Enable'}
                    >
                      <span class="material-icons" style="font-size:16px">{fac.active ? 'toggle_on' : 'toggle_off'}</span>
                    </span>
                    <span class="material-icons expand-chevron" style="font-size:16px">{isExpanded ? 'expand_less' : 'expand_more'}</span>
                  </div>
                </div>
                {#if isExpanded}
                  <div class="fac-detail">
                    {#if fac.description}
                      <p class="fac-desc">{fac.description}</p>
                    {/if}
                    <div class="fac-detail-meta">
                      <span class="detail-kv"><span class="detail-k">Type</span> {fac.type}</span>
                      {#if fac.level}
                        <span class="detail-kv"><span class="detail-k">Level</span> {fac.level}</span>
                      {/if}
                      {#if fac.rent_paid_until_tick}
                        <span class="detail-kv"><span class="detail-k">Rent until</span> tick {fac.rent_paid_until_tick}</span>
                      {/if}
                    </div>
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <div class="fac-detail-actions">
                      {#if fac.category === 'production'}
                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                        <span class="action-link" role="button" tabindex="0" onclick={(e: MouseEvent) => { e.stopPropagation(); openTransfer(fac); }}>
                          <span class="material-icons" style="font-size:13px">swap_horiz</span> Transfer
                        </span>
                      {/if}
                      <!-- svelte-ignore a11y_no_static_element_interactions -->
                      <span class="action-link" role="button" tabindex="0" onclick={(e: MouseEvent) => { e.stopPropagation(); viewTypeDetail(fac.type); }}>
                        <span class="material-icons" style="font-size:13px">info</span> Type Info
                      </span>
                    </div>
                  </div>
                {/if}
              </button>
            {/each}
          </div>
        </Content>
      </Card>
    {/if}

    <!-- Other Players' Facilities -->
    {#if otherPlayerFacilities.length > 0}
      <Card class="space-card">
        <Content>
          <p class="tab-section-title">Player Facilities</p>
          <div class="fac-list">
            {#each otherPlayerFacilities as fac}
              {@const isExpanded = expandedFacIds.has(fac.facility_id)}
              <button class="fac-row" class:expanded={isExpanded} onclick={() => toggleExpand(fac.facility_id)}>
                <div class="fac-top">
                  <div class="fac-info">
                    <span class="fac-name">{fac.name}</span>
                    <span class="fac-meta">
                      <span class="cat-badge cat-{fac.category}">{formatCategory(fac.category)}</span>
                      {#if fac.recipe_id}
                        <span class="recipe-badge">{fac.recipe_id}</span>
                      {/if}
                      {#if fac.personal_service}
                        <span class="personal-badge">{fac.personal_service}</span>
                      {/if}
                      {#if fac.bonus_type}
                        <span class="bonus-badge">+{fac.bonus_value}% {fac.bonus_type}</span>
                      {/if}
                    </span>
                  </div>
                  <div class="fac-actions">
                    {#if !fac.maintenance_satisfied}
                      <span class="maint-warn" title="Maintenance not satisfied">
                        <span class="material-icons" style="font-size:14px;color:#ff9800">warning</span>
                      </span>
                    {/if}
                    <span class="status-dot" class:active={fac.active} title={fac.active ? 'Active' : 'Inactive'}></span>
                    <span class="material-icons expand-chevron" style="font-size:16px">{isExpanded ? 'expand_less' : 'expand_more'}</span>
                  </div>
                </div>
                {#if isExpanded}
                  <div class="fac-detail">
                    {#if fac.description}
                      <p class="fac-desc">{fac.description}</p>
                    {/if}
                    <div class="fac-detail-meta">
                      <span class="detail-kv"><span class="detail-k">Type</span> {fac.type}</span>
                      {#if fac.rent_per_cycle}
                        <span class="detail-kv"><span class="detail-k">Rent</span> ₡{fac.rent_per_cycle}/cycle</span>
                      {/if}
                    </div>
                  </div>
                {/if}
              </button>
            {/each}
          </div>
        </Content>
      </Card>
    {/if}

    <!-- Faction Facilities -->
    {#if facilityStore.factionFacilities.length > 0}
      <Card class="space-card">
        <Content>
          <p class="tab-section-title">Faction Facilities</p>
          <div class="fac-list">
            {#each facilityStore.factionFacilities as fac}
              {@const isExpanded = expandedFacIds.has(fac.facility_id)}
              <button class="fac-row" class:expanded={isExpanded} onclick={() => toggleExpand(fac.facility_id)}>
                <div class="fac-top">
                  <div class="fac-info">
                    <span class="fac-name">{fac.name}</span>
                    <span class="fac-meta">
                      {#if fac.faction_service}
                        <span class="faction-svc-badge">{fac.faction_service}</span>
                      {/if}
                      {#if fac.capacity}
                        <span class="cap-badge">Cap: {fac.capacity}</span>
                      {/if}
                    </span>
                  </div>
                  <div class="fac-actions">
                    <span class="status-dot" class:active={fac.active} title={fac.active ? 'Active' : 'Inactive'}></span>
                    <span class="material-icons expand-chevron" style="font-size:16px">{isExpanded ? 'expand_less' : 'expand_more'}</span>
                  </div>
                </div>
                {#if isExpanded}
                  <div class="fac-detail">
                    {#if fac.description}
                      <p class="fac-desc">{fac.description}</p>
                    {/if}
                    <div class="fac-detail-meta">
                      <span class="detail-kv"><span class="detail-k">Type</span> {fac.type}</span>
                    </div>
                  </div>
                {/if}
              </button>
            {/each}
          </div>
        </Content>
      </Card>
    {/if}

    <!-- Station Facilities -->
    {#if facilityStore.stationFacilities.length > 0}
      <Card class="space-card">
        <Content>
          <p class="tab-section-title">Station Facilities</p>
          <div class="fac-list">
            {#each facilityStore.stationFacilities as fac}
              {@const isExpanded = expandedFacIds.has(fac.facility_id)}
              <button class="fac-row" class:expanded={isExpanded} onclick={() => toggleExpand(fac.facility_id)}>
                <div class="fac-top">
                  <div class="fac-info">
                    <span class="fac-name">{fac.name}</span>
                    <span class="fac-meta">
                      <span class="cat-badge cat-{fac.category}">{formatCategory(fac.category)}</span>
                      {#if fac.service}
                        <span class="service-badge">{fac.service}</span>
                      {/if}
                      {#if fac.recipe_id}
                        <span class="recipe-badge">{fac.recipe_id}</span>
                      {/if}
                    </span>
                  </div>
                  <div class="fac-actions">
                    {#if !fac.maintenance_satisfied}
                      <span class="maint-warn" title="Maintenance not satisfied">
                        <span class="material-icons" style="font-size:14px;color:#ff9800">warning</span>
                      </span>
                    {/if}
                    <span class="status-dot" class:active={fac.active} title={fac.active ? 'Active' : 'Inactive'}></span>
                    <span class="material-icons expand-chevron" style="font-size:16px">{isExpanded ? 'expand_less' : 'expand_more'}</span>
                  </div>
                </div>
                {#if isExpanded}
                  <div class="fac-detail">
                    {#if fac.description}
                      <p class="fac-desc">{fac.description}</p>
                    {/if}
                    <div class="fac-detail-meta">
                      <span class="detail-kv"><span class="detail-k">Type</span> {fac.type}</span>
                      {#if fac.personal_service}
                        <span class="detail-kv"><span class="detail-k">Service</span> {fac.personal_service}</span>
                      {/if}
                    </div>
                  </div>
                {/if}
              </button>
            {/each}
          </div>
        </Content>
      </Card>
    {/if}

    {#if facilityStore.allFacilities.length === 0 && !facilityStore.loading}
      <p class="empty-hint">No facilities found at this station.</p>
    {/if}

    <!-- Transfer Dialog -->
    {#if transferTarget}
      <Card class="space-card transfer-card">
        <Content>
          <div class="detail-header">
            <p class="tab-section-title">Transfer: {transferTarget.name}</p>
            <button class="close-btn" onclick={() => (transferTarget = null)}>
              <span class="material-icons" style="font-size:18px">close</span>
            </button>
          </div>
          <div class="transfer-form">
            <div class="transfer-row">
              <label class="transfer-label">Direction</label>
              <div class="transfer-btns">
                <button class="dir-btn" class:active={transferDirection === 'to_faction'} onclick={() => (transferDirection = 'to_faction')}>To Faction</button>
                <button class="dir-btn" class:active={transferDirection === 'to_player'} onclick={() => (transferDirection = 'to_player')}>To Player</button>
              </div>
            </div>
            {#if transferDirection === 'to_player'}
              <div class="transfer-row">
                <label class="transfer-label">Player ID</label>
                <input class="transfer-input" type="text" bind:value={transferPlayerId} placeholder="Player ID or username" />
              </div>
            {/if}
            <Button variant="raised" dense onclick={submitTransfer}>
              <Label>Transfer</Label>
            </Button>
          </div>
        </Content>
      </Card>
    {/if}

  <!-- ===== CATALOG BROWSER ===== -->
  {:else if section === 'catalog'}

    <!-- Category Filters -->
    <div class="cat-filters">
      {#each categoryEntries as [cat, info]}
        <button
          class="cat-btn cat-{cat}"
          class:active={categoryFilter === cat}
          onclick={() => { categoryFilter = cat; catalogPage = 1; fetchTypes(); }}
        >
          {formatCategory(cat)}
          <span class="cat-count">{info.count}</span>
          {#if info.buildable}
            <span class="cat-buildable">({info.buildable})</span>
          {/if}
        </button>
      {/each}
    </div>

    <!-- Search Mode Toggle -->
    <div class="search-mode-row">
      <button class="search-mode-btn" class:active={catalogSearchMode === 'name'} onclick={() => catalogSearchMode = 'name'}>
        <span class="material-icons" style="font-size:14px">text_fields</span> Facility Name
      </button>
      <button class="search-mode-btn" class:active={catalogSearchMode === 'recipe'} onclick={() => catalogSearchMode = 'recipe'}>
        <span class="material-icons" style="font-size:14px">science</span> Recipe Item
      </button>
      {#if facilityStore.recipeMappingStatus === 'loading'}
        <span class="mapping-status">
          <span class="material-icons" style="font-size:12px;animation:spin 1s linear infinite">sync</span>
          Indexing...
        </span>
      {:else if facilityStore.recipeMappingStatus === 'done'}
        <span class="mapping-status done">
          <span class="material-icons" style="font-size:12px">check_circle</span>
          {facilityStore.recipeMappingSize} mapped
        </span>
      {/if}
    </div>

    <!-- Name Search -->
    {#if catalogSearchMode === 'name'}
      <div class="search-row">
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="search-field" onkeydown={handleSearchKey}>
          <Textfield
            variant="outlined"
            label="Search by name"
            bind:value={nameSearch}
            style="flex:1;--mdc-outlined-text-field-container-shape:4px"
            dense
          >
            <svelte:fragment slot="trailingIcon">
              <!-- svelte-ignore a11y_consider_explicit_label -->
              <span class="material-icons search-icon" style="cursor:pointer;font-size:18px" onclick={() => { catalogPage = 1; fetchTypes(); }}>search</span>
            </svelte:fragment>
          </Textfield>
        </div>
      </div>
    {:else}
      <!-- Recipe Item Search -->
      <div class="search-row">
        <div class="search-field">
          <Textfield
            variant="outlined"
            label="Search by recipe item (e.g. steel, alloy)"
            bind:value={recipeSearch}
            style="flex:1;--mdc-outlined-text-field-container-shape:4px"
            dense
          />
        </div>
      </div>
    {/if}

    {#if facilityStore.typesLoading}
      <LinearProgress indeterminate />
    {/if}

    <!-- Recipe Search Results -->
    {#if catalogSearchMode === 'recipe' && recipeSearch.trim()}
      {#if recipeSearchResults.length === 0}
        <p class="empty-hint">No recipes matching "{recipeSearch}"</p>
      {:else}
        <div class="recipe-results">
          {#each recipeSearchResults as recipe}
            {@const facInfo = facilityStore.getFacilityForRecipe(recipe.id)}
            <div class="recipe-result-card">
              <div class="recipe-result-top">
                <span class="recipe-result-name">{recipe.name}</span>
                {#if recipe.category}
                  <span class="recipe-result-cat">{recipe.category}</span>
                {/if}
              </div>
              <div class="recipe-result-items">
                <span class="recipe-io-label">In:</span>
                {#each recipe.inputs ?? [] as inp}
                  <span class="recipe-io-chip input">{formatItemId(inp.item_id)} ×{inp.quantity}</span>
                {/each}
                <span class="recipe-io-arrow">→</span>
                <span class="recipe-io-label">Out:</span>
                {#each recipe.outputs ?? [] as out}
                  <span class="recipe-io-chip output">{formatItemId(out.item_id)} ×{out.quantity}</span>
                {/each}
              </div>
              {#if facInfo}
                <div class="recipe-facility-row">
                  <span class="material-icons" style="font-size:14px;color:#ff9800">factory</span>
                  <span class="facility-link-name">{facInfo.name}</span>
                  <span class="mono credits" style="font-size:0.65rem">₡{facInfo.build_cost.toLocaleString()}</span>
                  <button class="view-detail-btn" onclick={() => viewTypeDetail(facInfo.id)} title="View facility details">
                    <span class="material-icons" style="font-size:14px">open_in_new</span>
                  </button>
                </div>
              {:else if facilityStore.recipeMappingStatus === 'done'}
                <div class="recipe-facility-row no-fac">
                  <span class="material-icons" style="font-size:13px;color:#546e7a">help_outline</span>
                  <span style="color:#546e7a;font-size:0.68rem">No facility linked</span>
                </div>
              {:else}
                <div class="recipe-facility-row no-fac">
                  <span class="material-icons" style="font-size:13px;color:#78909c;animation:spin 1s linear infinite">sync</span>
                  <span style="color:#78909c;font-size:0.68rem">Loading facility data...</span>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}

    <!-- Hint when no category selected (name mode only) -->
    {:else if catalogNeedsFilter && catalogSearchMode === 'name'}
      <p class="empty-hint">Select a category above or search by name to browse facility types.</p>
    {/if}

    <!-- Type List (shown in name mode or when not searching by recipe) -->
    {#if facilityStore.types.length > 0 && catalogSearchMode === 'name'}
      <div class="types-grid">
        {#each facilityStore.types as ft}
          <button class="type-card" onclick={() => viewTypeDetail(ft.id)}>
            <span class="type-name">{ft.name}</span>
            <span class="type-meta">
              <span class="cat-badge cat-{ft.category}" style="font-size:0.65rem">{formatCategory(ft.category)}</span>
              <span class="mono" style="color:#ffd700">₡{ft.build_cost?.toLocaleString()}</span>
              {#if ft.buildable}
                <span class="buildable-tag">Buildable</span>
              {/if}
            </span>
          </button>
        {/each}
      </div>

      <!-- Pagination -->
      <div class="pagination">
        <Button variant="outlined" dense disabled={catalogPage <= 1} onclick={prevPage}>
          <Label>Prev</Label>
        </Button>
        <span class="mono page-info">{catalogPage} / {facilityStore.typesTotalPages}</span>
        <Button variant="outlined" dense disabled={catalogPage >= facilityStore.typesTotalPages} onclick={nextPage}>
          <Label>Next</Label>
        </Button>
      </div>
    {:else if !facilityStore.typesLoading && !catalogNeedsFilter && catalogSearchMode === 'name'}
      <p class="empty-hint">No facility types found. Try a different filter.</p>
    {/if}

    <div class="quick-actions">
      <Button variant="outlined" dense onclick={() => (section = 'list')}>
        <Label>Back to List</Label>
      </Button>
    </div>

  <!-- ===== UPGRADES ===== -->
  {:else if section === 'upgrades'}

    <div class="quick-actions">
      <Button variant="outlined" dense onclick={() => ws.facilityUpgrades()}>
        <Label>Refresh</Label>
      </Button>
      <Button variant="outlined" dense onclick={() => (section = 'list')}>
        <Label>Back to List</Label>
      </Button>
    </div>

    {#if facilityStore.upgradesLoading}
      <LinearProgress indeterminate />
    {/if}

    {#if facilityStore.upgrades.length > 0}
      <Card class="space-card">
        <Content>
          <p class="tab-section-title">Available Upgrades</p>
          <div class="fac-list">
            {#each facilityStore.upgrades as u}
              <div class="upgrade-row">
                <div class="upgrade-info">
                  <span class="fac-name">{u.current_name}</span>
                  <span class="upgrade-arrow">
                    <span class="material-icons" style="font-size:14px;color:#4fc3f7">arrow_forward</span>
                  </span>
                  <span class="fac-name upgrade-target">{u.upgrade_name}</span>
                </div>
                <div class="upgrade-cost">
                  <span class="mono credits">₡{u.upgrade_cost?.toLocaleString()}</span>
                  {#if u.upgrade_materials && u.upgrade_materials.length > 0}
                    <span class="upgrade-mats">
                      {#each u.upgrade_materials as mat}
                        <span class="mat-chip">{mat.name} x{mat.quantity}</span>
                      {/each}
                    </span>
                  {/if}
                </div>
                <Button variant="raised" dense onclick={() => handleUpgrade(u)} disabled={u.buildable === false}>
                  <Label>Upgrade</Label>
                </Button>
              </div>
            {/each}
          </div>
        </Content>
      </Card>
    {/if}

    {#if facilityStore.lockedUpgrades.length > 0}
      <Card class="space-card">
        <Content>
          <p class="tab-section-title">Locked Upgrades</p>
          <div class="fac-list">
            {#each facilityStore.lockedUpgrades as lu}
              <div class="upgrade-row locked">
                <div class="upgrade-info">
                  <span class="fac-name">{lu.your_facility_name}</span>
                  <span class="upgrade-arrow">
                    <span class="material-icons" style="font-size:14px;color:#546e7a">arrow_forward</span>
                  </span>
                  <span class="fac-name upgrade-target">{lu.upgrade_to.name}</span>
                  <span class="cat-badge cat-{lu.upgrade_to.category}" style="font-size:0.6rem">{formatCategory(lu.upgrade_to.category)} L{lu.upgrade_to.level}</span>
                </div>
                <div class="upgrade-cost">
                  <span class="mono credits" style="opacity:0.6">₡{lu.upgrade_to.build_cost?.toLocaleString()}</span>
                  {#if lu.upgrade_to.build_materials && lu.upgrade_to.build_materials.length > 0}
                    <span class="upgrade-mats">
                      {#each lu.upgrade_to.build_materials as mat}
                        <span class="mat-chip" style="opacity:0.6">{mat.name} x{mat.quantity}</span>
                      {/each}
                    </span>
                  {/if}
                </div>
                <div class="lock-reason">
                  <span class="material-icons" style="font-size:14px;color:#ff9800">lock</span>
                  <span class="lock-text">{lu.requires}</span>
                </div>
              </div>
            {/each}
          </div>
        </Content>
      </Card>
    {/if}

    {#if facilityStore.upgrades.length === 0 && facilityStore.lockedUpgrades.length === 0 && !facilityStore.upgradesLoading}
      <p class="empty-hint">No upgrades available. Build facilities first, then check here for upgrade paths.</p>
    {/if}

  <!-- ===== PERSONAL QUARTERS ===== -->
  {:else if section === 'quarters'}

    <div class="quick-actions">
      <Button variant="outlined" dense onclick={() => (section = 'list')}>
        <Label>Back to List</Label>
      </Button>
      {#if !hasQuarters}
        <Button variant="outlined" dense onclick={() => browseTypes('personal')}>
          <Label>Build Quarters</Label>
        </Button>
      {/if}
    </div>

    {#if !hasQuarters}
      <p class="empty-hint">You need Personal Quarters at this station first. Build a Crew Bunk or higher from the Personal category in the Catalog.</p>
    {:else}
      <!-- Decorate Section -->
      <Card class="space-card">
        <Content>
          <p class="tab-section-title">Decorate Quarters</p>
          <p class="hint-text">Write a description of your quarters. Other players can visit if set to public.</p>
          <div class="quarters-form">
            <textarea
              class="quarters-textarea"
              bind:value={decorateDesc}
              placeholder="A cozy cabin with star charts on the walls, the hum of life support, and a viewport overlooking the station dock..."
              rows="4"
            ></textarea>
            <div class="access-row">
              <span class="access-label">Access:</span>
              <button class="dir-btn" class:active={decorateAccess === 'public'} onclick={() => (decorateAccess = 'public')}>Public</button>
              <button class="dir-btn" class:active={decorateAccess === 'private'} onclick={() => (decorateAccess = 'private')}>Private</button>
            </div>
            <Button variant="raised" dense onclick={submitDecorate} disabled={!decorateDesc.trim()}>
              <Label>Save Description</Label>
            </Button>
          </div>
        </Content>
      </Card>

      <!-- Visit Section -->
      <Card class="space-card">
        <Content>
          <p class="tab-section-title">Visit Quarters</p>
          <div class="visit-form">
            <div class="visit-row">
              <Button variant="outlined" dense onclick={() => visitQuarters()}>
                <Label>Visit My Quarters</Label>
              </Button>
            </div>
            <div class="visit-row">
              <input
                class="transfer-input"
                type="text"
                bind:value={visitUsername}
                placeholder="Username to visit"
              />
              <Button variant="outlined" dense onclick={() => visitQuarters(visitUsername)} disabled={!visitUsername.trim()}>
                <Label>Visit</Label>
              </Button>
            </div>
          </div>

          {#if facilityStore.quartersLoading}
            <LinearProgress indeterminate />
          {/if}

          {#if facilityStore.quartersInfo}
            <div class="quarters-view">
              <div class="quarters-header">
                <span class="quarters-owner">{facilityStore.quartersInfo.username}'s Quarters</span>
                {#if facilityStore.quartersInfo.facility_name}
                  <span class="quarters-level">{facilityStore.quartersInfo.facility_name}</span>
                {/if}
                <span class="quarters-access-badge" class:public={facilityStore.quartersInfo.access === 'public'}>
                  {facilityStore.quartersInfo.access}
                </span>
              </div>
              <p class="quarters-desc">{facilityStore.quartersInfo.description}</p>
              <button class="close-btn" style="align-self:flex-end" onclick={() => facilityStore.setQuartersInfo(null)}>
                <span class="material-icons" style="font-size:14px">close</span> Close
              </button>
            </div>
          {/if}
        </Content>
      </Card>
    {/if}
  {/if}
</div>

<style>
  .facility-container {
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-switch {
    display: flex;
    gap: 4px;
    margin-bottom: 4px;
    flex-wrap: wrap;
  }
  .switch-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 14px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(79,195,247,0.15);
    border-radius: 4px;
    color: #78909c;
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.15s;
  }
  .switch-btn:hover { color: #b0bec5; background: rgba(255,255,255,0.05); }
  .switch-btn.active { color: #4fc3f7; border-color: #4fc3f7; background: rgba(79,195,247,0.08); }

  .empty-hint { color: #546e7a; font-size: 0.8rem; text-align: center; padding: 20px; }
  .hint-text { color: #546e7a; font-size: 0.72rem; margin: 0 0 8px; }

  /* Facility List */
  .fac-list { display: flex; flex-direction: column; gap: 2px; }
  .fac-row {
    display: flex;
    flex-direction: column;
    padding: 6px 8px;
    border-radius: 3px;
    background: rgba(255,255,255,0.02);
    border: 1px solid transparent;
    cursor: pointer;
    text-align: left;
    color: inherit;
    width: 100%;
    transition: background 0.1s, border-color 0.15s;
  }
  .fac-row:hover { background: rgba(79,195,247,0.05); }
  .fac-row.expanded { border-color: rgba(79,195,247,0.15); background: rgba(79,195,247,0.03); }
  .fac-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
  }
  .fac-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .fac-name { font-size: 0.8rem; color: #e0e0e0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .fac-meta { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
  .fac-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }

  .expand-chevron { color: #546e7a; transition: color 0.1s; }
  .fac-row:hover .expand-chevron { color: #90a4ae; }

  /* Expanded detail */
  .fac-detail {
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px solid rgba(79,195,247,0.08);
  }
  .fac-desc { font-size: 0.73rem; color: #90a4ae; line-height: 1.4; margin: 0 0 6px; }
  .fac-detail-meta { display: flex; flex-wrap: wrap; gap: 8px; }
  .fac-detail-actions { display: flex; gap: 8px; margin-top: 6px; }
  .detail-kv { font-size: 0.68rem; color: #78909c; }
  .detail-k { color: #546e7a; margin-right: 3px; text-transform: uppercase; font-size: 0.6rem; letter-spacing: 0.3px; }

  .action-link {
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 2px 8px;
    border: 1px solid rgba(79,195,247,0.2);
    border-radius: 3px;
    background: none;
    color: #4fc3f7;
    font-size: 0.68rem;
    cursor: pointer;
    transition: all 0.15s;
  }
  .action-link:hover { background: rgba(79,195,247,0.1); }

  .toggle-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: #546e7a;
    padding: 2px;
    display: flex;
    align-items: center;
  }
  .toggle-btn.active { color: #4caf50; }
  .toggle-btn:hover { color: #4fc3f7; }

  .status-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: #546e7a;
  }
  .status-dot.active { background: #4caf50; }

  .rent-label { font-size: 0.65rem; color: #78909c; }
  .maint-warn { display: flex; align-items: center; }

  /* Badges */
  .cat-badge {
    font-size: 0.65rem;
    padding: 1px 6px;
    border-radius: 3px;
    background: rgba(255,255,255,0.06);
    color: #90a4ae;
  }
  .cat-production { color: #ff9800; background: rgba(255,152,0,0.1); }
  .cat-service { color: #2196f3; background: rgba(33,150,243,0.1); }
  .cat-personal { color: #ab47bc; background: rgba(171,71,188,0.1); }
  .cat-faction { color: #4caf50; background: rgba(76,175,80,0.1); }
  .cat-infrastructure { color: #78909c; background: rgba(120,144,156,0.1); }

  .recipe-badge { font-size: 0.63rem; color: #ff9800; background: rgba(255,152,0,0.08); padding: 1px 5px; border-radius: 2px; }
  .personal-badge { font-size: 0.63rem; color: #ab47bc; background: rgba(171,71,188,0.08); padding: 1px 5px; border-radius: 2px; }
  .bonus-badge { font-size: 0.63rem; color: #ffd700; background: rgba(255,215,0,0.08); padding: 1px 5px; border-radius: 2px; }
  .faction-svc-badge { font-size: 0.63rem; color: #4caf50; background: rgba(76,175,80,0.08); padding: 1px 5px; border-radius: 2px; }
  .service-badge { font-size: 0.63rem; color: #2196f3; background: rgba(33,150,243,0.08); padding: 1px 5px; border-radius: 2px; }
  .cap-badge { font-size: 0.63rem; color: #78909c; }

  .quick-actions { display: flex; gap: 6px; padding: 4px 0; flex-wrap: wrap; }

  /* Catalog */
  .cat-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 4px;
  }
  .cat-btn {
    padding: 4px 10px;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 3px;
    background: rgba(255,255,255,0.03);
    color: #78909c;
    font-size: 0.7rem;
    cursor: pointer;
    transition: all 0.15s;
    display: flex;
    align-items: center;
    gap: 3px;
  }
  .cat-btn:hover { color: #b0bec5; background: rgba(255,255,255,0.06); }
  .cat-btn.active { color: #4fc3f7; border-color: #4fc3f7; }
  .cat-count { font-size: 0.6rem; opacity: 0.6; }
  .cat-buildable { font-size: 0.55rem; opacity: 0.5; }

  .search-row { display: flex; gap: 6px; margin-bottom: 4px; }
  .search-field { display: flex; flex: 1; }

  .types-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 4px;
  }
  .type-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 10px;
    border: 1px solid rgba(79,195,247,0.1);
    border-radius: 4px;
    background: rgba(255,255,255,0.02);
    cursor: pointer;
    text-align: left;
    transition: all 0.15s;
    color: inherit;
  }
  .type-card:hover { background: rgba(79,195,247,0.06); border-color: rgba(79,195,247,0.25); }
  .type-name { font-size: 0.78rem; color: #e0e0e0; }
  .type-meta { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .buildable-tag { font-size: 0.6rem; color: #4caf50; background: rgba(76,175,80,0.1); padding: 1px 5px; border-radius: 2px; }

  .pagination { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 8px 0; }
  .page-info { font-size: 0.75rem; color: #78909c; }

  /* Detail */
  .detail-card { margin-bottom: 8px; border: 1px solid rgba(79,195,247,0.3) !important; }
  .detail-header { display: flex; justify-content: space-between; align-items: center; }
  .close-btn {
    background: none; border: none; cursor: pointer; color: #78909c;
    padding: 2px; display: flex; align-items: center; gap: 3px;
  }
  .close-btn:hover { color: #e0e0e0; }
  .detail-desc { font-size: 0.75rem; color: #90a4ae; margin: 6px 0 10px; line-height: 1.4; }
  .detail-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 6px;
  }
  .detail-item { display: flex; flex-direction: column; gap: 2px; }
  .detail-label { font-size: 0.63rem; color: #546e7a; text-transform: uppercase; letter-spacing: 0.5px; }

  .materials-list { display: flex; flex-wrap: wrap; gap: 4px; }
  .mat-chip {
    font-size: 0.7rem;
    padding: 2px 8px;
    border-radius: 3px;
    background: rgba(255,255,255,0.05);
    color: #b0bec5;
  }

  .recipe-flow { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .recipe-side { display: flex; flex-wrap: wrap; gap: 4px; }
  .recipe-arrow { color: #546e7a; font-size: 18px; }
  .input-chip { color: #ff9800; background: rgba(255,152,0,0.08); }
  .output-chip { color: #4caf50; background: rgba(76,175,80,0.08); }

  .credits { color: #ffd700; }
  .mono { font-family: 'Roboto Mono', monospace; }

  /* Search icon helper */
  .search-icon { color: #546e7a; }
  .search-icon:hover { color: #4fc3f7; }

  /* Search mode toggle */
  .search-mode-row {
    display: flex;
    gap: 4px;
    margin-bottom: 6px;
    align-items: center;
  }
  .search-mode-btn {
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 4px 10px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 3px;
    color: #78909c;
    font-size: 0.7rem;
    cursor: pointer;
    transition: all 0.15s;
  }
  .search-mode-btn:hover { color: #b0bec5; background: rgba(255,255,255,0.06); }
  .search-mode-btn.active { color: #4fc3f7; border-color: #4fc3f7; background: rgba(79,195,247,0.08); }

  .mapping-status {
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: 0.6rem;
    color: #78909c;
    margin-left: auto;
  }
  .mapping-status.done { color: #4caf50; }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* Recipe search results */
  .recipe-results {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 500px;
    overflow-y: auto;
  }
  .recipe-result-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 10px;
    border: 1px solid rgba(79,195,247,0.1);
    border-radius: 4px;
    background: rgba(255,255,255,0.02);
  }
  .recipe-result-top {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .recipe-result-name { font-size: 0.78rem; color: #e0e0e0; }
  .recipe-result-cat {
    font-size: 0.55rem;
    font-family: 'Roboto Mono', monospace;
    color: #78909c;
    background: rgba(255,255,255,0.05);
    padding: 0 5px;
    border-radius: 3px;
  }
  .recipe-result-items {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
    align-items: center;
    font-size: 0.68rem;
  }
  .recipe-io-label {
    font-size: 0.6rem;
    color: #546e7a;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  .recipe-io-chip {
    padding: 1px 6px;
    border-radius: 2px;
    font-size: 0.65rem;
  }
  .recipe-io-chip.input { color: #ff9800; background: rgba(255,152,0,0.08); }
  .recipe-io-chip.output { color: #4caf50; background: rgba(76,175,80,0.08); }
  .recipe-io-arrow { color: #546e7a; font-size: 0.7rem; }

  .recipe-facility-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 6px;
    background: rgba(255,152,0,0.04);
    border-radius: 3px;
  }
  .recipe-facility-row.no-fac { background: rgba(255,255,255,0.02); }
  .facility-link-name { font-size: 0.73rem; color: #e0e0e0; }
  .view-detail-btn {
    background: none;
    border: 1px solid rgba(79,195,247,0.2);
    border-radius: 3px;
    color: #4fc3f7;
    cursor: pointer;
    padding: 1px 4px;
    display: flex;
    align-items: center;
    transition: all 0.15s;
    margin-left: auto;
  }
  .view-detail-btn:hover { background: rgba(79,195,247,0.1); }

  /* Transfer dialog */
  .transfer-card { border: 1px solid rgba(79,195,247,0.3) !important; }
  .transfer-form { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
  .transfer-row { display: flex; align-items: center; gap: 8px; }
  .transfer-label { font-size: 0.72rem; color: #78909c; min-width: 70px; }
  .transfer-btns { display: flex; gap: 4px; }
  .dir-btn {
    padding: 4px 10px;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 3px;
    background: rgba(255,255,255,0.03);
    color: #78909c;
    font-size: 0.7rem;
    cursor: pointer;
    transition: all 0.15s;
  }
  .dir-btn:hover { color: #b0bec5; background: rgba(255,255,255,0.06); }
  .dir-btn.active { color: #4fc3f7; border-color: #4fc3f7; }
  .transfer-input {
    flex: 1;
    padding: 5px 8px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(79,195,247,0.15);
    border-radius: 3px;
    color: #e0e0e0;
    font-size: 0.75rem;
    font-family: 'Roboto Mono', monospace;
  }
  .transfer-input::placeholder { color: #546e7a; }

  /* Upgrade section */
  .upgrade-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px;
    border-radius: 3px;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(79,195,247,0.08);
    flex-wrap: wrap;
  }
  .upgrade-info { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 180px; }
  .upgrade-arrow { display: flex; align-items: center; }
  .upgrade-target { color: #4fc3f7; }
  .upgrade-cost { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .upgrade-mats { display: flex; gap: 3px; flex-wrap: wrap; }
  .upgrade-row.locked { opacity: 0.75; border-color: rgba(255,152,0,0.15); }
  .lock-reason { display: flex; align-items: center; gap: 4px; }
  .lock-text { font-size: 0.7rem; color: #ff9800; }

  /* Quarters */
  .quarters-form { display: flex; flex-direction: column; gap: 8px; }
  .quarters-textarea {
    width: 100%;
    padding: 8px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(79,195,247,0.15);
    border-radius: 4px;
    color: #e0e0e0;
    font-size: 0.75rem;
    font-family: 'Roboto', sans-serif;
    line-height: 1.5;
    resize: vertical;
  }
  .quarters-textarea::placeholder { color: #546e7a; }
  .quarters-textarea:focus { border-color: #4fc3f7; outline: none; }

  .access-row { display: flex; align-items: center; gap: 6px; }
  .access-label { font-size: 0.72rem; color: #78909c; }

  .visit-form { display: flex; flex-direction: column; gap: 8px; margin-bottom: 8px; }
  .visit-row { display: flex; gap: 6px; align-items: center; }

  .quarters-view {
    margin-top: 10px;
    padding: 12px;
    border: 1px solid rgba(79,195,247,0.2);
    border-radius: 4px;
    background: rgba(79,195,247,0.03);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .quarters-header { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .quarters-owner { font-size: 0.82rem; color: #e0e0e0; font-weight: 500; }
  .quarters-level { font-size: 0.68rem; color: #ab47bc; background: rgba(171,71,188,0.08); padding: 1px 6px; border-radius: 2px; }
  .quarters-access-badge {
    font-size: 0.63rem;
    padding: 1px 6px;
    border-radius: 2px;
    background: rgba(255,255,255,0.06);
    color: #78909c;
  }
  .quarters-access-badge.public { color: #4caf50; background: rgba(76,175,80,0.1); }
  .quarters-desc {
    font-size: 0.78rem;
    color: #b0bec5;
    line-height: 1.6;
    white-space: pre-wrap;
    margin: 4px 0;
  }
</style>
