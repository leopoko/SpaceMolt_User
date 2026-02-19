<script lang="ts">
  import Button, { Label } from '@smui/button';
  import Card, { Content } from '@smui/card';
  import LinearProgress from '@smui/linear-progress';
  import { systemStore } from '$lib/stores/system.svelte';
  import { shipStore } from '$lib/stores/ship.svelte';
  import { ws } from '$lib/services/websocket';

  let selectedAsteroid = $state<string | null>(null);
  let miningActive = $state(false);

  function doMine() {
    if (selectedAsteroid) {
      miningActive = true;
      ws.mine(selectedAsteroid);
      setTimeout(() => { miningActive = false; }, 12000);
    }
  }
</script>

<div class="two-col">
  <!-- Asteroid selector -->
  <Card class="space-card">
    <Content>
      <p class="tab-section-title">Asteroid Fields</p>

      {#if systemStore.asteroids.length > 0}
        <div class="asteroid-list">
          {#each systemStore.asteroids as ast}
            <div
              class="asteroid-item"
              class:selected={selectedAsteroid === ast.id}
              onclick={() => { selectedAsteroid = selectedAsteroid === ast.id ? null : ast.id; }}
              role="button"
              tabindex="0"
              onkeydown={(e) => e.key === 'Enter' && (selectedAsteroid = ast.id)}
            >
              <span class="material-icons ast-icon">lens</span>
              <div class="ast-info">
                <span class="ast-name">{ast.name}</span>
                <span class="ast-type mono">{ast.type}</span>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <p class="empty-hint">No asteroid fields in this system.</p>
      {/if}

      <div style="margin-top:16px">
        {#if miningActive}
          <div class="mining-progress">
            <span class="mining-label">⛏ Mining in progress...</span>
            <LinearProgress indeterminate class="progress-hull" />
          </div>
        {:else}
          <Button
            variant="raised"
            disabled={!selectedAsteroid}
            onclick={doMine}
            style="width:100%"
          >
            <Label>⛏ Mine Selected Asteroid</Label>
          </Button>
        {/if}
      </div>
    </Content>
  </Card>

  <!-- Cargo / Inventory -->
  <Card class="space-card">
    <Content>
      <div class="section-head">
        <span class="tab-section-title">Cargo Bay</span>
        {#if shipStore.current}
          <span class="mono cargo-pct">
            {shipStore.cargoUsed.toFixed(1)} / {shipStore.current.max_cargo} m³
          </span>
        {/if}
      </div>

      {#if shipStore.current}
        <LinearProgress
          progress={shipStore.cargoPercent / 100}
          style="margin-bottom:12px; --mdc-theme-primary: #ff9800;"
        />
      {/if}

      {#if shipStore.cargo.length > 0}
        <table class="cargo-table">
          <thead>
            <tr>
              <th>Item</th>
              <th class="num">Qty</th>
              <th class="num">Vol (m³)</th>
              <th class="num">Value</th>
            </tr>
          </thead>
          <tbody>
            {#each shipStore.cargo as item}
              <tr>
                <td>{item.name}</td>
                <td class="num mono">{item.quantity}</td>
                <td class="num mono">{(item.quantity * (item.volume ?? 1)).toFixed(1)}</td>
                <td class="num mono credits">₡ {(item.quantity * (item.value ?? 0)).toLocaleString()}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {:else}
        <p class="empty-hint">Cargo bay is empty</p>
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

  .empty-hint {
    font-size: 0.75rem;
    color: #263238;
    text-align: center;
    padding: 12px 0;
  }

  .asteroid-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .asteroid-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.05);
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .asteroid-item:hover { background: rgba(255,255,255,0.06); }
  .asteroid-item.selected { border-color: rgba(255,152,0,0.5); background: rgba(255,152,0,0.08); }

  .ast-icon { font-size: 16px; color: #78909c; }
  .ast-info { display: flex; flex-direction: column; }
  .ast-name { font-size: 0.8rem; color: #b0bec5; }
  .ast-type { font-size: 0.68rem; color: #546e7a; }

  .mining-progress {
    background: rgba(255,152,0,0.08);
    border: 1px solid rgba(255,152,0,0.2);
    border-radius: 4px;
    padding: 10px;
  }

  .mining-label {
    display: block;
    font-size: 0.75rem;
    color: #ffb74d;
    margin-bottom: 8px;
  }

  .cargo-pct { font-size: 0.72rem; color: #ff9800; }

  .cargo-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.75rem;
  }

  .cargo-table th {
    text-align: left;
    font-size: 0.65rem;
    letter-spacing: 0.08em;
    color: #37474f;
    padding: 4px 4px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    text-transform: uppercase;
  }

  .cargo-table td {
    padding: 4px 4px;
    color: #90a4ae;
    border-bottom: 1px solid rgba(255,255,255,0.03);
  }

  .num { text-align: right; }
  .mono { font-family: 'Roboto Mono', monospace; }
  .credits { color: #ffd700; }
</style>
