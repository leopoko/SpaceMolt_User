import type {
  WsMessage, StateUpdate, StateUpdatePayload, WelcomePayload,
  CombatEvent, ScanResult, TargetScanResult, MarketData, MarketItem, MyOrder, StorageData,
  Faction, Recipe, FleetData, ChatMessage, EventLogEntry,
  CatalogType, CatalogResponse,
  BaseInfo, BaseCondition
} from '$lib/types/game';
import { connectionStore } from '$lib/stores/connection.svelte';
import { authStore } from '$lib/stores/auth.svelte';
import { playerStore } from '$lib/stores/player.svelte';
import { shipStore } from '$lib/stores/ship.svelte';
import { systemStore } from '$lib/stores/system.svelte';
import { combatStore } from '$lib/stores/combat.svelte';
import { marketStore } from '$lib/stores/market.svelte';
import { craftingStore } from '$lib/stores/crafting.svelte';
import { factionStore } from '$lib/stores/faction.svelte';
import { baseStore } from '$lib/stores/base.svelte';
import { chatStore } from '$lib/stores/chat.svelte';
import { eventsStore } from '$lib/stores/events.svelte';
import { actionQueueStore } from '$lib/stores/actionQueue.svelte';
import { catalogStore } from '$lib/stores/catalog.svelte';

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
    let msg: WsMessage;
    try {
      msg = JSON.parse(event.data as string);
    } catch {
      console.error('Invalid WS message:', event.data);
      return;
    }
    this.dispatch(msg);
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
        eventsStore.add({ type: 'error', message: errMsg });
        // Clear travel state if a travel/jump is in progress
        // Server sends generic 'error' type for some failures (e.g. not_connected)
        if (systemStore.travel.in_progress) {
          systemStore.setTravel({ in_progress: false, destination_id: null, destination_name: null });
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
        if (pl.modules) shipStore.updateModules(pl.modules);
        if (pl.nearby) systemStore.setNearby(pl.nearby);
        if (pl.in_combat !== undefined) combatStore.setInCombat(pl.in_combat);
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
        } else if (cmd === 'craft') {
          const message = (result?.message as string) ?? 'Craft complete';
          craftingStore.setLastResult(message);
          eventsStore.add({ type: 'info', message });
          if (result?.ship) shipStore.updateCurrent(result.ship as never);
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
        break;
      }

      case 'arrived':
      case 'jumped': {
        const pl = p<{ system_name?: string; destination?: string }>(msg);
        systemStore.setTravel({ in_progress: false, destination_id: null, destination_name: null });
        const dest = pl.system_name ?? pl.destination ?? '';
        eventsStore.add({ type: 'nav', message: `Arrived at ${dest}` });
        this.getSystem();
        break;
      }

      case 'travel_update': {
        const pl = p<{ arrival_tick?: number }>(msg);
        systemStore.setTravel({ in_progress: true, arrival_tick: pl.arrival_tick ?? null });
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

      case 'combat_update': {
        const pl = p<CombatEvent>(msg);
        combatStore.addEvent(pl);
        combatStore.setInCombat(true);
        eventsStore.add({
          type: 'combat',
          message: `${pl.attacker} → ${pl.defender}: ${pl.damage} dmg (${pl.result})`
        });
        break;
      }

      case 'player_died': {
        combatStore.setInCombat(false);
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
        const pl = p<{ item?: string; quantity?: number; ship?: never }>(msg);
        eventsStore.add({ type: 'info', message: `Mined ${pl.quantity ?? 0}x ${pl.item ?? 'ore'}` });
        if (pl.ship) shipStore.updateCurrent(pl.ship);
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
        factionStore.update(pl);
        break;
      }

      case 'chat_message': {
        const pl = p<ChatMessage>(msg);
        chatStore.addMessage(pl);
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
        const pl = p<{ action?: string; command?: string; message?: string; pending?: boolean; system?: Record<string, unknown>; poi?: Record<string, unknown>; base?: string; items?: MarketItem[]; orders?: MyOrder[]; faction_orders?: unknown[] }>(msg);
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
        if (pl.action === 'get_system' && pl.system) {
          const raw = pl.system as Record<string, unknown>;
          // Normalize POIs: server sends online/has_base/base_id/base_name
          const rawPois = (raw.pois as Array<Record<string, unknown>>) ?? [];
          const pois = rawPois.map(rp => ({
            id: rp.id as string,
            name: rp.name as string,
            type: rp.type as string,
            player_count: (rp.online as number) ?? (rp.player_count as number) ?? 0,
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
    this.send({ type: 'jump', payload: { system: systemId } });
  }

  dock(stationId: string) { this.send({ type: 'dock', payload: { station: stationId } }); }
  undock() { this.send({ type: 'undock' }); }

  // ---- Combat ----

  attack(targetId: string) {
    combatStore.lastAttackTarget = targetId;
    this.send({ type: 'attack', payload: { target: targetId } });
  }

  scan(targetId?: string) {
    if (targetId) {
      this.send({ type: 'scan', payload: { target_id: targetId } });
    } else {
      this.send({ type: 'scan' });
    }
  }

  // ---- Mining ----

  mine(asteroidId?: string) {
    const payload: Record<string, string> = {};
    if (asteroidId) payload.target = asteroidId;
    this.send({ type: 'mine', payload });
  }

  // ---- Ship Services ----

  repair() { this.send({ type: 'repair' }); }

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

  // ---- Ships ----

  listShips() { this.send({ type: 'list_ships' }); }
  getShipCatalog() { this.send({ type: 'get_ships' }); }
  buyShip(shipType: string) { this.send({ type: 'buy_ship', payload: { ship_type: shipType } }); }
  sellShip(shipId: string) { this.send({ type: 'sell_ship', payload: { ship: shipId } }); }
  switchShip(shipId: string) { this.send({ type: 'switch_ship', payload: { ship: shipId } }); }

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

  // ---- Faction ----

  getFactionInfo(factionId: string) { this.send({ type: 'get_faction_info', payload: { faction: factionId } }); }
  declareWar(factionId: string) { this.send({ type: 'declare_war', payload: { faction: factionId } }); }
  proposePeace(factionId: string) { this.send({ type: 'propose_peace', payload: { faction: factionId } }); }

  // ---- Catalog ----

  catalog(type: CatalogType, opts?: { id?: string; category?: string; search?: string; page?: number; page_size?: number }) {
    catalogStore.setLoading(type, true);
    this.send({ type: 'catalog', payload: { type, ...opts } });
  }

  // ---- Chat ----

  sendChat(message: string, channel = 'global') {
    this.send({ type: 'chat', payload: { message, channel } });
  }
}

// Singleton
export const ws = new WebSocketService();
