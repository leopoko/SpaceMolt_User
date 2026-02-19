<script lang="ts">
  import Card, { Content } from '@smui/card';
  import LinearProgress from '@smui/linear-progress';
  import { shipStore } from '$lib/stores/ship.svelte';
  import { playerStore } from '$lib/stores/player.svelte';
  import { marketMemoStore } from '$lib/stores/marketMemo.svelte';
  import { actionQueueStore } from '$lib/stores/actionQueue.svelte';
  import { ws } from '$lib/services/websocket';

  function doRepair() {
    actionQueueStore.enqueue('Repair', () => ws.repair(), {
      command: { type: 'repair' }
    });
  }

  function doRefuel() {
    actionQueueStore.enqueue('Refuel', () => ws.refuel(), {
      command: { type: 'refuel' }
    });
  }

  let showServiceButtons = $derived(
    playerStore.isDocked || actionQueueStore.recordingMode
  );

  function uninstallModule(modId: string, modName: string) {
    actionQueueStore.enqueue(`Uninstall ${modName}`, () => ws.uninstallMod(modId));
  }

  function installModule(itemId: string, itemName: string) {
    actionQueueStore.enqueue(`Install ${itemName}`, () => ws.installMod(itemId));
  }
</script>

<div class="two-col">
  <!-- Left: Ship Stats + Modules -->
  <Card class="space-card">
    <Content>
      <p class="tab-section-title">Active Ship</p>

      {#if shipStore.current}
        <h3 class="ship-name">{shipStore.current.name}</h3>
        <p class="ship-type mono">{shipStore.current.type} · {shipStore.current.class}</p>

        <div class="stat-row">
          <span class="stat-name">Hull</span>
          <LinearProgress progress={shipStore.hullPercent / 100} class="progress-hull" />
          <span class="mono stat-val">{shipStore.current.hull}/{shipStore.current.max_hull}</span>
        </div>
        <div class="stat-row">
          <span class="stat-name">Shield</span>
          <LinearProgress progress={shipStore.shieldPercent / 100} class="progress-shield" />
          <span class="mono stat-val">{shipStore.shield}/{shipStore.maxShield}</span>
        </div>
        <div class="stat-row">
          <span class="stat-name">Fuel</span>
          <LinearProgress progress={shipStore.fuelPercent / 100} class="progress-fuel" />
          <span class="mono stat-val">{shipStore.current.fuel}/{shipStore.current.max_fuel}</span>
        </div>
        <div class="stat-row">
          <span class="stat-name">Cargo</span>
          <LinearProgress progress={shipStore.cargoPercent / 100} style="--mdc-theme-primary:#ff9800" />
          <span class="mono stat-val">{shipStore.cargoUsed.toFixed(0)}/{shipStore.cargoCapacity}</span>
        </div>

        <div class="cpu-power">
          <span class="mono dim">CPU: {shipStore.cpuUsed}/{shipStore.cpuCapacity}</span>
          <span class="mono dim">PWR: {shipStore.powerUsed}/{shipStore.powerCapacity}</span>
        </div>

        {#if showServiceButtons}
          <div class="service-buttons">
            <button class="svc-btn repair-btn" onclick={doRepair} title="Repair ship">
              <span class="material-icons" style="font-size:15px">build</span> Repair
            </button>
            <button class="svc-btn refuel-btn" onclick={doRefuel} title="Refuel ship">
              <span class="material-icons" style="font-size:15px">local_gas_station</span> Refuel
            </button>
          </div>
        {/if}

        <!-- Installed Modules -->
        {#if shipStore.moduleData.length > 0}
          <p class="tab-section-title" style="margin-top:14px">
            Modules
            <span class="module-count mono">{shipStore.moduleData.length}</span>
          </p>
          <div class="module-list">
            {#each shipStore.moduleData as mod}
              <div class="module-item" class:active={mod.active ?? true}>
                <div class="mod-info">
                  <span class="mod-name">{mod.name}</span>
                  <div class="mod-details">
                    <span class="mod-type mono">{mod.type_id ?? mod.type}</span>
                    {#if mod.cpu_usage || mod.cpu_cost}
                      <span class="mod-res mono">CPU:{mod.cpu_usage ?? mod.cpu_cost}</span>
                    {/if}
                    {#if mod.power_usage || mod.power_cost}
                      <span class="mod-res mono">PWR:{mod.power_usage ?? mod.power_cost}</span>
                    {/if}
                    <span class="mod-wear mono" class:warn={(mod.wear ?? 0) > 70}>
                      {mod.wear_status ?? `${mod.wear ?? 0}% wear`}
                    </span>
                  </div>
                </div>
                <button
                  class="mod-action-btn uninstall"
                  title="Uninstall module (returns to cargo)"
                  onclick={() => uninstallModule(mod.id, mod.name)}
                >
                  <span class="material-icons">eject</span>
                </button>
              </div>
            {/each}
          </div>
        {:else}
          <p class="tab-section-title" style="margin-top:14px">Modules</p>
          <p class="empty-hint">No modules installed</p>
        {/if}

        <!-- Install from Cargo -->
        {#if shipStore.cargo.length > 0}
          <p class="tab-section-title" style="margin-top:14px">
            Install from Cargo
          </p>
          <p class="install-hint">Select a module item from cargo to install.</p>
          <div class="cargo-module-list">
            {#each shipStore.cargo as item}
              <div class="cargo-mod-item">
                <div class="cargo-mod-info">
                  <span class="cargo-mod-name">{item.name ?? item.item_id}</span>
                  <span class="cargo-mod-qty mono">x{item.quantity}</span>
                </div>
                <button
                  class="mod-action-btn install"
                  title="Install module from cargo"
                  onclick={() => installModule(item.item_id, item.name ?? item.item_id)}
                >
                  <span class="material-icons">download</span>
                </button>
              </div>
            {/each}
          </div>
        {/if}
      {:else}
        <p class="empty-hint">No ship data</p>
      {/if}
    </Content>
  </Card>

  <!-- Right: Cargo -->
  <Card class="space-card">
    <Content>
      <p class="tab-section-title">Cargo</p>

      {#if shipStore.cargo.length > 0}
        <table class="cargo-table">
          <thead>
            <tr>
              <th>Item</th>
              <th class="num">Qty</th>
              <th class="num">Vol</th>
              <th class="num">Buy</th>
              <th class="num">Sell</th>
              <th class="num">Value</th>
            </tr>
          </thead>
          <tbody>
            {#each shipStore.cargo as item}
              {@const priceInfo = marketMemoStore.getItemPrice(item.item_id)}
              <tr>
                <td class="item-name">
                  {item.name ?? item.item_id}
                  {#if priceInfo}
                    <span class="memo-station" title="Price from {priceInfo.station}">
                      @ {priceInfo.station}
                    </span>
                  {/if}
                </td>
                <td class="num mono">{item.quantity}</td>
                <td class="num mono">{(item.quantity * (item.volume ?? 1)).toFixed(1)}</td>
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
                <td class="num mono credits">
                  {#if item.value}
                    ₡{(item.quantity * item.value).toLocaleString()}
                  {:else if priceInfo && priceInfo.best_sell > 0}
                    ₡{(item.quantity * priceInfo.best_sell).toLocaleString()}
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
  .ship-name {
    font-size: 1.1rem;
    font-weight: 300;
    color: #90caf9;
    margin: 0 0 2px 0;
  }

  .ship-type { font-size: 0.72rem; color: #546e7a; margin-bottom: 12px; }

  .stat-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }

  .stat-name { font-size: 0.7rem; color: #4a6070; width: 44px; flex-shrink: 0; }
  .stat-val { font-size: 0.68rem; color: #607d8b; width: 64px; text-align: right; flex-shrink: 0; }

  .cpu-power {
    display: flex;
    gap: 12px;
    margin-top: 8px;
    font-size: 0.68rem;
  }

  .dim { color: #37474f; }

  .service-buttons {
    display: flex;
    gap: 8px;
    margin-top: 10px;
    margin-bottom: 4px;
  }

  .svc-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 5px 12px;
    font-size: 0.72rem;
    font-family: inherit;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s;
    border: 1px solid;
    background: none;
  }

  .repair-btn {
    color: #4caf50;
    border-color: rgba(76,175,80,0.3);
  }
  .repair-btn:hover { background: rgba(76,175,80,0.1); }

  .refuel-btn {
    color: #ff9800;
    border-color: rgba(255,152,0,0.3);
  }
  .refuel-btn:hover { background: rgba(255,152,0,0.1); }

  .module-count {
    font-size: 0.6rem;
    color: #546e7a;
    background: rgba(255,255,255,0.05);
    border-radius: 8px;
    padding: 1px 6px;
    margin-left: 4px;
  }


  .module-list { display: flex; flex-direction: column; gap: 4px; }

  .module-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 3px;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.04);
  }

  .module-item.active { border-color: rgba(76,175,80,0.2); }

  .mod-info { flex: 1; min-width: 0; }
  .mod-name { font-size: 0.75rem; color: #90a4ae; display: block; }
  .mod-details {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
    margin-top: 2px;
  }
  .mod-type { font-size: 0.65rem; color: #4a6070; }
  .mod-res { font-size: 0.6rem; color: #546e7a; }
  .mod-wear { font-size: 0.65rem; color: #607d8b; }
  .mod-wear.warn { color: #ff7043; }

  .mod-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 4px;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.03);
    cursor: pointer;
    transition: all 0.15s;
    flex-shrink: 0;
  }

  .mod-action-btn .material-icons { font-size: 16px; }

  .mod-action-btn.uninstall {
    color: #ff7043;
    border-color: rgba(255,112,67,0.2);
  }
  .mod-action-btn.uninstall:hover {
    background: rgba(255,112,67,0.12);
    border-color: rgba(255,112,67,0.4);
  }

  .mod-action-btn.install {
    color: #66bb6a;
    border-color: rgba(102,187,106,0.2);
  }
  .mod-action-btn.install:hover {
    background: rgba(102,187,106,0.12);
    border-color: rgba(102,187,106,0.4);
  }

  /* Install from Cargo section */
  .install-hint {
    font-size: 0.65rem;
    color: #37474f;
    margin: 0 0 6px 0;
  }

  .cargo-module-list {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .cargo-mod-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 8px;
    border-radius: 3px;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.04);
  }

  .cargo-mod-info { flex: 1; display: flex; align-items: center; gap: 6px; min-width: 0; }
  .cargo-mod-name {
    font-size: 0.73rem;
    color: #90a4ae;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .cargo-mod-qty { font-size: 0.62rem; color: #546e7a; flex-shrink: 0; }

  .item-name { max-width: 120px; overflow: hidden; text-overflow: ellipsis; }

  .cargo-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.73rem;
  }

  .cargo-table thead { display: table; width: 100%; }
  .cargo-table tbody { display: block; max-height: 300px; overflow-y: auto; }
  .cargo-table tr { display: table; width: 100%; table-layout: fixed; }

  .cargo-table th {
    text-align: left;
    font-size: 0.62rem;
    color: #37474f;
    padding: 4px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .cargo-table th.num { text-align: right; }

  .cargo-table td {
    padding: 4px;
    color: #90a4ae;
    border-bottom: 1px solid rgba(255,255,255,0.03);
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
  .credits { color: #ffd700; }
  .buy-price { color: #66bb6a; }
  .sell-price { color: #ff9800; }

  .empty-hint {
    font-size: 0.75rem;
    color: #263238;
    text-align: center;
    padding: 12px 0;
  }

  .mono { font-family: 'Roboto Mono', monospace; }
</style>
