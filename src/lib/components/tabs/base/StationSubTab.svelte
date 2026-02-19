<script lang="ts">
  import Button, { Label } from '@smui/button';
  import Card, { Content } from '@smui/card';
  import Textfield from '@smui/textfield';
  import LinearProgress from '@smui/linear-progress';
  import { baseStore } from '$lib/stores/base.svelte';
  import { playerStore } from '$lib/stores/player.svelte';
  import { shipStore } from '$lib/stores/ship.svelte';
  import { uiStore } from '$lib/stores/ui.svelte';
  import { eventsStore } from '$lib/stores/events.svelte';
  import { ws } from '$lib/services/websocket';
  import { actionQueueStore } from '$lib/stores/actionQueue.svelte';

  let depositItemId = $state('');
  let depositQty = $state(1);
  let withdrawItemId = $state('');
  let withdrawQty = $state(1);
  let creditAmount = $state(0);
  let creditMode = $state<'deposit' | 'withdraw'>('deposit');
  let showDepositSuggestions = $state(false);
  let showWithdrawSuggestions = $state(false);

  // Selected stored item (clickable rows)
  let selectedStoredItem = $state<string | null>(null);

  // Auto-refresh when Base tab is selected (view_storage is chained from get_base ok handler)
  $effect(() => {
    if (uiStore.activeTab.label === 'Base' && playerStore.isDocked) {
      ws.getBase();
    }
  });

  function loadStorage() {
    ws.getBase();
  }

  // Walk the action queue to compute effective dock state (for virtual queueing)
  let effectivelyDocked = $derived.by(() => {
    let docked = playerStore.isDocked;
    const cur = actionQueueStore.currentAction;
    if (cur === 'Undock') docked = false;
    else if (cur?.startsWith('Dock @')) docked = true;
    for (const item of actionQueueStore.items) {
      if (item.label === 'Undock') docked = false;
      else if (item.label.startsWith('Dock @')) docked = true;
    }
    return docked;
  });

  // Check if a Dock action exists in queue but no Undock follows it
  let hasPendingDock = $derived.by(() => {
    if (playerStore.isDocked) return false;
    let docked = false;
    const cur = actionQueueStore.currentAction;
    if (cur?.startsWith('Dock @')) docked = true;
    else if (cur === 'Undock') docked = false;
    for (const item of actionQueueStore.items) {
      if (item.label.startsWith('Dock @')) docked = true;
      else if (item.label === 'Undock') docked = false;
    }
    return docked;
  });

  // Whether the station has cloning service (required for set_home_base)
  let hasCloningService = $derived(
    baseStore.serviceList.some(s => s.toLowerCase().includes('cloning') || s.toLowerCase().includes('clone'))
  );

  // Whether this is already the home base
  let isHomeBase = $derived(
    playerStore.homeBase != null &&
    baseStore.currentBase != null &&
    (playerStore.homeBase === baseStore.currentBase.id ||
     playerStore.homeBase === baseStore.currentBase.poi_id)
  );

  /** Unique item suggestions from both storage and cargo */
  let allItemSuggestions = $derived.by(() => {
    const map = new Map<string, string>(); // item_id -> display name
    for (const item of baseStore.items) {
      map.set(item.item_id, item.name ?? item.item_id);
    }
    for (const item of shipStore.cargo) {
      if (!map.has(item.item_id)) {
        map.set(item.item_id, item.name ?? item.item_id);
      }
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  });

  let filteredDepositSuggestions = $derived(
    depositItemId.trim()
      ? allItemSuggestions.filter(s =>
          s.id.toLowerCase().includes(depositItemId.toLowerCase()) ||
          s.name.toLowerCase().includes(depositItemId.toLowerCase())
        )
      : allItemSuggestions
  );

  let filteredWithdrawSuggestions = $derived(
    withdrawItemId.trim()
      ? allItemSuggestions.filter(s =>
          s.id.toLowerCase().includes(withdrawItemId.toLowerCase()) ||
          s.name.toLowerCase().includes(withdrawItemId.toLowerCase())
        )
      : allItemSuggestions
  );

  function selectDepositItem(id: string) {
    depositItemId = id;
    showDepositSuggestions = false;
  }

  function selectWithdrawItem(id: string) {
    withdrawItemId = id;
    showWithdrawSuggestions = false;
  }

  function doDepositItem() {
    if (!depositItemId.trim() || depositQty <= 0) return;
    const itemId = depositItemId.trim();
    const qty = depositQty;
    actionQueueStore.enqueue(`Deposit ${qty}x ${itemId}`, () => ws.depositItems(itemId, qty), {
      command: { type: 'deposit_items', params: { itemId, quantity: qty } }
    });
    depositItemId = '';
    depositQty = 1;
  }

  function doWithdrawItem() {
    if (!withdrawItemId.trim() || withdrawQty <= 0) return;
    const itemId = withdrawItemId.trim();
    const qty = withdrawQty;
    actionQueueStore.enqueue(`Withdraw ${qty}x ${itemId}`, () => ws.withdrawItems(itemId, qty), {
      command: { type: 'withdraw_items', params: { itemId, quantity: qty } }
    });
    withdrawItemId = '';
    withdrawQty = 1;
  }

  /** Deposit a specific cargo item (all quantity) */
  function doDepositSelected(itemId: string) {
    const cargoItem = shipStore.cargo.find(c => c.item_id === itemId);
    if (!cargoItem || cargoItem.quantity <= 0) return;
    const qty = cargoItem.quantity;
    actionQueueStore.enqueue(`Deposit ${qty}x ${itemId}`, () => ws.depositItems(itemId, qty), {
      command: { type: 'deposit_items', params: { itemId, quantity: qty } }
    });
  }

  /** Withdraw a specific stored item (all quantity) */
  function doWithdrawSelected(itemId: string) {
    const stItem = baseStore.items.find(i => i.item_id === itemId);
    if (!stItem || stItem.quantity <= 0) return;
    const qty = stItem.quantity;
    actionQueueStore.enqueue(`Withdraw ${qty}x ${itemId}`, () => ws.withdrawItems(itemId, qty), {
      command: { type: 'withdraw_items', params: { itemId, quantity: qty } }
    });
  }

  /** Iterative Withdraw ALL stored items (one at a time, like mine full). */
  function doWithdrawAllStorage() {
    enqueueIterativeWithdraw('Withdraw All', false);
  }

  function enqueueIterativeWithdraw(label: string, asNext: boolean) {
    const cb = () => {
      const storageItems = baseStore.items.filter(i => i.quantity > 0);
      if (storageItems.length === 0) {
        eventsStore.add({ type: 'info', message: '[Base] Withdraw All 完了' });
        return;
      }
      const first = storageItems[0];
      ws.withdrawItems(first.item_id, first.quantity);
      enqueueIterativeWithdraw(label, true);
    };
    const opts = {
      continueOnError: true,
      command: { type: 'withdraw_all' as const },
    };
    if (asNext) {
      actionQueueStore.enqueueNext(label, cb, opts);
    } else {
      actionQueueStore.enqueue(label, cb, opts);
    }
  }

  /** Iterative Deposit ALL cargo items (one at a time, like mine full). */
  function doDepositAllCargo() {
    enqueueIterativeDeposit('Deposit All', false);
  }

  function enqueueIterativeDeposit(label: string, asNext: boolean) {
    const cb = () => {
      const cargoItems = shipStore.cargo.filter(c => c.quantity > 0);
      if (cargoItems.length === 0) {
        eventsStore.add({ type: 'info', message: '[Base] Deposit All 完了' });
        return;
      }
      const first = cargoItems[0];
      ws.depositItems(first.item_id, first.quantity);
      enqueueIterativeDeposit(label, true);
    };
    const opts = {
      continueOnError: true,
      command: { type: 'deposit_all' as const },
    };
    if (asNext) {
      actionQueueStore.enqueueNext(label, cb, opts);
    } else {
      actionQueueStore.enqueue(label, cb, opts);
    }
  }

  /** Click on a stored item row to select it for withdraw */
  function selectStoredRow(itemId: string) {
    if (selectedStoredItem === itemId) {
      selectedStoredItem = null;
      withdrawItemId = '';
    } else {
      selectedStoredItem = itemId;
      withdrawItemId = itemId;
      const stItem = baseStore.items.find(i => i.item_id === itemId);
      if (stItem) withdrawQty = stItem.quantity;
    }
  }

  /** Click on a cargo item row to select it for deposit */
  function selectCargoRow(itemId: string) {
    depositItemId = itemId;
    const cargoItem = shipStore.cargo.find(c => c.item_id === itemId);
    if (cargoItem) depositQty = cargoItem.quantity;
  }

  function doTransferCredits() {
    if (creditAmount <= 0) return;
    const amount = creditAmount;
    if (creditMode === 'deposit') {
      actionQueueStore.enqueue(`Deposit ₡${amount.toLocaleString()}`, () => ws.depositCredits(amount));
    } else {
      actionQueueStore.enqueue(`Withdraw ₡${amount.toLocaleString()}`, () => ws.withdrawCredits(amount));
    }
    creditAmount = 0;
  }

  function doSetHomeBase() {
    if (!baseStore.currentBase?.id) return;
    const baseId = baseStore.currentBase.id;
    actionQueueStore.enqueue(`Set Home Base`, () => ws.setHomeBase(baseId), {
      command: { type: 'set_home_base', params: { baseId } }
    });
  }
</script>

{#if !playerStore.isDocked && !hasPendingDock}
  <div class="not-docked">
    <span class="material-icons" style="font-size:48px;color:#263238">home</span>
    <p>Dock at a station to access base services</p>
  </div>
{:else}
  {#if hasPendingDock && !playerStore.isDocked}
    <div class="pending-dock-banner">
      <span class="material-icons" style="font-size:16px">schedule</span>
      Docking予定 — キューにアクションを追加できます
    </div>
  {/if}

  <div class="three-col">
    <!-- Station Info -->
    <Card class="space-card">
      <Content>
        <div class="section-head">
          <span class="tab-section-title">Station</span>
          <button class="icon-btn" onclick={loadStorage}>↻</button>
        </div>

        {#if baseStore.currentBase}
          <h3 class="base-name">{baseStore.currentBase.name}</h3>
          <p class="base-type mono">{baseStore.currentBase.type}</p>
          {#if baseStore.currentBase.owner_name}
            <p class="base-owner">Owner: {baseStore.currentBase.owner_name}</p>
          {/if}
          {#if baseStore.currentBase.description}
            <p class="base-desc">{baseStore.currentBase.description}</p>
          {/if}

          {#if isHomeBase}
            <p class="home-base-badge">
              <span class="material-icons" style="font-size:14px">home</span>
              Home Base
            </p>
          {:else if hasCloningService && playerStore.isDocked}
            <button class="set-home-btn" onclick={doSetHomeBase}>
              <span class="material-icons" style="font-size:14px">home</span>
              Set as Home Base
            </button>
          {/if}

          {#if baseStore.baseCondition}
            <p class="tab-section-title" style="margin-top:12px">Condition</p>
            {#if baseStore.baseCondition.satisfaction_pct !== undefined}
              <LinearProgress
                progress={(baseStore.baseCondition.satisfaction_pct ?? 0) / 100}
                style="--mdc-theme-primary:{(baseStore.baseCondition.satisfaction_pct ?? 0) >= 70 ? '#4caf50' : (baseStore.baseCondition.satisfaction_pct ?? 0) >= 40 ? '#ff9800' : '#f44336'}; margin-bottom:6px"
              />
              <p class="mono condition-text">
                {baseStore.baseCondition.satisfied_count}/{baseStore.baseCondition.total_service_infra} systems
                <span class="condition-status">({baseStore.baseCondition.satisfaction_pct}%)</span>
              </p>
              <p class="condition-label">{baseStore.baseCondition.condition}</p>
              {#if baseStore.baseCondition.condition_text}
                <p class="condition-flavor">{baseStore.baseCondition.condition_text}</p>
              {/if}
            {:else if baseStore.baseCondition.max_health}
              <LinearProgress
                progress={baseStore.baseCondition.max_health > 0
                  ? (baseStore.baseCondition.health ?? 0) / baseStore.baseCondition.max_health
                  : 0}
                style="--mdc-theme-primary:#4caf50; margin-bottom:6px"
              />
              <p class="mono condition-text">
                {baseStore.baseCondition.health} / {baseStore.baseCondition.max_health} HP
                <span class="condition-status">({baseStore.baseCondition.status})</span>
              </p>
            {/if}
          {/if}

          {#if baseStore.serviceList.length > 0}
            <p class="tab-section-title" style="margin-top:12px">Services</p>
            <div class="services">
              {#each baseStore.serviceList as svc}
                <span class="service-chip">{svc}</span>
              {/each}
            </div>
          {/if}

          {#if baseStore.currentBase.defense_level !== undefined}
            <p class="tab-section-title" style="margin-top:12px">Defense Level</p>
            <LinearProgress
              progress={baseStore.currentBase.defense_level / 100}
              style="--mdc-theme-primary:#2196f3; margin-bottom:6px"
            />
            <p class="mono defense-text">{baseStore.currentBase.defense_level}%</p>
          {/if}

          {#if baseStore.storageData}
            <p class="tab-section-title" style="margin-top:12px">Storage</p>
            <LinearProgress
              progress={baseStore.capacityPercent / 100}
              style="--mdc-theme-primary:#ff9800; margin-bottom:6px"
            />
            <p class="mono cap-text">
              {baseStore.capacityUsed} / {baseStore.capacity} m³
            </p>

            <p class="tab-section-title" style="margin-top:8px">Credits in Station</p>
            <p class="mono credits">₡ {baseStore.credits.toLocaleString()}</p>
          {/if}
        {:else if hasPendingDock}
          <p class="empty-hint">ドック後にステーション情報が表示されます</p>
        {:else}
          <p class="empty-hint">Loading station info...</p>
        {/if}
      </Content>
    </Card>

    <!-- Storage & Cargo items -->
    <Card class="space-card">
      <Content>
        <div class="cargo-header">
          <p class="tab-section-title" style="margin:0">Stored Items</p>
          {#if baseStore.items.length > 0 || (hasPendingDock && !playerStore.isDocked) || actionQueueStore.recordingMode}
            <button class="withdraw-all-btn" onclick={doWithdrawAllStorage} title="Withdraw all stored items (iterative)">
              Withdraw All ↓
            </button>
          {/if}
        </div>

        {#if baseStore.items.length > 0}
          <table class="storage-table">
            <thead>
              <tr>
                <th>Item</th>
                <th class="num">Qty</th>
                <th class="num">Volume</th>
                <th style="width:50px"></th>
              </tr>
            </thead>
            <tbody>
              {#each baseStore.items as item}
                <tr
                  class="clickable-row"
                  class:selected-row={selectedStoredItem === item.item_id}
                  onclick={() => selectStoredRow(item.item_id)}
                >
                  <td>{item.name ?? item.item_id}</td>
                  <td class="num mono">{item.quantity}</td>
                  <td class="num mono">{(item.quantity * (item.volume ?? 1)).toFixed(1)}</td>
                  <td>
                    <button class="withdraw-btn" onclick={(e) => { e.stopPropagation(); doWithdrawSelected(item.item_id); }} title="Withdraw all {item.item_id}">
                      ↓
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {:else if baseStore.storageData}
          <p class="empty-hint">No items in storage</p>
        {:else if !hasPendingDock}
          <p class="empty-hint">Loading storage...</p>
        {/if}

        {#if shipStore.cargo.length > 0 || (hasPendingDock && !playerStore.isDocked) || actionQueueStore.recordingMode}
          <div class="cargo-header">
            <p class="tab-section-title" style="margin:0">Cargo (Ship)</p>
            <button class="deposit-all-btn" onclick={doDepositAllCargo} title="Deposit all cargo items (iterative)">
              Deposit All ↑
            </button>
          </div>
        {/if}
        {#if shipStore.cargo.length > 0}
          <table class="storage-table">
            <thead>
              <tr>
                <th>Item</th>
                <th class="num">Qty</th>
                <th class="num">Volume</th>
                <th style="width:50px"></th>
              </tr>
            </thead>
            <tbody>
              {#each shipStore.cargo as item}
                <tr class="cargo-row clickable-row" onclick={() => selectCargoRow(item.item_id)}>
                  <td>{item.name ?? item.item_id}</td>
                  <td class="num mono">{item.quantity}</td>
                  <td class="num mono">{(item.quantity * (item.volume ?? 1)).toFixed(1)}</td>
                  <td>
                    <button class="deposit-btn" onclick={(e) => { e.stopPropagation(); doDepositSelected(item.item_id); }} title="Deposit all {item.item_id}">
                      ↑
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}

        <!-- Deposit/Withdraw Items -->
        <p class="tab-section-title" style="margin-top:16px">Move Items</p>
        <div class="transfer-form">
          <div class="autocomplete-wrapper">
            <Textfield
              bind:value={depositItemId}
              label="Item ID"
              variant="outlined"
              style="width:100%"
              onfocus={() => (showDepositSuggestions = true)}
              onblur={() => setTimeout(() => (showDepositSuggestions = false), 150)}
            />
            {#if showDepositSuggestions && filteredDepositSuggestions.length > 0}
              <ul class="suggestion-list">
                {#each filteredDepositSuggestions as s}
                  <li>
                    <button class="suggestion-item" onmousedown={() => selectDepositItem(s.id)}>
                      <span class="sugg-name">{s.name}</span>
                      <span class="sugg-id mono">{s.id}</span>
                    </button>
                  </li>
                {/each}
              </ul>
            {/if}
          </div>
          <div class="qty-row">
            <Textfield bind:value={depositQty} type="number" label="Qty" variant="outlined" style="width:45%" input$min="1" />
          </div>
          <div class="btn-row">
            <Button variant="outlined" onclick={doDepositItem} style="flex:1">
              <Label>Deposit ↑</Label>
            </Button>
            <Button variant="outlined" onclick={doWithdrawItem} style="flex:1">
              <Label>Withdraw ↓</Label>
            </Button>
          </div>
        </div>
      </Content>
    </Card>

    <!-- Credits transfer -->
    <Card class="space-card">
      <Content>
        <p class="tab-section-title">Credits Transfer</p>

        <div class="credit-balances">
          <div class="balance-item">
            <span class="bal-label">On Person</span>
            <span class="bal-val mono credits">₡ {playerStore.credits.toLocaleString()}</span>
          </div>
          <div class="balance-item">
            <span class="bal-label">In Station</span>
            <span class="bal-val mono credits">₡ {baseStore.credits.toLocaleString()}</span>
          </div>
        </div>

        <div class="type-toggle" style="margin:12px 0">
          <button class="toggle-btn" class:active={creditMode === 'deposit'} onclick={() => (creditMode = 'deposit')}>
            Deposit ↓
          </button>
          <button class="toggle-btn" class:active={creditMode === 'withdraw'} onclick={() => (creditMode = 'withdraw')}>
            Withdraw ↓
          </button>
        </div>

        <Textfield
          bind:value={creditAmount}
          type="number"
          label="Amount (₡)"
          variant="outlined"
          style="width:100%; margin-bottom:8px"
          input$min="1"
        />

        <Button
          variant="raised"
          onclick={doTransferCredits}
          disabled={creditAmount <= 0}
          style="width:100%"
        >
          <Label>{creditMode === 'deposit' ? 'Deposit Credits' : 'Withdraw Credits'}</Label>
        </Button>

        <!-- Gifts -->
        {#if baseStore.gifts.length > 0}
          <p class="tab-section-title" style="margin-top:16px">Pending Gifts</p>
          {#each baseStore.gifts as gift}
            <div class="gift-item">
              <span class="gift-from">From: {gift.from}</span>
              {#if gift.credits > 0}
                <span class="mono credits">₡{gift.credits.toLocaleString()}</span>
              {/if}
              {#if gift.items && gift.items.length > 0}
                <div class="gift-items">
                  {#each gift.items as giftItem}
                    <span class="gift-item-entry">{giftItem.quantity}x {giftItem.name ?? giftItem.item_id}</span>
                  {/each}
                </div>
              {/if}
              {#if gift.message}
                <p class="gift-msg">{gift.message}</p>
              {/if}
            </div>
          {/each}
        {/if}
      </Content>
    </Card>
  </div>
{/if}

<style>
  .not-docked {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 300px;
    gap: 12px;
    color: #37474f;
  }

  .not-docked p { font-size: 0.85rem; }

  .pending-dock-banner {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    margin-bottom: 8px;
    background: rgba(79,195,247,0.08);
    border: 1px solid rgba(79,195,247,0.25);
    border-radius: 4px;
    font-size: 0.72rem;
    color: #4fc3f7;
  }

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
    font-size: 1rem;
    padding: 2px 4px;
  }

  .empty-hint {
    font-size: 0.75rem;
    color: #263238;
    text-align: center;
    padding: 12px 0;
  }

  .base-name { font-size: 1rem; color: #90caf9; margin: 0 0 2px; font-weight: 300; }
  .base-type { font-size: 0.68rem; color: #546e7a; margin: 0 0 4px; text-transform: capitalize; }
  .base-owner { font-size: 0.72rem; color: #4a6070; margin: 0; }
  .base-desc { font-size: 0.7rem; color: #546e7a; margin: 4px 0 0; line-height: 1.4; }
  .cap-text { font-size: 0.7rem; color: #ff9800; margin: 0; }
  .condition-text { font-size: 0.7rem; color: #4caf50; margin: 0; }
  .condition-status { color: #546e7a; }
  .condition-label { font-size: 0.72rem; color: #ff9800; margin: 2px 0 0; text-transform: capitalize; }
  .condition-flavor { font-size: 0.65rem; color: #546e7a; margin: 2px 0 0; font-style: italic; line-height: 1.3; }
  .defense-text { font-size: 0.7rem; color: #2196f3; margin: 0; }

  .home-base-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-top: 6px;
    padding: 3px 10px;
    background: rgba(76,175,80,0.12);
    border: 1px solid rgba(76,175,80,0.3);
    border-radius: 12px;
    font-size: 0.68rem;
    color: #4caf50;
  }

  .set-home-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-top: 6px;
    padding: 4px 10px;
    background: rgba(79,195,247,0.08);
    border: 1px solid rgba(79,195,247,0.3);
    border-radius: 12px;
    font-size: 0.68rem;
    color: #4fc3f7;
    cursor: pointer;
    transition: all 0.15s;
  }
  .set-home-btn:hover {
    background: rgba(79,195,247,0.15);
    border-color: rgba(79,195,247,0.5);
  }

  .services { display: flex; flex-wrap: wrap; gap: 4px; }

  .service-chip {
    font-size: 0.65rem;
    padding: 2px 8px;
    background: rgba(79,195,247,0.1);
    border: 1px solid rgba(79,195,247,0.25);
    border-radius: 12px;
    color: #4fc3f7;
    text-transform: capitalize;
  }

  .storage-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.73rem;
    max-height: 200px;
    overflow-y: auto;
    display: block;
  }

  .storage-table thead { display: table; width: 100%; }
  .storage-table tbody { display: block; max-height: 200px; overflow-y: auto; }
  .storage-table tr { display: table; width: 100%; table-layout: fixed; }

  .storage-table th {
    text-align: left;
    font-size: 0.62rem;
    color: #37474f;
    padding: 4px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .storage-table th.num {
    text-align: right;
  }

  .storage-table td {
    padding: 4px;
    color: #90a4ae;
    border-bottom: 1px solid rgba(255,255,255,0.03);
  }

  .num { text-align: right; }
  .mono { font-family: 'Roboto Mono', monospace; }
  .credits { color: #ffd700; }

  .clickable-row {
    cursor: pointer;
    transition: background 0.1s;
  }
  .clickable-row:hover { background: rgba(79,195,247,0.05); }

  .selected-row {
    background: rgba(79,195,247,0.1) !important;
    border-left: 2px solid #4fc3f7;
  }

  .cargo-row td { color: #78909c; }

  .cargo-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 12px;
    margin-bottom: 4px;
  }

  .deposit-all-btn {
    background: none;
    border: 1px solid rgba(79,195,247,0.3);
    color: #4fc3f7;
    font-size: 0.62rem;
    padding: 2px 8px;
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .deposit-all-btn:hover { background: rgba(79,195,247,0.1); }

  .deposit-btn {
    background: none;
    border: 1px solid rgba(79,195,247,0.2);
    color: #4fc3f7;
    font-size: 0.7rem;
    padding: 1px 6px;
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .deposit-btn:hover { background: rgba(79,195,247,0.1); }

  .withdraw-all-btn {
    background: none;
    border: 1px solid rgba(255,152,0,0.3);
    color: #ff9800;
    font-size: 0.62rem;
    padding: 2px 8px;
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .withdraw-all-btn:hover { background: rgba(255,152,0,0.1); }

  .withdraw-btn {
    background: none;
    border: 1px solid rgba(255,152,0,0.2);
    color: #ff9800;
    font-size: 0.7rem;
    padding: 1px 6px;
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .withdraw-btn:hover { background: rgba(255,152,0,0.1); }

  .autocomplete-wrapper { position: relative; width: 100%; }

  .suggestion-list {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    z-index: 10;
    background: #0d1525;
    border: 1px solid rgba(79,195,247,0.25);
    border-radius: 4px;
    max-height: 160px;
    overflow-y: auto;
    list-style: none;
    margin: 2px 0 0;
    padding: 0;
  }

  .suggestion-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 6px 8px;
    background: none;
    border: none;
    color: #cfd8dc;
    font-size: 0.72rem;
    cursor: pointer;
    text-align: left;
  }

  .suggestion-item:hover {
    background: rgba(79,195,247,0.12);
  }

  .sugg-name { color: #b0bec5; }
  .sugg-id { font-size: 0.62rem; color: #546e7a; }

  .transfer-form { display: flex; flex-direction: column; gap: 8px; }
  .qty-row { display: flex; gap: 8px; }
  .btn-row { display: flex; gap: 8px; }

  .credit-balances { display: flex; flex-direction: column; gap: 6px; }

  .balance-item {
    display: flex;
    justify-content: space-between;
    padding: 6px 8px;
    background: rgba(255,255,255,0.02);
    border-radius: 4px;
  }

  .bal-label { font-size: 0.75rem; color: #4a6070; }
  .bal-val { font-size: 0.8rem; }

  .type-toggle { display: flex; gap: 4px; }

  .toggle-btn {
    flex: 1;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    color: #546e7a;
    font-size: 0.72rem;
    padding: 6px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .toggle-btn.active {
    background: rgba(79,195,247,0.1);
    border-color: rgba(79,195,247,0.35);
    color: #4fc3f7;
  }

  .gift-item {
    padding: 8px;
    background: rgba(76,175,80,0.06);
    border: 1px solid rgba(76,175,80,0.15);
    border-radius: 4px;
    margin-bottom: 4px;
    font-size: 0.75rem;
  }

  .gift-from { color: #66bb6a; }
  .gift-items { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
  .gift-item-entry { font-size: 0.7rem; color: #90a4ae; }
  .gift-msg { font-size: 0.7rem; color: #546e7a; margin: 4px 0 0; }
</style>
