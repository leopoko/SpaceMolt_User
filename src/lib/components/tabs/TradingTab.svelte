<script lang="ts">
  import Button, { Label } from '@smui/button';
  import Card, { Content } from '@smui/card';
  import { marketStore } from '$lib/stores/market.svelte';
  import { marketMemoStore } from '$lib/stores/marketMemo.svelte';
  import { playerStore } from '$lib/stores/player.svelte';
  import { shipStore } from '$lib/stores/ship.svelte';
  import { baseStore } from '$lib/stores/base.svelte';
  import { systemStore } from '$lib/stores/system.svelte';
  import { ws } from '$lib/services/websocket';
  import type { MarketItem, MarketOrderEntry } from '$lib/types/game';

  // --- Expand state for item rows ---
  let expandedItems = $state<Set<string>>(new Set());

  function toggleExpand(itemId: string) {
    const next = new Set(expandedItems);
    if (next.has(itemId)) next.delete(itemId);
    else next.add(itemId);
    expandedItems = next;
  }

  // --- Create order form ---
  let orderItemInput = $state('');
  let orderPrice = $state<number | string>('');
  let orderQty = $state<number | string>('');
  let orderType = $state<'buy' | 'sell'>('buy');

  // Autocomplete
  let showSuggestions = $state(false);

  // Build suggestion list from cargo + storage + market items
  let suggestions = $derived.by(() => {
    const input = orderItemInput.toLowerCase().trim();
    if (!input) return [];

    const seen = new Set<string>();
    const results: Array<{ item_id: string; item_name: string; source: string }> = [];

    // Cargo items
    for (const c of shipStore.cargo) {
      const name = c.name ?? c.item_id;
      if (!seen.has(c.item_id) && (c.item_id.toLowerCase().includes(input) || name.toLowerCase().includes(input))) {
        seen.add(c.item_id);
        results.push({ item_id: c.item_id, item_name: name, source: `cargo: ${c.quantity}` });
      }
    }

    // Storage items
    for (const s of baseStore.items) {
      const name = s.name ?? s.item_id;
      if (!seen.has(s.item_id) && (s.item_id.toLowerCase().includes(input) || name.toLowerCase().includes(input))) {
        seen.add(s.item_id);
        results.push({ item_id: s.item_id, item_name: name, source: `storage: ${s.quantity}` });
      }
    }

    // Market items
    for (const m of marketStore.items) {
      if (!seen.has(m.item_id) && (m.item_id.toLowerCase().includes(input) || m.item_name.toLowerCase().includes(input))) {
        seen.add(m.item_id);
        results.push({ item_id: m.item_id, item_name: m.item_name, source: 'market' });
      }
    }

    // Memo items (from saved memos)
    for (const info of marketMemoStore.getAllItemPrices()) {
      if (!seen.has(info.item_id) && (info.item_id.toLowerCase().includes(input) || info.item_name.toLowerCase().includes(input))) {
        seen.add(info.item_id);
        results.push({ item_id: info.item_id, item_name: info.item_name, source: `memo: ${info.station}` });
      }
    }

    return results.slice(0, 10);
  });

  function selectSuggestion(item: { item_id: string; item_name: string }) {
    orderItemInput = item.item_name;
    showSuggestions = false;
  }

  function onInputFocus() {
    if (orderItemInput.trim()) showSuggestions = true;
  }

  function onInputBlur() {
    // Delay to allow click on suggestion
    setTimeout(() => { showSuggestions = false; }, 150);
  }

  // --- Actions ---

  function loadMarket() {
    const stationId = playerStore.dockedAt ?? playerStore.poi_id ?? systemStore.stations[0]?.id;
    if (stationId) {
      // view_orders is automatically chained after view_market response arrives
      ws.viewMarket(stationId);
    }
  }

  function saveMemo() {
    if (marketStore.data) {
      marketMemoStore.save(marketStore.data);
    }
  }

  function createOrder() {
    const itemName = orderItemInput.trim();
    const price = Number(orderPrice);
    const qty = Number(orderQty);
    if (!itemName || qty <= 0 || price <= 0) return;

    // Resolve item_id: check if input matches an item_name in market/cargo, else use as-is
    let itemId = itemName;
    const marketMatch = marketStore.items.find(i => i.item_name.toLowerCase() === itemName.toLowerCase());
    if (marketMatch) {
      itemId = marketMatch.item_id;
    } else {
      const cargoMatch = shipStore.cargo.find(c => (c.name ?? c.item_id).toLowerCase() === itemName.toLowerCase());
      if (cargoMatch) itemId = cargoMatch.item_id;
    }

    if (orderType === 'buy') {
      ws.createBuyOrder(itemId, qty, price);
    } else {
      ws.createSellOrder(itemId, qty, price);
    }
    orderItemInput = '';
    orderPrice = '';
    orderQty = '';
  }

  function cancelOrder(orderId: string) {
    ws.cancelOrder(orderId);
  }

  // Quick buy: create a buy order at the sell price (instant fill)
  function quickBuy(item: MarketItem, order: MarketOrderEntry) {
    ws.createBuyOrder(item.item_id, order.quantity, order.price_each);
  }

  // Quick sell: create a sell order at the buy price (instant fill)
  function quickSell(item: MarketItem, order: MarketOrderEntry) {
    ws.createSellOrder(item.item_id, order.quantity, order.price_each);
  }

  // Memo info
  let currentMemo = $derived(marketStore.baseName ? marketMemoStore.getMemo(marketStore.baseName) : null);

