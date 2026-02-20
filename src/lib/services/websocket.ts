import type {
  WsMessage, StateUpdate, StateUpdatePayload, WelcomePayload,
  CombatEvent, ScanResult, TargetScanResult, MarketData, MarketItem, MyOrder, StorageData,
  Faction, Recipe, FleetData, ChatMessage, EventLogEntry, Module,
  CatalogType, CatalogResponse,
  BaseInfo, BaseCondition,
  ForumThread, ForumReply, ForumCategory,
  TradeOffer,
  BattleStatus, BattleStance
} from '$lib/types/game';
import { connectionStore } from '$lib/stores/connection.svelte';
import { authStore } from '$lib/stores/auth.svelte';
import { playerStore } from '$lib/stores/player.svelte';
import { shipStore } from '$lib/stores/ship.svelte';
import { systemStore } from '$lib/stores/system.svelte';
import { combatStore } from '$lib/stores/combat.svelte';
import { battleStore } from '$lib/stores/battle.svelte';
import { marketStore } from '$lib/stores/market.svelte';
import { craftingStore } from '$lib/stores/crafting.svelte';
import { factionStore, type FactionListItem, type FactionInvite } from '$lib/stores/faction.svelte';
import { baseStore } from '$lib/stores/base.svelte';
import { chatStore } from '$lib/stores/chat.svelte';
import { eventsStore } from '$lib/stores/events.svelte';
import { actionQueueStore } from '$lib/stores/actionQueue.svelte';
import { catalogStore } from '$lib/stores/catalog.svelte';
import { contactsStore } from '$lib/stores/contacts.svelte';
import { missionStore } from '$lib/stores/mission.svelte';
import { forumStore } from '$lib/stores/forum.svelte';
import { systemMemoStore } from '$lib/stores/systemMemo.svelte';
import { explorerStore } from '$lib/stores/explorer.svelte';
import { scavengerStore } from '$lib/stores/scavenger.svelte';
import { tradeStore } from '$lib/stores/trade.svelte';
import { userDataSync } from '$lib/services/userDataSync';

// All server messages use { type, payload: {...} }.
// p() extracts payload, falling back to the message itself for robustness.
function p<T>(msg: WsMessage): T {
  return (msg.payload ?? msg) as T;
}

const CATALOG_TYPES = new Set(['ships', 'skills', 'recipes', 'items']);

