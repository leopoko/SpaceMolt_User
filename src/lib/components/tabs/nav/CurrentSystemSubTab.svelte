<script lang="ts">
  import { onMount } from 'svelte';
  import Button, { Label } from '@smui/button';
  import Card, { Content } from '@smui/card';
  import { systemStore } from '$lib/stores/system.svelte';
  import { playerStore } from '$lib/stores/player.svelte';
  import { ws } from '$lib/services/websocket';
  import { actionQueueStore } from '$lib/stores/actionQueue.svelte';
  import { systemMemoStore } from '$lib/stores/systemMemo.svelte';
  import { eventsStore } from '$lib/stores/events.svelte';
  import SystemMap from '$lib/components/SystemMap.svelte';
  import { chatStore } from '$lib/stores/chat.svelte';

  let nearbyOpen = $state(false);

  // ---- Recording mode: virtual system tracking ----
  let recordingVirtualSystemId = $derived.by(() => {
    if (!actionQueueStore.recordingMode) return null;
    let virtualId: string | null = null;
    const cur = actionQueueStore.currentAction;
    if (cur) {
      const jumpMatch = cur.match(/^Jump → (.+)$/);
      if (jumpMatch) {
        for (const conn of systemStore.connections) {
          if (conn.system_name === jumpMatch[1]) {
            virtualId = conn.system_id;
            break;
          }
        }
      }
    }
    for (const item of actionQueueStore.items) {
      const cmd = actionQueueStore.getCommand(item.id);
      if (cmd?.type === 'jump' && cmd.params?.systemId) {
        virtualId = cmd.params.systemId as string;
      }
    }
    return virtualId;
  });

  let virtualMemo = $derived(
    recordingVirtualSystemId ? systemMemoStore.getMemo(recordingVirtualSystemId) : null
  );

  let isVirtualSystem = $derived(
    actionQueueStore.recordingMode && recordingVirtualSystemId != null && virtualMemo != null
  );

  let displaySystemName = $derived(
    isVirtualSystem ? (virtualMemo?.systemName ?? 'Unknown') : systemStore.name
  );
  let displaySecurityLevel = $derived(
    isVirtualSystem ? (virtualMemo?.securityLevel ?? 'null') : systemStore.securityLevel
  );
  let displayDescription = $derived(
    isVirtualSystem ? (virtualMemo?.description ?? '') : (systemStore.data?.description ?? '')
  );
  let displayPois = $derived(
    isVirtualSystem
      ? (virtualMemo?.pois ?? []).map(p => ({ ...p, player_count: 0, base: null }))
      : systemStore.pois
  );
  let displayConnections = $derived(
    isVirtualSystem
      ? (virtualMemo?.connections ?? [])
      : systemStore.connections
  );
  let hasSystemData = $derived(
    isVirtualSystem ? virtualMemo != null : systemStore.data != null
  );

  let effectivelyDocked = $derived.by(() => {
    let docked = playerStore.isDocked;
    const cur = actionQueueStore.currentAction;
    if (cur === 'Undock') docked = false;
    else if (cur?.startsWith('Dock @')) docked = true;
    for (const item of actionQueueStore.items) {
      if (item.label === 'Undock') docked = false;
      else if (item.label.startsWith('Dock @')) docked = true;
    }
    return docked;
  });

  let effectivePoiId = $derived.by(() => {
    let poiId = playerStore.poi_id;
    const cur = actionQueueStore.currentAction;
    if (cur) {
      for (const poi of displayPois) {
        if (cur === `Travel → ${poi.name}`) {
          poiId = poi.id;
          break;
        }
      }
    }
    for (const item of actionQueueStore.items) {
      for (const poi of displayPois) {
        if (item.label === `Travel → ${poi.name}`) {
          poiId = poi.id;
          break;
        }
      }
    }
    return poiId;
  });

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

  function doJump(systemId: string, systemName: string) {
    actionQueueStore.enqueue(`Jump → ${systemName}`, () => ws.jump(systemId, systemName), {
      command: { type: 'jump', params: { systemId, systemName } }
    });
  }

  function doTravel(poiId: string, poiName: string) {
    actionQueueStore.enqueue(`Travel → ${poiName}`, () => ws.travel(poiId), {
      command: { type: 'travel', params: { poiId, poiName } }
    });
  }

  function doDock(stationId: string, stationName: string) {
    actionQueueStore.enqueue(`Dock @ ${stationName}`, () => ws.dock(stationId), {
      command: { type: 'dock', params: { stationId, stationName } }
    });
  }

  function doUndock() {
    actionQueueStore.enqueue('Undock', () => ws.undock(), {
      command: { type: 'undock' }
    });
  }

  function doSurvey() {
    actionQueueStore.enqueue('Survey System', () => ws.surveySystem(), {
      command: { type: 'survey_system' }
    });
  }

  function saveMemo() {
    systemMemoStore.save(systemStore.data);
    eventsStore.add({ type: 'info', message: `[Memo] System memo saved: ${systemStore.name}` });
  }

  let currentMemo = $derived(
    systemStore.data?.id ? systemMemoStore.getMemo(systemStore.data.id) : null
  );

  function openPM(username: string) {
    chatStore.privateTarget = username;
    chatStore.setFilter('private');
  }

  function refresh() {
    ws.getSystem();
  }

  onMount(() => {
    ws.getSystem();
  });
