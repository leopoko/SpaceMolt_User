import type {
  WsMessage, StateUpdate, WelcomePayload,
  CombatEvent, ScanResult, MarketData, StorageData,
  Faction, Recipe, FleetData, ChatMessage, EventLogEntry
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
      this.rawSend({ type: 'login', username: authStore.savedUsername, password: authStore.savedPassword });
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
    // eslint-disable-next-line no-console
    console.debug('[WS →]', msg.type, msg);

    switch (msg.type) {
      case 'welcome': {
        const w = msg as unknown as WelcomePayload & { type: string };
        connectionStore.tickRate = w.tick_rate ?? 10;
        eventsStore.add({ type: 'system', message: `Connected to SpaceMolt v${w.version} – ${w.motd}` });
        break;
      }

      case 'logged_in': {
        authStore.isLoggedIn = true;
        authStore.username = (msg.username as string) ?? authStore.savedUsername;
        eventsStore.add({ type: 'system', message: `Logged in as ${authStore.username}` });
        // Fetch initial state
        this.getStatus();
        this.getSystem();
        break;
      }

      case 'registered': {
        authStore.isLoggedIn = true;
        authStore.username = (msg.username as string) ?? '';
        const pw = msg.password as string | undefined;
        if (pw) authStore.persistCredentials(authStore.username, pw);
        eventsStore.add({ type: 'system', message: `Registered as ${authStore.username}` });
        this.getStatus();
        this.getSystem();
        break;
      }

      case 'login_failed': {
        const errMsg = (msg.message as string) ?? 'Invalid credentials';
        authStore.loginError = errMsg;
        eventsStore.add({ type: 'error', message: errMsg });
        break;
      }

      case 'error': {
        const errMsg = (msg.message as string) ?? 'Unknown error';
        eventsStore.add({ type: 'error', message: errMsg });
        if (!authStore.isLoggedIn) {
          authStore.loginError = errMsg;
        }
        break;
      }

      case 'state_update': {
        const u = msg as unknown as StateUpdate;
        if (u.player) playerStore.update(u.player);
        if (u.ship) shipStore.updateCurrent(u.ship);
        if (u.system) systemStore.update(u.system);
        if (u.events) u.events.forEach(e => eventsStore.add(e));
        if (u.chat) u.chat.forEach(c => chatStore.addMessage(c));
        if (u.tick !== undefined) connectionStore.tick = u.tick;
        break;
      }

      case 'tick': {
        connectionStore.tick = (msg.tick as number) ?? connectionStore.tick + 1;
        systemStore.setTravel({ current_tick: connectionStore.tick });
        break;
      }

      case 'player_status': {
        if (msg.player) playerStore.update(msg.player as never);
        if (msg.ship) shipStore.updateCurrent(msg.ship as never);
        break;
      }

      case 'system_info': {
        systemStore.update(msg as never);
        break;
      }

      case 'arrived':
      case 'jumped': {
        systemStore.setTravel({ in_progress: false, destination_id: null, destination_name: null });
        const dest = (msg.system_name as string) ?? (msg.destination as string) ?? '';
        eventsStore.add({ type: 'nav', message: `Arrived at ${dest}` });
        this.getSystem();
        break;
      }

      case 'travel_update': {
        systemStore.setTravel({
          in_progress: true,
          arrival_tick: msg.arrival_tick as number ?? null
        });
        break;
      }

      case 'docked': {
        const stationName = (msg.station_name as string) ?? '';
        eventsStore.add({ type: 'nav', message: `Docked at ${stationName}` });
        playerStore.update({ status: 'docked', poi_id: msg.station_id as string ?? null });
        break;
      }

      case 'undocked': {
        eventsStore.add({ type: 'nav', message: 'Undocked' });
        playerStore.update({ status: 'active', poi_id: null });
        break;
      }

      case 'combat_update': {
        const event = msg as unknown as CombatEvent;
        combatStore.addEvent(event);
        combatStore.setInCombat(true);
        eventsStore.add({
          type: 'combat',
          message: `${event.attacker} → ${event.defender}: ${event.damage} dmg (${event.result})`
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
        const scan = msg as unknown as ScanResult;
        combatStore.setScanResult(scan);
        eventsStore.add({ type: 'nav', message: `Scan complete: ${scan.targets?.length ?? 0} targets detected` });
        break;
      }

      case 'mining_yield': {
        const item = msg.item as string ?? 'ore';
        const qty = msg.quantity as number ?? 0;
        eventsStore.add({ type: 'info', message: `Mined ${qty}x ${item}` });
        if (msg.ship) shipStore.updateCurrent(msg.ship as never);
        break;
      }

      case 'skill_level_up': {
        eventsStore.add({ type: 'info', message: `Skill up: ${msg.skill_name}` });
        if (msg.player) playerStore.update(msg.player as never);
        break;
      }

      case 'market_data': {
        marketStore.setData(msg as unknown as MarketData);
        break;
      }

      case 'orders_data': {
        marketStore.setMyOrders((msg.orders as never[]) ?? []);
        break;
      }

      case 'order_cancelled': {
        const oid = msg.order_id as string ?? '';
        marketStore.removeOrder(oid);
        eventsStore.add({ type: 'trade', message: 'Order cancelled' });
        break;
      }

      case 'buy_result':
      case 'sell_result': {
        eventsStore.add({ type: 'trade', message: (msg.message as string) ?? 'Trade complete' });
        if (msg.player) playerStore.update(msg.player as never);
        if (msg.ship) shipStore.updateCurrent(msg.ship as never);
        break;
      }

      case 'ship_list': {
        shipStore.updateFleet(msg as unknown as FleetData);
        break;
      }

      case 'ship_info': {
        shipStore.updateCurrent(msg.ship as never);
        break;
      }

      case 'ship_catalog': {
        shipStore.catalog = (msg.ships as never[]) ?? [];
        break;
      }

      case 'storage_data': {
        baseStore.setStorage(msg as unknown as StorageData);
        break;
      }

      case 'craft_result': {
        craftingStore.setInProgress(false);
        const resultMsg = (msg.message as string) ?? (msg.success ? 'Craft complete' : 'Craft failed');
        craftingStore.setLastResult(resultMsg);
        eventsStore.add({ type: 'info', message: resultMsg });
        if (msg.ship) shipStore.updateCurrent(msg.ship as never);
        break;
      }

      case 'recipes': {
        craftingStore.setRecipes((msg.recipes as Recipe[]) ?? []);
        break;
      }

      case 'faction_info': {
        factionStore.update(msg as unknown as Faction);
        break;
      }

      case 'chat_message': {
        chatStore.addMessage(msg as unknown as ChatMessage);
        break;
      }

      case 'police_warning': {
        eventsStore.add({ type: 'combat', message: `Police warning: ${msg.message ?? ''}` });
        break;
      }

      case 'ok': {
        // Generic success – log if there's a message
        if (msg.message) {
          eventsStore.add({ type: 'info', message: msg.message as string });
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
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      this.messageQueue.push(msg);
    }
  }

  // ---- Auth ----

  login(username: string, password: string) {
    authStore.savedUsername = username;
    authStore.savedPassword = password;
    this.send({ type: 'login', username, password });
  }

  register(username: string, password: string) {
    this.send({ type: 'register', username, password });
  }

  // ---- Navigation ----

  getStatus() { this.send({ type: 'get_status' }); }
  getSystem() { this.send({ type: 'get_system' }); }

  travel(destinationId: string) {
    systemStore.setTravel({ in_progress: true, destination_id: destinationId, type: 'travel' });
    this.send({ type: 'travel', destination: destinationId });
  }

  jump(systemId: string, systemName?: string) {
    systemStore.setTravel({ in_progress: true, destination_id: systemId, destination_name: systemName ?? systemId, type: 'jump' });
    this.send({ type: 'jump', system: systemId });
  }

  dock(stationId: string) { this.send({ type: 'dock', station: stationId }); }
  undock() { this.send({ type: 'undock' }); }

  // ---- Combat ----

  attack(targetId: string) {
    combatStore.lastAttackTarget = targetId;
    this.send({ type: 'attack', target: targetId });
  }

  scan() { this.send({ type: 'scan' }); }

  // ---- Mining ----

  mine(asteroidId: string) { this.send({ type: 'mine', target: asteroidId }); }

  // ---- Trading ----

  viewMarket(stationId: string) { this.send({ type: 'view_market', station: stationId }); }
  viewOrders() { this.send({ type: 'view_orders' }); }

  buy(itemId: string, quantity: number, price: number) {
    this.send({ type: 'buy', item: itemId, quantity, price });
  }

  sell(itemId: string, quantity: number, price: number) {
    this.send({ type: 'sell', item: itemId, quantity, price });
  }

  createBuyOrder(itemId: string, quantity: number, price: number) {
    this.send({ type: 'create_buy_order', item: itemId, quantity, price });
  }

  createSellOrder(itemId: string, quantity: number, price: number) {
    this.send({ type: 'create_sell_order', item: itemId, quantity, price });
  }

  cancelOrder(orderId: string) { this.send({ type: 'cancel_order', order: orderId }); }
  modifyOrder(orderId: string, price?: number, quantity?: number) {
    this.send({ type: 'modify_order', order: orderId, price, quantity });
  }

  // ---- Ships ----

  listShips() { this.send({ type: 'list_ships' }); }
  getShipCatalog() { this.send({ type: 'get_ships' }); }
  buyShip(shipType: string) { this.send({ type: 'buy_ship', ship_type: shipType }); }
  sellShip(shipId: string) { this.send({ type: 'sell_ship', ship: shipId }); }
  switchShip(shipId: string) { this.send({ type: 'switch_ship', ship: shipId }); }

  // ---- Crafting ----

  getRecipes() { this.send({ type: 'get_recipes' }); }
  craft(recipeId: string, quantity: number) {
    craftingStore.setInProgress(true);
    this.send({ type: 'craft', recipe: recipeId, quantity });
  }

  // ---- Storage ----

  viewStorage(stationId: string) { this.send({ type: 'view_storage', station: stationId }); }

  depositItems(items: Array<{ id: string; quantity: number }>) {
    this.send({ type: 'deposit_items', items });
  }

  withdrawItems(items: Array<{ id: string; quantity: number }>) {
    this.send({ type: 'withdraw_items', items });
  }

  depositCredits(amount: number) { this.send({ type: 'deposit_credits', amount }); }
  withdrawCredits(amount: number) { this.send({ type: 'withdraw_credits', amount }); }

  // ---- Faction ----

  getFactionInfo(factionId: string) { this.send({ type: 'get_faction_info', faction: factionId }); }
  declareWar(factionId: string) { this.send({ type: 'declare_war', faction: factionId }); }
  proposePeace(factionId: string) { this.send({ type: 'propose_peace', faction: factionId }); }

  // ---- Chat ----

  sendChat(message: string, channel = 'global') {
    this.send({ type: 'chat', message, channel });
  }
}

// Singleton
export const ws = new WebSocketService();
