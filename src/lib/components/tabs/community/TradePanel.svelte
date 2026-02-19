<script lang="ts">
  import { tradeStore } from '$lib/stores/trade.svelte';
  import { shipStore } from '$lib/stores/ship.svelte';
  import { playerStore } from '$lib/stores/player.svelte';
  import { ws } from '$lib/services/websocket';
  import { actionQueueStore } from '$lib/stores/actionQueue.svelte';
  import type { TradeOffer, TradeItemEntry } from '$lib/types/game';

  let { targetUsername }: { targetUsername: string } = $props();

  // --- Form state: Offer (what you give) ---
  let offerCredits = $state(0);
  let offerSelectedId = $state('');
  let offerSelectedQty = $state(1);
  let offerItems = $state<Record<string, number>>({});

  // --- Form state: Request (what you want) ---
  let requestCredits = $state(0);
  let requestItemId = $state('');
  let requestItemQty = $state(1);
  let requestItems = $state<Record<string, number>>({});

  let showForm = $state(false);

  // Trades with current target
  let incomingOffers = $derived(tradeStore.getOffersFrom(targetUsername));
  let outgoingOffers = $derived(tradeStore.getOffersTo(targetUsername));
  let hasAnyTrades = $derived(incomingOffers.length > 0 || outgoingOffers.length > 0);

  // Cargo for offer item selector
  let cargoItems = $derived(shipStore.cargo.filter(c => c.quantity > 0));
  let canTrade = $derived(playerStore.isDocked && !!targetUsername);

  // --- Offer item helpers ---
  function addOfferItem() {
    if (!offerSelectedId || offerSelectedQty < 1) return;
    const cargo = cargoItems.find(c => c.item_id === offerSelectedId);
    if (!cargo) return;
    const current = offerItems[offerSelectedId] ?? 0;
    const qty = Math.min(offerSelectedQty, cargo.quantity - current);
    if (qty <= 0) return;
    offerItems = { ...offerItems, [offerSelectedId]: current + qty };
    offerSelectedId = '';
    offerSelectedQty = 1;
  }

  function removeOfferItem(id: string) {
    const { [id]: _, ...rest } = offerItems;
    offerItems = rest;
  }

  let availableOfferItems = $derived(
    cargoItems.filter(c => c.quantity - (offerItems[c.item_id] ?? 0) > 0)
  );

  function maxOfferQty(): number {
    if (!offerSelectedId) return 0;
    const c = cargoItems.find(c => c.item_id === offerSelectedId);
    return c ? c.quantity - (offerItems[offerSelectedId] ?? 0) : 0;
  }

  // --- Request item helpers ---
  function addRequestItem() {
    if (!requestItemId.trim() || requestItemQty < 1) return;
    const id = requestItemId.trim();
    const current = requestItems[id] ?? 0;
    requestItems = { ...requestItems, [id]: current + requestItemQty };
    requestItemId = '';
    requestItemQty = 1;
  }

  function removeRequestItem(id: string) {
    const { [id]: _, ...rest } = requestItems;
    requestItems = rest;
  }

  // --- Send ---
  let hasContent = $derived(
    offerCredits > 0 || Object.keys(offerItems).length > 0 ||
    requestCredits > 0 || Object.keys(requestItems).length > 0
  );

  function sendOffer() {
    if (!targetUsername) return;
    const oi = { ...offerItems };
    const ri = { ...requestItems };
    const oc = offerCredits;
    const rc = requestCredits;
    actionQueueStore.enqueue(
      `Trade → ${targetUsername}`,
      () => ws.tradeOffer(targetUsername, oc, oi, rc, ri)
    );
    offerCredits = 0;
    offerItems = {};
    requestCredits = 0;
    requestItems = {};
    showForm = false;
  }

  function acceptTrade(tradeId: string) {
    actionQueueStore.enqueue('Accept trade', () => ws.tradeAccept(tradeId));
  }

  function declineTrade(tradeId: string) {
    ws.tradeDecline(tradeId);
  }

  function cancelTrade(tradeId: string) {
    ws.tradeCancel(tradeId);
  }

  // --- Display helpers ---
  function fmtItems(items: TradeItemEntry[]): string {
    if (!items || items.length === 0) return '';
    return items.map(i => `${i.quantity}x ${i.name ?? i.item_id}`).join(', ');
  }

  function fmtSide(credits: number, items: TradeItemEntry[]): string {
    const parts: string[] = [];
    if (credits > 0) parts.push(`₡${credits.toLocaleString()}`);
    if (items.length > 0) parts.push(fmtItems(items));
    return parts.length > 0 ? parts.join(' + ') : 'Nothing';
  }
