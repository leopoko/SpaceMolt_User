<script lang="ts">
  import Button, { Label } from '@smui/button';
  import Card, { Content } from '@smui/card';
  import LinearProgress from '@smui/linear-progress';
  import { systemStore } from '$lib/stores/system.svelte';
  import { shipStore } from '$lib/stores/ship.svelte';
  import { playerStore } from '$lib/stores/player.svelte';
  import { actionQueueStore } from '$lib/stores/actionQueue.svelte';
  import { marketMemoStore } from '$lib/stores/marketMemo.svelte';
  import { systemMemoStore } from '$lib/stores/systemMemo.svelte';
  import { eventsStore } from '$lib/stores/events.svelte';
  import { ws } from '$lib/services/websocket';

  let selectedAsteroid = $state<string | null>(null);
  let repeatCount = $state(5);
  let targetPercent = $state(80);

  // Jettison state
  let jettisonItemId = $state<string | null>(null);
  let jettisonQty = $state(1);

  function getAsteroidTarget(): string | undefined {
    return selectedAsteroid ?? systemStore.asteroids[0]?.id ?? undefined;
  }

  function doMine() {
    const asteroidId = getAsteroidTarget();
    actionQueueStore.enqueue('Mine', () => ws.mine(asteroidId), {
      command: { type: 'mine', params: { asteroidId } }
    });
  }

  function doMineRepeat() {
    const n = Math.max(1, Math.min(repeatCount, 999));
    const asteroidId = getAsteroidTarget();
    for (let i = 0; i < n; i++) {
      actionQueueStore.enqueue(`Mine [${i + 1}/${n}]`, () => ws.mine(asteroidId), {
        command: { type: 'mine_n', params: { asteroidId, count: n, current: i + 1 } }
      });
    }
  }

  function enqueueConditionalMine(targetPct: number, label: string, asNext = false) {
    const asteroidId = getAsteroidTarget();
    const cmdType = targetPct >= 100 ? 'mine_full' : 'mine_pct';
    const cmd = { type: cmdType, params: { asteroidId, targetPct } };
    const cb = () => {
      if (shipStore.cargoPercent >= targetPct) {
        eventsStore.add({ type: 'info', message: `[Mining] Cargo ${shipStore.cargoPercent.toFixed(0)}% – 停止` });
        return;
      }
      ws.mine(getAsteroidTarget());
      // Re-enqueue as next action so it stays ahead of Travel/Dock etc.
      enqueueConditionalMine(targetPct, label, true);
    };
    if (asNext) {
      actionQueueStore.enqueueNext(label, cb, { command: cmd });
    } else {
      actionQueueStore.enqueue(label, cb, { command: cmd });
    }
  }

  function doMineUntilPercent() {
    const pct = Math.max(1, Math.min(targetPercent, 100));
    enqueueConditionalMine(pct, `Mine → ${pct}%`);
  }

  function doMineUntilFull() {
    enqueueConditionalMine(100, 'Mine → Full');
  }

  function getItemDisplayName(item: { item_id: string; name?: string }): string {
    if (item.name) return item.name;
    const memo = marketMemoStore.getItemPrice(item.item_id);
    if (memo) return memo.item_name;
    return item.item_id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  function toggleJettison(item: { item_id: string; quantity: number }) {
    if (jettisonItemId === item.item_id) {
      jettisonItemId = null;
    } else {
      jettisonItemId = item.item_id;
      jettisonQty = item.quantity;
    }
  }

  function doJettison(item: { item_id: string; name?: string; quantity: number }) {
    const qty = Math.max(1, Math.min(jettisonQty, item.quantity));
    const name = getItemDisplayName(item);
    actionQueueStore.enqueue(`Jettison ${qty}x ${name}`, () => ws.jettison(item.item_id, qty), {
      command: { type: 'jettison', params: { item_id: item.item_id, quantity: qty } }
    });
    jettisonItemId = null;
  }

  // ---- Mining Statistics from System Memo ----
  let currentSystemId = $derived(playerStore.system_id);
  let currentPoiId = $derived(playerStore.poi_id);

  // All mining stats for the current system, sorted by total
  let allMiningStats = $derived.by(() => {
    if (!currentSystemId) return [];
    const stats = systemMemoStore.getSystemMiningStats(currentSystemId);
    const entries = Object.entries(stats);
    if (entries.length === 0) return [];
    return entries.map(([poiId, s]) => {
      const poiName = systemStore.pois.find(p => p.id === poiId)?.name
        ?? systemMemoStore.getMemo(currentSystemId!)?.pois.find(p => p.id === poiId)?.name
        ?? poiId;
      const items = Object.entries(s.items)
        .map(([name, count]) => ({
          name,
          count,
          pct: s.totalMined > 0 ? (count / s.totalMined * 100) : 0
        }))
        .sort((a, b) => b.count - a.count);
      return { poiId, poiName, items, total: s.totalMined, isCurrent: poiId === currentPoiId };
    }).sort((a, b) => {
      // Current POI first, then by total
      if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
      return b.total - a.total;
    });
  });

  function clearMiningStats(poiId?: string) {
    if (currentSystemId) {
      systemMemoStore.clearMiningStats(currentSystemId, poiId);
    }
  }
</script>

<div class="mine-layout">
  <div class="two-col">
    <!-- Mining controls -->
    <Card class="space-card">
      <Content>
        <p class="tab-section-title">Asteroid Fields</p>

        {#if systemStore.asteroids.length > 0}
          <div class="asteroid-list">
            {#each systemStore.asteroids as ast}
              <div
                class="asteroid-item"
                class:selected={selectedAsteroid === ast.id}
                onclick={() => { selectedAsteroid = selectedAsteroid === ast.id ? null : ast.id; }}
                role="button"
                tabindex="0"
                onkeydown={(e) => e.key === 'Enter' && (selectedAsteroid = ast.id)}
              >
                <span class="material-icons ast-icon">lens</span>
                <div class="ast-info">
                  <span class="ast-name">{ast.name}</span>
                  <span class="ast-type mono">{ast.type}</span>
                </div>
              </div>
            {/each}
          </div>
        {/if}

        <div class="mining-actions">
          <Button variant="raised" onclick={doMine} style="width:100%">
            <Label>⛏ Mine</Label>
          </Button>

          <div class="repeat-row">
            <input type="number" class="repeat-input" min="1" max="999" bind:value={repeatCount} />
            <Button variant="outlined" onclick={doMineRepeat} style="flex:1">
              <Label>×{repeatCount} Mining</Label>
            </Button>
          </div>

          <div class="repeat-row">
            <input type="number" class="repeat-input" min="1" max="100" bind:value={targetPercent} />
            <span class="pct-label">%</span>
            <Button variant="outlined" onclick={doMineUntilPercent} style="flex:1">
              <Label>Mine → {targetPercent}%</Label>
            </Button>
          </div>

          <Button variant="outlined" onclick={doMineUntilFull} style="width:100%">
            <Label>⛏ Mine → Full</Label>
          </Button>
        </div>

      </Content>
    </Card>

    <!-- Cargo / Inventory -->
    <Card class="space-card">
      <Content>
        <div class="section-head">
          <span class="tab-section-title">Cargo Bay</span>
          {#if shipStore.current}
            <span class="mono cargo-pct">
              {shipStore.cargoUsed.toFixed(1)} / {shipStore.cargoCapacity} m³
              ({shipStore.cargoPercent.toFixed(0)}%)
            </span>
          {/if}
        </div>

        {#if shipStore.current}
          <LinearProgress
            progress={shipStore.cargoPercent / 100}
            class="progress-cargo"
          />
        {/if}

        {#if shipStore.cargo.length > 0}
          <table class="cargo-table">
            <thead>
              <tr>
                <th>Item</th>
                <th class="num">Qty</th>
                <th class="num">Vol (m³)</th>
                <th class="num">Value</th>
                <th class="num">Buy</th>
                <th class="num">Sell</th>
                <th class="num act-col"></th>
              </tr>
            </thead>
            <tbody>
              {#each shipStore.cargo as item}
                {@const priceInfo = marketMemoStore.getItemPrice(item.item_id)}
                <tr>
                  <td class="item-name">
                    {getItemDisplayName(item)}
                    {#if priceInfo}
                      <span class="memo-station" title="Price from {priceInfo.station}">
                        @ {priceInfo.station}
                      </span>
                    {/if}
                  </td>
                  <td class="num mono">{item.quantity}</td>
                  <td class="num mono">{(item.quantity * (item.volume ?? 1)).toFixed(1)}</td>
                  <td class="num mono credits">
                    {#if item.value}
                      ₡{(item.quantity * item.value).toLocaleString()}
                    {:else if priceInfo && priceInfo.best_sell > 0}
                      ₡{(item.quantity * priceInfo.best_sell).toLocaleString()}
                    {:else}
                      —
                    {/if}
                  </td>
                  <td class="num mono buy-price">
                    {#if priceInfo && priceInfo.best_buy > 0}
                      ₡{priceInfo.best_buy}
                    {:else}
                      —
                    {/if}
                  </td>
                  <td class="num mono sell-price">
                    {#if priceInfo && priceInfo.best_sell > 0}
                      ₡{priceInfo.best_sell}
                    {:else}
                      —
                    {/if}
                  </td>
                  <td class="num act-col">
                    <button class="jettison-btn" title="Jettison" onclick={() => toggleJettison(item)}>
                      <span class="material-icons" style="font-size:14px">delete_outline</span>
                    </button>
                  </td>
                </tr>
                {#if jettisonItemId === item.item_id}
                  <tr class="jettison-row">
                    <td colspan="7">
                      <div class="jettison-controls">
                        <span class="jettison-label">Jettison {getItemDisplayName(item)}:</span>
                        <input
                          type="number"
                          class="jettison-input"
                          min="1"
                          max={item.quantity}
                          bind:value={jettisonQty}
                        />
                        <span class="jettison-max">/ {item.quantity}</span>
                        <button class="jettison-confirm" onclick={() => doJettison(item)}>
                          Jettison
                        </button>
                        <button class="jettison-cancel" onclick={() => { jettisonItemId = null; }}>
                          <span class="material-icons" style="font-size:14px">close</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                {/if}
              {/each}
            </tbody>
          </table>
          {#if shipStore.cargo.some(i => marketMemoStore.getItemPrice(i.item_id))}
            <p class="memo-hint">Prices from market memo</p>
          {/if}
        {:else}
          <p class="empty-hint">Cargo bay is empty</p>
        {/if}
      </Content>
    </Card>
  </div>

  <!-- Mining Statistics (full-width below the two columns) -->
  {#if allMiningStats.length > 0}
    <Card class="space-card">
      <Content>
        <div class="section-head">
          <span class="tab-section-title">
            <span class="material-icons" style="font-size:16px;vertical-align:middle;margin-right:4px">bar_chart</span>
            Mining Statistics
          </span>
          <button class="stats-clear-all" onclick={() => clearMiningStats()} title="Clear all mining stats for this system">
            <span class="material-icons" style="font-size:12px">delete</span> Clear All
          </button>
        </div>

        <div class="stats-grid">
          {#each allMiningStats as poi}
            <div class="stats-poi-card" class:stats-poi-current={poi.isCurrent}>
              <div class="stats-poi-head">
                <span class="stats-poi-name">
                  {poi.poiName}
                  {#if poi.isCurrent}
                    <span class="here-badge">HERE</span>
                  {/if}
                </span>
                <div class="stats-poi-right">
                  <span class="stats-poi-total mono">{poi.total} mined</span>
                  <button class="stats-clear-poi" onclick={() => clearMiningStats(poi.poiId)} title="Clear stats for {poi.poiName}">
                    <span class="material-icons" style="font-size:11px">close</span>
                  </button>
                </div>
              </div>
              <div class="stats-items">
                {#each poi.items as item}
                  <div class="stats-item-row">
                    <div class="stats-item-bar-bg">
                      <div class="stats-item-bar" style="width:{item.pct}%"></div>
                    </div>
                    <span class="stats-item-name">{item.name}</span>
                    <span class="stats-item-count mono">{item.count}</span>
                    <span class="stats-item-pct mono">{item.pct.toFixed(1)}%</span>
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </Content>
    </Card>
  {/if}
</div>

<style>
  .mine-layout {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .empty-hint {
    font-size: 0.75rem;
    color: #546e7a;
    text-align: center;
    padding: 12px 0;
  }

  .asteroid-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .asteroid-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.05);
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .asteroid-item:hover { background: rgba(255,255,255,0.06); }
  .asteroid-item.selected { border-color: rgba(255,152,0,0.5); background: rgba(255,152,0,0.08); }

  .ast-icon { font-size: 16px; color: #78909c; }
  .ast-info { display: flex; flex-direction: column; }
  .ast-name { font-size: 0.8rem; color: #b0bec5; }
  .ast-type { font-size: 0.68rem; color: #546e7a; }

  .mining-actions {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 16px;
  }

  .repeat-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 6px;
  }

  .repeat-input {
    width: 60px;
    padding: 4px 6px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(79,195,247,0.2);
    border-radius: 4px;
    color: #b0bec5;
    font-family: 'Roboto Mono', monospace;
    font-size: 0.75rem;
    text-align: center;
  }

  .repeat-input:focus {
    outline: none;
    border-color: rgba(79,195,247,0.5);
  }

  .pct-label {
    font-size: 0.72rem;
    color: #546e7a;
  }

  .cargo-pct { font-size: 0.72rem; color: #ff9800; }

  .cargo-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.75rem;
    margin-top: 10px;
  }

  .cargo-table th {
    text-align: left;
    font-size: 0.65rem;
    letter-spacing: 0.08em;
    color: #546e7a;
    padding: 4px 4px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    text-transform: uppercase;
  }

  .cargo-table th.num {
    text-align: right;
  }

  .cargo-table td {
    padding: 4px 4px;
    color: #90a4ae;
    border-bottom: 1px solid rgba(255,255,255,0.03);
  }

  .item-name {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .memo-station {
    font-size: 0.58rem;
    color: #37474f;
  }

  .memo-hint {
    font-size: 0.6rem;
    color: #37474f;
    text-align: right;
    margin-top: 4px;
  }

  .num { text-align: right; }
  .mono { font-family: 'Roboto Mono', monospace; }
  .credits { color: #ffd700; }
  .buy-price { color: #66bb6a; }
  .sell-price { color: #ff9800; }

  .act-col { width: 28px; padding: 2px !important; }

  .jettison-btn {
    background: none;
    border: none;
    color: #546e7a;
    cursor: pointer;
    padding: 2px;
    display: flex;
    align-items: center;
    border-radius: 3px;
    transition: all 0.15s;
  }
  .jettison-btn:hover { color: #f44336; background: rgba(244,67,54,0.1); }

  .jettison-row td {
    padding: 4px 4px !important;
    border-bottom: 1px solid rgba(244,67,54,0.15) !important;
  }

  .jettison-controls {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.72rem;
  }

  .jettison-label {
    color: #f44336;
    white-space: nowrap;
  }

  .jettison-input {
    width: 56px;
    padding: 2px 4px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(244,67,54,0.3);
    border-radius: 3px;
    color: #b0bec5;
    font-family: 'Roboto Mono', monospace;
    font-size: 0.72rem;
    text-align: center;
  }
  .jettison-input:focus { outline: none; border-color: rgba(244,67,54,0.6); }

  .jettison-max {
    font-size: 0.65rem;
    color: #546e7a;
    font-family: 'Roboto Mono', monospace;
  }

  .jettison-confirm {
    background: rgba(244,67,54,0.15);
    border: 1px solid rgba(244,67,54,0.4);
    color: #f44336;
    font-size: 0.68rem;
    font-family: inherit;
    padding: 2px 8px;
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .jettison-confirm:hover { background: rgba(244,67,54,0.25); }

  .jettison-cancel {
    background: none;
    border: none;
    color: #546e7a;
    cursor: pointer;
    padding: 2px;
    display: flex;
    align-items: center;
  }
  .jettison-cancel:hover { color: #90a4ae; }

  /* ---- Mining Statistics Section ---- */

  .stats-clear-all {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    background: none;
    border: 1px solid rgba(244,67,54,0.2);
    color: #ef5350;
    font-size: 0.6rem;
    font-family: inherit;
    padding: 2px 6px;
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .stats-clear-all:hover { background: rgba(244,67,54,0.1); }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 10px;
  }

  .stats-poi-card {
    padding: 8px 10px;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 5px;
  }

  .stats-poi-card.stats-poi-current {
    border-color: rgba(79,195,247,0.3);
    background: rgba(79,195,247,0.04);
  }

  .stats-poi-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
    gap: 4px;
  }

  .stats-poi-name {
    font-size: 0.78rem;
    color: #90caf9;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .here-badge {
    font-size: 0.52rem;
    font-family: 'Roboto Mono', monospace;
    font-weight: 700;
    color: #4fc3f7;
    background: rgba(79,195,247,0.15);
    border: 1px solid rgba(79,195,247,0.35);
    border-radius: 3px;
    padding: 0 3px;
    letter-spacing: 0.05em;
  }

  .stats-poi-right {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .stats-poi-total {
    font-size: 0.65rem;
    color: #546e7a;
  }

  .stats-clear-poi {
    background: none;
    border: none;
    color: #546e7a;
    cursor: pointer;
    padding: 1px;
    display: flex;
    align-items: center;
  }
  .stats-clear-poi:hover { color: #f44336; }

  .stats-items {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .stats-item-row {
    display: grid;
    grid-template-columns: 1fr auto auto auto;
    align-items: center;
    gap: 6px;
    position: relative;
  }

  .stats-item-bar-bg {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    right: 0;
    background: rgba(255,255,255,0.02);
    border-radius: 2px;
    overflow: hidden;
    z-index: 0;
  }

  .stats-item-bar {
    height: 100%;
    background: rgba(255,152,0,0.12);
    border-radius: 2px;
    min-width: 0;
  }

  .stats-item-name {
    font-size: 0.7rem;
    color: #b0bec5;
    padding: 2px 4px;
    position: relative;
    z-index: 1;
  }

  .stats-item-count {
    font-size: 0.65rem;
    color: #ff9800;
    position: relative;
    z-index: 1;
  }

  .stats-item-pct {
    font-size: 0.62rem;
    color: #546e7a;
    width: 42px;
    text-align: right;
    position: relative;
    z-index: 1;
  }
</style>
