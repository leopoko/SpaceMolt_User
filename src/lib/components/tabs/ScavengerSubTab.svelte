<script lang="ts">
  import Card, { Content } from '@smui/card';
  import { scavengerStore } from '$lib/stores/scavenger.svelte';
  import { actionQueueStore } from '$lib/stores/actionQueue.svelte';
  import { playerStore } from '$lib/stores/player.svelte';
  import { ws } from '$lib/services/websocket';

  // ---- Wreck list ----
  function refreshWrecks() {
    scavengerStore.loading = true;
    ws.getWrecks();
  }

  function selectWreck(id: string) {
    scavengerStore.selectWreck(id);
  }

  // ---- Loot ----
  let lootQuantities = $state<Record<string, number>>({});

  function getLootQty(wreckId: string, itemId: string): number {
    return lootQuantities[`${wreckId}:${itemId}`] ?? 1;
  }

  function setLootQty(wreckId: string, itemId: string, val: number) {
    lootQuantities[`${wreckId}:${itemId}`] = Math.max(1, val);
  }

  function lootItem(wreckId: string, itemId: string, itemName: string) {
    const qty = getLootQty(wreckId, itemId);
    actionQueueStore.enqueue(
      `Loot ${qty}x ${itemName || itemId}`,
      () => ws.lootWreck(wreckId, itemId, qty),
      { command: { type: 'loot_wreck', params: { wreckId, itemId, quantity: qty } } }
    );
  }

  function lootAll(wreckId: string, loot: Array<{ item_id: string; name?: string; quantity: number }>) {
    for (const item of loot) {
      actionQueueStore.enqueue(
        `Loot ${item.quantity}x ${item.name || item.item_id}`,
        () => ws.lootWreck(wreckId, item.item_id, item.quantity),
        { command: { type: 'loot_wreck', params: { wreckId, itemId: item.item_id, quantity: item.quantity } } }
      );
    }
  }

  // ---- Salvage ----
  function salvageWreck(wreckId: string, shipType: string) {
    actionQueueStore.enqueue(
      `Salvage ${shipType}`,
      () => ws.salvageWreck(wreckId),
      { command: { type: 'salvage_wreck', params: { wreckId } } }
    );
  }

  // ---- Scrap ----
  function scrapWreck() {
    actionQueueStore.enqueue(
      'Scrap wreck',
      () => ws.scrapWreck(),
      { command: { type: 'scrap_wreck', params: {} } }
    );
  }

  // ---- Self Destruct ----
  let showSelfDestructConfirm = $state(false);
  let holdProgress = $state(0);
  let holdInterval = $state<ReturnType<typeof setInterval> | null>(null);
  const HOLD_DURATION_MS = 3000; // 3 seconds
  const HOLD_TICK_MS = 50;

  function startHold() {
    holdProgress = 0;
    holdInterval = setInterval(() => {
      holdProgress += HOLD_TICK_MS / HOLD_DURATION_MS * 100;
      if (holdProgress >= 100) {
        stopHold();
        executeSelfDestruct();
      }
    }, HOLD_TICK_MS);
  }

  function stopHold() {
    if (holdInterval) {
      clearInterval(holdInterval);
      holdInterval = null;
    }
    holdProgress = 0;
  }

  function executeSelfDestruct() {
    showSelfDestructConfirm = false;
    actionQueueStore.enqueue(
      'SELF DESTRUCT',
      () => ws.selfDestruct(),
      { command: { type: 'self_destruct', params: {} } }
    );
  }

  let selectedWreck = $derived(scavengerStore.selectedWreck);
</script>

