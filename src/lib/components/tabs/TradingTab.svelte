<script lang="ts">
  import Button, { Label } from '@smui/button';
  import Card, { Content } from '@smui/card';
  import Textfield from '@smui/textfield';
  import { marketStore } from '$lib/stores/market.svelte';
  import { playerStore } from '$lib/stores/player.svelte';
  import { systemStore } from '$lib/stores/system.svelte';
  import { ws } from '$lib/services/websocket';

  // Create order form
  let orderItemId = $state('');
  let orderPrice = $state(0);
  let orderQty = $state(1);
  let orderType = $state<'buy' | 'sell'>('buy');

  // Confirm dialog
  let confirmMsg = $state('');
  let confirmAction = $state<(() => void) | null>(null);

  function loadMarket() {
    const stationId = playerStore.poi_id ?? systemStore.stations[0]?.id;
    if (stationId) {
      ws.viewMarket(stationId);
      ws.viewOrders();
    }
  }

  function createOrder() {
    if (!orderItemId.trim() || orderQty <= 0 || orderPrice <= 0) return;
    if (orderType === 'buy') {
      ws.createBuyOrder(orderItemId, orderQty, orderPrice);
    } else {
      ws.createSellOrder(orderItemId, orderQty, orderPrice);
    }
    orderItemId = '';
    orderPrice = 0;
    orderQty = 1;
  }

  function buyFrom(listing: { item_id: string; quantity: number; price: number }) {
    ws.buy(listing.item_id, listing.quantity, listing.price);
  }

  function sellTo(listing: { item_id: string; quantity: number; price: number }) {
    ws.sell(listing.item_id, listing.quantity, listing.price);
  }

  function cancelOrder(orderId: string) {
    ws.cancelOrder(orderId);
  }
</script>

<div class="trading-layout">
  <!-- Top bar -->
  <div class="top-bar">
    <Button variant="outlined" onclick={loadMarket}>
      <Label>Refresh Market</Label>
    </Button>
    {#if marketStore.data}
      <span class="station-label mono">Station: {marketStore.stationId}</span>
    {/if}
    <span class="credits-display mono">₡ {playerStore.credits.toLocaleString()}</span>
  </div>

  <div class="market-grid">
    <!-- Sell Orders (things for sale, you can buy) -->
    <Card class="space-card">
      <Content>
        <p class="tab-section-title">For Sale (Buy from market)</p>
        {#if marketStore.sellOrders.length > 0}
          <table class="market-table">
            <thead>
              <tr>
                <th>Item</th>
                <th class="num">Price</th>
                <th class="num">Qty</th>
                <th>Seller</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {#each marketStore.sellOrders as order}
                <tr>
                  <td>{order.item_name}</td>
                  <td class="num mono credits">₡{order.price.toLocaleString()}</td>
                  <td class="num mono">{order.quantity}</td>
                  <td class="dim">{order.owner_name}</td>
                  <td>
                    <button class="action-btn buy-btn" onclick={() => buyFrom(order)}>Buy</button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {:else}
          <p class="empty-hint">No sell orders</p>
        {/if}
      </Content>
    </Card>

    <!-- Buy Orders (things wanted, you can sell) -->
    <Card class="space-card">
      <Content>
        <p class="tab-section-title">Wanted (Sell to market)</p>
        {#if marketStore.buyOrders.length > 0}
          <table class="market-table">
            <thead>
              <tr>
                <th>Item</th>
                <th class="num">Price</th>
                <th class="num">Qty</th>
                <th>Buyer</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {#each marketStore.buyOrders as order}
                <tr>
                  <td>{order.item_name}</td>
                  <td class="num mono credits">₡{order.price.toLocaleString()}</td>
                  <td class="num mono">{order.quantity}</td>
                  <td class="dim">{order.owner_name}</td>
                  <td>
                    <button class="action-btn sell-btn" onclick={() => sellTo(order)}>Sell</button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {:else}
          <p class="empty-hint">No buy orders</p>
        {/if}
      </Content>
    </Card>
  </div>

  <!-- My Orders + Create Order -->
  <div class="market-grid" style="margin-top:12px">
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
                <th></th>
              </tr>
            </thead>
            <tbody>
              {#each marketStore.myOrders as order}
                <tr>
                  <td>
                    <span class="order-type-badge" class:buy={order.type === 'buy'}>
                      {order.type.toUpperCase()}
                    </span>
                  </td>
                  <td>{order.item_name}</td>
                  <td class="num mono credits">₡{order.price.toLocaleString()}</td>
                  <td class="num mono">{order.quantity}</td>
                  <td>
                    <button class="action-btn cancel-btn" onclick={() => cancelOrder(order.id)}>Cancel</button>
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
          <Textfield bind:value={orderItemId} label="Item ID / Name" variant="outlined" style="width:100%" />
          <div class="num-row">
            <Textfield
              bind:value={orderPrice}
              type="number"
              label="Price (₡)"
              variant="outlined"
              style="width:48%"
              input$min="1"
            />
            <Textfield
              bind:value={orderQty}
              type="number"
              label="Quantity"
              variant="outlined"
              style="width:48%"
              input$min="1"
            />
          </div>
        </div>

        <Button
          variant="raised"
          onclick={createOrder}
          disabled={!orderItemId.trim() || orderQty <= 0 || orderPrice <= 0}
          style="width:100%; margin-top:8px"
        >
          <Label>Create {orderType.toUpperCase()} Order</Label>
        </Button>
      </Content>
    </Card>
  </div>
</div>

<style>
  .trading-layout {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .top-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
    flex-wrap: wrap;
  }

  .station-label { font-size: 0.72rem; color: #546e7a; }
  .credits-display { font-size: 0.82rem; color: #ffd700; margin-left: auto; }

  .market-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  @media (max-width: 700px) { .market-grid { grid-template-columns: 1fr; } }

  .empty-hint {
    font-size: 0.75rem;
    color: #263238;
    text-align: center;
    padding: 12px 0;
  }

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
    padding: 4px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    text-transform: uppercase;
  }

  .market-table td {
    padding: 4px;
    color: #90a4ae;
    border-bottom: 1px solid rgba(255,255,255,0.03);
  }

  .num { text-align: right; }
  .mono { font-family: 'Roboto Mono', monospace; }
  .credits { color: #ffd700; }
  .dim { color: #4a6070; font-size: 0.68rem; }

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

  .form-fields {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .num-row {
    display: flex;
    gap: 4%;
    justify-content: space-between;
  }
</style>
