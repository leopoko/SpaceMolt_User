<script lang="ts">
  import Button, { Label } from '@smui/button';
  import Card, { Content } from '@smui/card';
  import LinearProgress from '@smui/linear-progress';
  import { systemStore } from '$lib/stores/system.svelte';
  import { shipStore } from '$lib/stores/ship.svelte';
  import { actionQueueStore } from '$lib/stores/actionQueue.svelte';
  import { marketMemoStore } from '$lib/stores/marketMemo.svelte';
  import { eventsStore } from '$lib/stores/events.svelte';
  import { ws } from '$lib/services/websocket';

  let selectedAsteroid = $state<string | null>(null);
  let repeatCount = $state(5);
  let targetPercent = $state(80);

  function getAsteroidTarget(): string | undefined {
    return selectedAsteroid ?? systemStore.asteroids[0]?.id ?? undefined;
  }

  function doMine() {
    actionQueueStore.enqueue('Mine', () => ws.mine(getAsteroidTarget()));
  }

  function doMineRepeat() {
    const n = Math.max(1, Math.min(repeatCount, 999));
    for (let i = 0; i < n; i++) {
      actionQueueStore.enqueue(`Mine [${i + 1}/${n}]`, () => ws.mine(getAsteroidTarget()));
    }
  }

  function enqueueConditionalMine(targetPct: number, label: string, asNext = false) {
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
      actionQueueStore.enqueueNext(label, cb);
    } else {
      actionQueueStore.enqueue(label, cb);
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
    // Fallback: humanize item_id (e.g. "ore_iron" → "Ore Iron")
    return item.item_id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
</script>

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
              </tr>
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

<style>
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
</style>
