<script lang="ts">
  import { tradeStore } from '$lib/stores/trade.svelte';
  import { shipStore } from '$lib/stores/ship.svelte';
  import { playerStore } from '$lib/stores/player.svelte';
  import { ws } from '$lib/services/websocket';
  import { actionQueueStore } from '$lib/stores/actionQueue.svelte';
  import type { TradeOffer, TradeItemEntry } from '$lib/types/game';

  let { targetUsername }: { targetUsername: string } = $props();

  // Trade form state
  let offerCredits = $state(0);
  let selectedItemId = $state('');
  let selectedItemQty = $state(1);
  let offerItems = $state<Record<string, number>>({});
  let showForm = $state(false);

  // Incoming offers from the target player
  let incomingOffers = $derived(tradeStore.getOffersFrom(targetUsername));
  // Outgoing offers to the target player
  let outgoingOffers = $derived(tradeStore.getOffersTo(targetUsername));

  let hasAnyTrades = $derived(incomingOffers.length > 0 || outgoingOffers.length > 0);

  // Available cargo items for offering
  let cargoItems = $derived(shipStore.cargo.filter(c => c.quantity > 0));

  let canTrade = $derived(playerStore.isDocked && !!targetUsername);

  function addItem() {
    if (!selectedItemId || selectedItemQty < 1) return;
    const cargoItem = cargoItems.find(c => c.item_id === selectedItemId);
    if (!cargoItem) return;
    const current = offerItems[selectedItemId] ?? 0;
    const maxQty = cargoItem.quantity - current;
    const qty = Math.min(selectedItemQty, maxQty);
    if (qty <= 0) return;
    offerItems = { ...offerItems, [selectedItemId]: current + qty };
    selectedItemId = '';
    selectedItemQty = 1;
  }

  function removeItem(itemId: string) {
    const { [itemId]: _, ...rest } = offerItems;
    offerItems = rest;
  }

  function sendOffer() {
    if (!targetUsername) return;
    // Build items as { item_id: quantity } for the API
    const items: Record<string, number> = { ...offerItems };
    actionQueueStore.enqueue(
      `Trade → ${targetUsername}`,
      () => ws.tradeOffer(targetUsername, offerCredits, items)
    );
    // Reset form
    offerCredits = 0;
    offerItems = {};
    showForm = false;
  }

  function acceptTrade(tradeId: string) {
    actionQueueStore.enqueue(
      `Accept trade`,
      () => ws.tradeAccept(tradeId)
    );
  }

  function declineTrade(tradeId: string) {
    ws.tradeDecline(tradeId);
  }

  function cancelTrade(tradeId: string) {
    ws.tradeCancel(tradeId);
  }

  function formatItemEntries(items: TradeItemEntry[]): string {
    if (!items || items.length === 0) return '';
    return items.map(i => `${i.quantity}x ${i.name ?? i.item_id}`).join(', ');
  }

  function formatOfferSummary(offer: TradeOffer): string {
    const parts: string[] = [];
    if (offer.offer_credits > 0) parts.push(`₡${offer.offer_credits.toLocaleString()}`);
    if (offer.offer_items.length > 0) parts.push(formatItemEntries(offer.offer_items));
    return parts.length > 0 ? parts.join(' + ') : 'Nothing';
  }

  let hasOfferContent = $derived(offerCredits > 0 || Object.keys(offerItems).length > 0);

  // Available items (not yet added to offer)
  let availableCargoItems = $derived(
    cargoItems.filter(c => {
      const offered = offerItems[c.item_id] ?? 0;
      return c.quantity - offered > 0;
    })
  );

  function maxQtyForSelected(): number {
    if (!selectedItemId) return 0;
    const cargo = cargoItems.find(c => c.item_id === selectedItemId);
    if (!cargo) return 0;
    return cargo.quantity - (offerItems[selectedItemId] ?? 0);
  }
</script>

