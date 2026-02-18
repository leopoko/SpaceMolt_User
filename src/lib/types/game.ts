// ============================================================
// SpaceMolt – Game Type Definitions
// ============================================================

// ---- Primitives ----

export type SecurityLevel = 'high' | 'medium' | 'low' | 'null';
export type PlayerStatus = 'active' | 'docked' | 'dead' | 'traveling';
export type EventType = 'combat' | 'trade' | 'nav' | 'system' | 'chat' | 'error' | 'info';
export type ChatChannel = 'global' | 'faction' | 'local' | 'system';
export type MissionStatus = 'available' | 'active' | 'complete' | 'failed';
export type OrderType = 'buy' | 'sell';

// ---- Player ----

export interface Player {
  id: string;
  username: string;
  empire: string;
  credits: number;
  status: PlayerStatus;
  faction_id: string | null;
  location: string;
  system_id: string;
  poi_id: string | null;
  skills: Skill[];
  missions: Mission[];
  achievements: Achievement[];
  insurance: boolean;
}

// ---- Ship ----

export interface Ship {
  id: string;
  name: string;
  type: string;
  class: string;
  hull: number;
  max_hull: number;
  shields: number;
  max_shields: number;
  fuel: number;
  max_fuel: number;
  cargo: CargoItem[];
  max_cargo: number;
  modules: Module[];
  cpu_used: number;
  cpu_max: number;
  power_used: number;
  power_max: number;
}

export interface ShipClass {
  id: string;
  name: string;
  class: string;
  base_hull: number;
  base_shields: number;
  base_fuel: number;
  base_cargo: number;
  price: number;
  description: string;
}

export interface Module {
  id: string;
  name: string;
  type: string;
  active: boolean;
  cpu_cost: number;
  power_cost: number;
  wear: number;
  stats: Record<string, number>;
}

export interface CargoItem {
  item_id: string;
  name: string;
  quantity: number;
  volume: number;
  value: number;
}

export interface FleetData {
  ships: Ship[];
  active_ship_id: string;
}

// ---- Star System ----

export interface SystemInfo {
  id: string;
  name: string;
  security_level: SecurityLevel;
  description: string;
  pois: POI[];
  connections: SystemConnection[];
  nearby_players: NearbyPlayer[];
  wrecks: Wreck[];
  drones: Drone[];
}

export interface SystemConnection {
  system_id: string;
  system_name: string;
  security_level: SecurityLevel;
  jump_cost: number;
}

export interface POI {
  id: string;
  name: string;
  type: 'station' | 'asteroid' | 'gate' | 'wreck' | 'planet' | 'anomaly';
  base: BaseInfo | null;
  player_count: number;
}

export interface NearbyPlayer {
  id: string;
  username: string;
  ship_type: string;
  faction_id: string | null;
  visible: boolean;
}

// ---- Travel ----

export interface TravelState {
  in_progress: boolean;
  destination_id: string | null;
  destination_name: string | null;
  arrival_tick: number | null;
  current_tick: number;
  type: 'travel' | 'jump' | null;
}

// ---- Base / Station ----

export interface BaseInfo {
  id: string;
  name: string;
  type: 'outpost' | 'station' | 'fortress' | 'shipyard';
  owner_id: string | null;
  owner_name: string | null;
  faction_id: string | null;
  services: string[];
  hull: number;
  max_hull: number;
}

export interface StorageData {
  station_id: string;
  station_name: string;
  items: CargoItem[];
  credits: number;
  capacity: number;
  capacity_used: number;
  ships: Ship[];
  gifts: StorageGift[];
}

export interface StorageGift {
  from: string;
  items: CargoItem[];
  credits: number;
  message: string;
}

// ---- Market / Trading ----

export interface MarketListing {
  id: string;
  item_id: string;
  item_name: string;
  price: number;
  quantity: number;
  type: OrderType;
  owner_id: string;
  owner_name: string;
  station_id: string;
  expires_at: number;
}

