// ============================================================
// SpaceMolt – Game Type Definitions
// ============================================================

// ---- Primitives ----

export type SecurityLevel = 'high' | 'medium' | 'low' | 'null';
export type PlayerStatus = 'active' | 'docked' | 'dead' | 'traveling';
export type EventType = 'combat' | 'trade' | 'nav' | 'system' | 'chat' | 'error' | 'info';
export type ChatChannel = 'global' | 'faction' | 'local' | 'system' | 'private';
export type MissionStatus = 'available' | 'active' | 'complete' | 'failed';
export type OrderType = 'buy' | 'sell';

// ---- Player ----

export interface Player {
  id: string;
  username: string;
  empire: string;
  credits: number;

  // Status (legacy – set by docked/undocked/player_died events)
  status?: PlayerStatus;

  // Navigation (actual server field names from state_update)
  current_system?: string;
  current_poi?: string;
  docked_at_base?: string | null;
  home_base?: string;

  // Legacy navigation aliases (kept for events that use old names)
  system_id?: string;
  poi_id?: string | null;
  location?: string;

  // Identity
  primary_color?: string;
  secondary_color?: string;
  anonymous?: boolean;
  is_cloaked?: boolean;
  status_message?: string;
  clan_tag?: string;
  current_ship_id?: string;

  // Skills
  skills?: Skill[] | Record<string, unknown>;
  skill_xp?: Record<string, number>;
  experience?: number;

  // Stats & discovery
  stats?: PlayerStats;
  discovered_systems?: Record<string, { system_id: string; discovered_at: string }>;

  faction_id?: string | null;
  missions?: Mission[];
  achievements?: Achievement[];
  insurance?: boolean;

  // Timestamps
  created_at?: string;
  last_login_at?: string;
  last_active_at?: string;
}

export interface PlayerStats {
  credits_earned: number;
  credits_spent: number;
  ships_destroyed: number;
  ships_lost: number;
  pirates_destroyed: number;
  bases_destroyed: number;
  ore_mined: number;
  items_crafted: number;
  trades_completed: number;
  systems_explored: number;
  distance_traveled: number;
  time_played: number;
}

// ---- Ship ----

export interface Ship {
  id: string;
  name: string;
  class_id?: string;    // actual server field
  type?: string;        // legacy alias
  class?: string;       // legacy alias
  owner_id?: string;

  hull: number;
  max_hull: number;

  // Shield – server sends 'shield'/'max_shield'; legacy used 'shields'/'max_shields'
  shield?: number;
  max_shield?: number;
  shields?: number;      // legacy
  max_shields?: number;  // legacy
  shield_recharge?: number;

  armor?: number;
  speed?: number;

  fuel: number;
  max_fuel: number;

  // Cargo – server sends cargo_used/cargo_capacity
  cargo_used?: number;
  cargo_capacity?: number;
  max_cargo?: number;    // legacy

  // CPU/Power – server sends cpu_capacity/power_capacity
  cpu_used?: number;
  cpu_capacity?: number;
  cpu_max?: number;      // legacy
  power_used?: number;
  power_capacity?: number;
  power_max?: number;    // legacy

  // Slots
  weapon_slots?: number;
  defense_slots?: number;
  utility_slots?: number;

  // Module IDs
  modules: string[];

  // Cargo items (server: {item_id, quantity}; legacy: full CargoItem)
  cargo: CargoItem[];

  created_at?: string;
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

// ---- Module ----

export interface Module {
  id: string;
  name: string;
  type: string;
  type_id?: string;

  // CPU/Power – server uses cpu_usage/power_usage
  cpu_usage?: number;
  power_usage?: number;
  cpu_cost?: number;     // legacy
  power_cost?: number;   // legacy

  active?: boolean;
  wear: number;
  wear_status?: string;

  // Quality
  quality?: number;
  quality_grade?: string;

  // Mining-specific
  mining_power?: number;
  mining_range?: number;

