<script lang="ts">
  import Button, { Label } from '@smui/button';
  import Card, { Content } from '@smui/card';
  import { playerStore } from '$lib/stores/player.svelte';
  import { baseStore } from '$lib/stores/base.svelte';
  import { actionQueueStore } from '$lib/stores/actionQueue.svelte';
  import { loopStore, type SavedLoop } from '$lib/stores/loop.svelte';
  import { eventsStore } from '$lib/stores/events.svelte';

  let loopName = $state('');
  let playCount = $state(1);
  let editingLoopId = $state<string | null>(null);
  let editName = $state('');

  // Current station info
  let stationId = $derived(baseStore.currentBase?.id ?? playerStore.dockedAt ?? '');
  let stationName = $derived(baseStore.currentBase?.name ?? 'Unknown Station');

  // Loops saved for this station
  let stationLoops = $derived(
    stationId ? loopStore.getLoopsForStation(stationId) : []
  );

  // Items currently in the recording queue
  let recordedItems = $derived(
    loopStore.isRecording ? actionQueueStore.items : []
  );

  // Items with command info (recordable)
  let recordedCommands = $derived(
    loopStore.isRecording ? actionQueueStore.getRecordedCommands() : []
  );

  function startRecording() {
    if (!stationId) return;
    loopStore.startRecording(stationId, stationName);
  }

  function cancelRecording() {
    loopStore.cancelRecording();
  }

  function saveRecording() {
    const name = loopName.trim() || `Loop @ ${stationName}`;
    loopStore.saveRecording(name);
    loopName = '';
  }

  function playLoop(loop: SavedLoop, count: number) {
    loopStore.playLoop(loop.id, count);
  }

  function playInfinite(loop: SavedLoop) {
    loopStore.playLoop(loop.id, 0);
  }

  function stopLoop() {
    loopStore.stopLoop();
  }

  function deleteLoop(loopId: string) {
    loopStore.deleteLoop(loopId);
  }

  function startRename(loop: SavedLoop) {
    editingLoopId = loop.id;
    editName = loop.name;
  }

  function confirmRename() {
    if (editingLoopId && editName.trim()) {
      loopStore.renameLoop(editingLoopId, editName.trim());
    }
    editingLoopId = null;
    editName = '';
  }

  function cancelRename() {
    editingLoopId = null;
    editName = '';
  }

  function removeRecordedItem(id: number) {
    actionQueueStore.remove(id);
  }

  function moveRecordedUp(id: number) {
    actionQueueStore.moveUp(id);
  }

  function moveRecordedDown(id: number) {
    actionQueueStore.moveDown(id);
  }
</script>

