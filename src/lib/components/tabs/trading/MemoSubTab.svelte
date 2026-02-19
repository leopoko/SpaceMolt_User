<script lang="ts">
  import Card, { Content } from '@smui/card';
  import { marketMemoStore } from '$lib/stores/marketMemo.svelte';
  import { bookmarkStore } from '$lib/stores/bookmark.svelte';
  import { shipStore } from '$lib/stores/ship.svelte';
  import { baseStore } from '$lib/stores/base.svelte';
  import { uiStore } from '$lib/stores/ui.svelte';
  import type { MarketItem } from '$lib/types/game';

  // Set of item_ids the player owns (cargo + storage)
  let ownedItemIds = $derived.by(() => {
    const ids = new Set<string>();
    for (const c of shipStore.cargo) ids.add(c.item_id);
    for (const s of baseStore.items) ids.add(s.item_id);
    return ids;
  });

  // --- Memo browsing ---
  let selectedMemoStation = $state('');
  let viewingMemo = $derived.by(() => {
    if (!selectedMemoStation) return null;
    return marketMemoStore.getMemo(selectedMemoStation);
  });
  let memoItems = $derived.by(() => {
    const items = viewingMemo?.items ?? [];
    if (!items.length) return items;
    const bm = bookmarkStore.ids;
    const owned = ownedItemIds;
    return [...items].sort((a, b) => {
      const aBm = bm.has(a.item_id) ? 0 : 1;
      const bBm = bm.has(b.item_id) ? 0 : 1;
      if (aBm !== bBm) return aBm - bBm;
      const aOwn = owned.has(a.item_id) ? 0 : 1;
      const bOwn = owned.has(b.item_id) ? 0 : 1;
      return aOwn - bOwn;
    });
  });

  let expandedMemoItems = $state<Set<string>>(new Set());
  function toggleMemoExpand(itemId: string) {
    const next = new Set(expandedMemoItems);
    if (next.has(itemId)) next.delete(itemId);
    else next.add(itemId);
    expandedMemoItems = next;
  }

  function gotoCraftOutput(itemId: string) {
    uiStore.navigateToCrafting(itemId, 'output');
  }

  function gotoCraftInput(itemId: string) {
    uiStore.navigateToCrafting(itemId, 'input');
  }
</script>

