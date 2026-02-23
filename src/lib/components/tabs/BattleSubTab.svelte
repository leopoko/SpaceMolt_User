<script lang="ts">
  import Card, { Content } from '@smui/card';
  import { battleStore } from '$lib/stores/battle.svelte';
  import { combatStore } from '$lib/stores/combat.svelte';
  import { connectionStore } from '$lib/stores/connection.svelte';
  import { actionQueueStore } from '$lib/stores/actionQueue.svelte';
  import { playerStore } from '$lib/stores/player.svelte';
  import { shipStore } from '$lib/stores/ship.svelte';
  import { ws } from '$lib/services/websocket';
  import type { BattleZone, BattleStance, BattleParticipant, Module, CargoItem } from '$lib/types/game';

  // ---- Polling: refresh battle status every tick ----
  $effect(() => {
    const tick = connectionStore.tick;
    if (battleStore.inBattle && tick > battleStore.lastPollTick) {
      battleStore.lastPollTick = tick;
      ws.getBattleStatus();
    }
  });

  // ---- Zone labels ----
  const ZONES: BattleZone[] = ['engaged', 'inner', 'mid', 'outer'];
  const zoneLabels: Record<BattleZone, string> = {
    outer: 'Outer',
    mid: 'Mid',
    inner: 'Inner',
    engaged: 'Engaged'
  };
  const zoneIcons: Record<BattleZone, string> = {
    outer: 'radio_button_unchecked',
    mid: 'adjust',
    inner: 'track_changes',
    engaged: 'gps_fixed'
  };

  // ---- Stance config ----
  const stanceConfig: Record<BattleStance, { label: string; icon: string; desc: string; color: string }> = {
    fire:  { label: 'Fire',  icon: 'local_fire_department', desc: '100% dmg dealt / 100% taken', color: '#f44336' },
    evade: { label: 'Evade', icon: 'speed',                 desc: '0% dealt / 50% taken (fuel)', color: '#ff9800' },
    brace: { label: 'Brace', icon: 'shield',                desc: '0% dealt / 25% taken, 2x regen', color: '#2196f3' },
    flee:  { label: 'Flee',  icon: 'directions_run',        desc: '0% dealt / 100% taken, auto-retreat', color: '#9e9e9e' }
  };

  // ---- Derived state ----
  let myZone = $derived(battleStore.myZone);
  let myStance = $derived(battleStore.myStance);
  let mySideId = $derived(battleStore.mySideId);
  let myTargetId = $derived(battleStore.myTargetId);
  let participantsByZone = $derived(battleStore.participantsByZone);

  let enemies = $derived(mySideId !== undefined ? battleStore.getEnemies(mySideId) : []);
  let allies = $derived(mySideId !== undefined ? battleStore.getAllies(mySideId) : []);

  // ---- Can advance/retreat ----
  const zoneOrder: BattleZone[] = ['outer', 'mid', 'inner', 'engaged'];
  let canAdvance = $derived.by(() => {
    if (!myZone) return false;
    const idx = zoneOrder.indexOf(myZone);
    return idx < zoneOrder.length - 1;
  });
  let canRetreat = $derived.by(() => {
    if (!myZone) return false;
    const idx = zoneOrder.indexOf(myZone);
    return idx > 0;
  });

  // ---- Actions ----
  function doAdvance() {
    actionQueueStore.enqueue('Advance', () => ws.battleAdvance(), {
      command: { type: 'battle', params: { action: 'advance' } }
    });
  }

  function doRetreat() {
    actionQueueStore.enqueue('Retreat', () => ws.battleRetreat(), {
      command: { type: 'battle', params: { action: 'retreat' } }
    });
  }

  function doStance(stance: BattleStance) {
    actionQueueStore.enqueue(`Stance: ${stanceConfig[stance].label}`, () => ws.battleStance(stance), {
      command: { type: 'battle', params: { action: 'stance', stance } }
    });
  }

  function doTarget(targetId: string) {
    const target = enemies.find(e => e.player_id === targetId);
    const name = target?.username ?? targetId;
    actionQueueStore.enqueue(`Target: ${name}`, () => ws.battleTarget(targetId), {
      command: { type: 'battle', params: { action: 'target', target_id: targetId } }
    });
  }

  // ---- Helpers ----
  function isMe(p: BattleParticipant): boolean {
    return p.player_id === playerStore.data?.id;
  }

  function chipClass(p: BattleParticipant): string {
    if (isMe(p)) return 'chip-me';
    if (mySideId !== undefined && p.side_id === mySideId) return 'chip-ally';
    return 'chip-enemy';
  }

  // Combat log (latest 10)
  let recentCombatLog = $derived(combatStore.combatLog.slice(0, 10));

  // ---- Weapons & Reload ----
  // Filter installed weapon modules that use ammo
  let weaponModules = $derived.by((): Module[] => {
    return shipStore.moduleData.filter(m => m.type === 'weapon' && m.ammo_type);
  });

  // Find compatible ammo items in cargo for a given ammo_type
  function getCompatibleAmmo(ammoType: string): CargoItem[] {
    return shipStore.cargo.filter(c => {
      if (c.effect?.type === 'ammo' && c.effect?.subtype === ammoType) return true;
      // Fallback: check item_id patterns (e.g., rounds_*, slugs_*, torpedoes_*)
      const id = c.item_id ?? '';
      if (ammoType === 'autocannon' && id.startsWith('rounds_')) return true;
      if (ammoType === 'railgun' && id.startsWith('slugs_')) return true;
      if (ammoType === 'torpedo' && id.startsWith('torpedoes_')) return true;
      return false;
    });
  }

  // State: expanded weapon for ammo selection
  let expandedWeaponId = $state<string | null>(null);

  function toggleWeaponExpand(weaponId: string) {
    expandedWeaponId = expandedWeaponId === weaponId ? null : weaponId;
  }

  function doReload(weapon: Module, ammoItemId: string) {
    const ammoItem = shipStore.cargo.find(c => c.item_id === ammoItemId);
    const ammoName = ammoItem?.name ?? ammoItemId;
    actionQueueStore.enqueue(`Reload: ${weapon.name}`, () => ws.reload(weapon.id, ammoItemId), {
      command: { type: 'reload', params: { weapon_instance_id: weapon.id, ammo_item_id: ammoItemId } }
    });
    expandedWeaponId = null;
  }

  function magazinePercent(weapon: Module): number {
    if (!weapon.magazine_size || weapon.magazine_size <= 0) return 0;
    const current = weapon.magazine_current ?? 0;
    return Math.min((current / weapon.magazine_size) * 100, 100);
  }
