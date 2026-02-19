<script lang="ts">
  import Button, { Label } from '@smui/button';
  import Card, { Content } from '@smui/card';
  import Textfield from '@smui/textfield';
  import Switch from '@smui/switch';
  import FormField from '@smui/form-field';
  import { connectionStore } from '$lib/stores/connection.svelte';
  import { authStore } from '$lib/stores/auth.svelte';
  import { uiStore } from '$lib/stores/ui.svelte';
  import { mapSettingsStore } from '$lib/stores/mapSettings.svelte';
  import { ws } from '$lib/services/websocket';

  let serverUrl = $state(connectionStore.serverUrl);
  let savedUser = $state(authStore.savedUsername);
  let savedPass = $state(authStore.savedPassword);

  function reconnect() {
    ws.disconnect();
    setTimeout(() => ws.connect(serverUrl), 500);
  }

  function disconnect() {
    ws.disconnect();
    authStore.logout();
  }

  function saveCredentials() {
    authStore.persistCredentials(savedUser, savedPass);
  }

  function clearCredentials() {
    authStore.clearCredentials();
    savedUser = '';
    savedPass = '';
  }

  function toggleDarkMode() {
    uiStore.setDarkMode(!uiStore.darkMode);
  }
</script>

<div class="settings-grid">
  <!-- Connection -->
  <Card class="space-card">
    <Content>
      <p class="tab-section-title">Connection</p>

      <div class="field-group">
        <Textfield
          bind:value={serverUrl}
          label="WebSocket Server URL"
          variant="outlined"
          style="width:100%"
        />
      </div>

      <div class="conn-status-row">
        <span class="conn-dot" style="color:{
          connectionStore.status === 'connected' ? '#4caf50' :
          connectionStore.status === 'connecting' ? '#ff9800' : '#f44336'
        }">●</span>
        <span class="mono conn-text">{connectionStore.status.toUpperCase()}</span>
        {#if connectionStore.reconnectAttempts > 0}
          <span class="dim mono">(retries: {connectionStore.reconnectAttempts})</span>
        {/if}
        {#if connectionStore.lastError}
          <span class="error-txt">{connectionStore.lastError}</span>
        {/if}
      </div>

      <div class="btn-row">
        <Button variant="outlined" onclick={reconnect} style="flex:1">
          <Label>Reconnect</Label>
        </Button>
        <Button variant="outlined" onclick={disconnect} style="flex:1; --mdc-theme-primary:#ef5350">
          <Label>Disconnect & Logout</Label>
        </Button>
      </div>
    </Content>
  </Card>

  <!-- Credentials -->
  <Card class="space-card">
    <Content>
      <p class="tab-section-title">Saved Credentials</p>
      <p class="hint-text">These are used for auto-reconnect after disconnections.</p>

      <div class="field-group">
        <Textfield
          bind:value={savedUser}
          label="Username"
          variant="outlined"
          style="width:100%"
        />
      </div>
      <div class="field-group">
        <Textfield
          bind:value={savedPass}
          label="Password"
          type="password"
          variant="outlined"
          style="width:100%"
          input$autocomplete="current-password"
        />
      </div>

      <div class="btn-row">
        <Button variant="outlined" onclick={saveCredentials} style="flex:1">
          <Label>Save</Label>
        </Button>
        <Button variant="outlined" onclick={clearCredentials} style="flex:1; --mdc-theme-primary:#ef5350">
          <Label>Clear</Label>
        </Button>
      </div>
    </Content>
  </Card>

  <!-- Display -->
  <Card class="space-card">
    <Content>
      <p class="tab-section-title">Display</p>

      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-name">Dark Mode</span>
          <span class="setting-desc">Space-themed dark interface</span>
        </div>
        <FormField>
          <Switch
            checked={uiStore.darkMode}
            onchange={toggleDarkMode}
          />
        </FormField>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-name">Tick Rate</span>
          <span class="setting-desc">Server tick interval</span>
        </div>
        <span class="mono tick-val">{connectionStore.tickRate}s/tick</span>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-name">Current Tick</span>
          <span class="setting-desc">Server game tick</span>
        </div>
        <span class="mono tick-val">{connectionStore.tick}</span>
      </div>
    </Content>
  </Card>

  <!-- System Map -->
  <Card class="space-card">
    <Content>
      <p class="tab-section-title">System Map</p>

      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-name">Asteroid Density</span>
          <span class="setting-desc">Rock count per belt ({mapSettingsStore.rockDensity})</span>
        </div>
        <input
          type="range" min="40" max="640" step="40"
          value={mapSettingsStore.rockDensity}
          oninput={(e: Event) => mapSettingsStore.setRockDensity(Number((e.target as HTMLInputElement).value))}
          class="range-input"
        />
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-name">Travel Animation</span>
          <span class="setting-desc">Moving dots along travel path</span>
        </div>
        <FormField>
          <Switch
            checked={mapSettingsStore.showTravelAnim}
            onchange={() => mapSettingsStore.setShowTravelAnim(!mapSettingsStore.showTravelAnim)}
          />
        </FormField>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-name">Player Waves</span>
          <span class="setting-desc">Ripple effect at POIs with players</span>
        </div>
        <FormField>
          <Switch
            checked={mapSettingsStore.showPlayerWaves}
            onchange={() => mapSettingsStore.setShowPlayerWaves(!mapSettingsStore.showPlayerWaves)}
          />
        </FormField>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-name">Orbit Lines</span>
          <span class="setting-desc">Dashed orbital circles</span>
        </div>
        <FormField>
          <Switch
            checked={mapSettingsStore.showOrbitLines}
            onchange={() => mapSettingsStore.setShowOrbitLines(!mapSettingsStore.showOrbitLines)}
          />
        </FormField>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-name">Grid Lines</span>
          <span class="setting-desc">Background grid overlay</span>
        </div>
        <FormField>
          <Switch
            checked={mapSettingsStore.showGrid}
            onchange={() => mapSettingsStore.setShowGrid(!mapSettingsStore.showGrid)}
          />
        </FormField>
      </div>
    </Content>
  </Card>

  <!-- About -->
  <Card class="space-card">
    <Content>
      <p class="tab-section-title">About</p>
      <div class="about-block">
        <p class="about-title">SpaceMolt Human Client</p>
        <p class="about-desc">
          A web-based game client for SpaceMolt – an MMO space game.
          Connect with your SpaceMolt account to explore star systems,
          mine resources, trade, fight, and manage your faction.
        </p>
        <p class="about-link">
          Server: <span class="mono accent">{connectionStore.serverUrl}</span>
        </p>
        <p class="about-links">
          <a href="https://game.spacemolt.com" target="_blank" rel="noopener noreferrer">
            game.spacemolt.com
          </a>
        </p>
      </div>
    </Content>
  </Card>
</div>

<style>
  .settings-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  @media (max-width: 700px) { .settings-grid { grid-template-columns: 1fr; } }

  .field-group { margin-bottom: 12px; }

  .conn-status-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    font-size: 0.75rem;
    flex-wrap: wrap;
  }

  .conn-dot { font-size: 1rem; }
  .conn-text { color: #90a4ae; }
  .dim { color: #37474f; }
  .error-txt { color: #ef5350; font-size: 0.7rem; }
  .mono { font-family: 'Roboto Mono', monospace; }

  .btn-row { display: flex; gap: 8px; }

  .hint-text { font-size: 0.72rem; color: #37474f; margin: 0 0 12px; }

  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 0;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }

  .setting-info { display: flex; flex-direction: column; }
  .setting-name { font-size: 0.82rem; color: #b0bec5; }
  .setting-desc { font-size: 0.68rem; color: #4a6070; margin-top: 2px; }

  .tick-val { font-size: 0.78rem; color: #4fc3f7; }

  .range-input {
    width: 120px;
    accent-color: #4fc3f7;
    cursor: pointer;
  }

  .about-block { display: flex; flex-direction: column; gap: 8px; }
  .about-title { font-size: 0.9rem; color: #4fc3f7; font-weight: 400; margin: 0; }
  .about-desc { font-size: 0.73rem; color: #546e7a; margin: 0; line-height: 1.6; }
  .about-link { font-size: 0.72rem; color: #4a6070; margin: 0; }
  .accent { color: #4fc3f7; }
  .about-links a { color: #4fc3f7; font-size: 0.72rem; text-decoration: none; }
  .about-links a:hover { text-decoration: underline; }
</style>
