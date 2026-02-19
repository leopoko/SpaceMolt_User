<script lang="ts">
  import { eventsStore } from '$lib/stores/events.svelte';
  import { ws } from '$lib/services/websocket';
  import type { EventType } from '$lib/types/game';

  const filters: Array<{ label: string; value: EventType | 'all' }> = [
    { label: 'All',    value: 'all' },
    { label: 'Combat', value: 'combat' },
    { label: 'Trade',  value: 'trade' },
    { label: 'Nav',    value: 'nav' },
    { label: 'System', value: 'system' },
    { label: 'Chat',   value: 'chat' },
    { label: 'Error',  value: 'error' }
  ];

  function formatTime(ts: number): string {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
  }

  // ---- Command input ----

  let cmdInput = $state('');

  const HELP_TEXT = [
    '/help                     — このヘルプを表示',
    '/<command>                — ゲームコマンドを送信 (例: /get_status)',
    '/<command> key: value ... — payload付きコマンド送信',
    '  例: /help command: travel',
    '  例: /travel target_poi: frontier_belt',
    '  例: /chat message: hello channel: global',
    '  例: /create_buy_order item_id: ore_iron quantity: 10 price_each: 5',
    '{ ... }                   — 生のJSONコマンドを送信',
  ].join('\n');

  /**
   * Parse slash command into a WS message.
   * Format: /type key1: value1 key2: value2
   * Auto-detects numeric values.
   */
  function parseSlashCommand(raw: string): { type: string; payload?: Record<string, unknown> } {
    // Remove leading /
    const content = raw.slice(1);

    // Split by key: value pattern
    // First token is the command type, rest are key: value pairs
    const typeMatch = content.match(/^(\S+)/);
    if (!typeMatch) return { type: content.trim() };

    const type = typeMatch[1];
    const rest = content.slice(type.length).trim();

    if (!rest) return { type };

    // Parse "key: value" pairs
    // Pattern: word followed by colon, then value (until next key: or end)
    const payload: Record<string, unknown> = {};
    const pairRegex = /(\w+)\s*:\s*/g;
    const keys: { key: string; start: number }[] = [];

    let match;
    while ((match = pairRegex.exec(rest)) !== null) {
      keys.push({ key: match[1], start: match.index + match[0].length });
    }

    for (let i = 0; i < keys.length; i++) {
      const start = keys[i].start;
      const end = i + 1 < keys.length ? keys[i + 1].start - keys[i + 1].key.length - 1 : rest.length;
      // Find the position of the next key pattern (key:) to extract the value
      const rawEnd = i + 1 < keys.length
        ? rest.lastIndexOf(keys[i + 1].key, end)
        : rest.length;
      let value: string = rest.slice(start, rawEnd).trim();

      // Auto-convert numbers and booleans
      const parsed = autoConvert(value);
      payload[keys[i].key] = parsed;
    }

    // If no key: value pairs found, treat rest as simple positional arg
    if (keys.length === 0) {
      // Try splitting as simple key=value pairs (fallback)
      const simpleTokens = rest.split(/\s+/);
      for (const token of simpleTokens) {
        if (token.includes('=')) {
          const [k, ...vParts] = token.split('=');
          payload[k] = autoConvert(vParts.join('='));
        }
      }
      if (Object.keys(payload).length === 0) {
        // Single argument – no clear key, return as-is in a generic field
        return { type, payload: { args: rest } };
      }
    }

    return { type, payload };
  }

  function autoConvert(value: string): unknown {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null') return null;
    const num = Number(value);
    if (!isNaN(num) && value !== '') return num;
    return value;
  }

  function handleCommand() {
    const raw = cmdInput.trim();
    if (!raw) return;

    cmdInput = '';

    // Show what was entered in the log
    eventsStore.add({ type: 'info', message: `> ${raw}` });

    // Raw JSON
    if (raw.startsWith('{')) {
      try {
        const msg = JSON.parse(raw);
        ws.send(msg);
      } catch {
        eventsStore.add({ type: 'error', message: 'JSONパースエラー' });
      }
      return;
    }

    // Slash commands → game commands
    if (raw.startsWith('/')) {
      const parts = raw.slice(1).split(/\s+/);
      const cmd = parts[0].toLowerCase();

      if (cmd === 'help' && parts.length === 1) {
        // Local help (no args) shows command format help
        eventsStore.add({ type: 'info', message: HELP_TEXT });
        return;
      }

      const parsed = parseSlashCommand(raw);
      ws.send(parsed.payload ? { type: parsed.type, payload: parsed.payload } : { type: parsed.type });
      return;
    }

    // Plain text → send as raw JSON (user should use /chat command)
    eventsStore.add({ type: 'info', message: 'ヒント: /chat message: テキスト channel: global でチャット送信' });
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCommand();
    }
  }
