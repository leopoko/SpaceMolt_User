<script lang="ts">
  import { chatStore } from '$lib/stores/chat.svelte';
  import { authStore } from '$lib/stores/auth.svelte';
  import { systemStore } from '$lib/stores/system.svelte';
  import { ws } from '$lib/services/websocket';
  import type { ChatViewFilter } from '$lib/types/game';

  let message = $state('');
  /** Autocomplete dropdown visible */
  let showSuggestions = $state(false);

  const tabs: Array<{ label: string; value: ChatViewFilter }> = [
    { label: 'ALL',     value: 'all' },
    { label: 'GLOBAL',  value: 'global' },
    { label: 'FACTION', value: 'faction' },
    { label: 'LOCAL',   value: 'local' },
    { label: 'SYSTEM',  value: 'system' },
    { label: 'PM',      value: 'private' },
  ];

  function formatTime(ts: number): string {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }

  /** Filtered nearby player names for PM autocomplete */
  let suggestions = $derived.by(() => {
    const q = chatStore.privateTarget.toLowerCase();
    if (!q) return [];
    return systemStore.nearbyPlayers
      .map(p => p.username)
      .filter(name => name.toLowerCase().includes(q))
      .slice(0, 6);
  });

  function selectSuggestion(name: string) {
    chatStore.privateTarget = name;
    showSuggestions = false;
  }

  function send() {
    const txt = message.trim();
    if (!txt) return;

    if (chatStore.activeFilter === 'private') {
      const target = chatStore.privateTarget.trim();
      if (!target) return;
      ws.sendChat(txt, 'private', target);
    } else {
      // Send on current channel (global/faction/local)
      const channel = chatStore.activeFilter === 'all' || chatStore.activeFilter === 'system'
        ? 'global' : chatStore.activeFilter;
      ws.sendChat(txt, channel);
    }
    message = '';
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  /** Channel label shown on each message */
  function channelTag(ch: string): string {
    switch (ch) {
      case 'global':  return 'G';
      case 'faction': return 'F';
      case 'local':   return 'L';
      case 'system':  return 'S';
      case 'private': return 'PM';
      default: return ch[0]?.toUpperCase() ?? '?';
    }
  }

  function channelColor(ch: string): string {
    switch (ch) {
      case 'global':  return '#90caf9';
      case 'faction': return '#ce93d8';
      case 'local':   return '#a5d6a7';
      case 'system':  return '#ffcc80';
      case 'private': return '#ef9a9a';
      default: return '#78909c';
    }
  }
</script>

<div class="chat-panel">
  <div class="chat-header">
    <span class="chat-title">CHAT</span>
    <div class="channel-tabs">
      {#each tabs as t}
        <button
          class="ch-btn"
          class:active={chatStore.activeFilter === t.value}
          onclick={() => chatStore.setFilter(t.value)}
        >
          {t.label}
        </button>
      {/each}
    </div>
  </div>

  <div class="messages">
    {#each chatStore.filteredMessages as msg (msg.id)}
      <div class="chat-msg" class:own={msg.sender_name === authStore.username}>
        <span class="ts">{formatTime(msg.timestamp)}</span>
        {#if chatStore.activeFilter === 'all'}
          <span class="ch-tag" style="color: {channelColor(msg.channel)}">[{channelTag(msg.channel)}]</span>
        {/if}
        <span class="sender" class:own-name={msg.sender_name === authStore.username}>
          {msg.sender_name}:
        </span>
        <span class="text">{msg.message}</span>
      </div>
    {:else}
      <div class="empty">No messages</div>
    {/each}
  </div>

  <!-- Private message target input -->
  {#if chatStore.activeFilter === 'private'}
    <div class="pm-target-row">
      <span class="pm-label">To:</span>
      <div class="pm-input-wrap">
        <input
          class="pm-target-input"
          bind:value={chatStore.privateTarget}
          placeholder="Player name..."
          onfocus={() => showSuggestions = true}
          onblur={() => setTimeout(() => showSuggestions = false, 150)}
          spellcheck="false"
          autocomplete="off"
        />
        {#if showSuggestions && suggestions.length > 0}
          <div class="suggestions">
            {#each suggestions as s}
              <button class="suggestion-item" onmousedown={() => selectSuggestion(s)}>
                {s}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Input row (hidden for receive-only views) -->
  {#if !chatStore.isReceiveOnly}
    <div class="input-row">
      <input
        class="chat-input"
        bind:value={message}
        placeholder={chatStore.activeFilter === 'private' ? 'Private message...' : 'Type a message...'}
        onkeydown={handleKeydown}
        maxlength={500}
      />
      <button class="send-btn" onclick={send} disabled={!message.trim() || (chatStore.activeFilter === 'private' && !chatStore.privateTarget.trim())}>
        Send
      </button>
    </div>
  {/if}
</div>

<style>
  .chat-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: rgba(4, 8, 18, 0.9);
    border: 1px solid rgba(79, 195, 247, 0.12);
    border-radius: 4px;
    overflow: hidden;
  }

  .chat-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 8px;
    border-bottom: 1px solid rgba(79, 195, 247, 0.1);
    flex-shrink: 0;
  }

  .chat-title {
    font-size: 0.65rem;
    letter-spacing: 0.1em;
    color: #37474f;
    font-weight: 500;
  }

  .channel-tabs {
    display: flex;
    gap: 2px;
  }

  .ch-btn {
    background: none;
    border: 1px solid rgba(255,255,255,0.06);
    color: #4a6070;
    font-size: 0.6rem;
    padding: 1px 6px;
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .ch-btn:hover { color: #90caf9; border-color: rgba(144,202,249,0.3); }
  .ch-btn.active { color: #4fc3f7; border-color: rgba(79,195,247,0.5); background: rgba(79,195,247,0.08); }

  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 4px 6px;
  }

  .chat-msg {
    display: flex;
    gap: 4px;
    font-size: 0.68rem;
    line-height: 1.5;
    padding: 1px 0;
  }

  .ts {
    font-family: 'Roboto Mono', monospace;
    color: #2e4050;
    flex-shrink: 0;
    font-size: 0.63rem;
  }

  .ch-tag {
    font-size: 0.6rem;
    font-weight: 600;
    flex-shrink: 0;
  }

  .sender { color: #78909c; flex-shrink: 0; }
  .own-name { color: #4fc3f7; }
  .text { color: #90a4ae; word-break: break-word; }
  .chat-msg.own .text { color: #b0bec5; }

  .empty {
    font-size: 0.68rem;
    color: #263238;
    padding: 8px;
    text-align: center;
  }

  /* ---- PM target row ---- */
  .pm-target-row {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 6px;
    border-top: 1px solid rgba(79, 195, 247, 0.1);
    flex-shrink: 0;
    background: rgba(239, 154, 154, 0.05);
  }

  .pm-label {
    font-size: 0.65rem;
    color: #ef9a9a;
    flex-shrink: 0;
    font-weight: 500;
  }

  .pm-input-wrap {
    flex: 1;
    position: relative;
  }

  .pm-target-input {
    width: 100%;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(239,154,154,0.25);
    border-radius: 3px;
    color: #ef9a9a;
    font-size: 0.68rem;
    padding: 2px 6px;
    outline: none;
  }

  .pm-target-input:focus {
    border-color: rgba(239,154,154,0.5);
  }

  .suggestions {
    position: absolute;
    bottom: 100%;
    left: 0;
    right: 0;
    background: #0d1525;
    border: 1px solid rgba(79, 195, 247, 0.25);
    border-radius: 3px;
    max-height: 120px;
    overflow-y: auto;
    z-index: 10;
  }

  .suggestion-item {
    display: block;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    color: #90caf9;
    font-size: 0.68rem;
    padding: 3px 8px;
    cursor: pointer;
  }

  .suggestion-item:hover {
    background: rgba(79, 195, 247, 0.1);
    color: #4fc3f7;
  }

  /* ---- Input row ---- */
  .input-row {
    display: flex;
    gap: 4px;
    padding: 4px 6px;
    border-top: 1px solid rgba(79, 195, 247, 0.1);
    flex-shrink: 0;
  }

  .chat-input {
    flex: 1;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(79,195,247,0.15);
    border-radius: 3px;
    color: #c0cfe0;
    font-size: 0.72rem;
    padding: 3px 8px;
    outline: none;
  }

  .chat-input:focus {
    border-color: rgba(79,195,247,0.4);
  }

  .send-btn {
    background: rgba(79,195,247,0.15);
    border: 1px solid rgba(79,195,247,0.3);
    color: #4fc3f7;
    font-size: 0.68rem;
    padding: 2px 10px;
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .send-btn:hover:not(:disabled) {
    background: rgba(79,195,247,0.25);
  }

  .send-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
</style>
