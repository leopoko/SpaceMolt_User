<script lang="ts">
  import Card, { Content } from '@smui/card';
  import { combatStore } from '$lib/stores/combat.svelte';
  import { systemStore } from '$lib/stores/system.svelte';
  import { actionQueueStore } from '$lib/stores/actionQueue.svelte';
  import { ws } from '$lib/services/websocket';

  let expandedTarget = $state<string | null>(null);

  function scanTarget(e: Event, targetId: string, username: string) {
    e.stopPropagation();
    actionQueueStore.enqueue(`Scan ${username}`, () => ws.scan(targetId));
  }

  function attackTarget(e: Event, targetId: string, username: string) {
    e.stopPropagation();
    actionQueueStore.enqueue(`Attack ${username}`, () => ws.attack(targetId));
  }

  function toggleExpand(targetId: string) {
    expandedTarget = expandedTarget === targetId ? null : targetId;
  }

  function formatTick(tick: number): string {
    return `T${tick}`;
  }

  // Merge nearby players: prefer scanResult targets, fallback to systemStore
  let nearbyTargets = $derived(() => {
    if (combatStore.scanResult?.targets?.length) {
      return combatStore.scanResult.targets.map(t => ({
        id: t.id ?? t.player_id ?? '',
        username: t.username,
        ship: t.ship_type ?? t.ship_class ?? '?',
        visible: t.visible !== false,
        in_combat: t.in_combat ?? false,
      }));
    }
    return systemStore.nearbyPlayers.map(p => ({
      id: p.id ?? p.player_id ?? '',
      username: p.username,
      ship: p.ship_type ?? p.ship_class ?? '?',
      visible: true,
      in_combat: p.in_combat ?? false,
    }));
  });
</script>

<div class="two-col">
  <!-- Targets -->
  <Card class="space-card">
    <Content>
      <p class="tab-section-title">Nearby Targets</p>

      {#if nearbyTargets().length > 0}
        <div class="target-list">
          {#each nearbyTargets() as target (target.id)}
            {@const scanData = combatStore.getTargetScan(target.id)}
            <div class="target-row">
              <div
                class="target-item"
                class:expanded={expandedTarget === target.id}
                onclick={() => toggleExpand(target.id)}
                role="button"
                tabindex="0"
                onkeydown={(e) => e.key === 'Enter' && toggleExpand(target.id)}
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
                </div>
              </div>

              <!-- Scan detail panel -->
              {#if expandedTarget === target.id && scanData}
                <div class="scan-detail">
                  <p class="scan-detail-title">
                    <span class="material-icons" style="font-size:14px">info</span>
                    Scan Result
                    {#if !scanData.success}
                      <span class="scan-failed">FAILED</span>
                    {/if}
                  </p>
                  {#if scanData.success}
                    <div class="scan-grid">
                      {#if scanData.username}
                        <span class="scan-label">Name</span>
                        <span class="scan-value">{scanData.username}</span>
                      {/if}
                      {#if scanData.ship_class}
                        <span class="scan-label">Ship</span>
                        <span class="scan-value mono">{scanData.ship_class}</span>
                      {/if}
                      {#if scanData.hull !== undefined}
                        <span class="scan-label">Hull</span>
                        <span class="scan-value hull-val mono">{scanData.hull}</span>
                      {/if}
                      {#if scanData.shield !== undefined}
                        <span class="scan-label">Shield</span>
                        <span class="scan-value shield-val mono">{scanData.shield}</span>
                      {/if}
                      {#if scanData.cloaked !== undefined}
                        <span class="scan-label">Cloaked</span>
                        <span class="scan-value">{scanData.cloaked ? 'Yes' : 'No'}</span>
                      {/if}
                      {#if scanData.faction_id}
                        <span class="scan-label">Faction</span>
                        <span class="scan-value">{scanData.faction_id}</span>
                      {/if}
                    </div>
                    {#if scanData.revealed_info?.length > 0}
                      <div class="revealed-info">
                        <span class="scan-label">Revealed:</span>
                        {#each scanData.revealed_info as info}
                          <span class="revealed-tag">{info}</span>
                        {/each}
                      </div>
                    {/if}
                  {/if}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {:else}
        <p class="empty-hint">No nearby targets detected.</p>
      {/if}

      <!-- Drones from area scan -->
      {#if combatStore.scanResult?.drones?.length}
        <p class="tab-section-title" style="margin-top:12px">Drones</p>
        <div class="target-list">
          {#each combatStore.scanResult.drones as drone}
            <div class="target-row">
              <div class="target-item">
                <div class="target-info">
                  <span class="target-name">{drone.owner_name}'s {drone.type}</span>
                  <span class="hp-bar-text mono">{drone.hull}/{drone.max_hull} HP</span>
                </div>
                <div class="target-actions">
                  <button
                    class="action-btn attack-btn"
                    onclick={() => attackTarget(drone.id, `${drone.owner_name}'s ${drone.type}`)}
                    title="Attack drone"
                  >
                    <span class="material-icons">gps_fixed</span>
                    ATK
                  </button>
                </div>
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

  <!-- Combat Log -->
  <Card class="space-card">
    <Content>
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

<style>
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

  .target-row {
    display: flex;
    flex-direction: column;
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
  .target-item.expanded { border-color: rgba(79,195,247,0.4); background: rgba(79,195,247,0.05); }

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

  .action-btn .material-icons {
    font-size: 13px;
  }

  .scan-btn {
    color: #4fc3f7;
    border-color: rgba(79,195,247,0.3);
  }
  .scan-btn:hover {
    background: rgba(79,195,247,0.12);
    border-color: rgba(79,195,247,0.6);
  }

  .attack-btn {
    color: #ef5350;
    border-color: rgba(244,67,54,0.3);
  }
  .attack-btn:hover {
    background: rgba(244,67,54,0.12);
    border-color: rgba(244,67,54,0.6);
  }

  /* Scan detail panel */
  .scan-detail {
    margin: 0 4px 4px;
    padding: 8px 10px;
    background: rgba(79,195,247,0.04);
    border: 1px solid rgba(79,195,247,0.15);
    border-top: none;
    border-radius: 0 0 4px 4px;
  }

  .scan-detail-title {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.7rem;
    color: #4fc3f7;
    margin-bottom: 6px;
    font-weight: 600;
  }

  .scan-failed {
    color: #f44336;
    font-size: 0.6rem;
    background: rgba(244,67,54,0.15);
    padding: 1px 4px;
    border-radius: 2px;
  }

  .scan-grid {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 2px 12px;
    font-size: 0.72rem;
  }

  .scan-label {
    color: #546e7a;
    font-size: 0.68rem;
  }

  .scan-value {
    color: #b0bec5;
    font-size: 0.72rem;
  }

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

  .hp-bar-text { font-size: 0.68rem; color: #4caf50; }

  .wreck-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    font-size: 0.78rem;
  }

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
    height: 300px;
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
