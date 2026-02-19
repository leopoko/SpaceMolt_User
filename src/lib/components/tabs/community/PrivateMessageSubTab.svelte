<script lang="ts">
  import { chatStore } from '$lib/stores/chat.svelte';
  import { authStore } from '$lib/stores/auth.svelte';
  import { systemStore } from '$lib/stores/system.svelte';
  import { contactsStore } from '$lib/stores/contacts.svelte';
  import { tradeStore } from '$lib/stores/trade.svelte';
  import { ws } from '$lib/services/websocket';
  import TradePanel from './TradePanel.svelte';

  let message = $state('');
  let showSuggestions = $state(false);

  function formatTime(ts: number): string {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }

  /** Combined suggestions: contacts + nearby players, filtered by input */
  let suggestions = $derived.by(() => {
    const q = chatStore.privateTarget.toLowerCase();
    if (!q) return [];
    const contactNames = contactsStore.list.map(c => c.username);
    const nearbyNames = systemStore.nearbyPlayers.map(p => p.username);
    const all = [...new Set([...contactNames, ...nearbyNames])];
    return all
      .filter(name => name.toLowerCase().includes(q))
      .slice(0, 8);
  });

  function selectSuggestion(name: string) {
    chatStore.privateTarget = name;
    showSuggestions = false;
  }

  function selectContact(username: string) {
    chatStore.privateTarget = username;
  }

  function removeContact(e: Event, username: string) {
    e.stopPropagation();
    contactsStore.removeContact(username);
  }

  /** Messages to display: contact history for selected target */
  let pmMessages = $derived.by(() => {
    const target = chatStore.privateTarget.trim();
    if (!target) return [];
    return contactsStore.getHistory(target);
  });

  function send() {
    const txt = message.trim();
    if (!txt) return;
    const target = chatStore.privateTarget.trim();
    if (!target) return;
    ws.sendChat(txt, 'private', target);
    message = '';
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  let messagesEl: HTMLDivElement | undefined = $state(undefined);

  $effect(() => {
    // Auto-scroll to bottom when messages change
    if (messagesEl && pmMessages.length > 0) {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  });
</script>

<div class="pm-panel">
  <!-- Contact list sidebar -->
  <div class="contact-list">
    <div class="contact-header">CONTACTS</div>
    {#each contactsStore.list as contact (contact.username)}
      <div
        class="contact-item"
        class:active={chatStore.privateTarget === contact.username}
        onclick={() => selectContact(contact.username)}
        role="button"
        tabindex="0"
        onkeydown={(e) => e.key === 'Enter' && selectContact(contact.username)}
      >
        <span class="contact-name">{contact.username}</span>
        {#if tradeStore.getOffersFrom(contact.username).length > 0}
          <span class="trade-badge" title="Trade offer">
            <span class="material-icons" style="font-size:12px">swap_horiz</span>
          </span>
        {/if}
        <button
          class="contact-remove"
          onclick={(e) => removeContact(e, contact.username)}
          title="Remove"
        >&times;</button>
      </div>
    {:else}
      <div class="contact-empty">No contacts</div>
    {/each}
  </div>

  <!-- Conversation area -->
  <div class="pm-conversation">
    <!-- Target input -->
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

    <!-- Message history -->
    <div class="messages" bind:this={messagesEl}>
      {#each pmMessages as msg (msg.id)}
        <div class="chat-msg" class:own={msg.sender_name === authStore.username}>
          <span class="ts">{formatTime(msg.timestamp)}</span>
          <span class="sender" class:own-name={msg.sender_name === authStore.username}>
            {msg.sender_name}:
          </span>
          <span class="text">{msg.message}</span>
        </div>
      {:else}
        <div class="empty">{chatStore.privateTarget ? 'No messages' : 'Select a contact or enter a name'}</div>
      {/each}
    </div>

    <!-- Trade panel (between messages and input) -->
    {#if chatStore.privateTarget.trim()}
      <TradePanel targetUsername={chatStore.privateTarget.trim()} />
    {/if}

    <!-- Send -->
    <div class="input-row">
      <input
        class="chat-input"
        bind:value={message}
        placeholder="Private message..."
        onkeydown={handleKeydown}
        maxlength={500}
      />
      <button class="send-btn" onclick={send} disabled={!message.trim() || !chatStore.privateTarget.trim()}>
        Send
      </button>
    </div>
  </div>
</div>

<style>
  .pm-panel {
    display: flex;
    height: 100%;
    min-height: 300px;
    background: rgba(4, 8, 18, 0.9);
    border: 1px solid rgba(79, 195, 247, 0.12);
    border-radius: 4px;
    overflow: hidden;
  }

  /* Contact list sidebar */
  .contact-list {
    width: 140px;
    flex-shrink: 0;
    border-right: 1px solid rgba(79, 195, 247, 0.1);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .contact-header {
    font-size: 0.62rem;
    letter-spacing: 0.1em;
    color: #37474f;
    font-weight: 500;
    padding: 6px 8px;
    border-bottom: 1px solid rgba(79, 195, 247, 0.06);
    flex-shrink: 0;
  }

  .contact-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    border-bottom: 1px solid rgba(255,255,255,0.03);
    color: #78909c;
    font-size: 0.7rem;
    padding: 5px 8px;
    cursor: pointer;
    transition: all 0.1s;
  }

  .contact-item:hover { background: rgba(79, 195, 247, 0.06); color: #90caf9; }
  .contact-item.active { background: rgba(239, 154, 154, 0.08); color: #ef9a9a; }

  .contact-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }

  .trade-badge {
    color: #ffd700;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    animation: pulse-trade 1.5s infinite;
  }

  @keyframes pulse-trade {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  .contact-remove {
    background: none;
    border: none;
    color: #37474f;
    font-size: 0.8rem;
    cursor: pointer;
    padding: 0 2px;
    flex-shrink: 0;
    line-height: 1;
  }

  .contact-remove:hover { color: #ef5350; }

  .contact-empty {
    font-size: 0.65rem;
    color: #263238;
    padding: 10px;
    text-align: center;
  }

  /* PM Conversation area */
  .pm-conversation {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
  }

  /* PM target row */
  .pm-target-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    border-bottom: 1px solid rgba(79, 195, 247, 0.1);
    flex-shrink: 0;
    background: rgba(239, 154, 154, 0.05);
  }

  .pm-label {
    font-size: 0.72rem;
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
    font-size: 0.75rem;
    padding: 4px 8px;
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
    max-height: 150px;
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
    font-size: 0.72rem;
    padding: 4px 10px;
    cursor: pointer;
  }

  .suggestion-item:hover {
    background: rgba(79, 195, 247, 0.1);
    color: #4fc3f7;
  }

  /* Messages */
  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 6px 8px;
  }

  .chat-msg {
    display: flex;
    gap: 5px;
    font-size: 0.75rem;
    line-height: 1.5;
    padding: 2px 0;
  }

  .ts {
    font-family: 'Roboto Mono', monospace;
    color: #2e4050;
    flex-shrink: 0;
    font-size: 0.68rem;
  }

  .sender { color: #78909c; flex-shrink: 0; }
  .own-name { color: #4fc3f7; }
  .text { color: #90a4ae; word-break: break-word; }
  .chat-msg.own .text { color: #b0bec5; }

  .empty {
    font-size: 0.75rem;
    color: #263238;
    padding: 16px;
    text-align: center;
  }

  /* Input row */
  .input-row {
    display: flex;
    gap: 6px;
    padding: 6px 8px;
    border-top: 1px solid rgba(79, 195, 247, 0.1);
    flex-shrink: 0;
  }

  .chat-input {
    flex: 1;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(79,195,247,0.15);
    border-radius: 3px;
    color: #c0cfe0;
    font-size: 0.78rem;
    padding: 5px 10px;
    outline: none;
  }

  .chat-input:focus {
    border-color: rgba(79,195,247,0.4);
  }

  .send-btn {
    background: rgba(79,195,247,0.15);
    border: 1px solid rgba(79,195,247,0.3);
    color: #4fc3f7;
    font-size: 0.72rem;
    padding: 4px 14px;
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
