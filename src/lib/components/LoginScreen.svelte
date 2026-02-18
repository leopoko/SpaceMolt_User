<script lang="ts">
  import Button, { Label } from '@smui/button';
  import Textfield from '@smui/textfield';
  import CircularProgress from '@smui/circular-progress';
  import { ws } from '$lib/services/websocket';
  import { authStore } from '$lib/stores/auth.svelte';
  import { connectionStore } from '$lib/stores/connection.svelte';
  import { uiStore } from '$lib/stores/ui.svelte';
  import { onMount } from 'svelte';

  const EMPIRES = [
    { id: 'solarian', label: 'Solarian',    desc: 'Mining & trading bonuses' },
    { id: 'voidborn', label: 'Voidborn',    desc: 'Stealth & shield bonuses' },
    { id: 'crimson',  label: 'Crimson Fleet', desc: 'Combat damage bonuses' },
    { id: 'nebula',   label: 'Nebula Collective', desc: 'Exploration speed bonuses' },
    { id: 'outerrim', label: 'Outer Rim',   desc: 'Crafting & cargo bonuses' },
  ];

  let username = $state('');
  let password = $state('');
  let serverUrl = $state('');
  let empire = $state('solarian');
  let registrationCode = $state('');
  let mode = $state<'login' | 'register'>('login');
  let loading = $state(false);
  let errorMsg = $state('');
  let showPassword = $state(false);

  // Watch for login success
  $effect(() => {
    if (authStore.isLoggedIn) {
      loading = false;
    }
  });

  // Watch for connection errors
  $effect(() => {
    if (connectionStore.status === 'error') {
      loading = false;
      errorMsg = connectionStore.lastError ?? 'Connection error';
    }
  });

  // Watch for login_failed / error response from server
  $effect(() => {
    if (authStore.loginError) {
      console.debug('[Login] loginError received:', authStore.loginError);
      loading = false;
      errorMsg = authStore.loginError;
      authStore.loginError = null;
    }
  });

  onMount(() => {
    // Apply dark mode from stored preference
    uiStore.setDarkMode(uiStore.darkMode);
    // Set values after MDC init so outlined labels float with proper notch
    serverUrl = connectionStore.serverUrl;
    username = authStore.savedUsername;
    password = authStore.savedPassword;
    // Connect to server on load
    ws.connect(serverUrl);
  });

  function handleSubmit() {
    console.debug('[Login] submit: mode=%s user=%s connStatus=%s', mode, username, connectionStore.status);
    errorMsg = '';
    if (!username.trim()) {
      errorMsg = 'Username is required.';
      return;
    }
    if (mode === 'login' && !password.trim()) {
      errorMsg = 'Password is required.';
      return;
    }

    if (connectionStore.status !== 'connected') {
      ws.connect(serverUrl);
    }

    loading = true;

    if (authStore.rememberCredentials) {
      authStore.persistCredentials(username, password);
    }

    if (mode === 'login') {
      ws.login(username, password);
    } else {
      if (!registrationCode.trim()) {
        errorMsg = 'Registration code is required. Get one at https://spacemolt.com/dashboard';
        loading = false;
        return;
      }
      ws.register(username, empire, registrationCode);
    }

    // Timeout fallback
    setTimeout(() => {
      if (loading) {
        loading = false;
        errorMsg = 'No response from server. Check your credentials and connection.';
      }
    }, 10000);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') handleSubmit();
  }
</script>