</script>

<div class="trade-panel">
  <!-- Existing trade offers -->
  {#if hasAnyTrades}
    <div class="trade-section">
      {#if incomingOffers.length > 0}
        <div class="section-title">
          <span class="material-icons" style="font-size:14px">call_received</span>
          Incoming Offers
        </div>
        {#each incomingOffers as offer (offer.trade_id)}
          <div class="trade-card incoming">
            <div class="card-header">
              <span class="trade-from">{offer.offerer_name}</span>
              <span class="badge pending">PENDING</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Gives:</span>
              <span class="detail-val give">{fmtSide(offer.offer_credits, offer.offer_items)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Wants:</span>
              <span class="detail-val want">{fmtSide(offer.request_credits, offer.request_items)}</span>
            </div>
            <div class="card-actions">
              <button class="trade-btn accept" onclick={() => acceptTrade(offer.trade_id)}>
                <span class="material-icons" style="font-size:14px">check</span> Accept
              </button>
              <button class="trade-btn decline" onclick={() => declineTrade(offer.trade_id)}>
                <span class="material-icons" style="font-size:14px">close</span> Decline
              </button>
            </div>
          </div>
        {/each}
      {/if}

      {#if outgoingOffers.length > 0}
        <div class="section-title">
          <span class="material-icons" style="font-size:14px">call_made</span>
          Sent Offers
        </div>
        {#each outgoingOffers as offer (offer.trade_id)}
          <div class="trade-card outgoing">
            <div class="card-header">
              <span class="trade-to">→ {offer.target_name}</span>
              <span class="badge pending">PENDING</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">You give:</span>
              <span class="detail-val give">{fmtSide(offer.offer_credits, offer.offer_items)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">You get:</span>
              <span class="detail-val want">{fmtSide(offer.request_credits, offer.request_items)}</span>
            </div>
            <div class="card-actions">
              <button class="trade-btn cancel" onclick={() => cancelTrade(offer.trade_id)}>
                <span class="material-icons" style="font-size:14px">cancel</span> Cancel
              </button>
            </div>
          </div>
        {/each}
      {/if}
    </div>
  {/if}

  <!-- New trade form -->
  {#if canTrade}
    {#if !showForm}
      <button class="open-trade-btn" onclick={() => showForm = true}>
        <span class="material-icons" style="font-size:16px">swap_horiz</span>
        New Trade Offer
      </button>
    {:else}
      <div class="trade-form">
        <div class="form-header">
          <span>Trade with <strong>{targetUsername}</strong></span>
          <button class="close-btn" onclick={() => showForm = false}>&times;</button>
        </div>

        <!-- ===== YOU OFFER ===== -->
        <div class="form-section-label offer-label">
          <span class="material-icons" style="font-size:13px">arrow_upward</span>
          You give
        </div>

        <div class="form-row">
          <label class="form-lbl">Credits:</label>
          <input type="number" class="form-input credits-input" bind:value={offerCredits}
            min="0" max={playerStore.credits} placeholder="0" />
          <span class="form-hint">/ ₡{playerStore.credits.toLocaleString()}</span>
        </div>

        <div class="form-row">
          <label class="form-lbl">Items:</label>
          <div class="item-selector">
            <select class="form-select" bind:value={offerSelectedId}>
              <option value="">Select cargo...</option>
              {#each availableOfferItems as item (item.item_id)}
                <option value={item.item_id}>
                  {item.name ?? item.item_id} ({item.quantity - (offerItems[item.item_id] ?? 0)})
                </option>
              {/each}
            </select>
            <input type="number" class="form-input qty-input" bind:value={offerSelectedQty}
              min="1" max={maxOfferQty()} placeholder="Qty" />
            <button class="add-btn" onclick={addOfferItem}
              disabled={!offerSelectedId || offerSelectedQty < 1}>+</button>
          </div>
        </div>

        {#if Object.keys(offerItems).length > 0}
          <div class="item-tags">
            {#each Object.entries(offerItems) as [id, qty] (id)}
              <div class="item-tag">
                <span class="tag-name">{id}</span>
                <span class="tag-qty">x{qty}</span>
                <button class="tag-remove" onclick={() => removeOfferItem(id)}>&times;</button>
              </div>
            {/each}
          </div>
        {/if}

        <!-- ===== YOU REQUEST ===== -->
        <div class="form-section-label request-label">
          <span class="material-icons" style="font-size:13px">arrow_downward</span>
          You want
        </div>

        <div class="form-row">
          <label class="form-lbl">Credits:</label>
          <input type="number" class="form-input credits-input" bind:value={requestCredits}
            min="0" placeholder="0" />
        </div>

        <div class="form-row">
          <label class="form-lbl">Items:</label>
          <div class="item-selector">
            <input type="text" class="form-input" bind:value={requestItemId}
              placeholder="Item ID..." style="flex:1;min-width:0" />
            <input type="number" class="form-input qty-input" bind:value={requestItemQty}
              min="1" placeholder="Qty" />
            <button class="add-btn" onclick={addRequestItem}
              disabled={!requestItemId.trim() || requestItemQty < 1}>+</button>
          </div>
        </div>

        {#if Object.keys(requestItems).length > 0}
          <div class="item-tags">
            {#each Object.entries(requestItems) as [id, qty] (id)}
              <div class="item-tag request">
                <span class="tag-name">{id}</span>
                <span class="tag-qty">x{qty}</span>
                <button class="tag-remove" onclick={() => removeRequestItem(id)}>&times;</button>
              </div>
            {/each}
          </div>
        {/if}

        <!-- Send -->
        <button class="send-trade-btn" onclick={sendOffer} disabled={!hasContent}>
          <span class="material-icons" style="font-size:16px">send</span>
          Send Trade Offer
        </button>
      </div>
    {/if}
  {:else if !playerStore.isDocked}
    <div class="trade-notice">Dock at a station to trade</div>
  {/if}
</div>

<style>
  .trade-panel {
    border-top: 1px solid rgba(79, 195, 247, 0.1);
    padding: 6px 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex-shrink: 0;
  }

  .trade-section { display: flex; flex-direction: column; gap: 4px; }

  .section-title {
    display: flex; align-items: center; gap: 4px;
    font-size: 0.65rem; letter-spacing: 0.08em;
    color: #546e7a; font-weight: 500; padding: 2px 0;
  }

  /* --- Trade cards --- */
  .trade-card {
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(79,195,247,0.1);
    border-radius: 3px; padding: 6px 8px; font-size: 0.72rem;
  }
  .trade-card.incoming { border-left: 2px solid #4caf50; }
  .trade-card.outgoing { border-left: 2px solid #4fc3f7; }

  .card-header {
    display: flex; align-items: center;
    justify-content: space-between; margin-bottom: 4px;
  }
  .trade-from { color: #4caf50; font-weight: 500; }
  .trade-to   { color: #4fc3f7; font-weight: 500; }

  .badge {
    font-size: 0.6rem; letter-spacing: 0.08em;
    padding: 1px 6px; border-radius: 2px; font-weight: 600;
  }
  .badge.pending { background: rgba(255,152,0,0.15); color: #ff9800; }

  .detail-row {
    display: flex; gap: 6px; font-size: 0.7rem; margin-bottom: 2px;
  }
  .detail-label { color: #546e7a; flex-shrink: 0; font-size: 0.65rem; }
  .detail-val.give { color: #ffd700; }
  .detail-val.want { color: #ff9800; }

  .card-actions { display: flex; gap: 6px; margin-top: 4px; }

  .trade-btn {
    display: inline-flex; align-items: center; gap: 3px;
    border: none; border-radius: 3px; font-size: 0.68rem;
    padding: 3px 10px; cursor: pointer; transition: all 0.15s;
  }
  .trade-btn.accept  { background: rgba(76,175,80,0.15); color: #4caf50; border: 1px solid rgba(76,175,80,0.3); }
  .trade-btn.accept:hover { background: rgba(76,175,80,0.25); }
  .trade-btn.decline { background: rgba(244,67,54,0.1); color: #ef5350; border: 1px solid rgba(244,67,54,0.2); }
  .trade-btn.decline:hover { background: rgba(244,67,54,0.2); }
  .trade-btn.cancel  { background: rgba(255,152,0,0.1); color: #ff9800; border: 1px solid rgba(255,152,0,0.2); }
  .trade-btn.cancel:hover  { background: rgba(255,152,0,0.2); }

  /* --- Open button --- */
  .open-trade-btn {
    display: inline-flex; align-items: center; gap: 5px;
    background: rgba(79,195,247,0.1); border: 1px solid rgba(79,195,247,0.25);
    color: #4fc3f7; font-size: 0.72rem; padding: 5px 12px;
    border-radius: 3px; cursor: pointer; transition: all 0.15s;
    align-self: flex-start;
  }
  .open-trade-btn:hover { background: rgba(79,195,247,0.2); border-color: rgba(79,195,247,0.4); }

  /* --- Trade form --- */
  .trade-form {
    background: rgba(4,8,18,0.95);
    border: 1px solid rgba(79,195,247,0.2);
    border-radius: 4px; padding: 8px;
    display: flex; flex-direction: column; gap: 5px;
  }

  .form-header {
    display: flex; align-items: center; justify-content: space-between;
    font-size: 0.75rem; color: #90a4ae;
  }
  .form-header strong { color: #4fc3f7; }

  .close-btn {
    background: none; border: none; color: #546e7a;
    font-size: 1rem; cursor: pointer; padding: 0 4px; line-height: 1;
  }
  .close-btn:hover { color: #ef5350; }

  .form-section-label {
    display: flex; align-items: center; gap: 4px;
    font-size: 0.65rem; letter-spacing: 0.06em;
    font-weight: 600; padding: 3px 0 1px;
    border-top: 1px solid rgba(79,195,247,0.08);
    margin-top: 2px;
  }
  .offer-label   { color: #4caf50; }
  .request-label { color: #ff9800; }

  .form-row {
    display: flex; align-items: center; gap: 6px; font-size: 0.72rem;
  }

  .form-lbl {
    color: #546e7a; flex-shrink: 0; width: 50px; font-size: 0.7rem;
  }

  .form-input {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(79,195,247,0.15);
    border-radius: 3px; color: #c0cfe0;
    font-size: 0.72rem; padding: 3px 6px;
    outline: none; font-family: 'Roboto Mono', monospace;
  }
  .form-input:focus { border-color: rgba(79,195,247,0.4); }
  .credits-input { width: 100px; }
  .qty-input { width: 52px; }

  .form-hint {
    font-size: 0.65rem; color: #37474f;
    font-family: 'Roboto Mono', monospace;
  }

  .item-selector { display: flex; gap: 4px; flex: 1; min-width: 0; }

  .form-select {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(79,195,247,0.15);
    border-radius: 3px; color: #c0cfe0;
    font-size: 0.7rem; padding: 3px 4px;
    outline: none; flex: 1; min-width: 0;
  }
  .form-select:focus { border-color: rgba(79,195,247,0.4); }

  .add-btn {
    background: rgba(79,195,247,0.15);
    border: 1px solid rgba(79,195,247,0.3);
    color: #4fc3f7; font-size: 0.8rem;
    width: 26px; border-radius: 3px;
    cursor: pointer; padding: 0; line-height: 1;
  }
  .add-btn:hover:not(:disabled) { background: rgba(79,195,247,0.25); }
  .add-btn:disabled { opacity: 0.3; cursor: not-allowed; }

  .item-tags {
    display: flex; flex-wrap: wrap; gap: 4px; padding-left: 56px;
  }

  .item-tag {
    display: inline-flex; align-items: center; gap: 4px;
    background: rgba(76,175,80,0.08);
    border: 1px solid rgba(76,175,80,0.15);
    border-radius: 3px; padding: 2px 6px;
    font-size: 0.68rem; color: #90a4ae;
  }
  .item-tag.request {
    background: rgba(255,152,0,0.08);
    border-color: rgba(255,152,0,0.15);
  }
  .tag-name { color: #b0bec5; }
  .tag-qty  { color: #ffd700; font-family: 'Roboto Mono', monospace; }
  .tag-remove {
    background: none; border: none; color: #546e7a;
    font-size: 0.78rem; cursor: pointer; padding: 0 2px; line-height: 1;
  }
  .tag-remove:hover { color: #ef5350; }

  .send-trade-btn {
    display: inline-flex; align-items: center; gap: 5px;
    background: rgba(76,175,80,0.15); border: 1px solid rgba(76,175,80,0.3);
    color: #4caf50; font-size: 0.72rem; padding: 5px 14px;
    border-radius: 3px; cursor: pointer; transition: all 0.15s;
    align-self: flex-end;
  }
  .send-trade-btn:hover:not(:disabled) { background: rgba(76,175,80,0.25); }
  .send-trade-btn:disabled { opacity: 0.3; cursor: not-allowed; }

  .trade-notice { font-size: 0.68rem; color: #37474f; padding: 4px 0; }
</style>
