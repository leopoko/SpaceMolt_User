<script lang="ts">
  import Card, { Content } from '@smui/card';
  import { storageMemoStore } from '$lib/stores/storageMemo.svelte';
  import { bookmarkStore } from '$lib/stores/bookmark.svelte';
  import { marketMemoStore } from '$lib/stores/marketMemo.svelte';

  let selectedStation = $state('');
  let viewingMemo = $derived.by(() => {
    if (!selectedStation) return null;
    return storageMemoStore.getMemo(selectedStation);
  });

  function formatFacility(id: string): string {
    return id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
</script>

<div class="memo-layout">
  <Card class="space-card">
    <Content>
      <p class="tab-section-title">Storage Memos</p>
      <p class="hint-text">Browse saved storage snapshots from stations you've visited.</p>
      {#if storageMemoStore.allMemos.length > 0}
        <div class="memo-selector">
          <select class="text-input" bind:value={selectedStation}>
            <option value="">-- Select Station --</option>
            {#each storageMemoStore.allMemos as memo}
              <option value={memo.base}>{memo.base} ({new Date(memo.savedAt).toLocaleDateString()})</option>
            {/each}
          </select>
          {#if selectedStation}
            <button class="action-btn cancel-btn" onclick={() => { storageMemoStore.removeMemo(selectedStation); selectedStation = ''; }} title="Delete this memo">
              <span class="material-icons" style="font-size:12px">delete</span>
            </button>
          {/if}
        </div>

        {#if viewingMemo}
          <div class="memo-header">
            <span class="station-name">{viewingMemo.base}</span>
            <span class="memo-date">Saved {new Date(viewingMemo.savedAt).toLocaleString()}</span>
          </div>

          <!-- Capacity -->
          {#if viewingMemo.capacity != null}
            <div class="capacity-row">
              <span class="cap-label">Storage:</span>
              <span class="mono cap-val">{viewingMemo.capacityUsed ?? 0} / {viewingMemo.capacity} m³</span>
              <span class="mono credits-val">₡ {viewingMemo.credits.toLocaleString()}</span>
            </div>
          {/if}

          <!-- Services -->
          {#if viewingMemo.services && viewingMemo.services.length > 0}
            <p class="sub-title">Services</p>
            <div class="chip-list">
              {#each viewingMemo.services as svc}
                <span class="service-chip">{svc}</span>
              {/each}
            </div>
          {/if}

          <!-- Facilities -->
          {#if viewingMemo.facilities && viewingMemo.facilities.length > 0}
            <p class="sub-title">Facilities</p>
            <div class="chip-list">
              {#each viewingMemo.facilities as fac}
                <span class="facility-chip">{formatFacility(fac)}</span>
              {/each}
            </div>
          {/if}

          <!-- Stored Items -->
          {#if viewingMemo.items.length > 0}
            <p class="sub-title">Stored Items</p>
            <table class="storage-table">
              <thead>
                <tr>
                  <th style="width:24px"></th>
                  <th>Item</th>
                  <th class="num">Qty</th>
                  <th class="num">Memo Price</th>
                </tr>
              </thead>
              <tbody>
                {#each viewingMemo.items as item}
                  {@const isBookmarked = bookmarkStore.has(item.item_id)}
                  {@const mp = marketMemoStore.getItemPrice(item.item_id)}
                  <tr class:bookmarked-row={isBookmarked}>
                    <td class="bm-cell">
                      <button class="bm-btn" class:active={isBookmarked} onclick={() => bookmarkStore.toggle(item.item_id)} title={isBookmarked ? 'Remove bookmark' : 'Bookmark'}>
                        <span class="material-icons" style="font-size:14px">{isBookmarked ? 'bookmark' : 'bookmark_border'}</span>
                      </button>
                    </td>
                    <td>{item.name ?? item.item_id}</td>
                    <td class="num mono">{item.quantity}</td>
                    <td class="num mono">
                      {#if mp && mp.best_buy > 0}
                        <span class="buy-price">B:₡{mp.best_buy}</span>
                      {/if}
                      {#if mp && mp.best_sell > 0}
                        {#if mp && mp.best_buy > 0} / {/if}
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
          {:else}
            <p class="empty-hint">No items stored at this station.</p>
          {/if}
        {/if}
      {:else}
        <p class="empty-hint">No saved storage memos. Dock at a station and press Memo to save a storage snapshot.</p>
      {/if}
    </Content>
  </Card>

  <!-- Overview: all stations at a glance -->
  {#if storageMemoStore.allMemos.length > 1}
    <Card class="space-card">
      <Content>
        <p class="tab-section-title">All Stations Overview</p>
        <table class="storage-table">
          <thead>
            <tr>
              <th>Station</th>
              <th class="num">Items</th>
              <th class="num">Credits</th>
              <th class="num">Saved</th>
            </tr>
          </thead>
          <tbody>
            {#each storageMemoStore.allMemos as memo}
              <tr class="clickable-row" onclick={() => (selectedStation = memo.base)}>
                <td class="station-cell">{memo.base}</td>
                <td class="num mono">{memo.items.length}</td>
                <td class="num mono credits-val">₡{memo.credits.toLocaleString()}</td>
                <td class="num memo-date">{new Date(memo.savedAt).toLocaleDateString()}</td>
              </tr>
            {/each}
          </tbody>
        </table>
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

  .memo-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
  }

  .station-name {
    font-size: 0.85rem;
    color: #90caf9;
    font-weight: 300;
  }

  .memo-date {
    font-size: 0.62rem;
    color: #546e7a;
  }

  .capacity-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px 8px;
    background: rgba(255,255,255,0.02);
    border-radius: 4px;
    margin-bottom: 8px;
  }

  .cap-label {
    font-size: 0.72rem;
    color: #78909c;
  }

  .cap-val {
    font-size: 0.72rem;
    color: #ff9800;
  }

  .credits-val {
    color: #ffd700;
    font-size: 0.72rem;
  }

  .sub-title {
    font-size: 0.68rem;
    font-weight: 600;
    color: #546e7a;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 8px 0 4px;
  }

  .chip-list {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 4px;
  }

  .service-chip {
    font-size: 0.6rem;
    padding: 2px 7px;
    background: rgba(79,195,247,0.1);
    border: 1px solid rgba(79,195,247,0.25);
    border-radius: 10px;
    color: #4fc3f7;
    text-transform: capitalize;
  }

  .facility-chip {
    font-size: 0.6rem;
    padding: 2px 7px;
    background: rgba(255,152,0,0.08);
    border: 1px solid rgba(255,152,0,0.2);
    border-radius: 10px;
    color: #ff9800;
  }

  .empty-hint {
    font-size: 0.75rem;
    color: #546e7a;
    text-align: center;
    padding: 18px 0;
  }

  /* Table */
  .storage-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.73rem;
  }

  .storage-table th {
    text-align: left;
    font-size: 0.62rem;
    letter-spacing: 0.08em;
    color: #37474f;
    padding: 4px 6px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    text-transform: uppercase;
  }
  .storage-table th.num { text-align: right; }

  .storage-table td {
    padding: 4px 6px;
    color: #90a4ae;
    border-bottom: 1px solid rgba(255,255,255,0.03);
  }

  .num { text-align: right; }
  .mono { font-family: 'Roboto Mono', monospace; }
  .dim { color: #4a6070; font-size: 0.68rem; }
  .buy-price { color: #66bb6a; }
  .sell-price { color: #ff9800; }

  .station-cell {
    font-weight: 500;
    color: #b0bec5;
  }

  .clickable-row {
    cursor: pointer;
    transition: background 0.1s;
  }
  .clickable-row:hover { background: rgba(79,195,247,0.05); }

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
</style>
