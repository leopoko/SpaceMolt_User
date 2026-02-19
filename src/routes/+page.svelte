<script lang="ts">
  import TabBar from '@smui/tab-bar';
  import Tab, { Label, Icon } from '@smui/tab';
  import { authStore } from '$lib/stores/auth.svelte';
  import { uiStore, TABS } from '$lib/stores/ui.svelte';
  import LoginScreen from '$lib/components/LoginScreen.svelte';
  import StatusBar from '$lib/components/StatusBar.svelte';
  import EventLog from '$lib/components/EventLog.svelte';
  import ChatPanel from '$lib/components/ChatPanel.svelte';
  import ActionQueue from '$lib/components/ActionQueue.svelte';
  import NavigationTab from '$lib/components/tabs/NavigationTab.svelte';
  import CombatTab from '$lib/components/tabs/CombatTab.svelte';
  import MiningTab from '$lib/components/tabs/MiningTab.svelte';
  import TradingTab from '$lib/components/tabs/TradingTab.svelte';
  import ShipTab from '$lib/components/tabs/ShipTab.svelte';
  import CraftingTab from '$lib/components/tabs/CraftingTab.svelte';
  import FactionTab from '$lib/components/tabs/FactionTab.svelte';
  import BaseTab from '$lib/components/tabs/BaseTab.svelte';
  import InfoTab from '$lib/components/tabs/InfoTab.svelte';
  import SettingsTab from '$lib/components/tabs/SettingsTab.svelte';

  // ======== localStorage helpers ========
  function loadNum(key: string, def: number, min: number, max: number): number {
    try {
      const v = Number(localStorage.getItem(key));
      if (v >= min && v <= max) return v;
    } catch { /* ignore */ }
    return def;
  }
  function saveNum(key: string, v: number) {
    try { localStorage.setItem(key, String(v)); } catch { /* ignore */ }
  }
  function loadBool(key: string, def: boolean): boolean {
    try {
      const v = localStorage.getItem(key);
      if (v !== null) return v === 'true';
    } catch { /* ignore */ }
    return def;
  }
  function saveBool(key: string, v: boolean) {
    try { localStorage.setItem(key, String(v)); } catch { /* ignore */ }
  }

  // ======== Drag state (shared) ========
  type DragKind = 'event-chat' | 'chat-aq' | 'height' | 'map';
  let dragKind = $state<DragKind | null>(null);

  /** True when any drag is active – disables text selection globally */
  let isDragging = $derived(dragKind !== null);

  function stopDrag() {
    dragKind = null;
    document.removeEventListener('mousemove', onGlobalMouseMove);
    document.removeEventListener('mouseup', onGlobalMouseUp);
  }

  function startDrag(kind: DragKind, e: MouseEvent) {
    e.preventDefault();
    dragKind = kind;
    document.addEventListener('mousemove', onGlobalMouseMove);
    document.addEventListener('mouseup', onGlobalMouseUp);
  }

  function onGlobalMouseUp() {
    // Save all on drag end
    saveNum('sm_bp_event_pct', eventLogPct);
    saveNum('sm_bp_chat_pct', chatPct);
    saveNum('sm_bp_height', bottomHeight);
    saveNum('sm_bp_map_pct', mapPct);
    stopDrag();
  }

  function onGlobalMouseMove(e: MouseEvent) {
    if (dragKind === 'event-chat') moveEventChat(e);
    else if (dragKind === 'chat-aq') moveChatAq(e);
    else if (dragKind === 'height') moveHeight(e);
    else if (dragKind === 'map') moveMap(e);
  }

  // ======== Bottom panel element ref ========
  let bottomPanelEl: HTMLDivElement | undefined = $state(undefined);

  // ======== 1) EventLog ↔ Chat divider (horizontal %) ========
  let eventLogPct = $state(loadNum('sm_bp_event_pct', 45, 15, 75));

  function moveEventChat(e: MouseEvent) {
    if (!bottomPanelEl) return;
    const rect = bottomPanelEl.getBoundingClientRect();
    const padding = 16;
    // total inner width minus map section
    const mapSection = showMap ? (mapPct / 100) * (rect.width - 2 * padding) + 4 : 0;
    const available = rect.width - 2 * padding - mapSection;
    const rel = e.clientX - rect.left - padding;
    let pct = (rel / available) * 100;
    eventLogPct = Math.round(Math.max(15, Math.min(75, pct)));
  }

  // ======== 2) Chat ↔ ActionQueue divider (horizontal %) ========
  let chatPct = $state(loadNum('sm_bp_chat_pct', 35, 15, 70));

  function moveChatAq(e: MouseEvent) {
    if (!bottomPanelEl) return;
    const rect = bottomPanelEl.getBoundingClientRect();
    const padding = 16;
    const mapSection = showMap ? (mapPct / 100) * (rect.width - 2 * padding) + 4 : 0;
    const available = rect.width - 2 * padding - mapSection;
    const rel = e.clientX - rect.left - padding;
    // chatPct is relative to the same total, but Chat starts after EventLog
    let chatEnd = (rel / available) * 100;
    // Chat starts at eventLogPct + handle(~1%), so chatPct = chatEnd - eventLogPct - ~1
    let cp = chatEnd - eventLogPct - 1;
    chatPct = Math.round(Math.max(15, Math.min(70, cp)));
  }

  // ======== 3) Bottom panel height (vertical px) ========
  let bottomHeight = $state(loadNum('sm_bp_height', 200, 100, 500));

  function moveHeight(e: MouseEvent) {
    // Height handle is at the top of the bottom panel
    const viewH = window.innerHeight;
    let h = viewH - e.clientY;
    bottomHeight = Math.round(Math.max(100, Math.min(500, h)));
  }

  // ======== 4) Map panel ========
  let showMap = $state(loadBool('sm_bp_map', false));
  let mapPct = $state(loadNum('sm_bp_map_pct', 30, 10, 60));

  function toggleMap() {
    showMap = !showMap;
    saveBool('sm_bp_map', showMap);
  }

  function moveMap(e: MouseEvent) {
    if (!bottomPanelEl) return;
    const rect = bottomPanelEl.getBoundingClientRect();
    const padding = 16;
    const totalInner = rect.width - 2 * padding;
    // Map starts from the right edge
    const fromRight = rect.right - padding - e.clientX;
    let pct = (fromRight / totalInner) * 100;
    mapPct = Math.round(Math.max(10, Math.min(60, pct)));
    saveNum('sm_bp_map_pct', mapPct);
  }

  // ======== Computed grid columns ========
  // Layout: [EventLog] [handle] [Chat] [handle] [ActionQueue] [handle?] [Map?]
  let gridColumns = $derived.by(() => {
    const aqPct = Math.max(5, 100 - eventLogPct - chatPct - 2); // ~2% for handles
    const mainCols = `${eventLogPct}fr 4px ${chatPct}fr 4px ${aqPct}fr`;
    if (showMap) {
      return `${mainCols} 4px ${mapPct}fr`;
    }
    return mainCols;
  });

  // ======== Tab bar horizontal scroll ========
  let tabBarWrapperEl: HTMLDivElement | undefined = $state(undefined);

  function onTabBarWheel(e: WheelEvent) {
    if (!tabBarWrapperEl) return;
    const scrollEl = tabBarWrapperEl.querySelector('.mdc-tab-scroller__scroll-area') as HTMLElement
      ?? tabBarWrapperEl;
    e.preventDefault();
    scrollEl.scrollLeft += e.deltaY;
  }
