<script lang="ts">
  import Button, { Label } from '@smui/button';
  import Card, { Content } from '@smui/card';
  import List, { Item, Text, PrimaryText, SecondaryText, Graphic } from '@smui/list';
  import { systemStore } from '$lib/stores/system.svelte';
  import { playerStore } from '$lib/stores/player.svelte';
  import { ws } from '$lib/services/websocket';

  const secColor: Record<string, string> = {
    high: '#4caf50', medium: '#ff9800', low: '#f44336', null: '#9c27b0'
  };

  const poiIcons: Record<string, string> = {
    station: 'home', asteroid: 'lens', gate: 'transit_enterexit',
    wreck: 'broken_image', planet: 'public', anomaly: 'help_outline'
  };

  function doJump(systemId: string, systemName: string) {
    ws.jump(systemId, systemName);
  }

  function doTravel(poiId: string) {
    ws.travel(poiId);
  }

  function doDock(stationId: string) {
    ws.dock(stationId);
  }

  function doUndock() {
    ws.undock();
  }

  function refresh() {
    ws.getSystem();
  }
</script>

<div class="three-col">
  <!-- Current System Info -->
  <Card class="space-card">
    <Content>
      <div class="section-head">
        <span class="tab-section-title">Current System</span>
        <button class="icon-btn" onclick={refresh} title="Refresh">↻</button>
      </div>

      {#if systemStore.data}
        <h2 class="system-name">{systemStore.name}</h2>
        <div class="sec-badge" style="color:{secColor[systemStore.securityLevel]}">
          Security: {systemStore.securityLevel.toUpperCase()}
        </div>
        {#if systemStore.data.description}
          <p class="sys-desc">{systemStore.data.description}</p>
        {/if}

        <p class="tab-section-title" style="margin-top:12px">Points of Interest</p>
        {#if systemStore.pois.length > 0}
          <List nonInteractive dense>
            {#each systemStore.pois as poi}
              <Item>
                <Graphic class="material-icons" style="font-size:16px;color:#546e7a">
                  {poiIcons[poi.type] ?? 'place'}
                </Graphic>
                <Text>
                  <PrimaryText style="font-size:0.8rem">{poi.name}</PrimaryText>
                  <SecondaryText style="font-size:0.68rem">{poi.type} · {poi.player_count} players</SecondaryText>
                </Text>
              </Item>
            {/each}
          </List>
        {:else}
          <p class="empty-hint">No POIs found</p>
        {/if}

        {#if systemStore.nearbyPlayers.length > 0}
          <p class="tab-section-title" style="margin-top:12px">Nearby Players</p>
          <List nonInteractive dense>
            {#each systemStore.nearbyPlayers as p}
              <Item>
                <Graphic class="material-icons" style="font-size:16px;color:#78909c">person</Graphic>
                <Text>
                  <PrimaryText style="font-size:0.8rem">{p.username}</PrimaryText>
                  <SecondaryText style="font-size:0.68rem">{p.ship_type}</SecondaryText>
                </Text>
              </Item>
            {/each}
          </List>
        {/if}
      {:else}
        <p class="empty-hint">No system data. Click Refresh.</p>
      {/if}
    </Content>
  </Card>

  <!-- Connected Systems / Jump -->
  <Card class="space-card">
    <Content>
      <p class="tab-section-title">Jump Destinations</p>
      {#if systemStore.connections.length > 0}
        <div class="connection-list">
          {#each systemStore.connections as conn}
            <div class="conn-item">
              <div class="conn-info">
                <span class="conn-name">{conn.system_name}</span>
                <span class="conn-sec" style="color:{secColor[conn.security_level ?? 'null']}">
                  {conn.security_level?.toUpperCase() ?? 'NULL'}
                </span>
                <span class="conn-cost mono">Fuel: {conn.jump_cost}</span>
              </div>
              <Button
                variant="outlined"
                dense
                disabled={systemStore.travel.in_progress}
                onclick={() => doJump(conn.system_id, conn.system_name)}
              >
                <Label>Jump</Label>
              </Button>
            </div>
          {/each}
        </div>
      {:else}
        <p class="empty-hint">No connections available</p>
      {/if}

      {#if systemStore.travel.in_progress}
        <div class="traveling-notice">
          ► Traveling to {systemStore.travel.destination_name ?? '...'}
          {#if systemStore.travel.arrival_tick !== null}
            <br/>ETA: Tick {systemStore.travel.arrival_tick}
          {/if}
        </div>
      {/if}
    </Content>
  </Card>

  <!-- Stations & Actions -->
  <Card class="space-card">
    <Content>
      <p class="tab-section-title">Stations</p>
      {#if systemStore.stations.length > 0}
        <div class="station-list">
          {#each systemStore.stations as station}
            <div class="station-item">
              <div class="station-info">
                <span class="station-name">{station.name}</span>
                {#if station.base}
                  <span class="station-type mono">{station.base.type}</span>
                {/if}
              </div>
              <div class="station-btns">
                <Button
                  variant="outlined"
                  dense
                  disabled={playerStore.isDocked}
                  onclick={() => doTravel(station.id)}
                >
                  <Label>Travel</Label>
                </Button>
                <Button
                  variant="outlined"
                  dense
                  disabled={playerStore.isDocked}
                  onclick={() => doDock(station.id)}
                >
                  <Label>Dock</Label>
                </Button>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <p class="empty-hint">No stations in this system</p>
      {/if}

      {#if playerStore.isDocked}
        <div style="margin-top:16px">
          <Button variant="raised" onclick={doUndock} style="width:100%">
            <Label>Undock</Label>
          </Button>
        </div>
      {/if}

      <!-- Asteroids -->
      {#if systemStore.asteroids.length > 0}
        <p class="tab-section-title" style="margin-top:16px">Asteroid Fields</p>
        <List nonInteractive dense>
          {#each systemStore.asteroids as ast}
            <Item>
              <Graphic class="material-icons" style="font-size:16px;color:#78909c">lens</Graphic>
              <Text>
                <PrimaryText style="font-size:0.8rem">{ast.name}</PrimaryText>
              </Text>
            </Item>
          {/each}
        </List>
      {/if}
    </Content>
  </Card>
</div>

<style>
  .section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
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
    color: #263238;
    text-align: center;
    padding: 12px 0;
  }

  .connection-list, .station-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .conn-item, .station-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px;
    background: rgba(255,255,255,0.03);
    border-radius: 4px;
    border: 1px solid rgba(255,255,255,0.05);
  }

  .conn-info, .station-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .conn-name, .station-name {
    font-size: 0.82rem;
    color: #b0bec5;
  }

  .conn-sec, .station-type {
    font-size: 0.68rem;
  }

  .conn-cost {
    font-size: 0.68rem;
    color: #ff9800;
  }

  .station-btns {
    display: flex;
    gap: 4px;
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
