<script lang="ts">
  import Card, { Content } from '@smui/card';
  import { shipStore } from '$lib/stores/ship.svelte';
  import { marketMemoStore } from '$lib/stores/marketMemo.svelte';
  import { actionQueueStore } from '$lib/stores/actionQueue.svelte';
  import { uiStore } from '$lib/stores/ui.svelte';
  import { ws } from '$lib/services/websocket';
  import type { Module, CargoItem } from '$lib/types/game';

  function uninstallModule(mod: Module) {
    actionQueueStore.enqueue(`Uninstall ${mod.name}`, () => ws.uninstallMod(mod.id));
  }

  function installModule(item: CargoItem) {
    actionQueueStore.enqueue(`Install ${item.name ?? item.item_id}`, () => ws.installMod(item.item_id));
  }

  function goToCrafting(typeId: string) {
    uiStore.navigateToCrafting(typeId, 'output');
  }

  // CPU / Power summary
  let cpuFree = $derived(shipStore.cpuCapacity - shipStore.cpuUsed);
  let pwrFree = $derived(shipStore.powerCapacity - shipStore.powerUsed);
</script>

<div class="mod-page">
  <!-- Capacity overview -->
  <Card class="space-card">
    <Content>
      <p class="tab-section-title">Fitting Overview</p>
      <div class="cap-grid">
        <div class="cap-item">
          <span class="cap-label">CPU</span>
          <div class="cap-bar">
            <div
              class="cap-fill cpu"
              style="width:{shipStore.cpuCapacity > 0 ? (shipStore.cpuUsed / shipStore.cpuCapacity) * 100 : 0}%"
            ></div>
          </div>
          <span class="cap-val mono">{shipStore.cpuUsed}/{shipStore.cpuCapacity}</span>
          <span class="cap-free mono" class:over={cpuFree < 0}>({cpuFree} free)</span>
        </div>
        <div class="cap-item">
          <span class="cap-label">Power</span>
          <div class="cap-bar">
            <div
              class="cap-fill pwr"
              style="width:{shipStore.powerCapacity > 0 ? (shipStore.powerUsed / shipStore.powerCapacity) * 100 : 0}%"
            ></div>
          </div>
          <span class="cap-val mono">{shipStore.powerUsed}/{shipStore.powerCapacity}</span>
          <span class="cap-free mono" class:over={pwrFree < 0}>({pwrFree} free)</span>
        </div>
      </div>

      {#if shipStore.current}
        <div class="slot-summary">
          {#if shipStore.current.weapon_slots}
            <span class="slot-chip weapon">
              <span class="material-icons si">gps_fixed</span>Weapon {shipStore.current.weapon_slots}
            </span>
          {/if}
          {#if shipStore.current.defense_slots}
            <span class="slot-chip defense">
              <span class="material-icons si">shield</span>Defense {shipStore.current.defense_slots}
            </span>
          {/if}
          {#if shipStore.current.utility_slots}
            <span class="slot-chip utility">
              <span class="material-icons si">build</span>Utility {shipStore.current.utility_slots}
            </span>
          {/if}
        </div>
      {/if}
    </Content>
  </Card>

  <!-- Installed modules -->
  <Card class="space-card">
    <Content>
      <p class="tab-section-title">
        Installed Modules
        <span class="badge mono">{shipStore.moduleData.length}</span>
      </p>

      {#if shipStore.moduleData.length > 0}
        <table class="mod-table">
          <thead>
            <tr>
              <th>Module</th>
              <th class="r">CPU</th>
              <th class="r">PWR</th>
              <th class="r">Wear</th>
              <th class="r">Market</th>
              <th></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {#each shipStore.moduleData as mod}
              {@const typeId = mod.type_id ?? mod.type}
              {@const price = marketMemoStore.getItemPrice(typeId)}
              {@const cpu = mod.cpu_usage ?? mod.cpu_cost ?? 0}
              {@const pwr = mod.power_usage ?? mod.power_cost ?? 0}
              <tr class:inactive={mod.active === false}>
                <td>
                  <span class="mn">{mod.name}</span>
                  <span class="mt mono">{typeId}</span>
                  {#if mod.quality_grade}
                    <span class="mq mono">{mod.quality_grade}</span>
                  {/if}
                </td>
                <td class="r mono cpu-val">{cpu}</td>
                <td class="r mono pwr-val">{pwr}</td>
                <td class="r mono" class:wear-warn={(mod.wear ?? 0) > 70}>
                  {mod.wear_status ?? `${mod.wear ?? 0}%`}
                </td>
                <td class="r mono market-val">
                  {#if price && price.best_sell > 0}
                    ₡{price.best_sell.toLocaleString()}
                  {:else}
                    —
                  {/if}
                </td>
                <td class="act">
                  <button class="icon-btn craft-btn" title="Search in Crafting" onclick={() => goToCrafting(typeId)}>
                    <span class="material-icons">precision_manufacturing</span>
                  </button>
                </td>
                <td class="act">
                  <button class="icon-btn eject-btn" title="Uninstall" onclick={() => uninstallModule(mod)}>
                    <span class="material-icons">eject</span>
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {:else}
        <p class="empty-hint">No modules installed</p>
      {/if}
    </Content>
  </Card>

  <!-- Installable cargo -->
  {#if shipStore.cargo.length > 0}
    <Card class="space-card">
      <Content>
        <p class="tab-section-title">
          Install from Cargo
        </p>
        <p class="sub-hint">Non-module items will be rejected by the server.</p>

        <table class="mod-table">
          <thead>
            <tr>
              <th>Item</th>
              <th class="r">Qty</th>
              <th class="r">Market</th>
              <th></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {#each shipStore.cargo as item}
              {@const price = marketMemoStore.getItemPrice(item.item_id)}
              <tr>
                <td>
                  <span class="mn">{item.name ?? item.item_id}</span>
                  <span class="mt mono">{item.item_id}</span>
                </td>
                <td class="r mono">{item.quantity}</td>
                <td class="r mono market-val">
                  {#if price && price.best_sell > 0}
                    ₡{price.best_sell.toLocaleString()}
                  {:else}
                    —
                  {/if}
                </td>
                <td class="act">
                  <button class="icon-btn craft-btn" title="Search in Crafting" onclick={() => goToCrafting(item.item_id)}>
                    <span class="material-icons">precision_manufacturing</span>
                  </button>
                </td>
                <td class="act">
                  <button class="icon-btn install-btn" title="Install" onclick={() => installModule(item)}>
                    <span class="material-icons">download</span>
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </Content>
    </Card>
  {/if}
</div>

<style>
  .mod-page {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* Capacity overview */
  .cap-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 8px;
  }

  .cap-item {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .cap-label {
    font-size: 0.7rem;
    color: #4a6070;
    width: 44px;
    flex-shrink: 0;
  }

  .cap-bar {
    flex: 1;
    height: 6px;
    background: rgba(255,255,255,0.06);
    border-radius: 3px;
    overflow: hidden;
  }

  .cap-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.3s;
  }

  .cap-fill.cpu { background: #ce93d8; }
  .cap-fill.pwr { background: #ffd54f; }

  .cap-val { font-size: 0.68rem; color: #90a4ae; width: 56px; text-align: right; flex-shrink: 0; }
  .cap-free { font-size: 0.62rem; color: #546e7a; flex-shrink: 0; }
  .cap-free.over { color: #ef5350; }

  .slot-summary {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-top: 4px;
  }

  .slot-chip {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 0.62rem;
    font-family: 'Roboto Mono', monospace;
    padding: 2px 8px;
    border-radius: 3px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    color: #78909c;
  }

  .slot-chip .si { font-size: 13px; }
  .slot-chip.weapon { border-color: rgba(244,67,54,0.25); color: #ef5350; }
  .slot-chip.defense { border-color: rgba(33,150,243,0.25); color: #42a5f5; }
  .slot-chip.utility { border-color: rgba(255,152,0,0.25); color: #ffa726; }

  /* Module table */
  .mod-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.73rem;
  }

  .mod-table th {
    text-align: left;
    font-size: 0.6rem;
    color: #37474f;
    padding: 4px 6px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .mod-table th.r { text-align: right; }

  .mod-table td {
    padding: 6px 6px;
    color: #90a4ae;
    border-bottom: 1px solid rgba(255,255,255,0.03);
    vertical-align: middle;
  }

  .mod-table td.r { text-align: right; }
  .mod-table td.act { text-align: center; width: 32px; padding: 4px 2px; }

  .mod-table tr.inactive td { opacity: 0.5; }

  .mn { display: block; font-size: 0.75rem; color: #b0bec5; }
  .mt { display: block; font-size: 0.6rem; color: #4a6070; }
  .mq { font-size: 0.58rem; color: #ce93d8; background: rgba(206,147,216,0.1); border-radius: 2px; padding: 0 4px; }

  .cpu-val { color: #ce93d8; }
  .pwr-val { color: #ffd54f; }
  .market-val { color: #ffd700; }
  .wear-warn { color: #ff7043; }

  .badge {
    font-size: 0.58rem;
    color: #546e7a;
    background: rgba(255,255,255,0.05);
    border-radius: 8px;
    padding: 1px 6px;
    margin-left: 4px;
  }

  .sub-hint {
    font-size: 0.62rem;
    color: #37474f;
    margin: 0 0 6px 0;
  }

  /* Icon buttons */
  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 4px;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.03);
    cursor: pointer;
    transition: all 0.15s;
  }

  .icon-btn .material-icons { font-size: 15px; }

  .eject-btn { color: #ff7043; border-color: rgba(255,112,67,0.2); }
  .eject-btn:hover { background: rgba(255,112,67,0.12); border-color: rgba(255,112,67,0.4); }

  .install-btn { color: #66bb6a; border-color: rgba(102,187,106,0.2); }
  .install-btn:hover { background: rgba(102,187,106,0.12); border-color: rgba(102,187,106,0.4); }

  .craft-btn { color: #4fc3f7; border-color: rgba(79,195,247,0.2); }
  .craft-btn:hover { background: rgba(79,195,247,0.12); border-color: rgba(79,195,247,0.4); }

  .empty-hint {
    font-size: 0.75rem;
    color: #263238;
    text-align: center;
    padding: 12px 0;
  }

  .mono { font-family: 'Roboto Mono', monospace; }
</style>
