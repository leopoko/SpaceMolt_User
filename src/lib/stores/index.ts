export { connectionStore } from './connection.svelte';
export { authStore } from './auth.svelte';
export { playerStore } from './player.svelte';
export { shipStore } from './ship.svelte';
export { systemStore } from './system.svelte';
export { combatStore } from './combat.svelte';
export { marketStore } from './market.svelte';
export { marketMemoStore } from './marketMemo.svelte';
export { systemMemoStore } from './systemMemo.svelte';
export { craftingStore } from './crafting.svelte';
export { factionStore } from './faction.svelte';
export { baseStore } from './base.svelte';
export { chatStore } from './chat.svelte';
export { eventsStore } from './events.svelte';
export { contactsStore } from './contacts.svelte';
export { catalogStore } from './catalog.svelte';
export { mapSettingsStore } from './mapSettings.svelte';
export { forumStore } from './forum.svelte';
export { missionStore } from './mission.svelte';
export { loopStore } from './loop.svelte';
export { scavengerStore } from './scavenger.svelte';
export { explorerStore } from './explorer.svelte';
export { bookmarkStore } from './bookmark.svelte';
export { storageMemoStore } from './storageMemo.svelte';
export { tradeStore } from './trade.svelte';
export { uiStore, TABS } from './ui.svelte';
export type { TabDef } from './ui.svelte';
export { actionQueueStore } from './actionQueue.svelte';
export { shipCatalogStore } from './shipCatalog.svelte';

// --- Multi-user support ---
// Import all stores for the reset function
import { connectionStore } from './connection.svelte';
import { playerStore } from './player.svelte';
import { shipStore } from './ship.svelte';
import { systemStore } from './system.svelte';
import { combatStore } from './combat.svelte';
import { marketStore } from './market.svelte';
import { craftingStore } from './crafting.svelte';
import { factionStore } from './faction.svelte';
import { baseStore } from './base.svelte';
import { chatStore } from './chat.svelte';
import { eventsStore } from './events.svelte';
import { contactsStore } from './contacts.svelte';
import { catalogStore } from './catalog.svelte';
import { forumStore } from './forum.svelte';
import { missionStore } from './mission.svelte';
import { loopStore } from './loop.svelte';
import { scavengerStore } from './scavenger.svelte';
import { tradeStore } from './trade.svelte';
import { actionQueueStore } from './actionQueue.svelte';
import { shipCatalogStore } from './shipCatalog.svelte';

/**
 * Reset all game-state stores to their initial values.
 * Called on logout to ensure the next user gets a clean session.
 * Does NOT reset user-preference stores (mapSettings, ui/darkMode, bookmarks, memos)
 * since those are per-device settings, not per-user game state.
 */
export function resetAllGameStores() {
  connectionStore.reset();
  playerStore.reset();
  shipStore.reset();
  systemStore.reset();
  combatStore.reset();
  marketStore.reset();
  craftingStore.reset();
  factionStore.reset();
  baseStore.reset();
  chatStore.reset();
  eventsStore.reset();
  contactsStore.reset();
  catalogStore.reset();
  forumStore.reset();
  missionStore.reset();
  loopStore.reset();
  scavengerStore.reset();
  tradeStore.reset();
  actionQueueStore.clear();
  shipCatalogStore.reset();
}
