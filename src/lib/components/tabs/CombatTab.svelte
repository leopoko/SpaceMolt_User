<script lang="ts">
  import Card, { Content } from '@smui/card';
  import { combatStore } from '$lib/stores/combat.svelte';
  import { systemStore } from '$lib/stores/system.svelte';
  import { actionQueueStore } from '$lib/stores/actionQueue.svelte';
  import { ws } from '$lib/services/websocket';
  import { chatStore } from '$lib/stores/chat.svelte';
  import ScavengerSubTab from './ScavengerSubTab.svelte';
  import BattleSubTab from './BattleSubTab.svelte';
  import { battleStore } from '$lib/stores/battle.svelte';

  // ---- Sub-tab state ----
  type SubTab = 'combat' | 'scavenger';
  let activeSubTab = $state<SubTab>('combat');

  // ---- Combat sub-tab state ----
  let selectedTargetId = $state<string | null>(null);
  let filterText = $state('');
  let sortBy = $state<'name' | 'ship' | 'combat'>('name');

  function scanTarget(e: Event, targetId: string, username: string) {
    e.stopPropagation();
    actionQueueStore.enqueue(`Scan ${username}`, () => ws.scan(targetId), {
      command: { type: 'scan', params: { targetId, username } }
    });
  }

  function attackTarget(e: Event, targetId: string, username: string) {
    e.stopPropagation();
    actionQueueStore.enqueue(`Attack ${username}`, () => ws.attack(targetId), {
      command: { type: 'attack', params: { targetId, username } }
    });
  }

  function selectTarget(targetId: string) {
    selectedTargetId = selectedTargetId === targetId ? null : targetId;
  }

  function openPM(e: Event, username: string) {
    e.stopPropagation();
    chatStore.privateTarget = username;
    chatStore.setFilter('private');
  }

  function formatTick(tick: number): string {
    return `T${tick}`;
  }

  interface NearbyTarget {
    id: string;
    username: string;
    ship: string;
    visible: boolean;
    in_combat: boolean;
  }

  // Build raw target list from scan result or system store
  let rawTargets = $derived((): NearbyTarget[] => {
    if (combatStore.scanResult?.targets?.length) {
      return combatStore.scanResult.targets.map(t => ({
        id: t.id ?? t.player_id ?? '',
        username: t.username ?? '???',
        ship: t.ship_type ?? t.ship_class ?? '?',
        visible: t.visible !== false,
        in_combat: t.in_combat ?? false,
      }));
    }
    return systemStore.nearbyPlayers.map(p => ({
      id: p.id ?? p.player_id ?? '',
      username: p.username ?? '???',
      ship: p.ship_type ?? p.ship_class ?? '?',
      visible: true,
      in_combat: p.in_combat ?? false,
    }));
  });

  // Apply filter, sort, and pin selected to top
  let displayTargets = $derived((): NearbyTarget[] => {
    let list = rawTargets();

    // Filter
    if (filterText.trim()) {
      const q = filterText.trim().toLowerCase();
      list = list.filter(t =>
        (t.username ?? '').toLowerCase().includes(q) ||
        (t.ship ?? '').toLowerCase().includes(q)
      );
    }

    // Sort
    list = [...list].sort((a, b) => {
      if (sortBy === 'name') return (a.username ?? '').localeCompare(b.username ?? '');
      if (sortBy === 'ship') return (a.ship ?? '').localeCompare(b.ship ?? '');
      // combat: in_combat first
      return (b.in_combat ? 1 : 0) - (a.in_combat ? 1 : 0);
    });

    // Pin selected to top
    if (selectedTargetId) {
      const idx = list.findIndex(t => t.id === selectedTargetId);
      if (idx > 0) {
        const [selected] = list.splice(idx, 1);
        list.unshift(selected);
      }
    }

    return list;
  });

  // Currently selected target data
  let selectedTarget = $derived((): NearbyTarget | null => {
    if (!selectedTargetId) return null;
    return rawTargets().find(t => t.id === selectedTargetId) ?? null;
  });

  // Scan data for selected target
  let selectedScanData = $derived(() => {
    if (!selectedTargetId) return undefined;
    return combatStore.getTargetScan(selectedTargetId);
  });
</script>