</script>

<div class="event-log">
  <div class="log-header">
    <span class="log-title">EVENT LOG</span>
    <div class="filters">
      {#each filters as f}
        <button
          class="filter-btn"
          class:active={eventsStore.filter === f.value}
          onclick={() => eventsStore.setFilter(f.value)}
        >
          {f.label}
        </button>
      {/each}
    </div>
  </div>

  <div class="log-entries">
    {#each eventsStore.filtered as entry (entry.id)}
      <div class="entry event-{entry.type}">
        <span class="ts">{formatTime(entry.timestamp)}</span>
        <span class="msg">{entry.message}</span>
      </div>
    {:else}
      <div class="empty">No events</div>
    {/each}
  </div>

  <!-- Command input -->
  <div class="cmd-row">
    <span class="cmd-prompt">›</span>
    <input
      class="cmd-input"
      type="text"
      placeholder="/command key: value  (/help で書式表示)"
      bind:value={cmdInput}
      onkeydown={onKeyDown}
      spellcheck="false"
      autocomplete="off"
    />
    <button class="cmd-send" onclick={handleCommand} title="Send">⏎</button>
  </div>
</div>

<style>
  .event-log {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: rgba(4, 8, 18, 0.9);
    border: 1px solid rgba(79, 195, 247, 0.12);
    border-radius: 4px;
    overflow: hidden;
  }

  .log-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 8px;
    border-bottom: 1px solid rgba(79, 195, 247, 0.1);
    flex-shrink: 0;
  }

  .log-title {
    font-size: 0.65rem;
    letter-spacing: 0.1em;
    color: #37474f;
    font-weight: 500;
  }

  .filters {
    display: flex;
    gap: 2px;
  }

  .filter-btn {
    background: none;
    border: 1px solid rgba(255,255,255,0.06);
    color: #4a6070;
    font-size: 0.6rem;
    padding: 1px 6px;
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .filter-btn:hover { color: #90caf9; border-color: rgba(144,202,249,0.3); }
  .filter-btn.active { color: #4fc3f7; border-color: rgba(79,195,247,0.5); background: rgba(79,195,247,0.08); }

  .log-entries {
    flex: 1;
    overflow-y: auto;
    padding: 4px 6px;
  }

  .entry {
    display: flex;
    gap: 6px;
    font-size: 0.68rem;
    line-height: 1.5;
    padding: 1px 0;
    border-bottom: 1px solid rgba(255,255,255,0.03);
    white-space: pre-wrap;
    word-break: break-word;
  }

  .ts {
    font-family: 'Roboto Mono', monospace;
    color: #2e4050;
    flex-shrink: 0;
    font-size: 0.63rem;
  }

  .msg { color: #7a9ab8; }

  /* event type colours */
  .event-combat .msg { color: #ff7043; }
  .event-trade  .msg { color: #66bb6a; }
  .event-nav    .msg { color: #42a5f5; }
  .event-system .msg { color: #ab47bc; }
  .event-chat   .msg { color: #80cbc4; }
  .event-error  .msg { color: #ef5350; }
  .event-info   .msg { color: #607d8b; }

  .empty {
    font-size: 0.68rem;
    color: #263238;
    padding: 8px;
    text-align: center;
  }

  /* ---- Command input row ---- */
  .cmd-row {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 6px;
    border-top: 1px solid rgba(79, 195, 247, 0.1);
    flex-shrink: 0;
    background: rgba(0,0,0,0.3);
  }

  .cmd-prompt {
    font-family: 'Roboto Mono', monospace;
    font-size: 0.75rem;
    color: #4fc3f7;
    flex-shrink: 0;
    line-height: 1;
  }

  .cmd-input {
    flex: 1;
    background: none;
    border: none;
    outline: none;
    color: #b0bec5;
    font-family: 'Roboto Mono', monospace;
    font-size: 0.68rem;
    padding: 2px 0;
    caret-color: #4fc3f7;
  }

  .cmd-input::placeholder { color: #2e4050; }

  .cmd-send {
    background: none;
    border: none;
    color: #37474f;
    cursor: pointer;
    font-size: 0.75rem;
    padding: 2px 4px;
    border-radius: 2px;
    transition: color 0.1s;
    flex-shrink: 0;
  }

  .cmd-send:hover { color: #4fc3f7; }
</style>
