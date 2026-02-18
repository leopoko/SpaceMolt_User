<script lang="ts">
  import Button, { Label } from '@smui/button';
  import Card, { Content } from '@smui/card';
  import { combatStore } from '$lib/stores/combat.svelte';
  import { systemStore } from '$lib/stores/system.svelte';
  import { ws } from '$lib/services/websocket';

  let selectedTarget = $state<string | null>(null);

  function doScan() {
    ws.scan();
  }

  function doAttack() {
    if (selectedTarget) ws.attack(selectedTarget);
  }

  function formatTick(tick: number): string {
    return `T${tick}`;
  }
</script>

<div class="two-col">
  <!-- Targets -->
  <Card class="space-card">
    <Content>
      <div class="section-head">
        <span class="tab-section-title">Nearby Targets</span>
        <Button variant="outlined" dense onclick={doScan}>
          <Label>Scan</Label>
        </Button>
      </div>

      {#if combatStore.scanResult}
        <!-- Players -->
        {#if combatStore.scanResult.targets?.length > 0}
          <p class="tab-section-title">Players</p>
          <div class="target-list">
            {#each combatStore.scanResult.targets as target}
              <div
                class="target-item"
                class:selected={selectedTarget === target.id}
                onclick={() => { selectedTarget = selectedTarget === target.id ? null : target.id; }}
                role="button"
                tabindex="0"
                onkeydown={(e) => e.key === 'Enter' && (selectedTarget = target.id)}
              >
                <div class="target-info">
                  <span class="target-name">{target.username}</span>
                  <span class="target-ship mono">{target.ship_type}</span>
                </div>
                <span class="material-icons target-icon">
                  {target.visible ? 'visibility' : 'visibility_off'}
                </span>
              </div>
            {/each}
          </div>
        {/if}

        <!-- Drones -->
        {#if combatStore.scanResult.drones?.length > 0}
          <p class="tab-section-title" style="margin-top:12px">Drones</p>
          <div class="target-list">
            {#each combatStore.scanResult.drones as drone}
              <div
                class="target-item"
                class:selected={selectedTarget === drone.id}
                onclick={() => { selectedTarget = selectedTarget === drone.id ? null : drone.id; }}
                role="button"
                tabindex="0"
                onkeydown={(e) => e.key === 'Enter' && (selectedTarget = drone.id)}
              >
                <div class="target-info">
                  <span class="target-name">{drone.owner_name}'s {drone.type}</span>
                  <span class="hp-bar-text mono">{drone.hull}/{drone.max_hull} HP</span>
                </div>
              </div>
            {/each}
          </div>
        {/if}

        <!-- Wrecks -->
        {#if combatStore.scanResult.wrecks?.length > 0}
          <p class="tab-section-title" style="margin-top:12px">Wrecks</p>
          {#each combatStore.scanResult.wrecks as wreck}
            <div class="wreck-item">
              <span class="material-icons" style="font-size:14px;color:#546e7a">broken_image</span>
              <span class="target-name">{wreck.ship_type}</span>
              <span class="target-ship mono">{wreck.loot?.length ?? 0} items</span>
            </div>
          {/each}
        {/if}
      {:else}
        <!-- Fallback: show nearby from system data -->
        {#if systemStore.nearbyPlayers.length > 0}
          <div class="target-list">
            {#each systemStore.nearbyPlayers as player}
              <div
                class="target-item"
                class:selected={selectedTarget === player.id}
                onclick={() => { selectedTarget = selectedTarget === player.id ? null : player.id; }}
                role="button"
                tabindex="0"
                onkeydown={(e) => e.key === 'Enter' && (selectedTarget = player.id)}
              >
                <div class="target-info">
                  <span class="target-name">{player.username}</span>
                  <span class="target-ship mono">{player.ship_type}</span>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <p class="empty-hint">No targets. Run a scan first.</p>
        {/if}
      {/if}

      <!-- Attack button -->
      <div style="margin-top:16px">
        <Button
          variant="raised"
          disabled={!selectedTarget}
          onclick={doAttack}
          style="width:100%;--mdc-theme-primary:#f44336;"
        >
          <Label>⚡ Attack Selected Target</Label>
        </Button>
      </div>
    </Content>
  </Card>

  <!-- Combat Log -->
  <Card class="space-card">
    <Content>
      <p class="tab-section-title">Combat Log</p>
      {#if combatStore.inCombat}
        <div class="in-combat-badge">⚔ IN COMBAT</div>
      {/if}
      <div class="combat-log">
        {#each combatStore.combatLog as event, i (i)}
          <div class="combat-entry" class:destroyed={event.result === 'destroyed'}>
            <span class="tick mono">{formatTick(event.tick)}</span>
            <span class="attacker">{event.attacker}</span>
            <span class="arrow">→</span>
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
  .section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

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
  }

  .target-item:hover { background: rgba(255,255,255,0.06); }
  .target-item.selected { border-color: rgba(244,67,54,0.5); background: rgba(244,67,54,0.08); }

  .target-info { display: flex; flex-direction: column; gap: 1px; }
  .target-name { font-size: 0.8rem; color: #b0bec5; }
  .target-ship { font-size: 0.68rem; color: #546e7a; }
  .target-icon { font-size: 16px; color: #37474f; }

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
