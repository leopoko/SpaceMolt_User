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

  // ---- Resizable bottom panel ----
  const STORAGE_KEY = 'sm_bottom_panel_ratio';
  const MIN_EVENT_PCT = 20;
  const MAX_EVENT_PCT = 80;

  /** Percentage of the EventLog+Chat area that EventLog occupies */
  let eventLogPct = $state(loadRatio());

  function loadRatio(): number {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const v = Number(saved);
        if (v >= MIN_EVENT_PCT && v <= MAX_EVENT_PCT) return v;
      }
    } catch { /* ignore */ }
    return 60; // default: 60% EventLog, 40% Chat
  }

  function saveRatio(pct: number) {
    try { localStorage.setItem(STORAGE_KEY, String(pct)); } catch { /* ignore */ }
  }

  let isDragging = $state(false);
  let bottomPanelEl: HTMLDivElement | undefined = $state(undefined);

  function onDragStart(e: MouseEvent) {
    e.preventDefault();
    isDragging = true;
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
  }

  function onDragMove(e: MouseEvent) {
    if (!isDragging || !bottomPanelEl) return;
    const rect = bottomPanelEl.getBoundingClientRect();
    // ActionQueue is 220px + gap on the right; compute available width for EventLog+Chat
    const actionQueueWidth = 220 + 8; // width + gap
    const availableWidth = rect.width - actionQueueWidth - 16; // subtract padding
    const relativeX = e.clientX - rect.left - 8; // subtract left padding
    let pct = (relativeX / availableWidth) * 100;
    pct = Math.max(MIN_EVENT_PCT, Math.min(MAX_EVENT_PCT, pct));
    eventLogPct = Math.round(pct);
  }

  function onDragEnd() {
    isDragging = false;
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
    saveRatio(eventLogPct);
  }

  let gridColumns = $derived(`${eventLogPct}fr 4px ${100 - eventLogPct}fr 220px`);

  // ---- Tab bar horizontal scroll with mouse wheel ----
  let tabBarWrapperEl: HTMLDivElement | undefined = $state(undefined);

  function onTabBarWheel(e: WheelEvent) {
    if (!tabBarWrapperEl) return;
    // Find the inner scrollable element
    const scrollEl = tabBarWrapperEl.querySelector('.mdc-tab-scroller__scroll-area') as HTMLElement
      ?? tabBarWrapperEl;
    e.preventDefault();
    scrollEl.scrollLeft += e.deltaY;
  }
</script>

{#if !authStore.isLoggedIn}
  <LoginScreen />
{:else}
  <div class="app-shell">
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

    <div
      class="bottom-panel"
      class:dragging={isDragging}
      bind:this={bottomPanelEl}
      style="grid-template-columns: {gridColumns};"
    >
      <EventLog />
      <div
        class="resize-handle"
        onmousedown={onDragStart}
        role="separator"
        aria-orientation="vertical"
        tabindex="-1"
      ></div>
      <ChatPanel />
      <ActionQueue />
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

  /* ---- Resize handle ---- */
  .resize-handle {
    width: 4px;
    cursor: col-resize;
    background: rgba(79, 195, 247, 0.12);
    border-radius: 2px;
    transition: background 0.15s;
    flex-shrink: 0;
  }

  .resize-handle:hover,
  .dragging .resize-handle {
    background: rgba(79, 195, 247, 0.4);
  }

  /* Prevent text selection while dragging */
  .dragging {
    user-select: none;
  }
</style>