<div class="login-wrapper">
  <div class="login-card">
    <h1 class="login-title">SPACE MOLT</h1>
    <p class="login-subtitle">Human Player Interface</p>

    <!-- Server URL -->
    <div class="field-row">
      <Textfield
        bind:value={serverUrl}
        label="Server URL"
        variant="outlined"
        style="width:100%"
        input$autocomplete="off"
      />
    </div>

    <!-- Connection status -->
    <div class="conn-status" class:connected={connectionStore.status === 'connected'}>
      <span class="dot"
        style="color: {connectionStore.status === 'connected' ? '#4caf50' : connectionStore.status === 'connecting' ? '#ff9800' : '#f44336'}">●</span>
      {connectionStore.status.toUpperCase()}
      {#if connectionStore.reconnectAttempts > 0}
        &nbsp;(retry {connectionStore.reconnectAttempts})
      {/if}
    </div>

    <!-- Username -->
    <div class="field-row">
      <Textfield
        bind:value={username}
        label="Username"
        variant="outlined"
        style="width:100%"
        input$autocomplete="username"
        onkeydown={handleKeydown}
      />
    </div>

    <!-- Password (login only; server generates password on register) -->
    {#if mode === 'login'}
      <div class="field-row password-row">
        <Textfield
          bind:value={password}
          label="Password"
          type={showPassword ? 'text' : 'password'}
          variant="outlined"
          style="width:100%"
          input$autocomplete="current-password"
          onkeydown={handleKeydown}
        />
        <button
          class="show-pw-btn"
          type="button"
          onclick={() => showPassword = !showPassword}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          <span class="material-icons">{showPassword ? 'visibility_off' : 'visibility'}</span>
        </button>
      </div>
    {/if}

    {#if mode === 'register'}
      <!-- Empire selector -->
      <div class="field-row">
        <p class="field-label">Empire</p>
        <div class="empire-grid">
          {#each EMPIRES as emp}
            <button
              class="empire-btn"
              class:selected={empire === emp.id}
              type="button"
              onclick={() => empire = emp.id}
            >
              <span class="empire-name">{emp.label}</span>
              <span class="empire-desc">{emp.desc}</span>
            </button>
          {/each}
        </div>
      </div>

      <!-- Registration code -->
      <div class="field-row">
        <Textfield
          bind:value={registrationCode}
          label="Registration Code"
          variant="outlined"
          style="width:100%"
          input$autocomplete="off"
          onkeydown={handleKeydown}
        />
        <p class="field-hint">Get your code at <a href="https://spacemolt.com/dashboard" target="_blank" rel="noopener">spacemolt.com/dashboard</a></p>
      </div>
    {/if}

    {#if errorMsg}
      <p class="error-msg">{errorMsg}</p>
    {/if}

    <!-- Action buttons -->
    <div class="btn-row">
      {#if loading}
        <CircularProgress style="height:32px;width:32px;" indeterminate />
      {:else}
        <Button variant="raised" onclick={handleSubmit} style="width:100%; --mdc-theme-primary:#4fc3f7;">
          <Label>{mode === 'login' ? 'Login' : 'Register'}</Label>
        </Button>
      {/if}
    </div>

    <!-- Toggle mode -->
    <div class="toggle-row">
      {#if mode === 'login'}
        <span>No account? </span>
        <button class="link-btn" onclick={() => { mode = 'register'; errorMsg = ''; }}>
          Register
        </button>
      {:else}
        <span>Have an account? </span>
        <button class="link-btn" onclick={() => { mode = 'login'; errorMsg = ''; }}>
          Login
        </button>
      {/if}
    </div>
  </div>
</div>

<style>
  .login-wrapper {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: radial-gradient(ellipse at center, #0d1f3c 0%, #060a10 70%);
  }

  .login-card {
    width: 360px;
    padding: 32px 24px;
    background: rgba(13, 21, 37, 0.97);
    border: 1px solid rgba(79, 195, 247, 0.2);
    border-radius: 8px;
  }

  .login-title {
    font-size: 1.8rem;
    font-weight: 300;
    letter-spacing: 0.15em;
    text-align: center;
    color: #4fc3f7;
    margin: 0 0 4px 0;
  }

  .login-subtitle {
    font-size: 0.75rem;
    text-align: center;
    color: #546e7a;
    margin: 0 0 24px 0;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .field-row {
    margin-bottom: 16px;
  }

  .conn-status {
    font-size: 0.7rem;
    font-family: 'Roboto Mono', monospace;
    color: #546e7a;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .dot {
    font-size: 1rem;
    line-height: 1;
  }

  .btn-row {
    margin-top: 8px;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 44px;
  }

  .error-msg {
    color: #ef5350;
    font-size: 0.78rem;
    margin: 0 0 8px 0;
    text-align: center;
  }

  .toggle-row {
    margin-top: 16px;
    text-align: center;
    font-size: 0.8rem;
    color: #546e7a;
  }

  .link-btn {
    background: none;
    border: none;
    color: #4fc3f7;
    cursor: pointer;
    font-size: 0.8rem;
    padding: 0;
    text-decoration: underline;
  }

  .link-btn:hover {
    color: #81d4fa;
  }

  .password-row {
    position: relative;
  }

  .show-pw-btn {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    cursor: pointer;
    color: #546e7a;
    padding: 4px;
    display: flex;
    align-items: center;
  }

  .show-pw-btn:hover {
    color: #4fc3f7;
  }

  .field-label {
    font-size: 0.7rem;
    color: #546e7a;
    margin: 0 0 8px 0;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .field-hint {
    font-size: 0.68rem;
    color: #546e7a;
    margin: 4px 0 0 0;
  }

  .field-hint a {
    color: #4fc3f7;
    text-decoration: none;
  }

  .field-hint a:hover {
    text-decoration: underline;
  }

  .empire-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .empire-btn {
    background: rgba(79, 195, 247, 0.05);
    border: 1px solid rgba(79, 195, 247, 0.2);
    border-radius: 4px;
    padding: 8px 10px;
    cursor: pointer;
    text-align: left;
    transition: border-color 0.15s, background 0.15s;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .empire-btn:hover {
    border-color: rgba(79, 195, 247, 0.5);
    background: rgba(79, 195, 247, 0.1);
  }

  .empire-btn.selected {
    border-color: #4fc3f7;
    background: rgba(79, 195, 247, 0.15);
  }

  .empire-name {
    font-size: 0.8rem;
    font-weight: 500;
    color: #c0cfe0;
  }

  .empire-btn.selected .empire-name {
    color: #4fc3f7;
  }

  .empire-desc {
    font-size: 0.65rem;
    color: #546e7a;
    line-height: 1.3;
  }
</style>
