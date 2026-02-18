<script lang="ts">
  import { chatStore } from '$lib/stores/chat.svelte';
  import { authStore } from '$lib/stores/auth.svelte';
  import { ws } from '$lib/services/websocket';
  import type { ChatChannel } from '$lib/types/game';

  let message = $state('');

  const channels: ChatChannel[] = ['global', 'faction', 'local'];

  function formatTime(ts: number): string {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }

  function send() {
    const txt = message.trim();
    if (!txt) return;
    ws.sendChat(txt, chatStore.activeChannel);
    message = '';
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }
</script>

<div class="chat-panel">
  <div class="chat-header">
    <span class="chat-title">CHAT</span>
    <div class="channel-tabs">
      {#each channels as ch}
        <button
          class="ch-btn"
          class:active={chatStore.activeChannel === ch}
          onclick={() => chatStore.setChannel(ch)}
        >
          {ch.toUpperCase()}
        </button>
      {/each}
    </div>
  </div>

  <div class="messages">
    {#each chatStore.filteredMessages as msg (msg.id)}
      <div class="chat-msg" class:own={msg.sender_name === authStore.username}>
        <span class="ts">{formatTime(msg.timestamp)}</span>
        <span class="sender" class:own-name={msg.sender_name === authStore.username}>
          {msg.sender_name}:
        </span>
        <span class="text">{msg.message}</span>
      </div>
    {:else}
      <div class="empty">No messages</div>
    {/each}
  </div>

  <div class="input-row">
    <input
      class="chat-input"
      bind:value={message}
      placeholder="Type a message..."
      onkeydown={handleKeydown}
      maxlength={500}
    />
    <button class="send-btn" onclick={send} disabled={!message.trim()}>
      Send
    </button>
  </div>
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

  .sender { color: #78909c; flex-shrink: 0; }
  .own-name { color: #4fc3f7; }
  .text { color: #90a4ae; }
  .chat-msg.own .text { color: #b0bec5; }

  .empty {
    font-size: 0.68rem;
    color: #263238;
    padding: 8px;
    text-align: center;
  }

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