</script>

<div class="nav-outer">
  <div class="nav-grid">
    <!-- Current System Info + Points of Interest -->
    <Card class="space-card">
      <Content>
        <div class="section-head">
          <span class="tab-section-title">
            {isVirtualSystem ? 'Virtual System (Memo)' : 'Current System'}
          </span>
          <div class="head-buttons">
            {#if !isVirtualSystem}
              <button class="svc-btn survey-btn" onclick={doSurvey} title="Survey system for hidden POIs">
                <span class="material-icons" style="font-size:14px">radar</span> Survey
              </button>
              <button class="svc-btn memo-save-btn" onclick={saveMemo} title="Save system memo">
                <span class="material-icons" style="font-size:14px">bookmark</span> Memo
              </button>
              {#if currentMemo}
                <span class="memo-saved-hint">
                  Saved {new Date(currentMemo.savedAt).toLocaleTimeString()}
                </span>
              {/if}
            {/if}
            <button class="icon-btn" onclick={refresh} title="Refresh">↻</button>
          </div>
        </div>

        {#if isVirtualSystem}
          <div class="virtual-banner">
            <span class="material-icons" style="font-size:14px">memory</span>
            メモデータで表示中 — 録画モード
          </div>
        {/if}

        {#if hasSystemData}
          <h2 class="system-name">{displaySystemName}</h2>
          {@const sys = secDisplay(displaySecurityLevel)}
          <div class="sec-badge" style="color:{sys.color}">
            Security: {sys.label}
          </div>
          {#if displayDescription}
            <p class="sys-desc">{displayDescription}</p>
          {/if}

          <p class="tab-section-title" style="margin-top:12px">Points of Interest</p>
          {#if displayPois.length > 0}
            <div class="poi-list">
              {#each displayPois as poi}
                {@const isHere = !isVirtualSystem && playerStore.poi_id === poi.id}
                {@const isTravDest = !isVirtualSystem && systemStore.travel.in_progress && systemStore.travel.destination_id === poi.id}
                <div class="poi-item" class:poi-current={isHere} class:poi-traveling={isTravDest}>
                  <div class="poi-left">
                    <span class="material-icons poi-icon">{poiIcons[poi.type] ?? 'place'}</span>
                    <div class="poi-info">
                      <span class="poi-name">
                        {poi.name}
                        {#if isHere && playerStore.isDocked}<span class="here-chip">DOCKED</span>
                        {:else if isHere}<span class="here-chip here-chip-active">HERE</span>
                        {/if}
                        {#if isTravDest}<span class="dest-chip">▶</span>{/if}
                      </span>
                      <span class="poi-sub">{poi.type}{#if !isVirtualSystem} · {poi.player_count ?? 0} online{/if}</span>
                    </div>
                  </div>
                  <div class="poi-btns">
                    {#if isHere && playerStore.isDocked && effectivelyDocked}
                      <Button variant="outlined" dense onclick={doUndock}>
                        <Label>Undock</Label>
                      </Button>
                    {:else}
                      <Button
                        variant="outlined"
                        dense
                        disabled={!isVirtualSystem && effectivelyDocked}
                        onclick={() => doTravel(poi.id, poi.name)}
                      >
                        <Label>Travel</Label>
                      </Button>
                      {#if poi.type === 'station'}
                        <Button
                          variant="outlined"
                          dense
                          disabled={!isVirtualSystem && (effectivelyDocked || effectivePoiId !== poi.id)}
                          onclick={() => doDock(poi.id, poi.name)}
                        >
                          <Label>Dock</Label>
                        </Button>
                      {/if}
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <p class="empty-hint">No POIs found</p>
          {/if}
        {:else}
          <p class="empty-hint">No system data. Click Refresh.</p>
        {/if}
      </Content>
    </Card>

    <!-- Right column: Jump Destinations + System Map -->
    <div class="right-col">
      <Card class="space-card">
        <Content>
          <p class="tab-section-title">Jump Destinations</p>
          {#if displayConnections.length > 0}
            <div class="connection-list">
              {#each displayConnections as conn}
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
                    {#if conn.distance != null}
                      <span class="conn-cost mono">Distance: {conn.distance}</span>
                    {/if}
                  </div>
                  <Button
                    variant="outlined"
                    dense
                    disabled={
                      (!isVirtualSystem && effectivelyDocked) ||
                      (actionQueueStore.recordingMode && !hasMemo)
                    }
                    onclick={() => doJump(conn.system_id, conn.system_name)}
                  >
                    <Label>
                      {#if actionQueueStore.recordingMode && !hasMemo}
                        No Memo
                      {:else}
                        Jump
                      {/if}
                    </Label>
                  </Button>
                </div>
              {/each}
            </div>
          {:else}
            <p class="empty-hint">No connections available</p>
          {/if}

          {#if !isVirtualSystem && systemStore.travel.in_progress}
            <div class="traveling-notice">
              ► {systemStore.travel.type === 'jump' ? 'Jumping to' : 'Traveling to'} {systemStore.travel.destination_name ?? '...'}
              {#if systemStore.travel.arrival_tick !== null}
                <br/>ETA: Tick {systemStore.travel.arrival_tick}
              {/if}
            </div>
          {/if}
        </Content>
      </Card>

      {#if !isVirtualSystem && systemStore.data && systemStore.pois.length > 0}
        <div class="map-section">
          <p class="tab-section-title" style="margin:0">System Map</p>
          <div class="map-wrap">
            <SystemMap pois={systemStore.pois} />
          </div>
        </div>
      {/if}
    </div>
  </div>

  <!-- Nearby Players -->
  {#if !isVirtualSystem && systemStore.nearbyPlayers.length > 0}
    <div class="nearby-section">
      <button class="nearby-toggle" onclick={() => nearbyOpen = !nearbyOpen}>
        <span class="material-icons nearby-arrow" class:nearby-arrow-open={nearbyOpen}>expand_more</span>
        <span class="tab-section-title" style="margin:0">Nearby Players ({systemStore.nearbyPlayers.length})</span>
      </button>
      {#if nearbyOpen}
        <div class="player-list">
          {#each systemStore.nearbyPlayers as np}
            <div class="player-item">
              <span class="material-icons" style="font-size:14px;color:{np.in_combat ? '#ff7043' : '#78909c'}"
              >{np.in_combat ? 'local_fire_department' : 'person'}</span>
              <span class="player-name">{np.username}</span>
              <span class="player-ship mono">{np.ship_class ?? np.ship_type ?? '?'}</span>
              <button class="pm-btn" onclick={() => openPM(np.username)} title="Send PM to {np.username}">
                <span class="material-icons" style="font-size:13px">mail</span>
              </button>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .nav-outer {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .nav-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    align-items: stretch;
  }

  .right-col {
    display: flex;
    flex-direction: column;
    gap: 12px;
    height: 100%;
  }

  .map-section {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: var(--space-surface, #0d1525);
    border: 1px solid rgba(79,195,247,0.18);
    border-radius: 6px;
    padding: 8px 12px 12px;
  }

  .map-wrap {
    flex: 1;
    min-height: 0;
  }

  .nearby-section {
    background: var(--space-surface, #0d1525);
    border: 1px solid rgba(79,195,247,0.18);
    border-radius: 6px;
    padding: 4px 12px 8px;
  }

  @media (max-width: 600px) {
    .nav-grid { grid-template-columns: 1fr; }
  }

  .section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
    gap: 6px;
  }

  .head-buttons {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .icon-btn {
    background: none;
    border: none;
    color: #546e7a;
    cursor: pointer;
    font-size: 1rem;
    padding: 2px 4px;
  }
  .icon-btn:hover { color: #90caf9; }

  .svc-btn {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 3px 8px;
    font-size: 0.65rem;
    font-family: inherit;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s;
    border: 1px solid;
    background: none;
  }

  .survey-btn {
    color: #ce93d8;
    border-color: rgba(206,147,216,0.3);
  }
  .survey-btn:hover { background: rgba(206,147,216,0.1); }

  .memo-save-btn {
    color: #ffd700;
    border-color: rgba(255,215,0,0.3);
  }
  .memo-save-btn:hover { background: rgba(255,215,0,0.1); }

  .memo-saved-hint {
    font-size: 0.58rem;
    color: #546e7a;
  }

  .virtual-banner {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px;
    margin-bottom: 8px;
    background: rgba(244,67,54,0.08);
    border: 1px solid rgba(244,67,54,0.25);
    border-radius: 4px;
    font-size: 0.68rem;
    color: #ef5350;
  }

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
    margin-bottom: 8px;
  }

  .sys-desc {
    font-size: 0.75rem;
    color: #546e7a;
    margin: 0;
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
    gap: 6px;
  }

  .poi-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px;
    background: rgba(255,255,255,0.03);
    border-radius: 4px;
    border: 1px solid rgba(255,255,255,0.05);
    gap: 8px;
  }

  .poi-item.poi-current {
    background: rgba(76, 175, 80, 0.08);
    border-color: rgba(76, 175, 80, 0.35);
  }

  .poi-item.poi-traveling {
    background: rgba(255, 183, 77, 0.06);
    border-color: rgba(255, 183, 77, 0.25);
  }

  .poi-left {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
  }

  .poi-icon {
    font-size: 16px;
    color: #546e7a;
    flex-shrink: 0;
  }

  .poi-item.poi-current .poi-icon { color: #4caf50; }
  .poi-item.poi-traveling .poi-icon { color: #ffb74d; }

  .poi-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .poi-name {
    font-size: 0.82rem;
    color: #b0bec5;
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
  }

  .poi-item.poi-current .poi-name { color: #81c784; }

  .poi-sub {
    font-size: 0.68rem;
    color: #546e7a;
  }

  .here-chip {
    font-size: 0.58rem;
    font-family: 'Roboto Mono', monospace;
    font-weight: 700;
    color: #4caf50;
    background: rgba(76, 175, 80, 0.15);
    border: 1px solid rgba(76, 175, 80, 0.4);
    border-radius: 3px;
    padding: 0 4px;
    letter-spacing: 0.05em;
  }

  .here-chip-active {
    color: #4fc3f7;
    background: rgba(79, 195, 247, 0.15);
    border-color: rgba(79, 195, 247, 0.4);
  }

  .dest-chip {
    font-size: 0.7rem;
    color: #ffb74d;
    font-weight: 700;
    animation: pulse 1.5s infinite;
  }

  .poi-btns {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }

  .nearby-toggle {
    display: flex;
    align-items: center;
    gap: 4px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 6px 0;
    margin-top: 12px;
    width: 100%;
    text-align: left;
  }
  .nearby-toggle:hover { opacity: 0.8; }

  .nearby-arrow {
    font-size: 18px;
    color: #546e7a;
    transition: transform 0.2s ease;
    transform: rotate(-90deg);
  }
  .nearby-arrow-open { transform: rotate(0deg); }

  .player-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .player-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 0;
  }

  .player-name {
    font-size: 0.8rem;
    color: #b0bec5;
    flex: 1;
  }

  .player-ship {
    font-size: 0.68rem;
    color: #546e7a;
  }

  .pm-btn {
    display: flex;
    align-items: center;
    padding: 2px 4px;
    background: transparent;
    border: 1px solid rgba(239,154,154,0.25);
    border-radius: 3px;
    color: #ef9a9a;
    cursor: pointer;
    transition: all 0.15s;
    flex-shrink: 0;
  }
  .pm-btn:hover {
    background: rgba(239,154,154,0.12);
    border-color: rgba(239,154,154,0.5);
  }

  .connection-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .conn-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px;
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

  .conn-cost {
    font-size: 0.68rem;
    color: #ff9800;
  }

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

  .mono { font-family: 'Roboto Mono', monospace; }

  .traveling-notice {
    margin-top: 12px;
    padding: 8px;
    background: rgba(255,183,77,0.08);
    border: 1px solid rgba(255,183,77,0.2);
    border-radius: 4px;
    color: #ffb74d;
    font-size: 0.75rem;
    animation: pulse 1.5s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }
</style>