{#if !playerStore.isDocked}
  <div class="not-docked">
    <span class="material-icons" style="font-size:48px;color:#263238">repeat</span>
    <p>Dock at a station to set up action loops</p>
  </div>
{:else}
  <div class="loop-layout">
    <!-- Recording Section -->
    <Card class="space-card">
      <Content>
        <p class="tab-section-title">Loop Recording</p>

        {#if !loopStore.isRecording && !loopStore.isPlaying}
          <p class="hint-text">
            アクションの流れを録画し、ルーチンワークを自動化します。
            録画中は他のタブでアクションをキューに追加してください。
          </p>
          <Button variant="raised" onclick={startRecording} style="width:100%; margin-top:8px">
            <Label>
              <span class="material-icons btn-icon">fiber_manual_record</span>
              録画開始
            </Label>
          </Button>
        {:else if loopStore.isRecording}
          <div class="recording-banner">
            <span class="rec-dot"></span>
            REC — {stationName} からのループを記録中
          </div>

          {#if recordedItems.length > 0}
            <p class="recorded-count">{recordedItems.length} アクション記録済み
              ({recordedCommands.length} 再生可能)
            </p>
            <div class="recorded-list">
              {#each recordedItems as item, i}
                {@const hasCommand = actionQueueStore.getCommand(item.id) !== undefined}
                <div class="recorded-item" class:no-command={!hasCommand}>
                  <span class="rec-idx">{i + 1}</span>
                  <span class="rec-label" class:rec-label-dim={!hasCommand}>
                    {item.label}
                    {#if !hasCommand}
                      <span class="rec-warning" title="コマンド情報なし — 再生不可">⚠</span>
                    {/if}
                  </span>
                  <div class="rec-actions">
                    <button class="rec-btn" onclick={() => moveRecordedUp(item.id)} disabled={i === 0} title="上へ">↑</button>
                    <button class="rec-btn" onclick={() => moveRecordedDown(item.id)} disabled={i === recordedItems.length - 1} title="下へ">↓</button>
                    <button class="rec-btn rec-btn-del" onclick={() => removeRecordedItem(item.id)} title="削除">×</button>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <p class="empty-hint">
              他のタブでアクションをキューに追加してください
            </p>
          {/if}

          <div class="save-form">
            <input
              type="text"
              class="loop-name-input"
              placeholder="ループ名 (省略可)"
              bind:value={loopName}
            />
            <div class="save-actions">
              <Button
                variant="raised"
                onclick={saveRecording}
                disabled={recordedCommands.length === 0}
                style="flex:1"
              >
                <Label>
                  <span class="material-icons btn-icon">save</span>
                  保存
                </Label>
              </Button>
              <Button variant="outlined" onclick={cancelRecording} style="flex:1">
                <Label>キャンセル</Label>
              </Button>
            </div>
          </div>
        {:else if loopStore.isPlaying}
          <div class="playing-banner">
            <span class="material-icons" style="font-size:16px">play_arrow</span>
            再生中 — イテレーション {loopStore.currentIteration}/{loopStore.totalIterations === 0 ? '∞' : loopStore.totalIterations}
          </div>
          <Button variant="raised" onclick={stopLoop} style="width:100%; margin-top:8px; --mdc-theme-primary:#f44336">
            <Label>
              <span class="material-icons btn-icon">stop</span>
              停止
            </Label>
          </Button>
        {/if}
      </Content>
    </Card>

    <!-- Saved Loops -->
    <Card class="space-card">
      <Content>
        <p class="tab-section-title">Saved Loops</p>

        {#if stationLoops.length > 0}
          {#each stationLoops as loop}
            <div class="loop-card" class:loop-playing={loopStore.playingLoopId === loop.id}>
              <div class="loop-header">
                {#if editingLoopId === loop.id}
                  <input
                    type="text"
                    class="loop-name-input"
                    bind:value={editName}
                    onkeydown={(e) => e.key === 'Enter' && confirmRename()}
                  />
                  <button class="rec-btn" onclick={confirmRename}>✓</button>
                  <button class="rec-btn" onclick={cancelRename}>×</button>
                {:else}
                  <span class="loop-name">{loop.name}</span>
                  <button class="rec-btn" onclick={() => startRename(loop)} title="名前変更">✎</button>
                  <button class="rec-btn rec-btn-del" onclick={() => deleteLoop(loop.id)} title="削除">×</button>
                {/if}
              </div>

              <div class="loop-steps">
                {#each loop.steps as step, i}
                  <span class="step-chip">
                    <span class="step-num">{i + 1}</span>
                    {step.label}
                  </span>
                {/each}
              </div>

              <div class="loop-meta">
                <span class="loop-date">{new Date(loop.createdAt).toLocaleDateString()}</span>
                <span class="loop-step-count">{loop.steps.length} steps</span>
              </div>

              {#if !loopStore.isPlaying && !loopStore.isRecording}
                <div class="loop-play-controls">
                  <Button variant="outlined" onclick={() => playLoop(loop, 1)} dense style="flex:1">
                    <Label>1回</Label>
                  </Button>
                  <div class="play-n-row">
                    <input
                      type="number"
                      class="play-count-input"
                      min="1"
                      max="999"
                      bind:value={playCount}
                    />
                    <Button variant="outlined" onclick={() => playLoop(loop, playCount)} dense style="flex:1">
                      <Label>×{playCount}</Label>
                    </Button>
                  </div>
                  <Button variant="raised" onclick={() => playInfinite(loop)} dense style="flex:1">
                    <Label>∞ 無限</Label>
                  </Button>
                </div>
              {/if}
            </div>
          {/each}
        {:else}
          <p class="empty-hint">
            このステーションに保存されたループはありません
          </p>
        {/if}

        {#if loopStore.savedLoops.length > stationLoops.length}
          <p class="other-loops-hint">
            他のステーションに {loopStore.savedLoops.length - stationLoops.length} 件のループがあります
          </p>
        {/if}
      </Content>
    </Card>
  </div>
{/if}

<style>
  .not-docked {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 300px;
    gap: 12px;
    color: #37474f;
  }
  .not-docked p { font-size: 0.85rem; }

  .loop-layout {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  @media (max-width: 800px) {
    .loop-layout { grid-template-columns: 1fr; }
  }

  .hint-text {
    font-size: 0.72rem;
    color: #546e7a;
    line-height: 1.5;
    margin: 0;
  }

  .btn-icon {
    font-size: 16px;
    vertical-align: middle;
    margin-right: 4px;
  }

  .recording-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    margin-bottom: 8px;
    background: rgba(244,67,54,0.1);
    border: 1px solid rgba(244,67,54,0.3);
    border-radius: 4px;
    font-size: 0.75rem;
    color: #f44336;
    font-weight: 500;
  }

  .rec-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #f44336;
    animation: blink 1s ease-in-out infinite;
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  .playing-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    margin-bottom: 8px;
    background: rgba(76,175,80,0.1);
    border: 1px solid rgba(76,175,80,0.3);
    border-radius: 4px;
    font-size: 0.75rem;
    color: #4caf50;
    font-weight: 500;
  }

  .recorded-count {
    font-size: 0.68rem;
    color: #78909c;
    margin: 4px 0;
  }

  .recorded-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 300px;
    overflow-y: auto;
    margin-bottom: 8px;
  }

  .recorded-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 6px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.05);
    border-radius: 3px;
    font-size: 0.72rem;
  }

  .recorded-item.no-command {
    opacity: 0.5;
    border-color: rgba(244,67,54,0.15);
  }

  .rec-idx {
    font-family: 'Roboto Mono', monospace;
    font-size: 0.62rem;
    color: #546e7a;
    min-width: 20px;
    text-align: center;
  }

  .rec-label {
    flex: 1;
    color: #b0bec5;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .rec-label-dim { color: #546e7a; }
  .rec-warning { color: #ff9800; font-size: 0.7rem; }

  .rec-actions {
    display: flex;
    gap: 2px;
  }

  .rec-btn {
    background: none;
    border: 1px solid rgba(255,255,255,0.1);
    color: #78909c;
    font-size: 0.65rem;
    padding: 1px 5px;
    border-radius: 2px;
    cursor: pointer;
    transition: all 0.1s;
  }
  .rec-btn:hover { background: rgba(255,255,255,0.06); color: #b0bec5; }
  .rec-btn:disabled { opacity: 0.3; cursor: default; }
  .rec-btn-del:hover { color: #f44336; border-color: rgba(244,67,54,0.3); }

  .save-form {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid rgba(255,255,255,0.06);
  }

  .save-actions {
    display: flex;
    gap: 6px;
  }

  .loop-name-input {
    width: 100%;
    padding: 6px 8px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(79,195,247,0.2);
    border-radius: 4px;
    color: #b0bec5;
    font-size: 0.75rem;
  }
  .loop-name-input:focus {
    outline: none;
    border-color: rgba(79,195,247,0.5);
  }

  .empty-hint {
    font-size: 0.75rem;
    color: #37474f;
    text-align: center;
    padding: 16px 0;
  }

  .loop-card {
    padding: 10px;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 6px;
    margin-bottom: 8px;
  }

  .loop-card.loop-playing {
    border-color: rgba(76,175,80,0.4);
    background: rgba(76,175,80,0.05);
  }

  .loop-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
  }

  .loop-name {
    flex: 1;
    font-size: 0.82rem;
    color: #90caf9;
    font-weight: 400;
  }

  .loop-steps {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
    margin-bottom: 6px;
  }

  .step-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.62rem;
    padding: 2px 6px;
    background: rgba(79,195,247,0.06);
    border: 1px solid rgba(79,195,247,0.15);
    border-radius: 10px;
    color: #78909c;
  }

  .step-num {
    font-family: 'Roboto Mono', monospace;
    font-size: 0.55rem;
    color: #546e7a;
  }

  .loop-meta {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .loop-date { font-size: 0.6rem; color: #37474f; }
  .loop-step-count { font-size: 0.6rem; color: #546e7a; font-family: 'Roboto Mono', monospace; }

  .loop-play-controls {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .play-n-row {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1;
  }

  .play-count-input {
    width: 48px;
    padding: 4px 4px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(79,195,247,0.2);
    border-radius: 4px;
    color: #b0bec5;
    font-family: 'Roboto Mono', monospace;
    font-size: 0.72rem;
    text-align: center;
  }
  .play-count-input:focus {
    outline: none;
    border-color: rgba(79,195,247,0.5);
  }

  .other-loops-hint {
    font-size: 0.62rem;
    color: #37474f;
    text-align: center;
    margin-top: 8px;
  }
</style>