<div class="memo-layout">
  <Card class="space-card">
    <Content>
      <p class="tab-section-title">Market Memos</p>
      <p class="hint-text">Browse saved market memos from stations you've visited.</p>
      {#if marketMemoStore.allMemos.length > 0}
        <div class="memo-selector">
          <select class="text-input" bind:value={selectedMemoStation}>
            <option value="">-- Select Station --</option>
            {#each marketMemoStore.allMemos as memo}
              <option value={memo.base}>{memo.base} ({new Date(memo.savedAt).toLocaleDateString()})</option>
            {/each}
          </select>
          {#if selectedMemoStation}
            <button class="action-btn cancel-btn" onclick={() => { marketMemoStore.removeMemo(selectedMemoStation); selectedMemoStation = ''; }} title="Delete this memo">
              <span class="material-icons" style="font-size:12px">delete</span>
            </button>
          {/if}
        </div>

        {#if viewingMemo}
          <p class="memo-info">
            <span class="station-label mono">{viewingMemo.base}</span>
            <span class="memo-saved-hint">Saved {new Date(viewingMemo.savedAt).toLocaleString()}</span>
          </p>
          {#if memoItems.length > 0}
            <table class="market-table">
              <thead>
                <tr>
                  <th style="width:24px"></th>
                  <th style="width:24px"></th>
                  <th>Item</th>
                  <th class="num">Best Buy</th>
                  <th class="num">Best Sell</th>
                  <th class="num">Spread</th>
                </tr>
              </thead>
              <tbody>
                {#each memoItems as item (item.item_id)}
                  {@const isOwned = ownedItemIds.has(item.item_id)}
                  {@const isBookmarked = bookmarkStore.has(item.item_id)}
                  <tr class="item-row" class:expanded={expandedMemoItems.has(item.item_id)} class:owned-row={isOwned} class:bookmarked-row={isBookmarked} onclick={() => toggleMemoExpand(item.item_id)}>
                    <td class="expand-icon">
                      <span class="material-icons" style="font-size:14px">
                        {expandedMemoItems.has(item.item_id) ? 'expand_more' : 'chevron_right'}
                      </span>
                    </td>
                    <td class="bm-cell">
                      <button class="bm-btn" class:active={isBookmarked} onclick={(e) => { e.stopPropagation(); bookmarkStore.toggle(item.item_id); }} title={isBookmarked ? 'Remove bookmark' : 'Bookmark this item'}>
                        <span class="material-icons" style="font-size:14px">{isBookmarked ? 'bookmark' : 'bookmark_border'}</span>
                      </button>
                    </td>
                    <td class="item-name">
                      {item.item_name}
                      {#if isOwned}<span class="owned-badge">OWNED</span>{/if}
                    </td>
                    <td class="num mono buy-price">{item.best_buy > 0 ? `₡${item.best_buy.toLocaleString()}` : '—'}</td>
                    <td class="num mono sell-price">{item.best_sell > 0 ? `₡${item.best_sell.toLocaleString()}` : '—'}</td>
                    <td class="num mono dim">{item.spread != null ? `₡${item.spread.toLocaleString()}` : '—'}</td>
                  </tr>

                  {#if expandedMemoItems.has(item.item_id)}
                    <tr class="detail-row">
                      <td colspan="6">
                        <div class="detail-grid">
                          <div class="detail-section">
                            <p class="detail-title buy-label">Wanted (Sell to)</p>
                            {#if item.buy_orders.length > 0}
                              <table class="detail-table">
                                <thead><tr><th class="num">Price</th><th class="num">Qty</th></tr></thead>
                                <tbody>
                                  {#each item.buy_orders as order}
                                    <tr>
                                      <td class="num mono buy-price">₡{order.price_each.toLocaleString()}</td>
                                      <td class="num mono">{order.quantity}{#if order.source}<span class="source-tag">{order.source}</span>{/if}</td>
                                    </tr>
                                  {/each}
                                </tbody>
                              </table>
                            {:else}
                              <p class="detail-empty">No buy orders</p>
                            {/if}
                          </div>
                          <div class="detail-section">
                            <p class="detail-title sell-label">For Sale (Buy from)</p>
                            {#if item.sell_orders.length > 0}
                              <table class="detail-table">
                                <thead><tr><th class="num">Price</th><th class="num">Qty</th></tr></thead>
                                <tbody>
                                  {#each item.sell_orders as order}
                                    <tr>
                                      <td class="num mono sell-price">₡{order.price_each.toLocaleString()}</td>
                                      <td class="num mono">{order.quantity}{#if order.source}<span class="source-tag">{order.source}</span>{/if}</td>
                                    </tr>
                                  {/each}
                                </tbody>
                              </table>
                            {:else}
                              <p class="detail-empty">No sell orders</p>
                            {/if}
                          </div>
                        </div>
                        <div class="craft-links">
                          <button class="craft-link-btn" onclick={(e) => { e.stopPropagation(); gotoCraftOutput(item.item_id); }} title="Recipes that produce {item.item_name}">
                            <span class="material-icons" style="font-size:13px">precision_manufacturing</span> Craft this
                          </button>
                          <button class="craft-link-btn" onclick={(e) => { e.stopPropagation(); gotoCraftInput(item.item_id); }} title="Recipes that use {item.item_name}">
                            <span class="material-icons" style="font-size:13px">build</span> Use in craft
                          </button>
                        </div>
                      </td>
                    </tr>
                  {/if}
                {/each}
              </tbody>
            </table>
          {:else}
            <p class="empty-hint">No items in this memo.</p>
          {/if}
        {/if}
      {:else}
        <p class="empty-hint">No saved memos. Dock at a station and press Memo to save market data.</p>
      {/if}
    </Content>
  </Card>

  <!-- All item prices across memos -->
  {#if marketMemoStore.allMemos.length > 0}
    <Card class="space-card">
      <Content>
        <p class="tab-section-title">All Item Prices (from Memos)</p>
        {@const allPrices = marketMemoStore.getAllItemPrices()}
        {#if allPrices.length > 0}
          <table class="market-table">
            <thead>
              <tr>
                <th style="width:24px"></th>
                <th>Item</th>
                <th class="num">Best Buy</th>
                <th class="num">Best Sell</th>
                <th>Station</th>
              </tr>
            </thead>
            <tbody>
              {#each allPrices.sort((a, b) => {
                const aBm = bookmarkStore.has(a.item_id) ? 0 : 1;
                const bBm = bookmarkStore.has(b.item_id) ? 0 : 1;
                if (aBm !== bBm) return aBm - bBm;
                return a.item_name.localeCompare(b.item_name);
              }) as info (info.item_id)}
                {@const isBookmarked = bookmarkStore.has(info.item_id)}
                <tr class:bookmarked-row={isBookmarked}>
                  <td class="bm-cell">
                    <button class="bm-btn" class:active={isBookmarked} onclick={() => bookmarkStore.toggle(info.item_id)} title={isBookmarked ? 'Remove bookmark' : 'Bookmark'}>
                      <span class="material-icons" style="font-size:14px">{isBookmarked ? 'bookmark' : 'bookmark_border'}</span>
                    </button>
                  </td>
                  <td class="item-name">{info.item_name}</td>
                  <td class="num mono buy-price">{info.best_buy > 0 ? `₡${info.best_buy.toLocaleString()}` : '—'}</td>
                  <td class="num mono sell-price">{info.best_sell > 0 ? `₡${info.best_sell.toLocaleString()}` : '—'}</td>
                  <td class="station-col mono">{info.station}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {:else}
          <p class="empty-hint">No price data available.</p>
        {/if}
      </Content>
    </Card>
  {/if}
</div>

<style>
  .memo-layout {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .hint-text {
    font-size: 0.72rem;
    color: #78909c;
    margin-bottom: 8px;
  }

  .memo-selector {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .memo-info {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
  }

  .station-label { font-size: 0.72rem; color: #546e7a; }
  .station-col { font-size: 0.62rem; color: #546e7a; }

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

  /* Market table */
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
  .market-table th.num { text-align: right; }

  .market-table td {
    padding: 4px 6px;
    color: #90a4ae;
    border-bottom: 1px solid rgba(255,255,255,0.03);
  }

  .num { text-align: right; }
  .mono { font-family: 'Roboto Mono', monospace; }
  .dim { color: #4a6070; font-size: 0.68rem; }
  .buy-price { color: #66bb6a; }
  .sell-price { color: #ff9800; }

  .item-row {
    cursor: pointer;
    transition: background 0.1s;
  }
  .item-row:hover { background: rgba(79, 195, 247, 0.04); }
  .item-row.expanded { background: rgba(79, 195, 247, 0.06); }

  .item-row.owned-row { background: rgba(255, 215, 0, 0.04); }
  .item-row.owned-row:hover { background: rgba(255, 215, 0, 0.08); }

  .owned-badge {
    font-size: 0.5rem;
    font-family: 'Roboto Mono', monospace;
    color: #ffd700;
    background: rgba(255,215,0,0.12);
    border: 1px solid rgba(255,215,0,0.3);
    border-radius: 2px;
    padding: 0 3px;
    margin-left: 6px;
    vertical-align: middle;
  }

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

  .craft-links {
    display: flex;
    gap: 6px;
    padding: 6px 12px 4px 30px;
  }

  .craft-link-btn {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    background: none;
    border: 1px solid rgba(124,77,255,0.25);
    color: #b388ff;
    font-size: 0.62rem;
    padding: 2px 8px;
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .craft-link-btn:hover { background: rgba(124,77,255,0.1); }

  /* Action buttons */
  .action-btn {
    background: none;
    border: 1px solid rgba(255,255,255,0.1);
    color: #78909c;
    font-size: 0.6rem;
    padding: 1px 6px;
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .cancel-btn { border-color: rgba(244,67,54,0.3); color: #ef5350; }
  .cancel-btn:hover { background: rgba(244,67,54,0.1); }

  /* Bookmark */
  .bm-cell { padding: 0 2px; }
  .bm-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    line-height: 1;
    color: #37474f;
    transition: color 0.15s;
  }
  .bm-btn:hover { color: #4fc3f7; }
  .bm-btn.active { color: #4fc3f7; }

  .bookmarked-row {
    border-left: 2px solid rgba(79,195,247,0.4);
  }
</style>
