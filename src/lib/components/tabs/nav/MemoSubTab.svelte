<script lang="ts">
  import Card, { Content } from '@smui/card';
  import { systemMemoStore } from '$lib/stores/systemMemo.svelte';
  import type { SystemMemo } from '$lib/stores/systemMemo.svelte';

  let selectedSystemId = $state<string | null>(null);

  let selectedMemo = $derived<SystemMemo | null>(
    selectedSystemId ? systemMemoStore.getMemo(selectedSystemId) : null
  );

  const secColor: Record<string, string> = {
    high: '#4caf50', medium: '#ff9800', low: '#f44336', null: '#9c27b0'
  };
  const secLabel: Record<string, string> = {
    high: 'HIGH', medium: 'MEDIUM', low: 'LOW', null: 'UNREGULATED'
  };
  const poiIcons: Record<string, string> = {
    station: 'home', asteroid: 'lens', asteroid_belt: 'lens', gate: 'transit_enterexit',
    wreck: 'broken_image', planet: 'public', anomaly: 'help_outline',
    sun: 'wb_sunny', nebula: 'cloud', gas_cloud: 'cloud_queue', ice_field: 'ac_unit'
  };

  function secDisplay(level: string | null | undefined): { color: string; label: string } {
    const k = (level ?? 'null') as string;
    return {
      color: secColor[k] ?? '#9c27b0',
      label: secLabel[k] ?? k.toUpperCase()
    };
  }

  function navigateTo(systemId: string) {
    if (systemMemoStore.hasMemo(systemId)) {
      selectedSystemId = systemId;
    }
  }

  // Mining stats for the selected memo
  let miningStatsEntries = $derived.by(() => {
    if (!selectedMemo) return [];
    const stats = selectedMemo.miningStats;
    return Object.entries(stats)
      .map(([poiId, s]) => {
        const poiName = selectedMemo!.pois.find(p => p.id === poiId)?.name ?? poiId;
        const items = Object.entries(s.items)
          .map(([name, count]) => ({
            name,
            count,
            pct: s.totalMined > 0 ? (count / s.totalMined * 100) : 0
          }))
          .sort((a, b) => b.count - a.count);
        return { poiId, poiName, items, total: s.totalMined };
      })
      .sort((a, b) => b.total - a.total);
  });
</script>

