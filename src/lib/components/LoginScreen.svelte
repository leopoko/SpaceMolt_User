<script lang="ts">
  import Button, { Label } from '@smui/button';
  import Textfield from '@smui/textfield';
  import CircularProgress from '@smui/circular-progress';
  import { ws } from '$lib/services/websocket';
  import { authStore } from '$lib/stores/auth.svelte';
  import { connectionStore } from '$lib/stores/connection.svelte';
  import { uiStore } from '$lib/stores/ui.svelte';
  import { onMount } from 'svelte';

  let username = $state('');
  let password = $state('');
  let serverUrl = $state('');
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
    if (!username.trim() || !password.trim()) {
      errorMsg = 'Username and password are required.';
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
      ws.register(username, password);
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

    <!-- Password -->
    <div class="field-row password-row">
      <Textfield
        bind:value={password}
        label="Password"
        type={showPassword ? 'text' : 'password'}
        variant="outlined"
        style="width:100%"
        input$autocomplete={mode === 'login' ? 'current-password' : 'new-password'}
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
</style>