// Detect catalog responses: { type: "ok", payload: { type: "ships"|..., items: [...], total_pages: N } }
function isCatalogResponse(pl: Record<string, unknown>): boolean {
  return CATALOG_TYPES.has(pl.type as string) && Array.isArray(pl.items) && pl.total_pages !== undefined;
}

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 2000;
  private readonly maxReconnectDelay = 30000;
  private messageQueue: WsMessage[] = [];
  private manualDisconnect = false;

  // ---- Lifecycle ----

  connect(url?: string) {
    if (url) connectionStore.serverUrl = url;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

    this.manualDisconnect = false;
    connectionStore.status = 'connecting';
    connectionStore.lastError = null;

    try {
      this.ws = new WebSocket(connectionStore.serverUrl);
    } catch (e) {
      connectionStore.status = 'error';
      connectionStore.lastError = String(e);
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => this.onOpen();
    this.ws.onmessage = (e: MessageEvent) => this.onMessage(e);
    this.ws.onclose = () => this.onClose();
    this.ws.onerror = (e) => {
      connectionStore.status = 'error';
      connectionStore.lastError = 'WebSocket error';
      console.error('WebSocket error:', e);
    };
  }

  disconnect() {
    this.manualDisconnect = true;
    this.cancelReconnect();
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    connectionStore.status = 'disconnected';
    connectionStore.reconnectAttempts = 0;
  }

  // ---- Internal handlers ----

  private onOpen() {
    connectionStore.status = 'connected';
    connectionStore.reconnectAttempts = 0;
    this.reconnectDelay = 2000;

    // Re-authenticate if was logged in
    if (authStore.isLoggedIn && authStore.savedUsername && authStore.savedPassword) {
      this.rawSend({ type: 'login', payload: { username: authStore.savedUsername, password: authStore.savedPassword } });
    }

    // Flush queued messages
    const queue = [...this.messageQueue];
    this.messageQueue = [];
    queue.forEach(m => this.send(m));
  }

  private onClose() {
    connectionStore.status = 'disconnected';
    if (!this.manualDisconnect) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    this.cancelReconnect();
    connectionStore.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.connect();
      this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, this.maxReconnectDelay);
    }, this.reconnectDelay);
  }

  private cancelReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // ---- Message dispatch ----

  private onMessage(event: MessageEvent) {
    const raw = event.data as string;
    // Try single JSON first (fast path)
    try {
      const msg: WsMessage = JSON.parse(raw);
      this.dispatch(msg);
      return;
    } catch { /* may be concatenated JSON */ }

    // Server sometimes concatenates multiple JSON objects in one frame
    // e.g. {"type":"error",...}{"type":"battle_update",...}
    const messages = this.splitConcatenatedJson(raw);
    if (messages.length === 0) {
      console.error('Invalid WS message:', raw);
      return;
    }
    for (const msg of messages) {
      this.dispatch(msg);
    }
  }

  /** Split concatenated JSON objects like `{...}{...}` into individual parsed messages.
   *  Handles strings (skips braces inside "...") and escaped quotes. */
  private splitConcatenatedJson(raw: string): WsMessage[] {
    const results: WsMessage[] = [];
    let depth = 0;
    let start = -1;
    let inString = false;
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (inString) {
        if (ch === '\\') { i++; continue; }  // skip escaped char
        if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') { inString = true; continue; }
      if (ch === '{') {
        if (depth === 0) start = i;
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0 && start !== -1) {
          try {
            results.push(JSON.parse(raw.substring(start, i + 1)));
          } catch {
            console.error('Failed to parse JSON segment:', raw.substring(start, i + 1));
          }
          start = -1;
        }
      }
    }
    return results;
  }

  private dispatch(msg: WsMessage) {
    console.debug('[WS →]', msg.type, msg);

    switch (msg.type) {
      case 'welcome': {
        const pl = p<WelcomePayload>(msg);
        connectionStore.tickRate = pl.tick_rate ?? 10;
        if (pl.current_tick !== undefined) connectionStore.tick = pl.current_tick;
        eventsStore.add({ type: 'system', message: `Connected to SpaceMolt v${pl.version ?? '?'} – ${pl.motd ?? ''}` });
        break;
      }

      case 'logged_in': {
        const pl = p<{ player?: Record<string, unknown>; ship?: Record<string, unknown>; system?: Record<string, unknown> }>(msg);
        authStore.isLoggedIn = true;
        authStore.username = (pl.player?.username as string) ?? authStore.savedUsername;
        if (pl.player) playerStore.update(pl.player as never);
        if (pl.ship) shipStore.updateCurrent(pl.ship as never);
        if (pl.system) systemStore.update(pl.system as never);
        eventsStore.add({ type: 'system', message: `Logged in as ${authStore.username}` });
        // Sync user data (memos, bookmarks, etc.) from cloud
        userDataSync.init(authStore.savedUsername, authStore.savedPassword);
        break;
      }

      case 'registered': {
        const pl = p<{ password?: string; player_id?: string }>(msg);
        authStore.isLoggedIn = true;
        authStore.username = authStore.savedUsername;
        const pw = pl.password;
        if (pw) {
          authStore.persistCredentials(authStore.savedUsername, pw);
          authStore.registeredPassword = pw; // shown to user so they can save it
          eventsStore.add({ type: 'system', message: `YOUR PASSWORD: ${pw} — Save this! It is auto-filled but write it down.` });
        }
        eventsStore.add({ type: 'system', message: `Registered as ${authStore.username}` });
        this.getStatus();
        this.getSystem();
        break;
      }

      case 'login_failed': {
        const pl = p<{ message?: string }>(msg);
        const errMsg = pl.message ?? 'Invalid credentials';
        console.debug('[WS login_failed]', errMsg);
        authStore.loginError = errMsg;
        eventsStore.add({ type: 'error', message: errMsg });
        break;
      }

      case 'error': {
        const pl = p<{ code?: string; message?: string; command?: string }>(msg);
        const errMsg = pl.message ?? 'Unknown error';
        console.debug('[WS error] code:', pl.code, '| message:', errMsg);
        // Silently handle not_in_battle errors from get_battle_status polling
        if (pl.code === 'not_in_battle') {
          battleStore.clear();
          break;
        }
        // Show combat-related errors as combat events (more visible in battle UI)
        if (pl.code === 'out_of_ammo' || pl.code === 'no_weapons') {
          eventsStore.add({ type: 'combat', message: errMsg });
        } else {
          eventsStore.add({ type: 'error', message: errMsg });
        }
        // Clear travel state if a travel/jump is in progress
        // Server sends generic 'error' type for some failures (e.g. not_connected)
        if (systemStore.travel.in_progress) {
          systemStore.setTravel({ in_progress: false, destination_id: null, destination_name: null });
        }
        // Stop action queue on error (e.g. mine no_resources)
        // But allow continue if the action has continueOnError flag (e.g. iterative Deposit All)
        if (actionQueueStore.currentContinueOnError) {
          eventsStore.add({ type: 'info', message: `[Queue] エラーをスキップして続行` });
        } else if (actionQueueStore.currentAction || actionQueueStore.holding || actionQueueStore.items.length > 0) {
          eventsStore.add({ type: 'error', message: `[Queue] エラーにより停止 (残り${actionQueueStore.items.length}件キャンセル)` });
          actionQueueStore.clear();
        }
        if (!authStore.isLoggedIn) {
          authStore.loginError = errMsg;
        }
        break;
      }

      case 'state_update': {
        const pl = p<StateUpdatePayload>(msg);
        if (pl.player) playerStore.update(pl.player);
        if (pl.ship) shipStore.updateCurrent(pl.ship);
        // modules: null means no modules; truthy array updates; undefined = no change
        if (pl.modules === null) shipStore.updateModules([]);
        else if (pl.modules) shipStore.updateModules(pl.modules);
        if (pl.nearby) systemStore.setNearby(pl.nearby);
        // NOTE: state_update.in_combat is unreliable for PvP battles (often false
        // even during active battle). Only use battle_started / battle_ended messages
        // for battleStore. Do NOT let in_combat:false clear battleStore.
        if (pl.in_combat !== undefined) {
          // Only trust in_combat for NPC pirate combat, not PvP battles
          if (!battleStore.inBattle) {
            combatStore.setInCombat(pl.in_combat);
          }
        }
        // Also handle legacy fields (events, chat, system) for forward-compatibility
        const legacy = pl as unknown as StateUpdate;
        if (legacy.system) systemStore.update(legacy.system);
        if (legacy.events) legacy.events.forEach(e => eventsStore.add(e));
        if (legacy.chat) legacy.chat.forEach(c => chatStore.addMessage(c));
        if (pl.tick !== undefined) {
          const prevTick = connectionStore.tick;
          connectionStore.tick = pl.tick;
          connectionStore.lastTickTime = Date.now();
          // Execute next queued action only when tick number advances
          // (dedup via tick number in case both tick + state_update fire)
          if (pl.tick > prevTick) {
            actionQueueStore.executeNext(pl.tick);
          }
        }
        break;
      }

      case 'tick': {
        const pl = p<{ tick?: number }>(msg);
        connectionStore.tick = pl.tick ?? connectionStore.tick + 1;
        connectionStore.lastTickTime = Date.now();
        systemStore.setTravel({ current_tick: connectionStore.tick });
        // Update jump ETA label if a persistent jump is holding the queue
        if (actionQueueStore.holding && systemStore.travel.type === 'jump' && systemStore.travel.arrival_tick != null) {
          const destName = systemStore.travel.destination_name ?? '...';
          const remaining = systemStore.travel.arrival_tick - connectionStore.tick;
          if (remaining > 0) {
            actionQueueStore.updateCurrentLabel(`Jump → ${destName} (ETA ${remaining} tick${remaining !== 1 ? 's' : ''})`);
          } else {
            actionQueueStore.updateCurrentLabel(`Jump → ${destName} (arriving...)`);
          }
        }
        actionQueueStore.executeNext(connectionStore.tick);
        break;
      }

      case 'player_status': {
        const pl = p<{ player?: never; ship?: never }>(msg);
        if (pl.player) playerStore.update(pl.player);
        if (pl.ship) shipStore.updateCurrent(pl.ship);
        break;
      }

      case 'system_info': {
        const pl = p<never>(msg);
        systemStore.update(pl);
        break;
      }

      case 'action_result': {
        const pl = p<{ command?: string; tick?: number; result?: Record<string, unknown> }>(msg);
        const cmd = pl.command;
        const result = pl.result;
        if (cmd === 'travel' && result) {
          if (result.action === 'arrived') {
            const poiName = (result.poi as string) ?? '';
            const poiId = (result.poi_id as string) ?? null;
            systemStore.setTravel({ in_progress: false, destination_id: null, destination_name: null });
            if (poiId) {
              playerStore.update({ current_poi: poiId, poi_id: poiId });
            }
            eventsStore.add({ type: 'nav', message: `Arrived at ${poiName}` });
            this.getSystem();
          }
        } else if (cmd === 'jump' && result) {
          if (result.action === 'arrived' || result.action === 'jumped') {
            const dest = (result.system_name as string) ?? (result.system as string) ?? '';
            systemStore.setTravel({ in_progress: false, destination_id: null, destination_name: null });
            eventsStore.add({ type: 'nav', message: `Jumped to ${dest}` });
            // Release the persistent jump action from queue
            actionQueueStore.completeCurrentAction();
            this.getSystem();
          }
        } else if (cmd === 'scan' && result) {
          const scanResult: TargetScanResult = {
            target_id: (result.target_id as string) ?? '',
            success: (result.success as boolean) ?? false,
            revealed_info: (result.revealed_info as string[] | null) ?? null,
            tick: pl.tick,
            username: result.username as string | undefined,
            ship_class: result.ship_class as string | undefined,
            cloaked: result.cloaked as boolean | undefined,
            hull: result.hull as number | undefined,
            shield: result.shield as number | undefined,
            faction_id: result.faction_id as string | undefined,
          };
          combatStore.setTargetScan(scanResult);
          if (scanResult.success) {
            eventsStore.add({ type: 'combat', message: `Scan complete: ${scanResult.username ?? scanResult.target_id}` });
          } else {
            eventsStore.add({ type: 'combat', message: `Scan failed: ${scanResult.target_id}` });
          }
        } else if (cmd === 'battle' && result) {
          const message = (result.message as string) ?? 'Battle action executed';
          eventsStore.add({ type: 'combat', message });
          // Refresh battle status after any battle action
          this.getBattleStatus();
        } else if (cmd === 'attack' && result) {
          const message = (result.message as string) ?? 'Attack initiated';
          eventsStore.add({ type: 'combat', message });
          // Auto-poll battle status when attack succeeds (entering battle)
          this.getBattleStatus();
        } else if (cmd === 'deposit_credits' && result) {
          const amount = (result.amount as number) ?? 0;
          eventsStore.add({ type: 'trade', message: `Deposited ₡${amount.toLocaleString()} to station` });
          this.viewStorage();
        } else if (cmd === 'withdraw_credits' && result) {
          const amount = (result.amount as number) ?? 0;
          eventsStore.add({ type: 'trade', message: `Withdrew ₡${amount.toLocaleString()} from station` });
          this.viewStorage();
        } else if (cmd === 'deposit_items' && result) {
          const itemId = (result.item_id as string) ?? '';
          const qty = (result.quantity as number) ?? 0;
          eventsStore.add({ type: 'trade', message: `Deposited ${qty}x ${itemId} to station` });
          this.viewStorage();
        } else if (cmd === 'withdraw_items' && result) {
          const itemId = (result.item_id as string) ?? '';
          const qty = (result.quantity as number) ?? 0;
          eventsStore.add({ type: 'trade', message: `Withdrew ${qty}x ${itemId} from station` });
          this.viewStorage();
        } else if (cmd === 'set_home_base' && result) {
          const message = (result.message as string) ?? 'Home base updated';
          eventsStore.add({ type: 'info', message });
          // Update player's home_base field
          if (result.base_id) {
            playerStore.update({ home_base: result.base_id as string });
          }
        } else if (cmd === 'install_mod') {
          const modId = (result?.module_id as string) ?? '';
          const message = (result?.message as string) ?? `Module installed: ${modId}`;
          eventsStore.add({ type: 'info', message });
          if (result?.ship) shipStore.updateCurrent(result.ship as never);
          if (result?.modules) shipStore.updateModules(result.modules as Module[]);
          // Always refresh ship data to sync modules/cargo/CPU/PWR
          this.getStatus();
        } else if (cmd === 'uninstall_mod') {
          const modId = (result?.module_id as string) ?? '';
          const message = (result?.message as string) ?? `Module uninstalled: ${modId}`;
          eventsStore.add({ type: 'info', message });
          if (result?.ship) shipStore.updateCurrent(result.ship as never);
          if (result?.modules) shipStore.updateModules(result.modules as Module[]);
          // Always refresh ship data to sync modules/cargo/CPU/PWR
          this.getStatus();
        } else if (cmd === 'craft') {
          const message = (result?.message as string) ?? 'Craft complete';
          craftingStore.setLastResult(message);
          eventsStore.add({ type: 'info', message });
          if (result?.ship) shipStore.updateCurrent(result.ship as never);
          this.viewStorage();
        } else if (cmd === 'survey_system') {
          const message = (result?.message as string) ?? 'Survey complete';
          eventsStore.add({ type: 'nav', message });
          // Survey may reveal new POIs; refresh system data
          this.getSystem();
        } else if (cmd === 'loot_wreck') {
          const message = (result?.message as string) ?? 'Loot collected';
          eventsStore.add({ type: 'info', message });
          // Refresh wreck list after looting
          this.getWrecks();
        } else if (cmd === 'tow_wreck') {
          const message = (result?.message as string) ?? 'Wreck attached to tow';
          eventsStore.add({ type: 'info', message });
          scavengerStore.setTowing(true);
          this.getWrecks();
        } else if (cmd === 'release_tow') {
          const message = (result?.message as string) ?? 'Tow released';
          eventsStore.add({ type: 'info', message });
          scavengerStore.setTowing(false);
          this.getWrecks();
        } else if (cmd === 'sell_wreck') {
          const message = (result?.message as string) ?? 'Wreck sold';
          eventsStore.add({ type: 'trade', message });
          scavengerStore.setTowing(false);
        } else if (cmd === 'scrap_wreck') {
          const message = (result?.message as string) ?? 'Wreck scrapped';
          eventsStore.add({ type: 'info', message });
          scavengerStore.setTowing(false);
        } else if (cmd === 'self_destruct') {
          const message = (result?.message as string) ?? 'Ship self-destructed';
          eventsStore.add({ type: 'combat', message });
        } else if (cmd === 'jettison' && result) {
          const itemId = (result.item_id as string) ?? '';
          const qty = (result.quantity as number) ?? 0;
          const message = (result.message as string) ?? `Jettisoned ${qty}x ${itemId}`;
          eventsStore.add({ type: 'info', message });
        } else if (cmd === 'trade_offer' && result) {
          const tradeId = (result.trade_id as string) ?? '';
          const message = (result.message as string) ?? 'Trade offer sent';
          if (tradeId) {
            const offerItems = Array.isArray(result.offer_items) ? (result.offer_items as TradeOffer['offer_items']) : [];
            const requestItems = Array.isArray(result.request_items) ? (result.request_items as TradeOffer['request_items']) : [];
            tradeStore.addOutgoing({
              trade_id: tradeId,
              offerer_id: (result.offerer_id as string) ?? '',
              offerer_name: authStore.username,
              target_id: (result.target_id as string) ?? '',
              target_name: (result.target_name as string) ?? (result.target as string) ?? '',
              offer_credits: (result.offer_credits as number) ?? (result.credits as number) ?? 0,
              offer_items: offerItems,
              request_credits: (result.request_credits as number) ?? 0,
              request_items: requestItems,
              status: 'pending',
              created_at: Date.now(),
            });
          }
          tradeStore.setLastResult(message);
          eventsStore.add({ type: 'trade', message });
        } else if (cmd === 'trade_accept' && result) {
          const tradeId = (result.trade_id as string) ?? '';
          const message = (result.message as string) ?? 'Trade accepted!';
          tradeStore.updateStatus(tradeId, 'completed');
          tradeStore.setLastResult(message);
          eventsStore.add({ type: 'trade', message });
        } else if (cmd === 'trade_decline' && result) {
          const tradeId = (result.trade_id as string) ?? '';
          const message = (result.message as string) ?? 'Trade declined';
          tradeStore.updateStatus(tradeId, 'declined');
          tradeStore.setLastResult(message);
          eventsStore.add({ type: 'trade', message });
        } else if (cmd === 'trade_cancel' && result) {
          const tradeId = (result.trade_id as string) ?? '';
          const message = (result.message as string) ?? 'Trade cancelled';
          tradeStore.updateStatus(tradeId, 'cancelled');
          tradeStore.setLastResult(message);
          eventsStore.add({ type: 'trade', message });
        } else {
          // Generic action_result: log if there's useful info
          const action = result?.action as string ?? cmd ?? '';
          const message = (result?.message as string) ?? '';
          if (message) {
            eventsStore.add({ type: 'info', message });
          } else if (action) {
            eventsStore.add({ type: 'info', message: `Action complete: ${action}` });
          }
        }
        break;
      }

      case 'action_error': {
        const pl = p<{ command?: string; tick?: number; code?: string; message?: string }>(msg);
        const cmd = pl.command;
        const errMsg = pl.message ?? pl.code ?? 'Action failed';
        // Clear travel state on travel/jump errors
        if (cmd === 'travel' || cmd === 'jump') {
          systemStore.setTravel({ in_progress: false, destination_id: null, destination_name: null });
        }
        if (cmd === 'craft') {
          craftingStore.setLastResult(errMsg);
        }
        eventsStore.add({ type: 'error', message: errMsg });
        // Stop action queue on action failure
        // But allow continue if the action has continueOnError flag (e.g. iterative Deposit All)
        if (actionQueueStore.currentContinueOnError) {
          eventsStore.add({ type: 'info', message: `[Queue] エラーをスキップして続行` });
        } else if (actionQueueStore.currentAction || actionQueueStore.holding || actionQueueStore.items.length > 0) {
          eventsStore.add({ type: 'error', message: `[Queue] エラーにより停止 (残り${actionQueueStore.items.length}件キャンセル)` });
          actionQueueStore.clear();
        }
        break;
      }

      case 'arrived':
      case 'jumped': {
        const pl = p<{ system_name?: string; destination?: string }>(msg);
        systemStore.setTravel({ in_progress: false, destination_id: null, destination_name: null });
        const dest = pl.system_name ?? pl.destination ?? '';
        eventsStore.add({ type: 'nav', message: `Arrived at ${dest}` });
        // Release the persistent jump action from queue (legacy message path)
        if (msg.type === 'jumped') {
          actionQueueStore.completeCurrentAction();
        }
        this.getSystem();
        break;
      }

      case 'travel_update': {
        const pl = p<{ arrival_tick?: number }>(msg);
        systemStore.setTravel({ in_progress: true, arrival_tick: pl.arrival_tick ?? null });
        // Update jump action label with ETA if a persistent jump is holding the queue
        if (actionQueueStore.holding && systemStore.travel.type === 'jump' && pl.arrival_tick != null) {
          const destName = systemStore.travel.destination_name ?? '...';
          const remaining = pl.arrival_tick - connectionStore.tick;
          if (remaining > 0) {
            actionQueueStore.updateCurrentLabel(`Jump → ${destName} (ETA ${remaining} tick${remaining !== 1 ? 's' : ''})`);
          }
        }
        break;
      }

      case 'docked': {
        const pl = p<{ station_name?: string; station_id?: string }>(msg);
        eventsStore.add({ type: 'nav', message: `Docked at ${pl.station_name ?? ''}` });
        playerStore.update({
          status: 'docked',
          poi_id: pl.station_id ?? null,
          docked_at_base: pl.station_id ?? null
        });
        // Auto-load station info (view_storage is chained from get_base ok handler)
        this.getBase();
        break;
      }

      case 'undocked': {
        eventsStore.add({ type: 'nav', message: 'Undocked' });
        playerStore.update({ status: 'active', poi_id: null, docked_at_base: null });
        baseStore.reset();
        break;
      }

      case 'battle_started': {
        const pl = p<BattleStatus>(msg);
        battleStore.setStatus(pl);
        const participantNames = (pl.participants ?? []).map(pp => pp.username).join(', ');
        eventsStore.add({ type: 'combat', message: `Battle started! Participants: ${participantNames}` });
        break;
      }

      case 'battle_update': {
        const pl = p<BattleStatus>(msg);
        battleStore.setStatus(pl);
        break;
      }

      case 'battle_ended': {
        const pl = p<Record<string, unknown>>(msg);
        const reason = (pl.reason as string) ?? 'unknown';
        const winningSide = pl.winning_side as number;
        const duration = pl.duration as number;
        const destroyed = pl.ships_destroyed as number;
        battleStore.endedSummary = pl;
        battleStore.clear();
        let summary = `Battle ended: ${reason}`;
        if (winningSide && winningSide > 0) summary += ` (side ${winningSide} wins)`;
        if (duration) summary += ` — ${duration} ticks`;
        if (destroyed) summary += `, ${destroyed} ships destroyed`;
        eventsStore.add({ type: 'combat', message: summary });
        break;
      }

      case 'police_combat': {
        const pl = p<{ damage: number; damage_type?: string; destroyed?: boolean; drone_id?: string; target_id?: string; tick?: number }>(msg);
        eventsStore.add({
          type: 'combat',
          message: `Police drone hit for ${pl.damage} ${pl.damage_type ?? ''} dmg${pl.destroyed ? ' — DESTROYED!' : ''}`
        });
        break;
      }

      case 'combat_update': {
        const pl = p<CombatEvent>(msg);
        combatStore.addEvent(pl);
        combatStore.setInCombat(true);
        eventsStore.add({
          type: 'combat',
          message: `${pl.attacker} → ${pl.defender}: ${pl.damage} dmg (${pl.result})`
        });
        // Auto-poll battle status when combat begins
        if (!battleStore.inBattle) {
          this.getBattleStatus();
        }
        break;
      }

      case 'player_died': {
        combatStore.setInCombat(false);
        battleStore.clear();
        eventsStore.add({ type: 'combat', message: 'You were destroyed!' });
        playerStore.update({ status: 'dead' });
        break;
      }

      case 'scan_result': {
        const pl = p<ScanResult & TargetScanResult>(msg);
        // Targeted scan (has target_id) vs area scan (has targets array)
        if (pl.target_id) {
          combatStore.setTargetScan(pl as TargetScanResult);
          eventsStore.add({ type: 'combat', message: `Scan complete: ${pl.username ?? pl.target_id}` });
        } else {
          combatStore.setScanResult(pl as ScanResult);
          eventsStore.add({ type: 'nav', message: `Scan complete: ${pl.targets?.length ?? 0} targets detected` });
        }
        break;
      }

      case 'mining_yield': {
        const pl = p<{ resource_id?: string; resource_name?: string; item?: string; quantity?: number; ship?: never }>(msg);
        const resourceName = pl.resource_name ?? pl.item ?? 'ore';
        eventsStore.add({ type: 'info', message: `Mined ${pl.quantity ?? 0}x ${resourceName}` });
        if (pl.ship) shipStore.updateCurrent(pl.ship);
        // Track mining yield in system memo and auto-save system data
        const yieldSystemId = playerStore.system_id;
        const yieldPoiId = playerStore.poi_id;
        if (yieldSystemId && yieldPoiId && (pl.quantity ?? 0) > 0) {
          if (!systemMemoStore.hasMemo(yieldSystemId)) {
            systemMemoStore.save(systemStore.data);
          }
          systemMemoStore.addMiningYield(yieldSystemId, yieldPoiId, resourceName, pl.quantity!);
        }
        break;
      }

      case 'skill_level_up': {
        const pl = p<{ skill_name?: string; player?: never }>(msg);
        eventsStore.add({ type: 'info', message: `Skill up: ${pl.skill_name ?? ''}` });
        if (pl.player) playerStore.update(pl.player);
        break;
      }

      case 'market_data': {
        const pl = p<MarketData>(msg);
        marketStore.setData(pl);
        break;
      }

      case 'orders_data': {
        const pl = p<{ orders?: MyOrder[] }>(msg);
        marketStore.setMyOrders(pl.orders ?? []);
        break;
      }

      case 'order_cancelled': {
        const pl = p<{ order_id?: string }>(msg);
        marketStore.removeOrder(pl.order_id ?? '');
        eventsStore.add({ type: 'trade', message: 'Order cancelled' });
        break;
      }

      case 'buy_result':
      case 'sell_result': {
        const pl = p<{ message?: string; player?: never; ship?: never }>(msg);
        eventsStore.add({ type: 'trade', message: pl.message ?? 'Trade complete' });
        if (pl.player) playerStore.update(pl.player);
        if (pl.ship) shipStore.updateCurrent(pl.ship);
        break;
      }

      case 'ship_list': {
        const pl = p<FleetData>(msg);
        shipStore.updateFleet(pl);
        break;
      }

      case 'ship_info': {
        const pl = p<{ ship?: never }>(msg);
        if (pl.ship) shipStore.updateCurrent(pl.ship);
        break;
      }

      case 'ship_catalog': {
        const pl = p<{ ships?: never[] }>(msg);
        shipStore.catalog = pl.ships ?? [];
        break;
      }

      case 'storage_data': {
        const pl = p<StorageData>(msg);
        baseStore.setStorage(pl);
        break;
      }

      case 'craft_result': {
        const pl = p<{ message?: string; success?: boolean; ship?: never }>(msg);
        const resultMsg = pl.message ?? (pl.success ? 'Craft complete' : 'Craft failed');
        craftingStore.setLastResult(resultMsg);
        eventsStore.add({ type: 'info', message: resultMsg });
        if (pl.ship) shipStore.updateCurrent(pl.ship);
        this.viewStorage();
        break;
      }

      case 'recipes': {
        const pl = p<{ recipes?: Record<string, Recipe> }>(msg);
        if (pl.recipes && typeof pl.recipes === 'object') {
          craftingStore.setRecipes(pl.recipes);
        }
        break;
      }

      case 'faction_info': {
        const pl = p<Faction>(msg);
        // If the returned faction matches player's faction, update own data
        // Otherwise it's a viewed faction
        if (pl.id && playerStore.faction_id && pl.id === playerStore.faction_id) {
          factionStore.update(pl);
        } else if (pl.id && !playerStore.faction_id) {
          // Player not in a faction, this is a viewed faction
          factionStore.setViewedFaction(pl);
        } else if (pl.id && pl.id !== playerStore.faction_id) {
          factionStore.setViewedFaction(pl);
        } else {
          // Default: update own faction data
          factionStore.update(pl);
        }
        break;
      }

      case 'chat_message': {
        const raw = p<Record<string, unknown>>(msg);
        const normalized: ChatMessage = {
          id: (raw.id as string) ?? String(Date.now()),
          sender_id: (raw.sender_id as string) ?? '',
          sender_name: (raw.sender as string) ?? (raw.sender_name as string) ?? 'Unknown',
          message: (raw.content as string) ?? (raw.message as string) ?? '',
          timestamp: typeof raw.timestamp === 'string' ? new Date(raw.timestamp).getTime() : (raw.timestamp as number) ?? Date.now(),
          channel: (raw.channel as ChatMessage['channel']) ?? 'global',
          target_id: (raw.target_id as string) ?? undefined,
        };
        chatStore.addMessage(normalized);
        // Also show in EventLog
        const chLabel = normalized.channel.toUpperCase();
        eventsStore.add({ type: 'chat', message: `[${chLabel}] ${normalized.sender_name}: ${normalized.message}` });
        // Save private messages to contacts
        if (normalized.channel === 'private') {
          // Determine the conversation partner
          const myUsername = authStore.username;
          const partner = normalized.sender_name === myUsername
            ? (normalized.target_id ?? 'Unknown')
            : normalized.sender_name;
          contactsStore.addMessage(normalized, partner);
        }
        break;
      }

      case 'police_warning': {
        const pl = p<{ message?: string }>(msg);
        eventsStore.add({ type: 'combat', message: `Police warning: ${pl.message ?? ''}` });
        break;
      }

      case 'catalog_result': {
        const pl = p<CatalogResponse>(msg);
        catalogStore.handleResponse(pl);
        break;
      }

      case 'ok': {
        const pl = p<{ action?: string; command?: string; message?: string; pending?: boolean; system?: Record<string, unknown>; poi?: Record<string, unknown>; base?: string; items?: MarketItem[]; orders?: MyOrder[]; faction_orders?: unknown[]; threads?: ForumThread[]; page?: number; total?: number; total_count?: number; per_page?: number; categories?: string[]; thread?: ForumThread; replies?: ForumReply[]; thread_id?: string; reply_id?: string; title?: string; factions?: unknown[]; invites?: unknown[]; faction_id?: string; faction?: Record<string, unknown> }>(msg);
        // faction_info: payload has id + tag + name but no threads/factions/items
        if (!pl.action && (pl as Record<string, unknown>).id && (pl as Record<string, unknown>).tag && !pl.threads && !pl.factions && !pl.items) {
          const f = pl as unknown as Faction;
          if (playerStore.faction_id && f.id === playerStore.faction_id) {
            factionStore.update(f);
          } else {
            factionStore.setViewedFaction(f);
          }
          factionStore.viewedFactionLoading = false;
          break;
        }
        // Mission responses
        // get_missions: { missions: [...], base_name, base_id }
        {
          const raw = msg.payload as Record<string, unknown>;
          if (raw.base_name && Array.isArray(raw.missions)) {
            missionStore.setAvailable(raw.missions as unknown[], raw.base_name as string, raw.base_id as string);
            // Chain: get_missions ok → get_active_missions (avoid concurrent queries)
            this.getActiveMissions();
            break;
          }
          // get_active_missions: { missions: [...] | null, total_count, max_missions }
          if (raw.max_missions !== undefined) {
            missionStore.setActive(raw.missions as unknown[] | null, raw.max_missions as number);
            break;
          }
        }
        if (pl.action === 'accept_mission') {
          eventsStore.add({ type: 'info', message: pl.message ?? 'Mission accepted' });
          // Chain: refresh available first, then active follows automatically
          if (playerStore.isDocked) {
            this.getMissions();
          } else {
            this.getActiveMissions();
          }
          break;
        }
        if (pl.action === 'complete_mission') {
          eventsStore.add({ type: 'info', message: pl.message ?? 'Mission completed!' });
          if (playerStore.isDocked) {
            this.getMissions();
          } else {
            this.getActiveMissions();
          }
          break;
        }
        if (pl.action === 'abandon_mission') {
          eventsStore.add({ type: 'info', message: pl.message ?? 'Mission abandoned' });
          if (playerStore.isDocked) {
            this.getMissions();
          } else {
            this.getActiveMissions();
          }
          break;
        }
        if (pl.action === 'decline_mission') {
          eventsStore.add({ type: 'info', message: pl.message ?? 'Mission declined' });
          break;
        }
        // Scavenger: get_wrecks response — { count: N, wrecks: [...] | null }
        {
          const raw = msg.payload as Record<string, unknown>;
          if (pl.action === 'get_wrecks' || (raw.count !== undefined && 'wrecks' in raw)) {
            const rawWrecks = Array.isArray(raw.wrecks) ? (raw.wrecks as Array<Record<string, unknown>>) : [];
            const normalized = rawWrecks.map(w => ({
              id: (w.wreck_id as string) ?? (w.id as string) ?? '',
              ship_type: (w.ship_type as string) ?? (w.ship_class as string) ?? 'Unknown',
              loot: Array.isArray(w.loot) ? (w.loot as Array<{ item_id: string; quantity: number; name?: string }>) : Array.isArray(w.items) ? (w.items as Array<{ item_id: string; quantity: number; name?: string }>) : [],
              expires_at: (w.expires_at as number) ?? 0,
              owner: (w.owner as string) ?? (w.owner_name as string) ?? undefined,
              wreck_type: (w.wreck_type as string) ?? (w.type as string) ?? undefined,
            }));
            scavengerStore.setWrecks(normalized as never);
            break;
          }
        }
        // Battle status response
        if (pl.action === 'get_battle_status') {
          const raw = msg.payload as Record<string, unknown>;
          battleStore.setStatus(raw as unknown as BattleStatus);
          break;
        }
        if (pl.action === 'view_market' && pl.items) {
          marketStore.setData({ base: pl.base ?? '', items: pl.items });
          // Chain: request own orders after market data arrives
          this.viewOrders();
          break;
        }
        if (pl.action === 'view_orders' && pl.orders) {
          marketStore.setMyOrders(pl.orders);
          break;
        }
        // Forum responses (may come with action field or without)
        if ((pl.action === 'forum_list' || (!pl.action && pl.threads && pl.per_page !== undefined)) && pl.threads) {
          forumStore.setThreadList({
            threads: pl.threads,
            page: pl.page ?? 1,
            total: pl.total ?? 0,
            per_page: pl.per_page ?? 20,
            categories: pl.categories,
          });
          break;
        }
        if ((pl.action === 'forum_get_thread' || (!pl.action && pl.thread)) && pl.thread) {
          forumStore.setThreadDetail(pl.thread, pl.replies ?? []);
          break;
        }
        if ((pl.action === 'forum_create_thread' || pl.action === 'forum_create') && pl.thread_id) {
          forumStore.addMyThread({
            id: pl.thread_id,
            title: pl.title ?? '',
            category: 'general',
            created_at: new Date().toISOString(),
          });
          eventsStore.add({ type: 'info', message: pl.message ?? 'Thread created' });
          // Refresh thread list
          this.forumList(forumStore.page);
          break;
        }
        if (pl.action === 'forum_reply' && pl.reply_id) {
          eventsStore.add({ type: 'info', message: pl.message ?? 'Reply posted' });
          // Refresh current thread
          if (pl.thread_id) this.forumGetThread(pl.thread_id);
          break;
        }
        if (pl.action === 'forum_delete_thread' && pl.thread_id) {
          forumStore.removeMyThread(pl.thread_id);
          forumStore.clearCurrentThread();
          eventsStore.add({ type: 'info', message: pl.message ?? 'Thread deleted' });
          this.forumList(forumStore.page);
          break;
        }
        if (pl.action === 'forum_delete_reply') {
          eventsStore.add({ type: 'info', message: pl.message ?? 'Reply deleted' });
          if (forumStore.currentThread) this.forumGetThread(forumStore.currentThread.id);
          break;
        }
        if (pl.action === 'forum_upvote') {
          eventsStore.add({ type: 'info', message: pl.message ?? 'Upvoted' });
          if (forumStore.currentThread) this.forumGetThread(forumStore.currentThread.id);
          break;
        }
        // Faction responses
        if ((pl.action === 'faction_list' || (!pl.action && pl.factions && Array.isArray(pl.factions))) && pl.factions) {
          factionStore.setFactionList(pl.factions as FactionListItem[], pl.total_count ?? pl.total ?? 0);
          break;
        }
        if (pl.action === 'faction_get_invites' && pl.invites) {
          factionStore.setInvites(pl.invites as FactionInvite[]);
          break;
        }
        if (pl.action === 'create_faction') {
          eventsStore.add({ type: 'info', message: pl.message ?? 'Faction created!' });
          // Refresh own faction info
          this.getFactionInfo();
          break;
        }
        if (pl.action === 'join_faction') {
          eventsStore.add({ type: 'info', message: pl.message ?? 'Joined faction!' });
          this.getFactionInfo();
          this.factionGetInvites();
          break;
        }
        if (pl.action === 'leave_faction') {
          eventsStore.add({ type: 'info', message: pl.message ?? 'Left faction' });
          factionStore.update(null as unknown as Faction);
          factionStore.reset();
          break;
        }
        if (pl.action === 'faction_decline_invite') {
          eventsStore.add({ type: 'info', message: pl.message ?? 'Invite declined' });
          this.factionGetInvites();
          break;
        }
        if (pl.action === 'faction_invite') {
          eventsStore.add({ type: 'info', message: pl.message ?? 'Invite sent' });
          break;
        }
        if (pl.action === 'faction_kick') {
          eventsStore.add({ type: 'info', message: pl.message ?? 'Player kicked' });
          this.getFactionInfo();
          break;
        }
        if (pl.action === 'faction_promote') {
          eventsStore.add({ type: 'info', message: pl.message ?? 'Role updated' });
          this.getFactionInfo();
          break;
        }
        if (pl.action === 'faction_edit') {
          eventsStore.add({ type: 'info', message: pl.message ?? 'Faction updated' });
          this.getFactionInfo();
          break;
        }
        if (pl.action === 'faction_deposit_credits') {
          eventsStore.add({ type: 'info', message: pl.message ?? 'Credits deposited' });
          this.getFactionInfo();
          break;
        }
        // Trade ok responses
        if (pl.action === 'trade_offer') {
          const raw = msg.payload as Record<string, unknown>;
          const tradeId = (raw.trade_id as string) ?? '';
          const message = pl.message ?? 'Trade offer sent';
          if (tradeId) {
            const oItems = Array.isArray(raw.offer_items) ? (raw.offer_items as TradeOffer['offer_items']) : [];
            const rItems = Array.isArray(raw.request_items) ? (raw.request_items as TradeOffer['request_items']) : [];
            tradeStore.addOutgoing({
              trade_id: tradeId,
              offerer_id: '',
              offerer_name: authStore.username,
              target_id: (raw.target_id as string) ?? '',
              target_name: (raw.target_name as string) ?? (raw.target as string) ?? '',
              offer_credits: (raw.offer_credits as number) ?? (raw.credits as number) ?? 0,
              offer_items: oItems,
              request_credits: (raw.request_credits as number) ?? 0,
              request_items: rItems,
              status: 'pending',
              created_at: Date.now(),
            });
          }
          tradeStore.setLastResult(message);
          eventsStore.add({ type: 'trade', message });
          break;
        }
        if (pl.action === 'trade_accept') {
          const raw = msg.payload as Record<string, unknown>;
          const tradeId = (raw.trade_id as string) ?? '';
          const message = pl.message ?? 'Trade accepted!';
          tradeStore.updateStatus(tradeId, 'completed');
          tradeStore.setLastResult(message);
          eventsStore.add({ type: 'trade', message });
          break;
        }
        if (pl.action === 'trade_decline') {
          const raw = msg.payload as Record<string, unknown>;
          const tradeId = (raw.trade_id as string) ?? '';
          const message = pl.message ?? 'Trade declined';
          tradeStore.updateStatus(tradeId, 'declined');
          tradeStore.setLastResult(message);
          eventsStore.add({ type: 'trade', message });
          break;
        }
        if (pl.action === 'trade_cancel') {
          const raw = msg.payload as Record<string, unknown>;
          const tradeId = (raw.trade_id as string) ?? '';
          const message = pl.message ?? 'Trade cancelled';
          tradeStore.updateStatus(tradeId, 'cancelled');
          tradeStore.setLastResult(message);
          eventsStore.add({ type: 'trade', message });
          break;
        }
        if (pl.action === 'list_ships' || ((pl as Record<string, unknown>).active_ship_id && (pl as Record<string, unknown>).ships)) {
          const raw = msg.payload as Record<string, unknown>;
          const rawShips = (raw.ships as Array<Record<string, unknown>>) ?? [];
          // Normalize fleet ship fields: server sends ship_id, class_name, class_id, hull "100/100"
          const ships = rawShips.map(rs => {
            let hull = 0, max_hull = 1;
            if (typeof rs.hull === 'string' && rs.hull.includes('/')) {
              const [h, m] = rs.hull.split('/').map(Number);
              hull = h; max_hull = m;
            } else if (typeof rs.hull === 'number') {
              hull = rs.hull; max_hull = (rs.max_hull as number) ?? hull;
            }
            return {
              id: (rs.ship_id as string) ?? (rs.id as string) ?? '',
              name: (rs.class_name as string) ?? (rs.name as string) ?? '',
              type: (rs.class_id as string) ?? (rs.type as string) ?? '',
              hull,
              max_hull,
              fuel: 0,
              max_fuel: 0,
              cargo_used: (rs.cargo_used as number) ?? 0,
              modules: (rs.modules as number) ?? 0,
              location: (rs.location as string) ?? '',
              is_active: (rs.is_active as boolean) ?? false,
              cargo: [],
            };
          });
          shipStore.updateFleet({
            ships: ships as never,
            active_ship_id: (raw.active_ship_id as string) ?? '',
          });
          break;
        }
        if (pl.action === 'get_ships' || ((pl as Record<string, unknown>).ships && (pl as Record<string, unknown>).count && !(pl as Record<string, unknown>).active_ship_id)) {
          const raw = msg.payload as Record<string, unknown>;
          const rawShips = (raw.ships as Array<Record<string, unknown>>) ?? [];
          // Normalize catalog fields: server sends base_shield/cargo_capacity
          const catalog = rawShips.map(rs => ({
            id: (rs.id as string) ?? '',
            name: (rs.name as string) ?? '',
            class: (rs.class as string) ?? '',
            description: (rs.description as string) ?? '',
            price: (rs.price as number) ?? 0,
            base_hull: (rs.base_hull as number) ?? 0,
            base_shields: (rs.base_shield as number) ?? (rs.base_shields as number) ?? 0,
            base_fuel: (rs.base_fuel as number) ?? 0,
            base_cargo: (rs.cargo_capacity as number) ?? (rs.base_cargo as number) ?? 0,
            weapon_slots: (rs.weapon_slots as number) ?? 0,
            defense_slots: (rs.defense_slots as number) ?? 0,
            utility_slots: (rs.utility_slots as number) ?? 0,
            cpu_capacity: (rs.cpu_capacity as number) ?? 0,
            power_capacity: (rs.power_capacity as number) ?? 0,
            base_armor: (rs.base_armor as number) ?? 0,
            base_speed: (rs.base_speed as number) ?? 0,
            base_shield_recharge: (rs.base_shield_recharge as number) ?? 0,
            required_skills: (rs.required_skills as Record<string, number>) ?? undefined,
          }));
          shipStore.catalog = catalog as never;
          break;
        }
        if (pl.action === 'get_system' && pl.system) {
          const raw = pl.system as Record<string, unknown>;
          // Normalize POIs: server sends online/has_base/base_id/base_name
          const rawPois = (raw.pois as Array<Record<string, unknown>>) ?? [];
          const pois = rawPois.map(rp => ({
            id: rp.id as string,
            name: rp.name as string,
            type: rp.type as string,
            player_count: (rp.online as number) ?? (rp.player_count as number) ?? 0,
            position: rp.position as { x: number; y: number } | undefined,
            online: (rp.online as number) ?? 0,
            base: rp.has_base ? {
              id: (rp.base_id as string) ?? '',
              name: (rp.base_name as string) ?? '',
            } : null,
            has_base: rp.has_base ?? false,
            base_id: rp.base_id ?? null,
            base_name: rp.base_name ?? null,
          }));
          // Normalize connections: server sends name/distance
          const rawConns = (raw.connections as Array<Record<string, unknown>>) ?? [];
          const connections = rawConns.map(rc => ({
            system_id: rc.system_id as string,
            system_name: (rc.name as string) ?? (rc.system_name as string) ?? '—',
            distance: (rc.distance as number) ?? null,
            security_level: rc.security_level ?? null,
            jump_cost: rc.jump_cost ?? null,
          }));
          // Map security_status string to security_level enum
          const secStr = ((raw.security_status as string) ?? '').toLowerCase();
          let security_level: string = raw.security_level as string ?? 'null';
          if (secStr.includes('maximum') || secStr.includes('high')) security_level = 'high';
          else if (secStr.includes('medium') || secStr.includes('moderate')) security_level = 'medium';
          else if (secStr.includes('low') || secStr.includes('dangerous')) security_level = 'low';
          else if (secStr.includes('unregulated') || secStr.includes('lawless')) security_level = 'null';

          systemStore.update({
            id: raw.id as string,
            name: raw.name as string,
            description: (raw.description as string) ?? '',
            security_level,
            security_status: raw.security_status as string,
            pois,
            connections,
          } as never);

          // Auto-save system memo whenever we get system data
          systemMemoStore.save(systemStore.data);

          // Detect home base system: if any POI matches player's home_base, mark this system
          const homeBasePoi = playerStore.homeBase;
          if (homeBasePoi && systemStore.data) {
            const hasHome = (systemStore.data.pois ?? []).some(
              poi => poi.id === homeBasePoi || poi.base_id === homeBasePoi
            );
            if (hasHome && explorerStore.homeBaseSystemId !== systemStore.data.id) {
              explorerStore.setHomeBase(systemStore.data.id);
            }
          }

          // Also update currentPoi if provided
          if (pl.poi) {
            systemStore.currentPoi = pl.poi as never;
          }
        } else if ((pl as Record<string, unknown>).recipes && typeof (pl as Record<string, unknown>).recipes === 'object' && !Array.isArray((pl as Record<string, unknown>).recipes)) {
          craftingStore.setRecipes((pl as Record<string, unknown>).recipes as Record<string, Recipe>);
        } else if (isCatalogResponse(pl)) {
          catalogStore.handleResponse(pl as unknown as CatalogResponse);
        } else if (pl.action === 'view_storage' || ((msg.payload as Record<string, unknown>)?.base_id && (msg.payload as Record<string, unknown>)?.items)) {
          // Query response: view_storage — detected by action field or by base_id+items presence
          const raw = msg.payload as Record<string, unknown>;
          const storageData: StorageData = {
            station_id: (raw.station_id as string) ?? (raw.base_id as string) ?? '',
            base_id: (raw.base_id as string) ?? (raw.station_id as string) ?? '',
            station_name: (raw.station_name as string) ?? '',
            items: (raw.items as StorageData['items']) ?? [],
            credits: (raw.credits as number) ?? 0,
            capacity: (raw.capacity as number) ?? undefined,
            capacity_used: (raw.capacity_used as number) ?? undefined,
            ships: (raw.ships as StorageData['ships']) ?? [],
            gifts: (raw.gifts as StorageData['gifts']) ?? [],
          };
          baseStore.setStorage(storageData);
        } else if (pl.action === 'get_base' || (msg.payload as Record<string, unknown>)?.base) {
          // Query response: get_base — detected by action field or by base field presence
          const raw = msg.payload as Record<string, unknown>;
          const base = raw.base as BaseInfo;
          const condition = raw.condition as BaseCondition | undefined;
          if (base && base.name) {
            baseStore.setBase(base, condition);
            // Chain: get_base ok → view_storage (avoid concurrent queries)
            this.viewStorage();
          }
        } else if (pl.action === 'jumped') {
          // Jump completed (multi-tick jump)
          const raw = msg.payload as Record<string, unknown>;
          const dest = (raw.system as string) ?? '';
          const destId = (raw.system_id as string) ?? '';
          const fromSystem = (raw.from_system as string) ?? '';
          const poiId = (raw.poi as string) ?? null;
          systemStore.setTravel({ in_progress: false, destination_id: null, destination_name: null });
          if (destId) {
            playerStore.update({ current_system: destId } as never);
          }
          if (poiId) {
            playerStore.update({ current_poi: poiId, poi_id: poiId } as never);
          }
          eventsStore.add({ type: 'nav', message: `Jumped to ${dest}${fromSystem ? ` (from ${fromSystem})` : ''}` });
          // Release the persistent jump action from queue
          actionQueueStore.completeCurrentAction();
          this.getSystem();
        } else if (!pl.action && (msg.payload as Record<string, unknown>)?.player && (msg.payload as Record<string, unknown>)?.ship) {
          // get_status response: has player + ship at top level, no action field
          const raw = msg.payload as Record<string, unknown>;
          if (raw.player) playerStore.update(raw.player as never);
          if (raw.ship) shipStore.updateCurrent(raw.ship as never);
          // modules can be null (no modules installed) or Module[]
          if (raw.modules === null || (Array.isArray(raw.modules) && raw.modules.length === 0)) {
            shipStore.updateModules([]);
          } else if (Array.isArray(raw.modules)) {
            shipStore.updateModules(raw.modules as Module[]);
          }
        } else if (pl.pending) {
          // Mutation accepted, will execute on next tick
          if (pl.message) {
            eventsStore.add({ type: 'info', message: pl.message });
          }
        } else if (pl.message) {
          eventsStore.add({ type: 'info', message: pl.message });
        }
        break;
      }

      case 'forum_list': {
        const pl = p<{ threads: ForumThread[]; page: number; total: number; per_page: number; categories?: string[] }>(msg);
        forumStore.setThreadList(pl);
        break;
      }

      case 'forum_thread': {
        const pl = p<{ thread: ForumThread; replies: ForumReply[] }>(msg);
        forumStore.setThreadDetail(pl.thread, pl.replies ?? []);
        break;
      }

      case 'faction_list': {
        const pl = p<{ factions: FactionListItem[]; total?: number; total_count?: number }>(msg);
        factionStore.setFactionList(pl.factions ?? [], pl.total_count ?? pl.total);
        break;
      }

      case 'faction_invites': {
        const pl = p<{ invites: FactionInvite[] }>(msg);
        factionStore.setInvites(pl.invites ?? []);
        break;
      }

      // ---- Trade messages ----

      case 'trade_offer':
      case 'trade_offer_received': {
        // Incoming trade offer from another player
        const raw = p<Record<string, unknown>>(msg);
        const offerItems = Array.isArray(raw.offer_items) ? (raw.offer_items as TradeOffer['offer_items']) : [];
        const requestItems = Array.isArray(raw.request_items) ? (raw.request_items as TradeOffer['request_items']) : [];
        const offer: TradeOffer = {
          trade_id: (raw.trade_id as string) ?? '',
          offerer_id: (raw.offerer_id as string) ?? (raw.from_id as string) ?? '',
          offerer_name: (raw.offerer_name as string) ?? (raw.from as string) ?? (raw.from_name as string) ?? 'Unknown',
          target_id: (raw.target_id as string) ?? undefined,
          target_name: (raw.target_name as string) ?? authStore.username,
          offer_credits: (raw.offer_credits as number) ?? (raw.credits as number) ?? 0,
          offer_items: offerItems,
          request_credits: (raw.request_credits as number) ?? 0,
          request_items: requestItems,
          status: 'pending',
          expires_at: (raw.expires_at as string) ?? undefined,
          created_at: Date.now(),
        };
        tradeStore.addIncoming(offer);
        const itemCount = offerItems.length + requestItems.length;
        eventsStore.add({ type: 'trade', message: `Trade offer from ${offer.offerer_name}: ₡${offer.offer_credits.toLocaleString()} + ${itemCount} item(s)` });
        break;
      }

      case 'trade_accepted':
      case 'trade_completed': {
        const raw = p<Record<string, unknown>>(msg);
        const tradeId = (raw.trade_id as string) ?? '';
        const message = (raw.message as string) ?? 'Trade completed!';
        tradeStore.updateStatus(tradeId, 'completed');
        tradeStore.setLastResult(message);
        eventsStore.add({ type: 'trade', message });
        break;
      }

      case 'trade_declined': {
        const raw = p<Record<string, unknown>>(msg);
        const tradeId = (raw.trade_id as string) ?? '';
        const message = (raw.message as string) ?? 'Trade declined';
        tradeStore.updateStatus(tradeId, 'declined');
        tradeStore.setLastResult(message);
        eventsStore.add({ type: 'trade', message });
        break;
      }

      case 'trade_cancelled': {
        const raw = p<Record<string, unknown>>(msg);
        const tradeId = (raw.trade_id as string) ?? '';
        const message = (raw.message as string) ?? 'Trade cancelled';
        tradeStore.updateStatus(tradeId, 'cancelled');
        tradeStore.setLastResult(message);
        eventsStore.add({ type: 'trade', message });
        break;
      }

      default:
        console.warn('[WS] Unhandled message type:', msg.type, msg);
    }
  }

  // ---- Send helpers ----

  private rawSend(msg: WsMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  send(msg: WsMessage) {
    console.debug('[WS ←]', msg.type, msg);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      console.debug('[WS ←] queued (readyState=%s)', this.ws?.readyState);
      this.messageQueue.push(msg);
    }
  }

  // ---- Auth ----

  login(username: string, password: string) {
    authStore.savedUsername = username;
    authStore.savedPassword = password;
    this.send({ type: 'login', payload: { username, password } });
  }

  register(username: string, empire: string, registrationCode: string) {
    authStore.savedUsername = username;
    this.send({ type: 'register', payload: { username, empire, registration_code: registrationCode } });
  }

  // ---- Navigation ----

  getStatus() { this.send({ type: 'get_status' }); }
  getSystem() { this.send({ type: 'get_system' }); }

  travel(destinationId: string) {
    systemStore.setTravel({ in_progress: true, destination_id: destinationId, type: 'travel' });
    this.send({ type: 'travel', payload: { target_poi: destinationId } });
  }

  jump(systemId: string, systemName?: string) {
    systemStore.setTravel({ in_progress: true, destination_id: systemId, destination_name: systemName ?? systemId, type: 'jump' });
    this.send({ type: 'jump', payload: { target_system: systemId } });
  }

  dock(stationId: string) { this.send({ type: 'dock', payload: { station: stationId } }); }
  undock() { this.send({ type: 'undock' }); }

  // ---- Combat ----

  attack(targetId: string) {
    combatStore.lastAttackTarget = targetId;
    this.send({ type: 'attack', payload: { target_id: targetId } });
  }

  scan(targetId?: string) {
    if (targetId) {
      this.send({ type: 'scan', payload: { target_id: targetId } });
    } else {
      this.send({ type: 'scan' });
    }
  }

  // ---- Battle (Zone-based PvP) ----

  /** Query: get current battle state (no tick cost) */
  getBattleStatus() {
    battleStore.setLoading(true);
    this.send({ type: 'get_battle_status' });
  }

  /** Mutation: move one zone closer */
  battleAdvance() {
    this.send({ type: 'battle', payload: { action: 'advance' } });
  }

  /** Mutation: move one zone back */
  battleRetreat() {
    this.send({ type: 'battle', payload: { action: 'retreat' } });
  }

  /** Mutation: change stance */
  battleStance(stance: BattleStance) {
    this.send({ type: 'battle', payload: { action: 'stance', stance } });
  }

  /** Mutation: set target */
  battleTarget(targetId: string) {
    this.send({ type: 'battle', payload: { action: 'target', target_id: targetId } });
  }

  /** Mutation: join an existing battle */
  battleEngage(sideId?: number) {
    const payload: Record<string, unknown> = { action: 'engage' };
    if (sideId !== undefined) payload.side_id = sideId;
    this.send({ type: 'battle', payload });
  }

  // ---- Scavenger ----

  getWrecks() { this.send({ type: 'get_wrecks' }); }

  lootWreck(wreckId: string, itemId: string, quantity: number) {
    this.send({ type: 'loot_wreck', payload: { wreck_id: wreckId, item_id: itemId, quantity } });
  }

  towWreck(wreckId: string) {
    this.send({ type: 'tow_wreck', payload: { wreck_id: wreckId } });
  }

  releaseTow() {
    this.send({ type: 'release_tow' });
  }

  sellWreck() {
    this.send({ type: 'sell_wreck' });
  }

  scrapWreck() {
    this.send({ type: 'scrap_wreck' });
  }

  selfDestruct() {
    this.send({ type: 'self_destruct' });
  }

  // ---- Mining ----

  mine(asteroidId?: string) {
    const payload: Record<string, string> = {};
    if (asteroidId) payload.target = asteroidId;
    this.send({ type: 'mine', payload });
  }

  jettison(itemId: string, quantity: number) {
    this.send({ type: 'jettison', payload: { item_id: itemId, quantity } });
  }

  // ---- Ship Services ----

  repair() { this.send({ type: 'repair' }); }

  surveySystem() { this.send({ type: 'survey_system' }); }

  refuel(quantity?: number, itemId?: string) {
    const payload: Record<string, unknown> = {};
    if (quantity != null) payload.quantity = quantity;
    if (itemId) payload.item_id = itemId;
    this.send({ type: 'refuel', payload });
  }

  // ---- Trading ----

  viewMarket(stationId: string) { this.send({ type: 'view_market', payload: { station: stationId } }); }
  viewOrders() { this.send({ type: 'view_orders' }); }

  buy(itemId: string, quantity: number, price: number) {
    this.send({ type: 'buy', payload: { item: itemId, quantity, price } });
  }

  sell(itemId: string, quantity: number, price: number) {
    this.send({ type: 'sell', payload: { item: itemId, quantity, price } });
  }

  createBuyOrder(itemId: string, quantity: number, priceEach: number) {
    this.send({ type: 'create_buy_order', payload: { item_id: itemId, quantity, price_each: priceEach } });
  }

  createSellOrder(itemId: string, quantity: number, priceEach: number) {
    this.send({ type: 'create_sell_order', payload: { item_id: itemId, quantity, price_each: priceEach } });
  }

  cancelOrder(orderId: string) { this.send({ type: 'cancel_order', payload: { order_id: orderId } }); }
  modifyOrder(orderId: string, newPrice: number) {
    this.send({ type: 'modify_order', payload: { order_id: orderId, new_price: newPrice } });
  }

  // ---- Missions ----

  getMissions() {
    missionStore.loadingAvailable = true;
    this.send({ type: 'get_missions' });
  }

  getActiveMissions() {
    missionStore.loadingActive = true;
    this.send({ type: 'get_active_missions' });
  }

  acceptMission(missionId: string) {
    this.send({ type: 'accept_mission', payload: { mission_id: missionId } });
  }

  completeMission(missionId: string) {
    this.send({ type: 'complete_mission', payload: { mission_id: missionId } });
  }

  abandonMission(missionId: string) {
    this.send({ type: 'abandon_mission', payload: { mission_id: missionId } });
  }

  declineMission(templateId: string) {
    this.send({ type: 'decline_mission', payload: { template_id: templateId } });
  }

  // ---- Ships ----

  listShips() { this.send({ type: 'list_ships' }); }
  getShipCatalog() { this.send({ type: 'get_ships' }); }
  buyShip(shipClass: string) { this.send({ type: 'buy_ship', payload: { ship_class: shipClass } }); }
  sellShip(shipId: string) { this.send({ type: 'sell_ship', payload: { ship_id: shipId } }); }
  switchShip(shipId: string) { this.send({ type: 'switch_ship', payload: { ship_id: shipId } }); }

  // ---- Module Management ----

  installMod(moduleId: string) { this.send({ type: 'install_mod', payload: { module_id: moduleId } }); }
  uninstallMod(moduleId: string) { this.send({ type: 'uninstall_mod', payload: { module_id: moduleId } }); }

  // ---- Crafting ----

  getRecipes() { this.send({ type: 'get_recipes' }); }
  craft(recipeId: string, count: number) {
    this.send({ type: 'craft', payload: { recipe_id: recipeId, count: Math.min(Math.max(1, count), 10) } });
  }

  // ---- Storage / Base ----

  getBase() { this.send({ type: 'get_base' }); }

  viewStorage() { this.send({ type: 'view_storage' }); }

  depositItems(itemId: string, quantity: number) {
    this.send({ type: 'deposit_items', payload: { item_id: itemId, quantity } });
  }

  withdrawItems(itemId: string, quantity: number) {
    this.send({ type: 'withdraw_items', payload: { item_id: itemId, quantity } });
  }

  depositCredits(amount: number) { this.send({ type: 'deposit_credits', payload: { amount } }); }
  withdrawCredits(amount: number) { this.send({ type: 'withdraw_credits', payload: { amount } }); }

  setHomeBase(baseId: string) { this.send({ type: 'set_home_base', payload: { base_id: baseId } }); }

  // ---- Faction ----

  getFactionInfo(factionId?: string) {
    if (factionId) {
      this.send({ type: 'faction_info', payload: { faction_id: factionId } });
    } else {
      this.send({ type: 'faction_info' });
    }
  }
  declareWar(factionId: string) { this.send({ type: 'faction_declare_war', payload: { target_faction_id: factionId } }); }
  proposePeace(factionId: string) { this.send({ type: 'faction_propose_peace', payload: { target_faction_id: factionId } }); }

  // ---- Catalog ----

  catalog(type: CatalogType, opts?: { id?: string; category?: string; search?: string; page?: number; page_size?: number }) {
    catalogStore.setLoading(type, true);
    this.send({ type: 'catalog', payload: { type, ...opts } });
  }

  // ---- Forum ----

  forumList(page = 1) {
    forumStore.loading = true;
    this.send({ type: 'forum_list', payload: { page } });
  }

  forumGetThread(threadId: string) {
    forumStore.loadingThread = true;
    this.send({ type: 'forum_get_thread', payload: { thread_id: threadId } });
  }

  forumCreateThread(title: string, content: string, category: ForumCategory = 'general') {
    this.send({ type: 'forum_create_thread', payload: { title, content, category } });
  }

  forumReply(threadId: string, content: string) {
    this.send({ type: 'forum_reply', payload: { thread_id: threadId, content } });
  }

  forumDeleteThread(threadId: string) {
    this.send({ type: 'forum_delete_thread', payload: { thread_id: threadId } });
  }

  forumDeleteReply(replyId: string) {
    this.send({ type: 'forum_delete_reply', payload: { reply_id: replyId } });
  }

  forumUpvote(threadId: string, replyId?: string) {
    const payload: Record<string, string> = { thread_id: threadId };
    if (replyId) payload.reply_id = replyId;
    this.send({ type: 'forum_upvote', payload });
  }

  // ---- Faction (extended) ----

  factionList(limit = 50, offset = 0) {
    factionStore.factionListLoading = true;
    this.send({ type: 'faction_list', payload: { limit, offset } });
  }

  createFaction(name: string, tag: string) {
    this.send({ type: 'create_faction', payload: { name, tag } });
  }

  joinFaction(factionId: string) {
    this.send({ type: 'join_faction', payload: { faction_id: factionId } });
  }

  leaveFaction() {
    this.send({ type: 'leave_faction' });
  }

  factionGetInvites() {
    factionStore.invitesLoading = true;
    this.send({ type: 'faction_get_invites' });
  }

  factionDeclineInvite(factionId: string) {
    this.send({ type: 'faction_decline_invite', payload: { faction_id: factionId } });
  }

  factionInvite(playerIdOrUsername: string) {
    this.send({ type: 'faction_invite', payload: { player_id: playerIdOrUsername } });
  }

  factionKick(playerIdOrUsername: string) {
    this.send({ type: 'faction_kick', payload: { player_id: playerIdOrUsername } });
  }

  factionPromote(playerIdOrUsername: string, roleId: string) {
    this.send({ type: 'faction_promote', payload: { player_id: playerIdOrUsername, role_id: roleId } });
  }

  factionEdit(opts: { description?: string; charter?: string; primary_color?: string; secondary_color?: string }) {
    this.send({ type: 'faction_edit', payload: opts });
  }

  factionDepositCredits(amount: number) {
    this.send({ type: 'faction_deposit_credits', payload: { amount } });
  }

  factionViewInfo(factionId: string) {
    factionStore.viewedFactionLoading = true;
    this.send({ type: 'faction_info', payload: { faction_id: factionId } });
  }

  // ---- Player-to-Player Trade ----

  tradeOffer(targetId: string, offerCredits: number, offerItems: Record<string, number>, requestCredits: number, requestItems: Record<string, number>) {
    tradeStore.loading = true;
    // Server expects arrays of {item_id, quantity}, not Record objects
    const offerArr = Object.entries(offerItems).map(([item_id, quantity]) => ({ item_id, quantity }));
    const requestArr = Object.entries(requestItems).map(([item_id, quantity]) => ({ item_id, quantity }));
    this.send({ type: 'trade_offer', payload: {
      target_id: targetId,
      offer_credits: offerCredits,
      offer_items: offerArr,
      request_credits: requestCredits,
      request_items: requestArr,
    } });
  }

  tradeAccept(tradeId: string) {
    tradeStore.loading = true;
    this.send({ type: 'trade_accept', payload: { trade_id: tradeId } });
  }

  tradeDecline(tradeId: string) {
    this.send({ type: 'trade_decline', payload: { trade_id: tradeId } });
  }

  tradeCancel(tradeId: string) {
    this.send({ type: 'trade_cancel', payload: { trade_id: tradeId } });
  }

  // ---- Chat ----

  sendChat(content: string, channel = 'global', target?: string) {
    const payload: Record<string, unknown> = { content, channel };
    if (channel === 'private' && target) {
      payload.target_id = target;
      // Save sent PM to contacts
      const sentMsg: ChatMessage = {
        id: `sent_${Date.now()}`,
        sender_id: '',
        sender_name: authStore.username,
        message: content,
        timestamp: Date.now(),
        channel: 'private',
        target_id: target,
      };
      contactsStore.addMessage(sentMsg, target);
    }
    this.send({ type: 'chat', payload });
  }
}

// Singleton
export const ws = new WebSocketService();