</script>

{#if !authStore.isLoggedIn}
  <LoginScreen />
{:else}
  <div class="app-shell" class:dragging={isDragging}>
    <StatusBar />

    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="tab-bar-wrapper"
      bind:this={tabBarWrapperEl}
      onwheel={onTabBarWheel}
    >
      <TabBar tabs={TABS} bind:active={uiStore.activeTab}>
        {#snippet tab(t)}
          <Tab tab={t}>
            <Icon class="material-icons">{t.icon}</Icon>
            <Label>{t.label}</Label>
          </Tab>
        {/snippet}
      </TabBar>
    </div>

    <main class="tab-content">
      {#if uiStore.activeTab?.label === 'Navigation'}
        <NavigationTab />
      {:else if uiStore.activeTab?.label === 'Combat'}
        <CombatTab />
      {:else if uiStore.activeTab?.label === 'Mining'}
        <MiningTab />
      {:else if uiStore.activeTab?.label === 'Trading'}
        <TradingTab />
      {:else if uiStore.activeTab?.label === 'Ship'}
        <ShipTab />
      {:else if uiStore.activeTab?.label === 'Crafting'}
        <CraftingTab />
      {:else if uiStore.activeTab?.label === 'Faction'}
        <FactionTab />
      {:else if uiStore.activeTab?.label === 'Base'}
        <BaseTab />
      {:else if uiStore.activeTab?.label === 'Info'}
        <InfoTab />
      {:else if uiStore.activeTab?.label === 'Settings'}
        <SettingsTab />
      {/if}
    </main>

    <!-- Vertical resize handle (bottom panel height) -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="height-handle" onmousedown={(e) => startDrag('height', e)}>
      <button class="map-toggle" onclick={toggleMap} title={showMap ? 'Hide Map' : 'Show Map'}>
        <span class="material-icons" style="font-size:14px">{showMap ? 'map' : 'map'}</span>
        MAP
      </button>
    </div>

    <div
      class="bottom-panel"
      bind:this={bottomPanelEl}
      style="grid-template-columns: {gridColumns}; height: {bottomHeight}px;"
    >
      <EventLog />

      <!-- EventLog ↔ Chat handle -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="resize-handle-v"
        onmousedown={(e) => startDrag('event-chat', e)}
      ></div>

      <ChatPanel />

      <!-- Chat ↔ ActionQueue handle -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="resize-handle-v"
        onmousedown={(e) => startDrag('chat-aq', e)}
      ></div>

      <ActionQueue />

      <!-- Map section (conditional) -->
      {#if showMap}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="resize-handle-v"
          onmousedown={(e) => startDrag('map', e)}
        ></div>
        <div class="map-container">
          <iframe
            src="https://www.spacemolt.com/map"
            title="SpaceMolt Map"
            class="map-iframe"
          ></iframe>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .app-shell {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }

  .tab-content {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px;
    background: #060a10;
  }

  /* ---- Vertical resize handles (column dividers) ---- */
  .resize-handle-v {
    width: 4px;
    cursor: col-resize;
    background: rgba(79, 195, 247, 0.12);
    border-radius: 2px;
    transition: background 0.15s;
    flex-shrink: 0;
  }

  .resize-handle-v:hover,
  .dragging .resize-handle-v {
    background: rgba(79, 195, 247, 0.4);
  }

  /* ---- Height handle (horizontal bar at top of bottom panel) ---- */
  .height-handle {
    height: 6px;
    cursor: ns-resize;
    background: rgba(79, 195, 247, 0.08);
    border-top: 1px solid rgba(79, 195, 247, 0.15);
    transition: background 0.15s;
    flex-shrink: 0;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-right: 16px;
  }

  .height-handle:hover,
  .dragging .height-handle {
    background: rgba(79, 195, 247, 0.18);
  }

  /* ---- Map toggle button ---- */
  .map-toggle {
    position: absolute;
    right: 16px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    gap: 3px;
    background: rgba(79, 195, 247, 0.1);
    border: 1px solid rgba(79, 195, 247, 0.25);
    border-radius: 3px;
    color: #4fc3f7;
    font-size: 0.58rem;
    font-family: 'Roboto Mono', monospace;
    font-weight: 600;
    padding: 0 6px;
    height: 18px;
    cursor: pointer;
    transition: all 0.15s;
    z-index: 1;
  }

  .map-toggle:hover {
    background: rgba(79, 195, 247, 0.2);
    border-color: rgba(79, 195, 247, 0.5);
  }

  /* ---- Map container ---- */
  .map-container {
    overflow: hidden;
    border: 1px solid rgba(79, 195, 247, 0.12);
    border-radius: 4px;
    background: #060a10;
  }

  .map-iframe {
    border: none;
    width: 200%;
    height: 200%;
    transform: scale(0.5);
    transform-origin: top left;
  }

  /* Prevent text selection while dragging */
  .dragging {
    user-select: none;
  }
</style>