<div class="trade-panel">
  <!-- Trade offers section -->
  {#if hasAnyTrades}
    <div class="trade-section">
      {#if incomingOffers.length > 0}
        <div class="trade-section-title">
          <span class="material-icons" style="font-size:14px">call_received</span>
          Incoming Offers
        </div>
        {#each incomingOffers as offer (offer.trade_id)}
          <div class="trade-card incoming">
            <div class="trade-card-header">
              <span class="trade-from">{offer.offerer_name}</span>
              <span class="trade-status pending">PENDING</span>
            </div>
            <div class="trade-details">
              <span class="trade-label">Offering:</span>
              <span class="trade-value">{formatOfferSummary(offer)}</span>
            </div>
            {#if offer.request_credits > 0 || offer.request_items.length > 0}
              <div class="trade-details">
                <span class="trade-label">Requesting:</span>
                <span class="trade-value request">
                  {#if offer.request_credits > 0}₡{offer.request_credits.toLocaleString()}{/if}
                  {#if offer.request_items.length > 0}
                    {offer.request_credits > 0 ? ' + ' : ''}{formatItemEntries(offer.request_items)}
                  {/if}
                </span>
              </div>
            {/if}
            <div class="trade-actions">
              <button class="trade-btn accept" onclick={() => acceptTrade(offer.trade_id)}>
                <span class="material-icons" style="font-size:14px">check</span>
                Accept
              </button>
              <button class="trade-btn decline" onclick={() => declineTrade(offer.trade_id)}>
                <span class="material-icons" style="font-size:14px">close</span>
                Decline
              </button>
            </div>
          </div>
        {/each}
      {/if}

      {#if outgoingOffers.length > 0}
        <div class="trade-section-title">
          <span class="material-icons" style="font-size:14px">call_made</span>
          Sent Offers
        </div>
        {#each outgoingOffers as offer (offer.trade_id)}
          <div class="trade-card outgoing">
            <div class="trade-card-header">
              <span class="trade-to">→ {offer.target_name}</span>
              <span class="trade-status pending">PENDING</span>
            </div>
            <div class="trade-details">
              <span class="trade-label">Offering:</span>
              <span class="trade-value">{formatOfferSummary(offer)}</span>
            </div>
            <div class="trade-actions">
              <button class="trade-btn cancel" onclick={() => cancelTrade(offer.trade_id)}>
                <span class="material-icons" style="font-size:14px">cancel</span>
                Cancel
              </button>
            </div>
          </div>
        {/each}
      {/if}
    </div>
  {/if}

  <!-- New trade offer form -->
  {#if canTrade}
    {#if !showForm}
      <button class="open-trade-btn" onclick={() => showForm = true}>
        <span class="material-icons" style="font-size:16px">swap_horiz</span>
        New Trade Offer
      </button>
    {:else}
      <div class="trade-form">
        <div class="trade-form-header">
          <span>Trade with <strong>{targetUsername}</strong></span>
          <button class="close-btn" onclick={() => showForm = false}>&times;</button>
        </div>

        <!-- Credits -->
        <div class="form-row">
          <label class="form-label">Credits:</label>
          <input
            type="number"
            class="form-input credits-input"
            bind:value={offerCredits}
            min="0"
            max={playerStore.credits}
            placeholder="0"
          />
          <span class="form-hint">/ ₡{playerStore.credits.toLocaleString()}</span>
        </div>

        <!-- Items to offer -->
        <div class="form-row">
          <label class="form-label">Items:</label>
          <div class="item-selector">
            <select class="form-select" bind:value={selectedItemId}>
              <option value="">Select item...</option>
              {#each availableCargoItems as item (item.item_id)}
                <option value={item.item_id}>
                  {item.name ?? item.item_id} ({item.quantity - (offerItems[item.item_id] ?? 0)})
                </option>
              {/each}
            </select>
            <input
              type="number"
              class="form-input qty-input"
              bind:value={selectedItemQty}
              min="1"
              max={maxQtyForSelected()}
              placeholder="Qty"
            />
            <button class="add-item-btn" onclick={addItem} disabled={!selectedItemId || selectedItemQty < 1}>
              +
            </button>
          </div>
        </div>

        <!-- Added items list -->
        {#if Object.keys(offerItems).length > 0}
          <div class="offered-items">
            {#each Object.entries(offerItems) as [itemId, qty] (itemId)}
              <div class="offered-item">
                <span class="item-name">{itemId}</span>
                <span class="item-qty">x{qty}</span>
                <button class="remove-item-btn" onclick={() => removeItem(itemId)}>&times;</button>
              </div>
            {/each}
          </div>
        {/if}

        <!-- Send button -->
        <button
          class="send-trade-btn"
          onclick={sendOffer}
          disabled={!hasOfferContent}
        >
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

  .trade-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .trade-section-title {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.65rem;
    letter-spacing: 0.08em;
    color: #546e7a;
    font-weight: 500;
    padding: 2px 0;
  }

  .trade-card {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(79, 195, 247, 0.1);
    border-radius: 3px;
    padding: 6px 8px;
    font-size: 0.72rem;
  }

  .trade-card.incoming {
    border-left: 2px solid #4caf50;
  }

  .trade-card.outgoing {
    border-left: 2px solid #4fc3f7;
  }

  .trade-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  }

  .trade-from { color: #4caf50; font-weight: 500; }
  .trade-to { color: #4fc3f7; font-weight: 500; }

  .trade-status {
    font-size: 0.6rem;
    letter-spacing: 0.08em;
    padding: 1px 6px;
    border-radius: 2px;
    font-weight: 600;
  }

  .trade-status.pending {
    background: rgba(255, 152, 0, 0.15);
    color: #ff9800;
  }

  .trade-details {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    font-size: 0.7rem;
    margin-bottom: 2px;
  }

  .trade-label {
    color: #546e7a;
    flex-shrink: 0;
    font-size: 0.65rem;
  }

  .trade-value {
    color: #ffd700;
  }

  .trade-value.request {
    color: #ff9800;
  }

  .trade-actions {
    display: flex;
    gap: 6px;
    margin-top: 4px;
  }

  .trade-btn {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    border: none;
    border-radius: 3px;
    font-size: 0.68rem;
    padding: 3px 10px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .trade-btn.accept {
    background: rgba(76, 175, 80, 0.15);
    color: #4caf50;
    border: 1px solid rgba(76, 175, 80, 0.3);
  }

  .trade-btn.accept:hover {
    background: rgba(76, 175, 80, 0.25);
  }

  .trade-btn.decline {
    background: rgba(244, 67, 54, 0.1);
    color: #ef5350;
    border: 1px solid rgba(244, 67, 54, 0.2);
  }

  .trade-btn.decline:hover {
    background: rgba(244, 67, 54, 0.2);
  }

  .trade-btn.cancel {
    background: rgba(255, 152, 0, 0.1);
    color: #ff9800;
    border: 1px solid rgba(255, 152, 0, 0.2);
  }

  .trade-btn.cancel:hover {
    background: rgba(255, 152, 0, 0.2);
  }

  /* New Trade button */
  .open-trade-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: rgba(79, 195, 247, 0.1);
    border: 1px solid rgba(79, 195, 247, 0.25);
    color: #4fc3f7;
    font-size: 0.72rem;
    padding: 5px 12px;
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.15s;
    align-self: flex-start;
  }

  .open-trade-btn:hover {
    background: rgba(79, 195, 247, 0.2);
    border-color: rgba(79, 195, 247, 0.4);
  }

  /* Trade form */
  .trade-form {
    background: rgba(4, 8, 18, 0.95);
    border: 1px solid rgba(79, 195, 247, 0.2);
    border-radius: 4px;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .trade-form-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.75rem;
    color: #90a4ae;
  }

  .trade-form-header strong {
    color: #4fc3f7;
  }

  .close-btn {
    background: none;
    border: none;
    color: #546e7a;
    font-size: 1rem;
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
  }

  .close-btn:hover { color: #ef5350; }

  .form-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.72rem;
  }

  .form-label {
    color: #546e7a;
    flex-shrink: 0;
    width: 50px;
    font-size: 0.7rem;
  }

  .form-input {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(79, 195, 247, 0.15);
    border-radius: 3px;
    color: #c0cfe0;
    font-size: 0.72rem;
    padding: 3px 6px;
    outline: none;
    font-family: 'Roboto Mono', monospace;
  }

  .form-input:focus {
    border-color: rgba(79, 195, 247, 0.4);
  }

  .credits-input {
    width: 100px;
  }

  .form-hint {
    font-size: 0.65rem;
    color: #37474f;
    font-family: 'Roboto Mono', monospace;
  }

  .item-selector {
    display: flex;
    gap: 4px;
    flex: 1;
    min-width: 0;
  }

  .form-select {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(79, 195, 247, 0.15);
    border-radius: 3px;
    color: #c0cfe0;
    font-size: 0.7rem;
    padding: 3px 4px;
    outline: none;
    flex: 1;
    min-width: 0;
  }

  .form-select:focus {
    border-color: rgba(79, 195, 247, 0.4);
  }

  .qty-input {
    width: 52px;
  }

  .add-item-btn {
    background: rgba(79, 195, 247, 0.15);
    border: 1px solid rgba(79, 195, 247, 0.3);
    color: #4fc3f7;
    font-size: 0.8rem;
    width: 26px;
    border-radius: 3px;
    cursor: pointer;
    padding: 0;
    line-height: 1;
  }

  .add-item-btn:hover:not(:disabled) {
    background: rgba(79, 195, 247, 0.25);
  }

  .add-item-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .offered-items {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding-left: 56px;
  }

  .offered-item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: rgba(79, 195, 247, 0.08);
    border: 1px solid rgba(79, 195, 247, 0.15);
    border-radius: 3px;
    padding: 2px 6px;
    font-size: 0.68rem;
    color: #90a4ae;
  }

  .item-name { color: #b0bec5; }
  .item-qty { color: #ffd700; font-family: 'Roboto Mono', monospace; }

  .remove-item-btn {
    background: none;
    border: none;
    color: #546e7a;
    font-size: 0.78rem;
    cursor: pointer;
    padding: 0 2px;
    line-height: 1;
  }

  .remove-item-btn:hover { color: #ef5350; }

  .send-trade-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: rgba(76, 175, 80, 0.15);
    border: 1px solid rgba(76, 175, 80, 0.3);
    color: #4caf50;
    font-size: 0.72rem;
    padding: 5px 14px;
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.15s;
    align-self: flex-end;
  }

  .send-trade-btn:hover:not(:disabled) {
    background: rgba(76, 175, 80, 0.25);
  }

  .send-trade-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .trade-notice {
    font-size: 0.68rem;
    color: #37474f;
    padding: 4px 0;
  }
</style>