<!-- Sub-tab bar -->
<div class="sub-tab-bar">
  <button
    class="sub-tab-btn"
    class:active={activeSubTab === 'combat'}
    onclick={() => activeSubTab = 'combat'}
  >
    <span class="material-icons">gps_fixed</span>
    <span class="sub-tab-label">Combat</span>
    {#if battleStore.inBattle || combatStore.inCombat}
      <span class="battle-indicator">BATTLE</span>
    {/if}
  </button>
  <button
    class="sub-tab-btn"
    class:active={activeSubTab === 'scavenger'}
    onclick={() => activeSubTab = 'scavenger'}
  >
    <span class="material-icons">broken_image</span>
    <span class="sub-tab-label">Scavenger</span>
  </button>
</div>

{#if activeSubTab === 'combat'}
  {#if battleStore.inBattle || combatStore.inCombat}
    <!-- === Battle Mode: Tactical UI === -->
    <BattleSubTab />
  {:else}
  <!-- === Combat Sub-Tab (original content) === -->
  <div class="two-col">
    <!-- Left: Targets -->
    <Card class="space-card">
      <Content>
        <p class="tab-section-title">Nearby Targets</p>

        <!-- Filter & Sort controls -->
        <div class="controls-row">
          <div class="filter-box">
            <span class="material-icons filter-icon">search</span>
            <input
              type="text"
              class="filter-input"
              placeholder="Filter..."
              bind:value={filterText}
            />
          </div>
          <div class="sort-btns">
            <button class="sort-btn" class:active={sortBy === 'name'} onclick={() => sortBy = 'name'} title="Sort by name">A-Z</button>
            <button class="sort-btn" class:active={sortBy === 'ship'} onclick={() => sortBy = 'ship'} title="Sort by ship">SHIP</button>
            <button class="sort-btn" class:active={sortBy === 'combat'} onclick={() => sortBy = 'combat'} title="Sort by combat status">!</button>
          </div>
        </div>

        {#if displayTargets().length > 0}
          <div class="target-list">
            {#each displayTargets() as target, idx (target.id || `_idx_${idx}`)}
              <div
                class="target-item"
                class:selected={selectedTargetId === target.id}
                onclick={() => selectTarget(target.id)}
                role="button"
                tabindex="0"
                onkeydown={(e) => e.key === 'Enter' && selectTarget(target.id)}
              >
                <div class="target-info">
                  <span class="target-name">
                    {target.username}
                    {#if target.in_combat}
                      <span class="combat-indicator">IN COMBAT</span>
                    {/if}
                  </span>
                  <span class="target-ship mono">{target.ship}</span>
                </div>
                <div class="target-actions">
                  <button
                    class="action-btn scan-btn"
                    onclick={(e) => scanTarget(e, target.id, target.username)}
                    title="Scan {target.username}"
                  >
                    <span class="material-icons">radar</span>
                    SCAN
                  </button>
                  <button
                    class="action-btn attack-btn"
                    onclick={(e) => attackTarget(e, target.id, target.username)}
                    title="Attack {target.username}"
                  >
                    <span class="material-icons">gps_fixed</span>
                    ATK
                  </button>
                  <button
                    class="action-btn pm-btn"
                    onclick={(e) => openPM(e, target.username)}
                    title="PM {target.username}"
                  >
                    <span class="material-icons">mail</span>
                    PM
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {:else if rawTargets().length > 0}
          <p class="empty-hint">No targets match filter.</p>
        {:else}
          <p class="empty-hint">No nearby targets detected.</p>
        {/if}

        <!-- Drones from area scan -->
        {#if combatStore.scanResult?.drones?.length}
          <p class="tab-section-title" style="margin-top:12px">Drones</p>
          <div class="target-list">
            {#each combatStore.scanResult.drones as drone}
              <div class="target-item">
                <div class="target-info">
                  <span class="target-name">{drone.owner_name}'s {drone.type}</span>
                  <span class="hp-bar-text mono">{drone.hull}/{drone.max_hull} HP</span>
                </div>
                <div class="target-actions">
                  <button
                    class="action-btn attack-btn"
                    onclick={(e) => attackTarget(e, drone.id, `${drone.owner_name}'s ${drone.type}`)}
                    title="Attack drone"
                  >
                    <span class="material-icons">gps_fixed</span>
                    ATK
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}

        <!-- Wrecks from area scan -->
        {#if combatStore.scanResult?.wrecks?.length}
          <p class="tab-section-title" style="margin-top:12px">Wrecks</p>
          {#each combatStore.scanResult.wrecks as wreck}
            <div class="wreck-item">
              <span class="material-icons" style="font-size:14px;color:#546e7a">broken_image</span>
              <span class="target-name">{wreck.ship_type}</span>
              <span class="target-ship mono">{wreck.loot?.length ?? 0} items</span>
            </div>
          {/each}
        {/if}
      </Content>
    </Card>

    <!-- Right: Target Detail + Combat Log -->
    <Card class="space-card">
      <Content>
        <!-- Selected Target Detail -->
        {#if selectedTarget()}
          {@const tgt = selectedTarget()}
          {@const scan = selectedScanData}
          <div class="detail-section">
            <div class="detail-header">
              <span class="material-icons" style="font-size:18px;color:#4fc3f7">person</span>
              <span class="detail-title">{tgt.username}</span>
              {#if tgt.in_combat}
                <span class="combat-indicator">IN COMBAT</span>
              {/if}
            </div>
            <div class="detail-grid">
              <span class="detail-label">Ship</span>
              <span class="detail-value mono">{tgt.ship}</span>
              <span class="detail-label">ID</span>
              <span class="detail-value mono id-val">{tgt.id.slice(0, 12)}...</span>
            </div>

            <div class="detail-actions">
              <button class="action-btn-lg scan-btn" onclick={(e) => scanTarget(e, tgt.id, tgt.username)}>
                <span class="material-icons">radar</span> Scan
              </button>
              <button class="action-btn-lg attack-btn" onclick={(e) => attackTarget(e, tgt.id, tgt.username)}>
                <span class="material-icons">gps_fixed</span> Attack
              </button>
            </div>

            <!-- Scan Result -->
            {#if scan}
              <div class="scan-result-panel" class:scan-failed={!scan.success}>
                <div class="scan-result-header">
                  <span class="material-icons" style="font-size:14px">{scan.success ? 'check_circle' : 'cancel'}</span>
                  <span>Scan Result</span>
                  {#if scan.tick}
                    <span class="scan-tick mono">T{scan.tick}</span>
                  {/if}
                  {#if !scan.success}
                    <span class="scan-failed-badge">FAILED</span>
                  {/if}
                </div>

                {#if scan.success}
                  <div class="scan-grid">
                    {#if scan.username}
                      <span class="scan-label">Name</span>
                      <span class="scan-value">{scan.username}</span>
                    {/if}
                    {#if scan.ship_class}
                      <span class="scan-label">Ship</span>
                      <span class="scan-value mono">{scan.ship_class}</span>
                    {/if}
                    {#if scan.hull !== undefined}
                      <span class="scan-label">Hull</span>
                      <span class="scan-value hull-val mono">{scan.hull}</span>
                    {/if}
                    {#if scan.shield !== undefined}
                      <span class="scan-label">Shield</span>
                      <span class="scan-value shield-val mono">{scan.shield}</span>
                    {/if}
                    {#if scan.cloaked !== undefined}
                      <span class="scan-label">Cloaked</span>
                      <span class="scan-value">{scan.cloaked ? 'Yes' : 'No'}</span>
                    {/if}
                    {#if scan.faction_id}
                      <span class="scan-label">Faction</span>
                      <span class="scan-value">{scan.faction_id}</span>
                    {/if}
                  </div>
                  {#if scan.revealed_info?.length}
                    <div class="revealed-info">
                      <span class="scan-label">Revealed:</span>
                      {#each scan.revealed_info as info}
                        <span class="revealed-tag">{info}</span>
                      {/each}
                    </div>
                  {/if}
                {:else}
                  <p class="scan-fail-msg">
                    Scan could not penetrate target defenses. Try improving your scanner module.
                  </p>
                {/if}
              </div>
            {/if}
          </div>
          <div class="section-divider"></div>
        {:else}
          <div class="no-selection">
            <span class="material-icons" style="font-size:24px;color:#263238">ads_click</span>
            <p>Select a target to view details</p>
          </div>
          <div class="section-divider"></div>
        {/if}

        <!-- Combat Log -->
        <p class="tab-section-title">Combat Log</p>
        {#if combatStore.inCombat}
          <div class="in-combat-badge">IN COMBAT</div>
        {/if}
        <div class="combat-log">
          {#each combatStore.combatLog as event, i (i)}
            <div class="combat-entry" class:destroyed={event.result === 'destroyed'}>
              <span class="tick mono">{formatTick(event.tick)}</span>
              <span class="attacker">{event.attacker}</span>
              <span class="arrow">{' -> '}</span>
              <span class="defender">{event.defender}</span>
              <span class="damage mono" class:miss={event.result === 'miss'}>
                {event.result === 'miss' ? 'MISS' : `-${event.damage}`}
              </span>
              {#if event.result === 'destroyed'}
                <span class="destroyed-badge">DESTROYED</span>
              {/if}
            </div>
          {:else}
            <p class="empty-hint">No combat activity</p>
          {/each}
        </div>
      </Content>
    </Card>
  </div>
  {/if}
{:else if activeSubTab === 'scavenger'}
  <!-- === Scavenger Sub-Tab === -->
  <ScavengerSubTab />
{/if}

<style>
  /* ---- Sub-tab bar ---- */
  .sub-tab-bar {
    display: flex;
    gap: 2px;
    margin-bottom: 12px;
    border-bottom: 1px solid rgba(79, 195, 247, 0.12);
    padding-bottom: 0;
  }

  .sub-tab-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 6px 14px;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: #546e7a;
    font-size: 0.75rem;
    font-family: 'Roboto Mono', monospace;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    position: relative;
    bottom: -1px;
  }

  .sub-tab-btn .material-icons { font-size: 14px; }

  .sub-tab-btn:hover {
    color: #90a4ae;
    background: rgba(79, 195, 247, 0.04);
  }

  .sub-tab-btn.active {
    color: #4fc3f7;
    border-bottom-color: #4fc3f7;
  }

  .sub-tab-label { white-space: nowrap; }

  .battle-indicator {
    font-size: 0.55rem;
    font-weight: 700;
    color: #060a10;
    background: #f44336;
    padding: 1px 4px;
    border-radius: 2px;
    letter-spacing: 0.5px;
    animation: battle-pulse 1.5s infinite;
  }

  @keyframes battle-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }

  /* ---- Controls ---- */
  .controls-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
  }

  .filter-box {
    display: flex;
    align-items: center;
    flex: 1;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 3px;
    padding: 0 6px;
  }

  .filter-icon {
    font-size: 14px;
    color: #546e7a;
  }

  .filter-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: #b0bec5;
    font-size: 0.72rem;
    font-family: 'Roboto Mono', monospace;
    padding: 4px 6px;
  }

  .filter-input::placeholder { color: #37474f; }

  .sort-btns {
    display: flex;
    gap: 2px;
  }

  .sort-btn {
    padding: 3px 6px;
    font-size: 0.58rem;
    font-family: 'Roboto Mono', monospace;
    font-weight: 600;
    background: transparent;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 2px;
    color: #546e7a;
    cursor: pointer;
    transition: all 0.15s;
  }

  .sort-btn:hover { color: #b0bec5; border-color: rgba(255,255,255,0.15); }
  .sort-btn.active { color: #4fc3f7; border-color: rgba(79,195,247,0.4); background: rgba(79,195,247,0.08); }

  /* ---- Target list ---- */
  .empty-hint {
    font-size: 0.75rem;
    color: #263238;
    text-align: center;
    padding: 12px 0;
  }

  .target-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .target-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.05);
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s;
    gap: 8px;
  }

  .target-item:hover { background: rgba(255,255,255,0.06); }
  .target-item.selected { border-color: rgba(79,195,247,0.5); background: rgba(79,195,247,0.06); }

  .target-info { display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0; }
  .target-name { font-size: 0.8rem; color: #b0bec5; display: flex; align-items: center; gap: 6px; }
  .target-ship { font-size: 0.68rem; color: #546e7a; }

  .combat-indicator {
    font-size: 0.58rem;
    background: rgba(244,67,54,0.2);
    color: #ef5350;
    padding: 1px 4px;
    border-radius: 2px;
    font-family: 'Roboto Mono', monospace;
  }

  .target-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 3px 6px;
    border: 1px solid;
    border-radius: 3px;
    font-size: 0.6rem;
    font-family: 'Roboto Mono', monospace;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    background: transparent;
    white-space: nowrap;
  }

  .action-btn .material-icons { font-size: 13px; }

  .scan-btn { color: #4fc3f7; border-color: rgba(79,195,247,0.3); }
  .scan-btn:hover { background: rgba(79,195,247,0.12); border-color: rgba(79,195,247,0.6); }

  .attack-btn { color: #ef5350; border-color: rgba(244,67,54,0.3); }
  .attack-btn:hover { background: rgba(244,67,54,0.12); border-color: rgba(244,67,54,0.6); }

  .pm-btn { color: #ef9a9a; border-color: rgba(239,154,154,0.3); }
  .pm-btn:hover { background: rgba(239,154,154,0.12); border-color: rgba(239,154,154,0.6); }

  .hp-bar-text { font-size: 0.68rem; color: #4caf50; }

  .wreck-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    font-size: 0.78rem;
  }

  /* ---- Right panel: Detail ---- */
  .no-selection {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 20px 0;
  }

  .no-selection p {
    font-size: 0.72rem;
    color: #37474f;
  }

  .detail-section {
    margin-bottom: 4px;
  }

  .detail-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
  }

  .detail-title {
    font-size: 0.95rem;
    color: #e0e0e0;
    font-weight: 600;
  }

  .detail-grid {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 3px 12px;
    font-size: 0.75rem;
    margin-bottom: 10px;
  }

  .detail-label { color: #546e7a; font-size: 0.7rem; }
  .detail-value { color: #b0bec5; }
  .id-val { font-size: 0.65rem; color: #455a64; }

  .detail-actions {
    display: flex;
    gap: 6px;
    margin-bottom: 10px;
  }

  .action-btn-lg {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 5px 12px;
    border: 1px solid;
    border-radius: 4px;
    font-size: 0.7rem;
    font-family: 'Roboto Mono', monospace;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    background: transparent;
    flex: 1;
    justify-content: center;
  }

  .action-btn-lg .material-icons { font-size: 15px; }
  .action-btn-lg.scan-btn { color: #4fc3f7; border-color: rgba(79,195,247,0.4); }
  .action-btn-lg.scan-btn:hover { background: rgba(79,195,247,0.12); }
  .action-btn-lg.attack-btn { color: #ef5350; border-color: rgba(244,67,54,0.4); }
  .action-btn-lg.attack-btn:hover { background: rgba(244,67,54,0.12); }

  /* ---- Scan result panel ---- */
  .scan-result-panel {
    padding: 8px 10px;
    background: rgba(79,195,247,0.04);
    border: 1px solid rgba(79,195,247,0.15);
    border-radius: 4px;
  }

  .scan-result-panel.scan-failed {
    background: rgba(244,67,54,0.04);
    border-color: rgba(244,67,54,0.2);
  }

  .scan-result-header {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.72rem;
    color: #4fc3f7;
    font-weight: 600;
    margin-bottom: 6px;
  }

  .scan-result-panel.scan-failed .scan-result-header { color: #ef5350; }

  .scan-tick {
    font-size: 0.6rem;
    color: #455a64;
    margin-left: auto;
  }

  .scan-failed-badge {
    font-size: 0.6rem;
    background: rgba(244,67,54,0.2);
    color: #ef5350;
    padding: 1px 4px;
    border-radius: 2px;
  }

  .scan-grid {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 2px 12px;
    font-size: 0.72rem;
  }

  .scan-label { color: #546e7a; font-size: 0.68rem; }
  .scan-value { color: #b0bec5; font-size: 0.72rem; }
  .hull-val { color: #4caf50; }
  .shield-val { color: #2196f3; }

  .revealed-info {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    margin-top: 6px;
  }

  .revealed-tag {
    font-size: 0.6rem;
    background: rgba(79,195,247,0.1);
    color: #4fc3f7;
    padding: 1px 5px;
    border-radius: 2px;
    font-family: 'Roboto Mono', monospace;
  }

  .scan-fail-msg {
    font-size: 0.7rem;
    color: #78909c;
    margin: 4px 0 0;
  }

  .section-divider {
    border-bottom: 1px solid rgba(255,255,255,0.05);
    margin: 10px 0;
  }

  /* ---- Combat Log ---- */
  .in-combat-badge {
    background: rgba(244,67,54,0.15);
    border: 1px solid rgba(244,67,54,0.4);
    color: #ef5350;
    font-size: 0.72rem;
    font-family: 'Roboto Mono', monospace;
    text-align: center;
    padding: 4px;
    border-radius: 4px;
    margin-bottom: 8px;
    animation: pulse 1s infinite;
  }

  @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }

  .combat-log {
    max-height: 250px;
    overflow-y: auto;
  }

  .combat-entry {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.72rem;
    padding: 3px 0;
    border-bottom: 1px solid rgba(255,255,255,0.03);
    flex-wrap: wrap;
  }

  .combat-entry.destroyed { background: rgba(244,67,54,0.05); }

  .tick { color: #37474f; font-size: 0.65rem; }
  .attacker { color: #ef5350; }
  .arrow { color: #37474f; }
  .defender { color: #90caf9; }
  .damage { color: #ff7043; font-weight: 500; }
  .damage.miss { color: #546e7a; }

  .destroyed-badge {
    font-size: 0.6rem;
    background: rgba(244,67,54,0.2);
    color: #ef5350;
    border-radius: 2px;
    padding: 1px 4px;
    font-family: 'Roboto Mono', monospace;
  }

  .mono { font-family: 'Roboto Mono', monospace; }
</style>
