<script lang="ts">
  import Button, { Label } from '@smui/button';
  import Card, { Content } from '@smui/card';
  import Textfield from '@smui/textfield';
  import LinearProgress from '@smui/linear-progress';
  import { baseStore } from '$lib/stores/base.svelte';
  import { playerStore } from '$lib/stores/player.svelte';
  import { ws } from '$lib/services/websocket';

  let depositItemId = $state('');
  let depositQty = $state(1);
  let withdrawItemId = $state('');
  let withdrawQty = $state(1);
  let creditAmount = $state(0);
  let creditMode = $state<'deposit' | 'withdraw'>('deposit');

  function loadStorage() {
    if (playerStore.poi_id) ws.viewStorage(playerStore.poi_id);
  }

  function doDepositItem() {
    if (!depositItemId.trim() || depositQty <= 0) return;
    ws.depositItems([{ id: depositItemId, quantity: depositQty }]);
    depositItemId = '';
    depositQty = 1;
  }

  function doWithdrawItem() {
    if (!withdrawItemId.trim() || withdrawQty <= 0) return;
    ws.withdrawItems([{ id: withdrawItemId, quantity: withdrawQty }]);
    withdrawItemId = '';
    withdrawQty = 1;
  }

  function doTransferCredits() {
    if (creditAmount <= 0) return;
    if (creditMode === 'deposit') {
      ws.depositCredits(creditAmount);
    } else {
      ws.withdrawCredits(creditAmount);
    }
    creditAmount = 0;
  }
</script>

{#if !playerStore.isDocked}
  <div class="not-docked">
    <span class="material-icons" style="font-size:48px;color:#263238">home</span>
    <p>Dock at a station to access base services</p>
  </div>
{:else}
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

          {#if baseStore.currentBase.services.length > 0}
            <p class="tab-section-title" style="margin-top:12px">Services</p>
            <div class="services">
              {#each baseStore.currentBase.services as svc}
                <span class="service-chip">{svc}</span>
              {/each}
            </div>
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
        {:else}
          <p class="empty-hint">Click ↻ to load station info</p>
        {/if}
      </Content>
    </Card>

    <!-- Storage items -->
    <Card class="space-card">
      <Content>
        <p class="tab-section-title">Stored Items</p>

        {#if baseStore.items.length > 0}
          <table class="storage-table">
            <thead>
              <tr>
                <th>Item</th>
                <th class="num">Qty</th>
                <th class="num">Volume</th>
              </tr>
            </thead>
            <tbody>
              {#each baseStore.items as item}
                <tr>
                  <td>{item.name}</td>
                  <td class="num mono">{item.quantity}</td>
                  <td class="num mono">{(item.quantity * (item.volume ?? 1)).toFixed(1)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {:else}
          <p class="empty-hint">No items in storage</p>
        {/if}

        <!-- Deposit/Withdraw Items -->
        <p class="tab-section-title" style="margin-top:16px">Move Items</p>
        <div class="transfer-form">
          <Textfield bind:value={depositItemId} label="Item ID" variant="outlined" style="width:100%" />
          <div class="qty-row">
            <Textfield bind:value={depositQty} type="number" label="Qty" variant="outlined" style="width:45%" input$min="1" />
          </div>
          <div class="btn-row">
            <Button variant="outlined" onclick={doDepositItem} style="flex:1">
              <Label>Deposit ↓</Label>
            </Button>
            <Button variant="outlined" onclick={doWithdrawItem} style="flex:1">
              <Label>Withdraw ↑</Label>
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
            Withdraw ↑
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
  .base-type { font-size: 0.68rem; color: #546e7a; margin: 0 0 4px; }
  .base-owner { font-size: 0.72rem; color: #4a6070; margin: 0; }
  .cap-text { font-size: 0.7rem; color: #ff9800; margin: 0; }

  .services { display: flex; flex-wrap: wrap; gap: 4px; }

  .service-chip {
    font-size: 0.65rem;
    padding: 2px 8px;
    background: rgba(79,195,247,0.1);
    border: 1px solid rgba(79,195,247,0.25);
    border-radius: 12px;
    color: #4fc3f7;
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

  .storage-table td {
    padding: 4px;
    color: #90a4ae;
    border-bottom: 1px solid rgba(255,255,255,0.03);
  }

  .num { text-align: right; }
  .mono { font-family: 'Roboto Mono', monospace; }
  .credits { color: #ffd700; }

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
  .gift-msg { font-size: 0.7rem; color: #546e7a; margin: 4px 0 0; }
</style>
