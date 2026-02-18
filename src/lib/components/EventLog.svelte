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
    { label: 'Error',  value: 'error' }
  ];

  function formatTime(ts: number): string {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
  }

  // ---- Command input ----

  let cmdInput = $state('');

  const HELP_TEXT = [
    '/help               — このヘルプを表示',
    '/scan               — 周辺スキャン',
    '/status             — プレイヤーステータス取得',
    '/system             — システム情報取得',
    '/jump <system_id>   — 別システムへジャンプ',
    '/travel <poi_id>    — POIへ移動',
    '/dock <station_id>  — ステーションにドック',
    '/undock             — ドック解除',
    '/mine <poi_id>      — 採掘開始',
    '/chat <msg>         — グローバルチャットに送信',
    '{ ... }             — 生のJSONコマンドを送信',
    '<その他>            — ローカルチャットとして送信',
  ].join('\n');

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

    // Slash commands
    if (raw.startsWith('/')) {
      const parts = raw.slice(1).split(/\s+/);
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1);

      switch (cmd) {
        case 'help':
          eventsStore.add({ type: 'info', message: HELP_TEXT });
          break;
        case 'scan':
          ws.scan();
          break;
        case 'status':
          ws.getStatus();
          break;
        case 'system':
          ws.getSystem();
          break;
        case 'jump':
          if (args[0]) ws.jump(args[0], args[1]);
          else eventsStore.add({ type: 'error', message: '使い方: /jump <system_id>' });
          break;
        case 'travel':
          if (args[0]) ws.travel(args[0]);
          else eventsStore.add({ type: 'error', message: '使い方: /travel <poi_id>' });
          break;
        case 'dock':
          if (args[0]) ws.dock(args[0]);
          else eventsStore.add({ type: 'error', message: '使い方: /dock <station_id>' });
          break;
        case 'undock':
          ws.undock();
          break;
        case 'mine':
          if (args[0]) ws.mine(args[0]);
          else eventsStore.add({ type: 'error', message: '使い方: /mine <poi_id>' });
          break;
        case 'chat':
          if (args.length > 0) ws.sendChat(args.join(' '));
          else eventsStore.add({ type: 'error', message: '使い方: /chat <message>' });
          break;
        default:
          eventsStore.add({ type: 'error', message: `不明なコマンド: /${cmd}  (/help で一覧表示)` });
      }
      return;
    }

    // Plain text → send as local chat
    ws.sendChat(raw, 'local');
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
      placeholder="コマンドまたはチャット  (/help で一覧)"
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