  stats?: Record<string, number>;
}

// ---- Cargo ----

export interface CargoItem {
  item_id: string;
  name?: string;        // not always present from server
  quantity: number;
  volume?: number;      // not always present
  value?: number;       // not always present
}

// ---- Fleet ----

export interface FleetData {
  ships: Ship[];
  active_ship_id: string;
}

// ---- Star System ----

export interface SystemInfo {
  id: string;
  name: string;
  security_level: SecurityLevel;
  security_status?: string; // descriptive string from server e.g. "Maximum Security (empire capital)"
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
  security_level?: SecurityLevel | null;
  jump_cost?: number | null;
  distance?: number | null;
}

export interface POI {
  id: string;
  name: string;
  type: string; // station, asteroid_belt, gate, wreck, planet, anomaly, sun, nebula, gas_cloud, ice_field, etc.
  base: BaseInfo | null;
  player_count: number;
  // Server fields (from get_system)
  has_base?: boolean;
  base_id?: string | null;
  base_name?: string | null;
  online?: number;
  position?: { x: number; y: number };
}

// Legacy nearby player (from system_info)
export interface NearbyPlayer {
  id?: string;
  player_id?: string;
  username: string;
  ship_type?: string;    // legacy
  ship_class?: string;   // actual server field
  faction_id?: string | null;
  visible?: boolean;
  primary_color?: string;
  secondary_color?: string;
  anonymous?: boolean;
  in_combat?: boolean;
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

export interface BaseServices {
  cloning?: boolean;
  crafting?: boolean;
  insurance?: boolean;
  market?: boolean;
  missions?: boolean;
  refuel?: boolean;
  repair?: boolean;
  shipyard?: boolean;
  storage?: boolean;
}

export interface BaseCondition {
  total_service_infra?: number;
  satisfied_count?: number;
  satisfaction_pct?: number;
  condition?: string;
  condition_text?: string;
  // Legacy fields
  health?: number;
  max_health?: number;
  status?: string;
}

export interface BaseInfo {
  id: string;
  poi_id?: string;
  name: string;
  type: 'outpost' | 'station' | 'fortress' | 'shipyard' | string;
  owner_id?: string | null;
  owner_name?: string | null;
  faction_id?: string | null;
  services: BaseServices | string[];
  hull?: number;
  max_hull?: number;
  defense_level?: number;
  public_access?: boolean;
  description?: string;
  empire?: string;
  facilities?: string[];
  has_drones?: boolean;
  condition?: BaseCondition;
}

export interface StorageData {
  station_id?: string;
  station_name?: string;
  base_id?: string;
  items: CargoItem[];
  credits: number;
  capacity?: number;
  capacity_used?: number;
  ships?: Ship[];
  gifts?: StorageGift[];
}

export interface StorageGift {
  from: string;
  items: CargoItem[];
  credits: number;
  message: string;
}

// ---- Market / Trading ----

/** Individual order within a market item (from view_market) */
export interface MarketOrderEntry {
  price_each: number;
  quantity: number;
  source?: string; // "station" for NPC orders
}

/** A single item listing in the market (from view_market payload.items[]) */
export interface MarketItem {
  item_id: string;
  item_name: string;
  best_buy: number;   // highest buy order price (0 = no buy orders)
  best_sell: number;   // lowest sell order price (0 = no sell orders)
  spread?: number;
  buy_orders: MarketOrderEntry[];
  sell_orders: MarketOrderEntry[];
}

/** Full market data from view_market response */
export interface MarketData {
  base: string;        // station name e.g. "Frontier Station"
  items: MarketItem[];
}

/** Player's own order (from view_orders) */
export interface MyOrder {
  order_id: string;
  order_type: OrderType;
  item_id: string;
  item_name: string;
  price_each: number;
  quantity: number;
  remaining: number;
  listing_fee: number;
  created_at: string;
}

/** Legacy flat listing – kept for backward compatibility */
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

export interface MyOrders {
  orders: MarketListing[];
}

// ---- Crafting ----

export interface RecipeInput {
  item_id: string;
  quantity: number;
}

export interface RecipeOutput {
  item_id: string;
  quantity: number;
  quality_mod?: boolean;
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  category?: string;
  inputs: RecipeInput[];
  outputs: RecipeOutput[];
  required_skills: Record<string, number>;
  crafting_time: number;
  base_quality?: number;
  skill_quality_mod?: number;
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

export interface TargetScanResult {
  target_id: string;
  success: boolean;
  revealed_info: string[] | null;
  tick?: number;
  username?: string;
  ship_class?: string;
  cloaked?: boolean;
  hull?: number;
  shield?: number;
  faction_id?: string;
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
  target_id?: string;
}

/** View filter for chat panel – 'all' shows every channel */
export type ChatViewFilter = ChatChannel | 'all';

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
  current_tick?: number;
}

// Legacy StateUpdate (kept for old handlers)
export interface StateUpdate {
  player?: Partial<Player>;
  ship?: Partial<Ship>;
  system?: Partial<SystemInfo>;
  events?: EventLogEntry[];
  chat?: ChatMessage[];
  tick?: number;
}

// Actual state_update payload from server
export interface StateUpdatePayload {
  tick?: number;
  player?: Player;
  ship?: Ship;
  modules?: Module[];
  nearby?: NearbyPlayer[];
  in_combat?: boolean;
}

// ---- Catalog ----

export type CatalogType = 'ships' | 'skills' | 'recipes' | 'items';

export interface CatalogRequest {
  type: CatalogType;
  id?: string;
  category?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface CatalogResponse {
  type: CatalogType;
  items: CatalogEntry[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  message?: string;
}

// Generic catalog entry – each catalog type has different fields
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CatalogEntry = Record<string, any>;

// ---- Game State (full snapshot) ----

export interface GameState {
  connected: boolean;
  authenticated: boolean;
  welcome: WelcomePayload | null;
  tick: number;

  player: Player | null;
  ship: Ship | null;

  system: SystemInfo | null;
  poi: POI | null;
  travel: TravelState;

  in_combat: boolean;
  combat_log: CombatEvent[];
  scan_result: ScanResult | null;

  market_data: MarketData | null;
  my_orders: MarketListing[];

  ship_catalog: ShipClass[];
  fleet: FleetData | null;

  storage_data: StorageData | null;

  recipes: Recipe[];

  faction: Faction | null;

  chat_messages: ChatMessage[];
  event_log: EventLogEntry[];
}
