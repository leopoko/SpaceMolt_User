<script lang="ts">
  import TabBar from '@smui/tab-bar';
  import Tab, { Label, Icon } from '@smui/tab';
  import { authStore } from '$lib/stores/auth.svelte';
  import { uiStore, TABS } from '$lib/stores/ui.svelte';
  import LoginScreen from '$lib/components/LoginScreen.svelte';
  import StatusBar from '$lib/components/StatusBar.svelte';
  import EventLog from '$lib/components/EventLog.svelte';
  import ChatPanel from '$lib/components/ChatPanel.svelte';
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
</script>

{#if !authStore.isLoggedIn}
  <LoginScreen />
{:else}
  <div class="app-shell">
    <StatusBar />

    <TabBar tabs={TABS} bind:active={uiStore.activeTab}>
      {#snippet tab(t)}
        <Tab tab={t}>
          <Icon class="material-icons">{t.icon}</Icon>
          <Label>{t.label}</Label>
        </Tab>
      {/snippet}
    </TabBar>

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

    <div class="bottom-panel">
      <EventLog />
      <ChatPanel />
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
</style>