<div class="memo-browser">
  {#if systemMemoStore.allMemos.length === 0}
    <Card class="space-card">
      <Content>
        <p class="empty-hint">No system memos saved yet. Visit systems and save memos from the Current tab.</p>
      </Content>
    </Card>
  {:else}
    <div class="memo-layout">
      <!-- System list sidebar -->
      <div class="system-list">
        <p class="tab-section-title">Systems ({systemMemoStore.allMemos.length})</p>
        <div class="system-items">
          {#each systemMemoStore.allMemos as memo}
            {@const msec = secDisplay(memo.securityLevel)}
            <button
              class="system-item"
              class:active={selectedSystemId === memo.systemId}
              onclick={() => selectedSystemId = memo.systemId}
            >
              <span class="sys-item-name">{memo.systemName}</span>
              <span class="sys-item-sec" style="color:{msec.color}">{msec.label}</span>
              <span class="sys-item-detail mono">{memo.pois.length} POIs</span>
            </button>
          {/each}
        </div>
      </div>

      <!-- Selected system detail -->
      <div class="system-detail">
        {#if selectedMemo}
          <Card class="space-card">
            <Content>
              <div class="section-head">
                <span class="tab-section-title">System Info</span>
                <button class="delete-btn" onclick={() => { systemMemoStore.removeMemo(selectedMemo!.systemId); selectedSystemId = null; }} title="Delete memo">
                  <span class="material-icons" style="font-size:14px">delete</span>
                </button>
              </div>
              <h2 class="system-name">{selectedMemo.systemName}</h2>
              {@const sys = secDisplay(selectedMemo.securityLevel)}
              <div class="sec-badge" style="color:{sys.color}">
                Security: {sys.label}
              </div>
              {#if selectedMemo.description}
                <p class="sys-desc">{selectedMemo.description}</p>
              {/if}
              <p class="memo-time">Saved: {new Date(selectedMemo.savedAt).toLocaleString()}</p>

              <!-- POIs -->
              <p class="tab-section-title" style="margin-top:12px">Points of Interest</p>
              {#if selectedMemo.pois.length > 0}
                <div class="poi-list">
                  {#each selectedMemo.pois as poi}
                    <div class="poi-item">
                      <span class="material-icons poi-icon">{poiIcons[poi.type] ?? 'place'}</span>
                      <div class="poi-info">
                        <span class="poi-name">{poi.name}</span>
                        <span class="poi-sub">{poi.type}</span>
                      </div>
                    </div>
                  {/each}
                </div>
              {:else}
                <p class="empty-hint">No POIs</p>
              {/if}
            </Content>
          </Card>

          <!-- Connections -->
          <Card class="space-card">
            <Content>
              <p class="tab-section-title">Connections</p>
              {#if selectedMemo.connections.length > 0}
                <div class="connection-list">
                  {#each selectedMemo.connections as conn}
                    {@const csec = secDisplay(conn.security_level)}
                    {@const hasMemo = systemMemoStore.hasMemo(conn.system_id)}
                    <div class="conn-item">
                      <div class="conn-info">
                        <span class="conn-name">
                          {conn.system_name ?? '—'}
                          {#if hasMemo}
                            <span class="memo-chip" title="Memo available">M</span>
                          {/if}
                        </span>
                        {#if conn.security_level != null}
                          <span class="conn-sec" style="color:{csec.color}">{csec.label}</span>
                        {/if}
                        {#if conn.jump_cost != null}
                          <span class="conn-cost mono">Fuel: {conn.jump_cost}</span>
                        {/if}
                      </div>
                      {#if hasMemo}
                        <button class="nav-btn" onclick={() => navigateTo(conn.system_id)}>
                          View
                        </button>
                      {/if}
                    </div>
                  {/each}
                </div>
              {:else}
                <p class="empty-hint">No connections</p>
              {/if}
            </Content>
          </Card>

          <!-- Mining Stats -->
          {#if miningStatsEntries.length > 0}
            <Card class="space-card">
              <Content>
                <div class="section-head">
                  <span class="tab-section-title">Mining Statistics</span>
                  <button class="stats-clear-btn" onclick={() => systemMemoStore.clearMiningStats(selectedMemo!.systemId)} title="Clear mining stats">
                    <span class="material-icons" style="font-size:12px">delete</span> Clear
                  </button>
                </div>
                {#each miningStatsEntries as poi}
                  <div class="stats-poi">
                    <div class="stats-poi-head">
                      <span class="stats-poi-name">{poi.poiName}</span>
                      <span class="stats-poi-total mono">{poi.total} total</span>
                    </div>
                    <div class="stats-items">
                      {#each poi.items as item}
                        <div class="stats-item-row">
                          <div class="stats-item-bar-bg">
                            <div class="stats-item-bar" style="width:{item.pct}%"></div>
                          </div>
                          <span class="stats-item-name">{item.name}</span>
                          <span class="stats-item-count mono">{item.count}</span>
                          <span class="stats-item-pct mono">{item.pct.toFixed(1)}%</span>
                        </div>
                      {/each}
                    </div>
                  </div>
                {/each}
              </Content>
            </Card>
          {/if}
        {:else}
          <Card class="space-card">
            <Content>
              <p class="empty-hint">Select a system from the list to view its memo</p>
            </Content>
          </Card>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .memo-browser {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .memo-layout {
    display: grid;
    grid-template-columns: 200px 1fr;
    gap: 12px;
    align-items: start;
  }

  @media (max-width: 600px) {
    .memo-layout { grid-template-columns: 1fr; }
  }

  .system-list {
    background: var(--space-surface, #0d1525);
    border: 1px solid rgba(79,195,247,0.18);
    border-radius: 6px;
    padding: 8px;
  }

  .system-items {
    display: flex;
    flex-direction: column;
    gap: 3px;
    max-height: 400px;
    overflow-y: auto;
  }

  .system-item {
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: 6px 8px;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.05);
    border-radius: 4px;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s;
    color: inherit;
    font-family: inherit;
  }
  .system-item:hover { background: rgba(255,255,255,0.06); }
  .system-item.active {
    border-color: rgba(79,195,247,0.4);
    background: rgba(79,195,247,0.08);
  }

  .sys-item-name {
    font-size: 0.78rem;
    color: #90caf9;
  }
  .sys-item-sec { font-size: 0.6rem; }
  .sys-item-detail {
    font-size: 0.6rem;
    color: #546e7a;
  }

  .system-detail {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .delete-btn {
    background: none;
    border: none;
    color: #546e7a;
    cursor: pointer;
    padding: 2px;
  }
  .delete-btn:hover { color: #f44336; }

  .system-name {
    font-size: 1.2rem;
    font-weight: 300;
    letter-spacing: 0.05em;
    color: #90caf9;
    margin: 0 0 4px 0;
  }

  .sec-badge {
    font-size: 0.72rem;
    font-family: 'Roboto Mono', monospace;
    margin-bottom: 4px;
  }

  .sys-desc {
    font-size: 0.75rem;
    color: #546e7a;
    margin: 0;
  }

  .memo-time {
    font-size: 0.62rem;
    color: #37474f;
    margin-top: 4px;
  }

  .empty-hint {
    font-size: 0.75rem;
    color: #546e7a;
    text-align: center;
    padding: 12px 0;
  }

  .poi-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .poi-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 8px;
    background: rgba(255,255,255,0.03);
    border-radius: 4px;
    border: 1px solid rgba(255,255,255,0.05);
  }

  .poi-icon {
    font-size: 16px;
    color: #546e7a;
    flex-shrink: 0;
  }

  .poi-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .poi-name {
    font-size: 0.82rem;
    color: #b0bec5;
  }

  .poi-sub {
    font-size: 0.68rem;
    color: #546e7a;
  }

  .connection-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .conn-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 5px 8px;
    background: rgba(255,255,255,0.03);
    border-radius: 4px;
    border: 1px solid rgba(255,255,255,0.05);
  }

  .conn-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .conn-name {
    font-size: 0.82rem;
    color: #b0bec5;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .conn-sec { font-size: 0.68rem; }
  .conn-cost { font-size: 0.68rem; color: #ff9800; }

  .memo-chip {
    font-size: 0.55rem;
    font-family: 'Roboto Mono', monospace;
    font-weight: 700;
    color: #ffd700;
    background: rgba(255,215,0,0.15);
    border: 1px solid rgba(255,215,0,0.3);
    border-radius: 3px;
    padding: 0 3px;
  }

  .nav-btn {
    padding: 3px 10px;
    font-size: 0.68rem;
    font-family: inherit;
    background: none;
    border: 1px solid rgba(79,195,247,0.3);
    border-radius: 4px;
    color: #4fc3f7;
    cursor: pointer;
    transition: all 0.15s;
  }
  .nav-btn:hover { background: rgba(79,195,247,0.1); }

  .mono { font-family: 'Roboto Mono', monospace; }

  /* ---- Mining Stats ---- */

  .stats-clear-btn {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    background: none;
    border: 1px solid rgba(244,67,54,0.2);
    color: #ef5350;
    font-size: 0.6rem;
    font-family: inherit;
    padding: 2px 6px;
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .stats-clear-btn:hover { background: rgba(244,67,54,0.1); }

  .stats-poi {
    margin-bottom: 10px;
  }

  .stats-poi-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  }

  .stats-poi-name {
    font-size: 0.75rem;
    color: #90caf9;
  }

  .stats-poi-total {
    font-size: 0.65rem;
    color: #546e7a;
  }

  .stats-items {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .stats-item-row {
    display: grid;
    grid-template-columns: 1fr auto auto auto;
    align-items: center;
    gap: 6px;
    position: relative;
  }

  .stats-item-bar-bg {
    position: absolute;
    left: 0; top: 0; bottom: 0; right: 0;
    background: rgba(255,255,255,0.02);
    border-radius: 2px;
    overflow: hidden;
    z-index: 0;
  }

  .stats-item-bar {
    height: 100%;
    background: rgba(255,152,0,0.12);
    border-radius: 2px;
    min-width: 0;
  }

  .stats-item-name {
    font-size: 0.7rem;
    color: #b0bec5;
    padding: 2px 4px;
    position: relative;
    z-index: 1;
  }

  .stats-item-count {
    font-size: 0.65rem;
    color: #ff9800;
    position: relative;
    z-index: 1;
  }

  .stats-item-pct {
    font-size: 0.62rem;
    color: #546e7a;
    width: 42px;
    text-align: right;
    position: relative;
    z-index: 1;
  }
</style>