export interface MarketData {
  station_id: string;
  buy_orders: MarketListing[];
  sell_orders: MarketListing[];
}

export interface MyOrders {
  orders: MarketListing[];
}

// ---- Crafting ----

export interface Recipe {
  id: string;
  name: string;
  description: string;
  inputs: RecipeItem[];
  output: RecipeItem;
  craft_time_ticks: number;
  required_skills: string[];
  station_types: string[];
}

export interface RecipeItem {
  item_id: string;
  item_name: string;
  quantity: number;
}

// ---- Faction ----

export interface Faction {
  id: string;
  name: string;
  description: string;
  leader_id: string;
  leader_name: string;
  members: FactionMember[];
  wars: FactionWar[];
  allies: string[];
  credits: number;
  standing: number;
}

export interface FactionMember {
  player_id: string;
  username: string;
  role: 'leader' | 'officer' | 'member';
  joined_at: number;
}

export interface FactionWar {
  faction_id: string;
  faction_name: string;
  started_at: number;
  kills: number;
  losses: number;
}

// ---- Skills ----

export interface Skill {
  id: string;
  name: string;
  description: string;
  level: number;
  max_level: number;
  xp: number;
  next_level_xp: number;
  prerequisites: string[];
}

// ---- Missions ----

export interface Mission {
  id: string;
  title: string;
  description: string;
  difficulty: number;
  reward_credits: number;
  reward_items: CargoItem[];
  status: MissionStatus;
  objectives: MissionObjective[];
  expires_at: number | null;
}

export interface MissionObjective {
  id: string;
  description: string;
  target: number;
  current: number;
  complete: boolean;
}

// ---- Achievements ----

export interface Achievement {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
  unlocked_at: number | null;
}

// ---- Combat ----

export interface CombatEvent {
  tick: number;
  attacker: string;
  defender: string;
  damage: number;
  damage_type: string;
  shield_damage: number;
  hull_damage: number;
  result: 'hit' | 'miss' | 'destroyed';
}

export interface ScanResult {
  targets: NearbyPlayer[];
  wrecks: Wreck[];
  drones: Drone[];
  anomalies: string[];
}

export interface Drone {
  id: string;
  owner_id: string;
  owner_name: string;
  type: string;
  hull: number;
  max_hull: number;
  bandwidth: number;
}

export interface Wreck {
  id: string;
  ship_type: string;
  loot: CargoItem[];
  expires_at: number;
}

// ---- Chat / Events ----

export interface ChatMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  message: string;
  timestamp: number;
  channel: ChatChannel;
}

export interface EventLogEntry {
  id: string;
  timestamp: number;
  type: EventType;
  message: string;
}

// ---- WebSocket messages ----

export interface WsMessage {
  type: string;
  [key: string]: unknown;
}

export interface WelcomePayload {
  version: string;
  tick_rate: number;
  motd: string;
  server_time: number;
}

export interface StateUpdate {
  player?: Partial<Player>;
  ship?: Partial<Ship>;
  system?: Partial<SystemInfo>;
  events?: EventLogEntry[];
  chat?: ChatMessage[];
  tick?: number;
}

// ---- Game State (full snapshot) ----

export interface GameState {
  // connection
  connected: boolean;
  authenticated: boolean;
  welcome: WelcomePayload | null;
  tick: number;

  // player
  player: Player | null;
  ship: Ship | null;

  // navigation
  system: SystemInfo | null;
  poi: POI | null;
  travel: TravelState;

  // combat
  in_combat: boolean;
  combat_log: CombatEvent[];
  scan_result: ScanResult | null;

  // market
  market_data: MarketData | null;
  my_orders: MarketListing[];

  // ship management
  ship_catalog: ShipClass[];
  fleet: FleetData | null;

  // storage
  storage_data: StorageData | null;

  // crafting
  recipes: Recipe[];

  // faction
  faction: Faction | null;

  // social
  chat_messages: ChatMessage[];
  event_log: EventLogEntry[];
}