</script>

<div class="trading-layout">
  <!-- Top bar -->
  <div class="top-bar">
    <Button variant="outlined" onclick={loadMarket}>
      <Label><span class="material-icons btn-icon">refresh</span> Refresh</Label>
    </Button>
    {#if marketStore.data}
      <button class="memo-btn" onclick={saveMemo} title="Save market data as memo">
        <span class="material-icons" style="font-size:16px">bookmark</span>
        Memo
      </button>
      {#if currentMemo}
        <span class="memo-saved-hint">Saved {new Date(currentMemo.savedAt).toLocaleTimeString()}</span>
      {/if}
    {/if}
    {#if marketStore.baseName}
      <span class="station-label mono">{marketStore.baseName}</span>
    {/if}
    <span class="credits-display mono">₡ {playerStore.credits.toLocaleString()}</span>
  </div>

  {#if !marketStore.data}
    <Card class="space-card">
      <Content>
        <p class="empty-hint">
          {#if playerStore.isDocked}
            Press <strong>Refresh</strong> to load market data.
          {:else}
            Dock at a station to access the market.
          {/if}
        </p>
      </Content>
    </Card>
  {:else}
    <!-- Market Items Table -->
    <Card class="space-card">
      <Content>
        <p class="tab-section-title">Market – {marketStore.baseName}</p>
        {#if marketStore.items.length > 0}
          <table class="market-table">
            <thead>
              <tr>
                <th style="width:24px"></th>
                <th>Item</th>
                <th class="num">Best Buy</th>
                <th class="num">Best Sell</th>
                <th class="num">Spread</th>
              </tr>
            </thead>
            <tbody>
              {#each marketStore.items as item (item.item_id)}
                <!-- Item summary row -->
                <tr class="item-row" class:expanded={expandedItems.has(item.item_id)} onclick={() => toggleExpand(item.item_id)}>
                  <td class="expand-icon">
                    <span class="material-icons" style="font-size:14px">
                      {expandedItems.has(item.item_id) ? 'expand_more' : 'chevron_right'}
                    </span>
                  </td>
                  <td class="item-name">{item.item_name}</td>
                  <td class="num mono buy-price">{item.best_buy > 0 ? `₡${item.best_buy.toLocaleString()}` : '—'}</td>
                  <td class="num mono sell-price">{item.best_sell > 0 ? `₡${item.best_sell.toLocaleString()}` : '—'}</td>
                  <td class="num mono dim">{item.spread != null ? `₡${item.spread.toLocaleString()}` : '—'}</td>
                </tr>

                <!-- Expanded detail -->
                {#if expandedItems.has(item.item_id)}
                  <tr class="detail-row">
                    <td colspan="5">
                      <div class="detail-grid">
                        <!-- Buy orders (things wanted – you can sell to these) -->
                        <div class="detail-section">
                          <p class="detail-title buy-label">Buy Orders (Sell to)</p>
                          {#if item.buy_orders.length > 0}
                            <table class="detail-table">
                              <thead><tr><th class="num">Price</th><th class="num">Qty</th><th></th></tr></thead>
                              <tbody>
                                {#each item.buy_orders as order}
                                  <tr>
                                    <td class="num mono buy-price">₡{order.price_each.toLocaleString()}</td>
                                    <td class="num mono">{order.quantity}{#if order.source}<span class="source-tag">{order.source}</span>{/if}</td>
                                    <td><button class="action-btn sell-btn" onclick={(e) => { e.stopPropagation(); quickSell(item, order); }}>Sell</button></td>
                                  </tr>
                                {/each}
                              </tbody>
                            </table>
                          {:else}
                            <p class="detail-empty">No buy orders</p>
                          {/if}
                        </div>

                        <!-- Sell orders (things for sale – you can buy from these) -->
                        <div class="detail-section">
                          <p class="detail-title sell-label">Sell Orders (Buy from)</p>
                          {#if item.sell_orders.length > 0}
                            <table class="detail-table">
                              <thead><tr><th class="num">Price</th><th class="num">Qty</th><th></th></tr></thead>
                              <tbody>
                                {#each item.sell_orders as order}
                                  <tr>
                                    <td class="num mono sell-price">₡{order.price_each.toLocaleString()}</td>
                                    <td class="num mono">{order.quantity}{#if order.source}<span class="source-tag">{order.source}</span>{/if}</td>
                                    <td><button class="action-btn buy-btn" onclick={(e) => { e.stopPropagation(); quickBuy(item, order); }}>Buy</button></td>
                                  </tr>
                                {/each}
                              </tbody>
                            </table>
                          {:else}
                            <p class="detail-empty">No sell orders</p>
                          {/if}
                        </div>
                      </div>
                    </td>
                  </tr>
                {/if}
              {/each}
            </tbody>
          </table>
        {:else}
          <p class="empty-hint">No items listed on this market.</p>
        {/if}
      </Content>
    </Card>

    <!-- My Orders + Create Order -->
    <div class="bottom-grid">
      <!-- My Orders -->
      <Card class="space-card">
        <Content>
          <p class="tab-section-title">My Orders</p>
          {#if marketStore.myOrders.length > 0}
            <table class="market-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Item</th>
                  <th class="num">Price</th>
                  <th class="num">Qty</th>
                  <th class="num">Left</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {#each marketStore.myOrders as order (order.order_id)}
                  <tr>
                    <td>
                      <span class="order-type-badge" class:buy={order.order_type === 'buy'}>
                        {order.order_type.toUpperCase()}
                      </span>
                    </td>
                    <td>{order.item_name}</td>
                    <td class="num mono {order.order_type === 'buy' ? 'buy-price' : 'sell-price'}">₡{order.price_each.toLocaleString()}</td>
                    <td class="num mono">{order.quantity}</td>
                    <td class="num mono">{order.remaining}</td>
                    <td>
                      <button class="action-btn cancel-btn" onclick={() => cancelOrder(order.order_id)}>Cancel</button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          {:else}
            <p class="empty-hint">No active orders</p>
          {/if}
        </Content>
      </Card>

      <!-- Create Order -->
      <Card class="space-card">
        <Content>
          <p class="tab-section-title">Create Order</p>

          <div class="type-toggle">
            <button
              class="toggle-btn"
              class:active={orderType === 'buy'}
              onclick={() => (orderType = 'buy')}
            >Buy Order</button>
            <button
              class="toggle-btn"
              class:active={orderType === 'sell'}
              onclick={() => (orderType = 'sell')}
            >Sell Order</button>
          </div>

          <div class="form-fields">
            <div class="autocomplete-wrapper">
              <input
                type="text"
                class="text-input"
                placeholder="Item ID / Name"
                bind:value={orderItemInput}
                onfocus={onInputFocus}
                onblur={onInputBlur}
                oninput={() => { showSuggestions = true; }}
              />
              {#if showSuggestions && suggestions.length > 0}
                <ul class="suggestion-list">
                  {#each suggestions as s}
                    <li>
                      <button class="suggestion-item" onmousedown={() => selectSuggestion(s)}>
                        <span class="suggestion-name">{s.item_name}</span>
                        <span class="suggestion-source">{s.source}</span>
                      </button>
                    </li>
                  {/each}
                </ul>
              {/if}
            </div>
            <div class="num-row">
              <input
                type="number"
                class="text-input num-input"
                placeholder="Price (₡)"
                bind:value={orderPrice}
                min="1"
              />
              <input
                type="number"
                class="text-input num-input"
                placeholder="Quantity"
                bind:value={orderQty}
                min="1"
              />
            </div>
          </div>

          <Button
            variant="raised"
            onclick={createOrder}
            disabled={!orderItemInput.trim() || Number(orderQty) <= 0 || Number(orderPrice) <= 0}
            style="width:100%; margin-top:8px"
          >
            <Label>Create {orderType.toUpperCase()} Order</Label>
          </Button>
        </Content>
      </Card>
    </div>

    <!-- Cargo with memo prices -->
    {#if shipStore.cargo.length > 0}
      <Card class="space-card" style="margin-top:12px">
        <Content>
          <p class="tab-section-title">Cargo</p>
          <table class="market-table">
            <thead>
              <tr>
                <th>Item</th>
                <th class="num">Qty</th>
                <th class="num">Memo Price</th>
              </tr>
            </thead>
            <tbody>
              {#each shipStore.cargo as c}
                <tr>
                  <td>{c.name ?? c.item_id}</td>
                  <td class="num mono">{c.quantity}</td>
                  {@const mp = marketMemoStore.getItemPrice(c.item_id)}
                  <td class="num mono">
                    {#if mp && mp.best_buy > 0}
                      <span class="buy-price">B:₡{mp.best_buy}</span>
                    {/if}
                    {#if mp && mp.best_sell > 0}
                      {#if mp.best_buy > 0} / {/if}
                      <span class="sell-price">S:₡{mp.best_sell}</span>
                    {/if}
                    {#if !mp || (mp.best_buy <= 0 && mp.best_sell <= 0)}
                      <span class="dim">—</span>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </Content>
      </Card>
    {/if}
  {/if}
</div>

<style>
  .trading-layout {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .top-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .btn-icon {
    font-size: 16px;
    vertical-align: middle;
    margin-right: 2px;
  }

  .station-label { font-size: 0.72rem; color: #546e7a; }
  .credits-display { font-size: 0.82rem; color: #ffd700; margin-left: auto; }

  .memo-btn {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    background: rgba(255, 215, 0, 0.08);
    border: 1px solid rgba(255, 215, 0, 0.25);
    color: #ffd700;
    font-size: 0.7rem;
    padding: 4px 10px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .memo-btn:hover { background: rgba(255, 215, 0, 0.16); }

  .memo-saved-hint {
    font-size: 0.62rem;
    color: #546e7a;
  }

  .empty-hint {
    font-size: 0.75rem;
    color: #546e7a;
    text-align: center;
    padding: 18px 0;
  }

  /* --- Market table --- */

  .market-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.73rem;
  }

  .market-table th {
    text-align: left;
    font-size: 0.62rem;
    letter-spacing: 0.08em;
    color: #37474f;
    padding: 4px 6px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    text-transform: uppercase;
  }

  .market-table th.num {
    text-align: right;
  }

  .market-table td {
    padding: 4px 6px;
    color: #90a4ae;
    border-bottom: 1px solid rgba(255,255,255,0.03);
  }

  .num { text-align: right; }
  .mono { font-family: 'Roboto Mono', monospace; }
  .credits { color: #ffd700; }
  .dim { color: #4a6070; font-size: 0.68rem; }
  .buy-price { color: #66bb6a; }
  .sell-price { color: #ff9800; }

  /* Item rows */
  .item-row {
    cursor: pointer;
    transition: background 0.1s;
  }
  .item-row:hover { background: rgba(79, 195, 247, 0.04); }
  .item-row.expanded { background: rgba(79, 195, 247, 0.06); }

  .expand-icon { color: #37474f; padding: 0 2px; }
  .item-name { font-weight: 500; color: #b0bec5; }

  /* Detail rows */
  .detail-row td {
    padding: 0;
    border-bottom: 1px solid rgba(79, 195, 247, 0.08);
  }

  .detail-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    padding: 8px 12px 12px 30px;
  }

  @media (max-width: 600px) { .detail-grid { grid-template-columns: 1fr; } }

  .detail-section {
    background: rgba(0, 0, 0, 0.15);
    border-radius: 4px;
    padding: 6px 8px;
  }

  .detail-title {
    font-size: 0.62rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 4px;
  }
  .sell-label { color: #ff9800; }
  .buy-label { color: #4caf50; }

  .detail-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.7rem;
  }
  .detail-table th {
    text-align: right;
    font-size: 0.58rem;
    color: #37474f;
    padding: 2px 4px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .detail-table td {
    padding: 2px 4px;
    color: #90a4ae;
  }

  .detail-empty {
    font-size: 0.65rem;
    color: #263238;
    text-align: center;
    padding: 6px 0;
  }

  .source-tag {
    font-size: 0.55rem;
    color: #37474f;
    margin-left: 4px;
    font-style: italic;
  }

  /* Action buttons */
  .action-btn {
    background: none;
    border: 1px solid rgba(255,255,255,0.1);
    color: #78909c;
    font-size: 0.65rem;
    padding: 2px 8px;
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .buy-btn { border-color: rgba(76,175,80,0.3); color: #4caf50; }
  .buy-btn:hover { background: rgba(76,175,80,0.1); }

  .sell-btn { border-color: rgba(255,152,0,0.3); color: #ff9800; }
  .sell-btn:hover { background: rgba(255,152,0,0.1); }

  .cancel-btn { border-color: rgba(244,67,54,0.3); color: #ef5350; }
  .cancel-btn:hover { background: rgba(244,67,54,0.1); }

  .order-type-badge {
    font-size: 0.6rem;
    font-family: 'Roboto Mono', monospace;
    padding: 1px 5px;
    border-radius: 2px;
    background: rgba(255,152,0,0.15);
    color: #ff9800;
    border: 1px solid rgba(255,152,0,0.3);
  }
  .order-type-badge.buy {
    background: rgba(76,175,80,0.15);
    color: #4caf50;
    border-color: rgba(76,175,80,0.3);
  }

  /* Bottom grid */
  .bottom-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  @media (max-width: 700px) { .bottom-grid { grid-template-columns: 1fr; } }

  /* Type toggle */
  .type-toggle {
    display: flex;
    gap: 4px;
    margin-bottom: 12px;
  }

  .toggle-btn {
    flex: 1;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    color: #546e7a;
    font-size: 0.75rem;
    padding: 6px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .toggle-btn.active {
    background: rgba(79,195,247,0.12);
    border-color: rgba(79,195,247,0.4);
    color: #4fc3f7;
  }

  /* Form */
  .form-fields {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .num-row {
    display: flex;
    gap: 8px;
  }

  .text-input {
    width: 100%;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.1);
    color: #cfd8dc;
    font-size: 0.78rem;
    padding: 8px 10px;
    border-radius: 4px;
    font-family: 'Roboto', sans-serif;
    outline: none;
    transition: border-color 0.15s;
    box-sizing: border-box;
  }
  .text-input:focus { border-color: rgba(79, 195, 247, 0.5); }
  .text-input::placeholder { color: #37474f; }

  .num-input { flex: 1; }

  /* Autocomplete */
  .autocomplete-wrapper {
    position: relative;
  }

  .suggestion-list {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    z-index: 100;
    background: #0d1525;
    border: 1px solid rgba(79, 195, 247, 0.25);
    border-top: none;
    border-radius: 0 0 4px 4px;
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 200px;
    overflow-y: auto;
  }

  .suggestion-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 6px 10px;
    border: none;
    background: none;
    color: #b0bec5;
    font-size: 0.73rem;
    cursor: pointer;
    text-align: left;
    font-family: 'Roboto', sans-serif;
  }
  .suggestion-item:hover { background: rgba(79, 195, 247, 0.1); }

  .suggestion-name { flex: 1; }
  .suggestion-source {
    font-size: 0.6rem;
    color: #546e7a;
    margin-left: 8px;
    white-space: nowrap;
  }
</style>