</script>

<div class="battle-layout">
  <!-- Left column: Zone visualization -->
  <div class="battle-left">
    <Card class="space-card">
      <Content>
        <div class="section-header">
          <span class="material-icons">map</span>
          <span>Battle Zones</span>
          {#if battleStore.loading}
            <span class="loading-dot">...</span>
          {/if}
        </div>

        <div class="zone-grid">
          {#each ZONES as zone}
            {@const zonePlayers = participantsByZone[zone] ?? []}
            <div class="zone-row" class:zone-active={myZone === zone}>
              <div class="zone-label">
                <span class="material-icons zone-icon">{zoneIcons[zone]}</span>
                <span class="zone-name">{zoneLabels[zone]}</span>
                {#if myZone === zone}
                  <span class="you-badge">YOU</span>
                {/if}
              </div>
              <div class="zone-chips">
                {#each zonePlayers as player}
                  <div
                    class="player-chip {chipClass(player)}"
                    class:is-target={player.player_id === myTargetId}
                    class:is-destroyed={player.is_destroyed}
                    class:is-fleeing={player.is_fleeing}
                    title="{player.username} ({player.ship_class}) — HP:{player.hull_percent}% SH:{player.shield_percent}%"
                  >
                    <span class="chip-name">{isMe(player) ? 'YOU' : player.username}</span>
                    <div class="chip-bars">
                      <div class="chip-bar hull-bar" style="width: {player.hull_percent}%"></div>
                      <div class="chip-bar shield-bar" style="width: {player.shield_percent}%"></div>
                    </div>
                    {#if player.is_fleeing}
                      <span class="chip-badge flee-badge">FLEE</span>
                    {/if}
                    {#if player.is_destroyed}
                      <span class="chip-badge destroyed-badge">DEAD</span>
                    {/if}
                  </div>
                {/each}
                {#if zonePlayers.length === 0}
                  <span class="zone-empty">—</span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </Content>
    </Card>

    <!-- Combat Log -->
    <Card class="space-card">
      <Content>
        <div class="section-header">
          <span class="material-icons">list</span>
          <span>Combat Log</span>
        </div>
        <div class="combat-log-mini">
          {#each recentCombatLog as event}
            <div class="log-entry">
              <span class="log-tick mono">T{event.tick}</span>
              <span class="log-text">
                {event.attacker} → {event.defender}:
                <span class="mono">{event.damage}</span> dmg
                <span class="log-result result-{event.result}">{event.result}</span>
              </span>
            </div>
          {:else}
            <div class="log-empty">No combat events yet</div>
          {/each}
        </div>
      </Content>
    </Card>
  </div>

  <!-- Right column: Controls -->
  <div class="battle-right">
    <!-- Status panel -->
    <Card class="space-card">
      <Content>
        <div class="section-header">
          <span class="material-icons">dashboard</span>
          <span>Status</span>
        </div>
        <div class="status-grid">
          <div class="status-item">
            <span class="status-label">Zone</span>
            <span class="status-value zone-value">{zoneLabels[myZone ?? 'outer']}</span>
          </div>
          <div class="status-item">
            <span class="status-label">Stance</span>
            <span class="status-value" style="color: {stanceConfig[myStance ?? 'fire'].color}">
              {stanceConfig[myStance ?? 'fire'].label}
            </span>
          </div>
          <div class="status-item">
            <span class="status-label">Target</span>
            <span class="status-value">
              {#if myTargetId}
                {@const t = enemies.find(e => e.player_id === myTargetId)}
                {t?.username ?? 'Auto'}
              {:else}
                Auto
              {/if}
            </span>
          </div>
          <div class="status-item">
            <span class="status-label">Allies</span>
            <span class="status-value mono">{allies.length}</span>
          </div>
          <div class="status-item">
            <span class="status-label">Enemies</span>
            <span class="status-value mono">{enemies.length}</span>
          </div>
        </div>
      </Content>
    </Card>

    <!-- Movement -->
    <Card class="space-card">
      <Content>
        <div class="section-header">
          <span class="material-icons">swap_vert</span>
          <span>Movement</span>
        </div>
        <div class="move-buttons">
          <button
            class="action-btn advance-btn"
            disabled={!canAdvance}
            onclick={doAdvance}
          >
            <span class="material-icons">keyboard_arrow_up</span>
            Advance
          </button>
          <button
            class="action-btn retreat-btn"
            disabled={!canRetreat}
            onclick={doRetreat}
          >
            <span class="material-icons">keyboard_arrow_down</span>
            Retreat
          </button>
        </div>
      </Content>
    </Card>

    <!-- Stance -->
    <Card class="space-card">
      <Content>
        <div class="section-header">
          <span class="material-icons">psychology</span>
          <span>Stance</span>
        </div>
        <div class="stance-grid">
          {#each (['fire', 'evade', 'brace', 'flee'] as BattleStance[]) as stance}
            {@const cfg = stanceConfig[stance]}
            <button
              class="stance-btn"
              class:stance-active={myStance === stance}
              style="--stance-color: {cfg.color}"
              onclick={() => doStance(stance)}
            >
              <span class="material-icons">{cfg.icon}</span>
              <span class="stance-label">{cfg.label}</span>
              <span class="stance-desc">{cfg.desc}</span>
            </button>
          {/each}
        </div>
      </Content>
    </Card>

    <!-- Target selection -->
    <Card class="space-card">
      <Content>
        <div class="section-header">
          <span class="material-icons">gps_fixed</span>
          <span>Target</span>
        </div>
        <div class="target-list">
          {#each enemies as enemy}
            <button
              class="target-row"
              class:target-selected={myTargetId === enemy.player_id}
              onclick={() => doTarget(enemy.player_id)}
            >
              <span class="target-name">{enemy.username}</span>
              <span class="target-ship mono">{enemy.ship_class}</span>
              <span class="target-zone">{zoneLabels[enemy.zone]}</span>
              <div class="target-hp">
                <div class="mini-bar hull-bar" style="width: {enemy.hull_percent}%"></div>
                <div class="mini-bar shield-bar" style="width: {enemy.shield_percent}%"></div>
              </div>
            </button>
          {:else}
            <div class="no-targets">No enemies visible</div>
          {/each}
        </div>
      </Content>
    </Card>

    <!-- Weapons / Reload -->
    {#if weaponModules.length > 0}
      <Card class="space-card">
        <Content>
          <div class="section-header">
            <span class="material-icons">local_fire_department</span>
            <span>Weapons</span>
          </div>
          <div class="weapon-list">
            {#each weaponModules as weapon (weapon.id)}
              {@const magPct = magazinePercent(weapon)}
              {@const magCurrent = weapon.magazine_current ?? 0}
              {@const magSize = weapon.magazine_size ?? 0}
              {@const compatAmmo = getCompatibleAmmo(weapon.ammo_type ?? '')}
              {@const isExpanded = expandedWeaponId === weapon.id}
              <div class="weapon-item" class:weapon-empty={magCurrent === 0}>
                <button class="weapon-header" onclick={() => toggleWeaponExpand(weapon.id)}>
                  <div class="weapon-info">
                    <span class="weapon-name">{weapon.name}</span>
                    <span class="weapon-ammo-type mono">{weapon.ammo_type}</span>
                  </div>
                  <div class="weapon-mag">
                    <div class="mag-bar-bg">
                      <div
                        class="mag-bar-fill"
                        class:mag-low={magPct < 25}
                        class:mag-mid={magPct >= 25 && magPct < 60}
                        class:mag-ok={magPct >= 60}
                        style="width: {magPct}%"
                      ></div>
                    </div>
                    <span class="mag-text mono">{magCurrent}/{magSize}</span>
                  </div>
                  <span class="material-icons expand-icon" class:expanded={isExpanded}>
                    expand_more
                  </span>
                </button>

                {#if isExpanded}
                  <div class="ammo-panel">
                    {#if compatAmmo.length > 0}
                      <div class="ammo-list">
                        {#each compatAmmo as ammo (ammo.item_id)}
                          <button
                            class="ammo-row"
                            onclick={() => doReload(weapon, ammo.item_id)}
                          >
                            <span class="ammo-name">{ammo.name ?? ammo.item_id}</span>
                            <span class="ammo-qty mono">×{ammo.quantity}</span>
                            <span class="material-icons reload-icon">refresh</span>
                          </button>
                        {/each}
                      </div>
                    {:else}
                      <div class="no-ammo">
                        <span class="material-icons" style="font-size:14px">warning</span>
                        No compatible ammo in cargo
                      </div>
                    {/if}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </Content>
      </Card>
    {/if}
  </div>
</div>

<style>
  .battle-layout {
    display: grid;
    grid-template-columns: 1fr 320px;
    gap: 12px;
    padding: 8px;
  }

  @media (max-width: 800px) {
    .battle-layout {
      grid-template-columns: 1fr;
    }
  }

  .battle-left, .battle-right {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.85rem;
    font-weight: 600;
    color: #4fc3f7;
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .section-header .material-icons {
    font-size: 18px;
  }

  .loading-dot {
    color: #ff9800;
    margin-left: auto;
    animation: pulse 1s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  /* ---- Zone Grid ---- */
  .zone-grid {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .zone-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 4px;
    border: 1px solid rgba(79, 195, 247, 0.08);
    background: rgba(255, 255, 255, 0.02);
    min-height: 38px;
  }

  .zone-row.zone-active {
    border-color: rgba(79, 195, 247, 0.35);
    background: rgba(79, 195, 247, 0.06);
  }

  .zone-label {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 100px;
    flex-shrink: 0;
  }

  .zone-icon {
    font-size: 16px;
    color: #4fc3f7;
    opacity: 0.7;
  }

  .zone-name {
    font-size: 0.78rem;
    font-weight: 500;
    color: #b0bec5;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .you-badge {
    font-size: 0.6rem;
    font-weight: 700;
    color: #060a10;
    background: #4fc3f7;
    padding: 1px 4px;
    border-radius: 2px;
    letter-spacing: 0.5px;
  }

  .zone-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    flex: 1;
  }

  .zone-empty {
    color: rgba(255, 255, 255, 0.15);
    font-size: 0.75rem;
  }

  /* ---- Player Chips ---- */
  .player-chip {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 3px 6px;
    border-radius: 3px;
    font-size: 0.7rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
    position: relative;
    min-width: 60px;
  }

  .chip-me {
    border-color: #4fc3f7;
    background: rgba(79, 195, 247, 0.12);
  }

  .chip-ally {
    border-color: rgba(76, 175, 80, 0.5);
    background: rgba(76, 175, 80, 0.08);
  }

  .chip-enemy {
    border-color: rgba(244, 67, 54, 0.5);
    background: rgba(244, 67, 54, 0.08);
  }

  .player-chip.is-target {
    box-shadow: 0 0 6px rgba(244, 67, 54, 0.5);
    border-color: #f44336;
  }

  .player-chip.is-destroyed {
    opacity: 0.35;
    text-decoration: line-through;
  }

  .chip-name {
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 80px;
    color: #e0e0e0;
  }

  .chip-bars {
    display: flex;
    flex-direction: column;
    gap: 1px;
    height: 4px;
  }

  .chip-bar {
    height: 2px;
    border-radius: 1px;
    min-width: 1px;
  }

  .hull-bar { background: #4caf50; }
  .shield-bar { background: #2196f3; }

  .chip-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    font-size: 0.5rem;
    font-weight: 700;
    padding: 0 3px;
    border-radius: 2px;
    line-height: 1.3;
  }

  .flee-badge {
    background: #ff9800;
    color: #000;
  }

  .destroyed-badge {
    background: #f44336;
    color: #fff;
  }

  /* ---- Status Grid ---- */
  .status-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
    gap: 8px;
  }

  .status-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .status-label {
    font-size: 0.65rem;
    color: #78909c;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .status-value {
    font-size: 0.85rem;
    font-weight: 600;
    color: #e0e0e0;
  }

  .zone-value {
    color: #4fc3f7;
  }

  /* ---- Movement Buttons ---- */
  .move-buttons {
    display: flex;
    gap: 8px;
  }

  .action-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 8px 12px;
    border: 1px solid rgba(79, 195, 247, 0.25);
    border-radius: 4px;
    background: rgba(79, 195, 247, 0.08);
    color: #4fc3f7;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }

  .action-btn:hover:not(:disabled) {
    background: rgba(79, 195, 247, 0.15);
    border-color: rgba(79, 195, 247, 0.4);
  }

  .action-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .action-btn .material-icons {
    font-size: 18px;
  }

  .advance-btn {
    border-color: rgba(255, 152, 0, 0.3);
    background: rgba(255, 152, 0, 0.08);
    color: #ff9800;
  }

  .advance-btn:hover:not(:disabled) {
    background: rgba(255, 152, 0, 0.15);
    border-color: rgba(255, 152, 0, 0.5);
  }

  .retreat-btn {
    border-color: rgba(33, 150, 243, 0.3);
    background: rgba(33, 150, 243, 0.08);
    color: #2196f3;
  }

  .retreat-btn:hover:not(:disabled) {
    background: rgba(33, 150, 243, 0.15);
    border-color: rgba(33, 150, 243, 0.5);
  }

  /* ---- Stance Grid ---- */
  .stance-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .stance-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 8px 6px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.02);
    color: #b0bec5;
    cursor: pointer;
    transition: all 0.15s;
  }

  .stance-btn:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: var(--stance-color, #4fc3f7);
  }

  .stance-btn.stance-active {
    border-color: var(--stance-color, #4fc3f7);
    background: color-mix(in srgb, var(--stance-color, #4fc3f7) 12%, transparent);
    color: var(--stance-color, #4fc3f7);
  }

  .stance-btn .material-icons {
    font-size: 20px;
  }

  .stance-label {
    font-size: 0.78rem;
    font-weight: 600;
  }

  .stance-desc {
    font-size: 0.58rem;
    color: #78909c;
    text-align: center;
    line-height: 1.2;
  }

  /* ---- Target List ---- */
  .target-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 180px;
    overflow-y: auto;
  }

  .target-row {
    display: grid;
    grid-template-columns: 1fr auto auto 40px;
    gap: 6px;
    align-items: center;
    padding: 5px 8px;
    border: 1px solid rgba(244, 67, 54, 0.12);
    border-radius: 3px;
    background: rgba(244, 67, 54, 0.04);
    color: #e0e0e0;
    cursor: pointer;
    font-size: 0.75rem;
    text-align: left;
    transition: all 0.1s;
  }

  .target-row:hover {
    background: rgba(244, 67, 54, 0.1);
    border-color: rgba(244, 67, 54, 0.3);
  }

  .target-row.target-selected {
    border-color: #f44336;
    background: rgba(244, 67, 54, 0.15);
  }

  .target-name {
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .target-ship {
    font-size: 0.65rem;
    color: #78909c;
  }

  .target-zone {
    font-size: 0.65rem;
    color: #4fc3f7;
  }

  .target-hp {
    display: flex;
    flex-direction: column;
    gap: 1px;
    width: 40px;
  }

  .mini-bar {
    height: 3px;
    border-radius: 1px;
  }

  .no-targets {
    font-size: 0.75rem;
    color: #546e7a;
    text-align: center;
    padding: 12px;
  }

  /* ---- Combat Log Mini ---- */
  .combat-log-mini {
    max-height: 160px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .log-entry {
    display: flex;
    gap: 6px;
    font-size: 0.72rem;
    padding: 2px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  .log-tick {
    color: #546e7a;
    flex-shrink: 0;
    font-size: 0.65rem;
  }

  .log-text {
    color: #b0bec5;
  }

  .log-result {
    font-weight: 600;
    font-size: 0.65rem;
  }

  .result-hit { color: #f44336; }
  .result-miss { color: #78909c; }
  .result-destroyed { color: #ff9800; }

  .log-empty {
    font-size: 0.75rem;
    color: #546e7a;
    text-align: center;
    padding: 12px;
  }

  .mono { font-family: 'Roboto Mono', monospace; }

  /* ---- Weapons / Reload ---- */
  .weapon-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .weapon-item {
    border: 1px solid rgba(255, 152, 0, 0.12);
    border-radius: 4px;
    overflow: hidden;
  }

  .weapon-item.weapon-empty {
    border-color: rgba(244, 67, 54, 0.25);
  }

  .weapon-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    background: rgba(255, 152, 0, 0.04);
    border: none;
    color: #e0e0e0;
    cursor: pointer;
    width: 100%;
    text-align: left;
    font-size: 0.75rem;
    transition: background 0.15s;
  }

  .weapon-header:hover {
    background: rgba(255, 152, 0, 0.08);
  }

  .weapon-empty .weapon-header {
    background: rgba(244, 67, 54, 0.04);
  }

  .weapon-empty .weapon-header:hover {
    background: rgba(244, 67, 54, 0.08);
  }

  .weapon-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    flex: 1;
    min-width: 0;
  }

  .weapon-name {
    font-weight: 600;
    font-size: 0.73rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .weapon-ammo-type {
    font-size: 0.6rem;
    color: #78909c;
    text-transform: uppercase;
  }

  .weapon-mag {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .mag-bar-bg {
    width: 40px;
    height: 6px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 3px;
    overflow: hidden;
  }

  .mag-bar-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.3s;
  }

  .mag-bar-fill.mag-ok { background: #4caf50; }
  .mag-bar-fill.mag-mid { background: #ff9800; }
  .mag-bar-fill.mag-low { background: #f44336; }

  .mag-text {
    font-size: 0.62rem;
    color: #b0bec5;
    min-width: 40px;
    text-align: right;
  }

  .expand-icon {
    font-size: 18px;
    color: #546e7a;
    transition: transform 0.2s;
  }

  .expand-icon.expanded {
    transform: rotate(180deg);
  }

  .ammo-panel {
    padding: 6px 8px;
    background: rgba(0, 0, 0, 0.15);
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }

  .ammo-list {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .ammo-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border: 1px solid rgba(76, 175, 80, 0.15);
    border-radius: 3px;
    background: rgba(76, 175, 80, 0.04);
    color: #e0e0e0;
    cursor: pointer;
    font-size: 0.72rem;
    transition: all 0.15s;
    width: 100%;
    text-align: left;
  }

  .ammo-row:hover {
    background: rgba(76, 175, 80, 0.1);
    border-color: rgba(76, 175, 80, 0.35);
  }

  .ammo-name {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ammo-qty {
    font-size: 0.65rem;
    color: #78909c;
    flex-shrink: 0;
  }

  .reload-icon {
    font-size: 16px;
    color: #4caf50;
    flex-shrink: 0;
  }

  .no-ammo {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.7rem;
    color: #78909c;
    padding: 4px 0;
  }

  .no-ammo .material-icons {
    color: #ff9800;
  }
</style>