<div class="two-col">
  <!-- Left: Wreck List -->
  <Card class="space-card">
    <Content>
      <div class="section-header">
        <p class="tab-section-title">Wrecks</p>
        <button class="refresh-btn" onclick={refreshWrecks} disabled={scavengerStore.loading}>
          <span class="material-icons" class:spinning={scavengerStore.loading}>refresh</span>
          SCAN
        </button>
      </div>

      {#if scavengerStore.wrecks.length > 0}
        <div class="wreck-list">
          {#each scavengerStore.wrecks as wreck (wreck.id)}
            <div
              class="wreck-item"
              class:selected={scavengerStore.selectedWreckId === wreck.id}
              onclick={() => selectWreck(wreck.id)}
              role="button"
              tabindex="0"
              onkeydown={(e) => e.key === 'Enter' && selectWreck(wreck.id)}
            >
              <div class="wreck-info">
                <span class="wreck-icon material-icons">broken_image</span>
                <div class="wreck-details">
                  <span class="wreck-name">{wreck.ship_type}</span>
                  <span class="wreck-meta mono">
                    {wreck.loot?.length ?? 0} items
                    {#if wreck.wreck_type}
                      <span class="wreck-type-badge">{wreck.wreck_type}</span>
                    {/if}
                  </span>
                </div>
              </div>
              <div class="wreck-actions-mini">
                <button
                  class="action-btn salvage-btn"
                  onclick={(e) => { e.stopPropagation(); salvageWreck(wreck.id, wreck.ship_type); }}
                  title="Salvage wreck"
                >
                  <span class="material-icons">recycling</span>
                  SALVAGE
                </button>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <p class="empty-hint">
          {scavengerStore.loading ? 'Scanning for wrecks...' : 'No wrecks found. Press SCAN to search.'}
        </p>
      {/if}

      <!-- Scrap Wreck (docked only) -->
      {#if playerStore.isDocked}
        <div class="scrap-section">
          <p class="tab-section-title" style="margin-top: 12px">Salvage Yard</p>
          <button class="action-btn-lg scrap-btn" onclick={scrapWreck}>
            <span class="material-icons">construction</span>
            Scrap Wreck
          </button>
          <p class="hint-text">Requires salvaging skill Lv.2+</p>
        </div>
      {/if}
    </Content>
  </Card>

  <!-- Right: Wreck Detail + Self Destruct -->
  <Card class="space-card">
    <Content>
      {#if selectedWreck}
        <div class="detail-section">
          <div class="detail-header">
            <span class="material-icons" style="font-size:18px;color:#ff9800">broken_image</span>
            <span class="detail-title">{selectedWreck.ship_type}</span>
            {#if selectedWreck.owner}
              <span class="owner-tag">{selectedWreck.owner}</span>
            {/if}
          </div>

          <div class="detail-grid">
            <span class="detail-label">Wreck ID</span>
            <span class="detail-value mono id-val">{selectedWreck.id.slice(0, 16)}...</span>
            {#if selectedWreck.wreck_type}
              <span class="detail-label">Type</span>
              <span class="detail-value">{selectedWreck.wreck_type}</span>
            {/if}
          </div>

          <!-- Loot All button -->
          {#if selectedWreck.loot?.length}
            <div class="loot-all-row">
              <button
                class="action-btn-lg loot-all-btn"
                onclick={() => lootAll(selectedWreck!.id, selectedWreck!.loot)}
              >
                <span class="material-icons">inventory_2</span>
                Loot All ({selectedWreck.loot.length} items)
              </button>
            </div>
          {/if}

          <!-- Loot Items -->
          <p class="tab-section-title" style="margin-top: 8px">Cargo</p>
          {#if selectedWreck.loot?.length}
            <div class="loot-list">
              {#each selectedWreck.loot as item (item.item_id)}
                <div class="loot-item">
                  <div class="loot-info">
                    <span class="loot-name">{item.name || item.item_id}</span>
                    <span class="loot-qty mono">x{item.quantity}</span>
                  </div>
                  <div class="loot-controls">
                    <input
                      type="number"
                      class="qty-input mono"
                      min="1"
                      max={item.quantity}
                      value={getLootQty(selectedWreck!.id, item.item_id)}
                      oninput={(e) => setLootQty(selectedWreck!.id, item.item_id, Number((e.target as HTMLInputElement).value))}
                    />
                    <button
                      class="action-btn loot-btn"
                      onclick={() => lootItem(selectedWreck!.id, item.item_id, item.name ?? item.item_id)}
                      title="Loot item"
                    >
                      <span class="material-icons">move_to_inbox</span>
                      LOOT
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <p class="empty-hint">No loot remaining</p>
          {/if}

          <div class="section-divider"></div>

          <!-- Salvage this wreck -->
          <div class="wreck-action-row">
            <button
              class="action-btn-lg salvage-lg-btn"
              onclick={() => salvageWreck(selectedWreck!.id, selectedWreck!.ship_type)}
            >
              <span class="material-icons">recycling</span>
              Salvage Wreck
            </button>
            <p class="hint-text">Destroys wreck. Yields metal scrap &amp; components.</p>
          </div>
        </div>
      {:else}
        <div class="no-selection">
          <span class="material-icons" style="font-size:24px;color:#263238">search</span>
          <p>Select a wreck to view loot</p>
        </div>
      {/if}

      <div class="section-divider"></div>

      <!-- Self Destruct -->
      <div class="self-destruct-section">
        <p class="tab-section-title danger-title">
          <span class="material-icons" style="font-size:16px">warning</span>
          Self Destruct
        </p>

        {#if !showSelfDestructConfirm}
          <button
            class="action-btn-lg self-destruct-btn"
            onclick={() => showSelfDestructConfirm = true}
          >
            <span class="material-icons">dangerous</span>
            Self Destruct
          </button>
          <p class="hint-text">Destroys your ship, creates a wreck, respawns at home base.</p>
        {:else}
          <div class="confirm-panel">
            <div class="confirm-warning">
              <span class="material-icons" style="font-size: 20px; color: #f44336">error</span>
              <div>
                <p class="confirm-title">Confirm Self Destruct</p>
                <p class="confirm-desc">
                  Your ship will be destroyed. A wreck will be left at your location.
                  You will respawn at your home base.
                </p>
              </div>
            </div>

            <div class="hold-btn-wrapper">
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="hold-btn"
                onmousedown={startHold}
                onmouseup={stopHold}
                onmouseleave={stopHold}
                ontouchstart={startHold}
                ontouchend={stopHold}
                ontouchcancel={stopHold}
                role="button"
                tabindex="0"
              >
                <div class="hold-progress" style="width: {holdProgress}%"></div>
                <span class="hold-label">
                  <span class="material-icons" style="font-size:16px">dangerous</span>
                  {holdProgress > 0 ? `${Math.round(holdProgress)}%` : 'HOLD TO CONFIRM'}
                </span>
              </div>
              <p class="hold-hint">Hold for 3 seconds to self-destruct</p>
            </div>

            <button
              class="cancel-btn"
              onclick={() => { showSelfDestructConfirm = false; stopHold(); }}
            >
              Cancel
            </button>
          </div>
        {/if}
      </div>
    </Content>
  </Card>
</div>

<style>
  /* ---- Section header ---- */
  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .section-header .tab-section-title { margin: 0; }

  .refresh-btn {
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 3px 8px;
    background: transparent;
    border: 1px solid rgba(79, 195, 247, 0.3);
    border-radius: 3px;
    color: #4fc3f7;
    font-size: 0.62rem;
    font-family: 'Roboto Mono', monospace;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }

  .refresh-btn:hover { background: rgba(79, 195, 247, 0.12); }
  .refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .refresh-btn .material-icons { font-size: 14px; }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .spinning { animation: spin 1s linear infinite; }

  /* ---- Wreck list ---- */
  .wreck-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .wreck-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s;
    gap: 8px;
  }

  .wreck-item:hover { background: rgba(255, 255, 255, 0.06); }
  .wreck-item.selected { border-color: rgba(255, 152, 0, 0.5); background: rgba(255, 152, 0, 0.06); }

  .wreck-info {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
  }

  .wreck-icon { font-size: 16px; color: #546e7a; }
  .wreck-item.selected .wreck-icon { color: #ff9800; }

  .wreck-details {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .wreck-name { font-size: 0.8rem; color: #b0bec5; }
  .wreck-meta { font-size: 0.68rem; color: #546e7a; display: flex; align-items: center; gap: 6px; }

  .wreck-type-badge {
    font-size: 0.56rem;
    background: rgba(255, 152, 0, 0.15);
    color: #ff9800;
    padding: 0 4px;
    border-radius: 2px;
    text-transform: uppercase;
  }

  .wreck-actions-mini {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }

  .empty-hint {
    font-size: 0.75rem;
    color: #263238;
    text-align: center;
    padding: 12px 0;
  }

  /* ---- Action buttons ---- */
  .action-btn {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 3px 6px;
    border: 1px solid;
    border-radius: 3px;
    font-size: 0.6rem;
    font-family: 'Roboto Mono', monospace;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    background: transparent;
    white-space: nowrap;
  }

  .action-btn .material-icons { font-size: 13px; }

  .salvage-btn { color: #ff9800; border-color: rgba(255, 152, 0, 0.3); }
  .salvage-btn:hover { background: rgba(255, 152, 0, 0.12); border-color: rgba(255, 152, 0, 0.6); }

  .loot-btn { color: #4caf50; border-color: rgba(76, 175, 80, 0.3); }
  .loot-btn:hover { background: rgba(76, 175, 80, 0.12); border-color: rgba(76, 175, 80, 0.6); }

  /* ---- Large action buttons ---- */
  .action-btn-lg {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 5px 12px;
    border: 1px solid;
    border-radius: 4px;
    font-size: 0.7rem;
    font-family: 'Roboto Mono', monospace;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    background: transparent;
    justify-content: center;
    width: 100%;
  }

  .action-btn-lg .material-icons { font-size: 15px; }

  .loot-all-btn { color: #4caf50; border-color: rgba(76, 175, 80, 0.4); }
  .loot-all-btn:hover { background: rgba(76, 175, 80, 0.12); }

  .salvage-lg-btn { color: #ff9800; border-color: rgba(255, 152, 0, 0.4); }
  .salvage-lg-btn:hover { background: rgba(255, 152, 0, 0.12); }

  .scrap-btn { color: #78909c; border-color: rgba(120, 144, 156, 0.4); }
  .scrap-btn:hover { background: rgba(120, 144, 156, 0.12); }

  .self-destruct-btn { color: #f44336; border-color: rgba(244, 67, 54, 0.4); }
  .self-destruct-btn:hover { background: rgba(244, 67, 54, 0.12); }

  /* ---- Scrap section ---- */
  .scrap-section {
    margin-top: 4px;
  }

  .hint-text {
    font-size: 0.65rem;
    color: #455a64;
    margin-top: 4px;
  }

  /* ---- Detail panel ---- */
  .no-selection {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 20px 0;
  }

  .no-selection p { font-size: 0.72rem; color: #37474f; }

  .detail-section { margin-bottom: 4px; }

  .detail-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
  }

  .detail-title {
    font-size: 0.95rem;
    color: #e0e0e0;
    font-weight: 600;
  }

  .owner-tag {
    font-size: 0.6rem;
    background: rgba(79, 195, 247, 0.1);
    color: #4fc3f7;
    padding: 1px 5px;
    border-radius: 2px;
    font-family: 'Roboto Mono', monospace;
  }

  .detail-grid {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 3px 12px;
    font-size: 0.75rem;
    margin-bottom: 10px;
  }

  .detail-label { color: #546e7a; font-size: 0.7rem; }
  .detail-value { color: #b0bec5; }
  .id-val { font-size: 0.65rem; color: #455a64; }

  .loot-all-row { margin-bottom: 8px; }

  /* ---- Loot list ---- */
  .loot-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 250px;
    overflow-y: auto;
  }

  .loot-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 6px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.04);
    border-radius: 3px;
    gap: 6px;
  }

  .loot-info {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    min-width: 0;
  }

  .loot-name {
    font-size: 0.75rem;
    color: #b0bec5;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .loot-qty { font-size: 0.68rem; color: #78909c; }

  .loot-controls {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .qty-input {
    width: 48px;
    padding: 2px 4px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 2px;
    color: #b0bec5;
    font-size: 0.68rem;
    text-align: center;
  }

  .qty-input:focus {
    outline: none;
    border-color: rgba(79, 195, 247, 0.4);
  }

  .section-divider {
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    margin: 10px 0;
  }

  .wreck-action-row { margin-bottom: 4px; }

  /* ---- Self Destruct ---- */
  .self-destruct-section {
    margin-top: 4px;
  }

  .danger-title {
    display: flex;
    align-items: center;
    gap: 4px;
    color: #f44336 !important;
  }

  .confirm-panel {
    background: rgba(244, 67, 54, 0.04);
    border: 1px solid rgba(244, 67, 54, 0.2);
    border-radius: 6px;
    padding: 12px;
  }

  .confirm-warning {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }

  .confirm-title {
    font-size: 0.82rem;
    color: #f44336;
    font-weight: 600;
    margin-bottom: 4px;
  }

  .confirm-desc {
    font-size: 0.7rem;
    color: #78909c;
    line-height: 1.4;
  }

  /* ---- Hold button ---- */
  .hold-btn-wrapper {
    margin-bottom: 8px;
  }

  .hold-btn {
    position: relative;
    width: 100%;
    height: 40px;
    background: rgba(244, 67, 54, 0.08);
    border: 2px solid rgba(244, 67, 54, 0.4);
    border-radius: 4px;
    cursor: pointer;
    overflow: hidden;
    user-select: none;
    -webkit-user-select: none;
    transition: border-color 0.15s;
  }

  .hold-btn:hover { border-color: rgba(244, 67, 54, 0.7); }

  .hold-progress {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    background: rgba(244, 67, 54, 0.3);
    transition: width 0.05s linear;
    pointer-events: none;
  }

  .hold-label {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 100%;
    color: #f44336;
    font-size: 0.72rem;
    font-family: 'Roboto Mono', monospace;
    font-weight: 700;
    letter-spacing: 0.5px;
  }

  .hold-hint {
    font-size: 0.6rem;
    color: #546e7a;
    text-align: center;
    margin-top: 4px;
  }

  .cancel-btn {
    width: 100%;
    padding: 5px;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    color: #78909c;
    font-size: 0.7rem;
    font-family: 'Roboto Mono', monospace;
    cursor: pointer;
    transition: all 0.15s;
  }

  .cancel-btn:hover {
    background: rgba(255, 255, 255, 0.04);
    color: #b0bec5;
  }

  .mono { font-family: 'Roboto Mono', monospace; }
</style>
