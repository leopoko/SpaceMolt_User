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
  weapon_slots?: number;
  defense_slots?: number;
  utility_slots?: number;
  cpu_capacity?: number;
  power_capacity?: number;
  base_armor?: number;
  base_speed?: number;
  base_shield_recharge?: number;
  required_skills?: Record<string, number>;
}

// ---- Shipyard: Showroom ----

export interface ShowroomShip {
  ship_class: string;
  name: string;
  category?: string;
  scale?: number;
  price: number;
  stock?: number;
  // Ship stats
  hull?: number;
  shield?: number;
  fuel?: number;
  cargo_capacity?: number;
  cpu_capacity?: number;
  power_capacity?: number;
  weapon_slots?: number;
  defense_slots?: number;
  utility_slots?: number;
  armor?: number;
  speed?: number;
  description?: string;
}

// ---- Shipyard: Commission ----

export type CommissionStatus = 'pending' | 'building' | 'ready' | 'cancelled';

export interface CommissionOrder {
  commission_id: string;
  ship_class: string;
  ship_name?: string;
  status: CommissionStatus;
  base_id?: string;
  base_name?: string;
  cost?: number;
  provide_materials?: boolean;
  started_at?: string;
  estimated_completion?: number;  // tick
  progress?: number;             // 0-100
  message?: string;
}

export interface CommissionQuote {
  ship_class: string;
  ship_name?: string;

  // Pricing
  credits_only_total?: number;
  provide_materials_total?: number;
  labor_cost?: number;
  material_cost?: number;
  player_credits?: number;

  // Affordability flags
  can_commission?: boolean;
  can_afford_credits_only?: boolean;
  can_afford_provide_materials?: boolean;

  // Build info
  build_materials?: { item_id: string; name?: string; quantity: number }[];
  build_time?: number;

  // Shipyard tier
  shipyard_tier_here?: number;
  shipyard_tier_required?: number;

  // Issues
  blockers?: string[];
  message?: string;
}

// ---- Ship Catalog (REST API /api/ships) ----

export interface ShipCatalogEntry {
  id: string;
  name: string;
  description: string;
  class: string;
  category: string;
  empire: string;
  empire_name: string;
  tier: number;
  scale: number;
  price: number;
  lore: string;
  base_hull: number;
  base_shield: number;
  base_shield_recharge: number;
  base_armor: number;
  base_speed: number;
  base_fuel: number;
  cargo_capacity: number;
  cpu_capacity: number;
  power_capacity: number;
  weapon_slots: number;
  defense_slots: number;
  utility_slots: number;
  shipyard_tier: number;
  build_materials: { item_id: string; item_name: string; quantity: number }[];
  flavor_tags: string[];
}

export interface ShipCatalogResponse {
  classes: string[];
  empires: { id: string; name: string }[];
  ships: ShipCatalogEntry[];
}

// ---- Shipyard: Player Ship Exchange ----

export interface ShipListing {
  listing_id: string;
  ship_id: string;
  ship_class?: string;
  ship_name?: string;
  price: number;
  seller_id?: string;
  seller_name?: string;
  base_id?: string;
  base_name?: string;
  // Ship stats
  hull?: string | number;
  modules?: number;
  cargo_used?: number;
  listed_at?: string;
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

  // Weapon-specific (from catalog & state_update)
  damage?: number;
  damage_type?: string;       // kinetic, thermal, explosive, void, etc.
  ammo_type?: string;         // autocannon, railgun, torpedo, plasma, void_core, etc.
  range?: number;
  reach?: number;             // how many zones away it can hit
  cooldown?: number;
  magazine_size?: number;
  magazine_current?: number;  // rounds currently loaded
  loaded_ammo_id?: string;    // item_id of currently loaded ammo
  special?: string;           // e.g., "armor_bypass_50"

  stats?: Record<string, number>;
}

// ---- Cargo ----

export interface CargoItem {
  item_id: string;
  name?: string;        // not always present from server
  quantity: number;
  volume?: number;      // not always present
  value?: number;       // not always present
  effect?: {            // present on consumable items (ammo, buffs, etc.)
    type?: string;      // "ammo", "buff", "repair", etc.
    subtype?: string;   // for ammo: "autocannon", "railgun", "torpedo", etc.
    [key: string]: unknown;
  };
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

// ---- Facilities ----

export interface FacilityBuildMaterial {
  item_id: string;
  name: string;
  quantity: number;
}

export interface FacilityRecipe {
  id: string;
  name: string;
  crafting_time?: number;
  inputs: FacilityBuildMaterial[];
  outputs: FacilityBuildMaterial[];
}

/** Facility type from the catalog (types action) */
export interface FacilityType {
  id: string;
  type_id?: string;  // present in detail view
  name: string;
  category: string;
  level: number;
  build_cost: number;
  buildable: boolean;
  recipe_id?: string;
  description?: string;
  build_materials?: FacilityBuildMaterial[];
  build_time?: number;
  labor_cost?: number;
  rent_per_cycle?: number;
  recipe?: FacilityRecipe;
  upgrades_to?: string;
  upgrades_to_name?: string;
  bonus_type?: string;
  bonus_value?: number;
  hint?: string;
  personal_service?: string;
}

export interface FacilityTypeCategories {
  [key: string]: { count: number; description?: string; buildable?: number };
}

/** Facility instance at a station (list action) */
export interface FacilityInstance {
  facility_id: string;
  type: string;
  name: string;
  category: string;
  description?: string;
  active: boolean;
  maintenance_satisfied?: boolean;
  rent_per_cycle?: number;
  recipe_id?: string;
  // Player-owned
  owner_id?: string;
  rent_paid_until_tick?: number;
  // Personal
  personal_service?: string;
  bonus_type?: string;
  bonus_value?: number;
  // Faction
  faction_id?: string;
  faction_service?: string;
  capacity?: number;
  // Station service
  service?: string;
  // Level (for upgrade display)
  level?: number;
}

/** Upgrade option returned by the 'upgrades' action */
export interface FacilityUpgrade {
  facility_id: string;
  current_type: string;
  current_name: string;
  upgrade_type: string;
  upgrade_name: string;
  upgrade_cost: number;
  upgrade_materials?: FacilityBuildMaterial[];
  buildable?: boolean;
}

/** Locked upgrade — requires skill or other prerequisite */
export interface FacilityLockedUpgrade {
  your_facility_id: string;
  your_facility_name: string;
  your_facility_type: string;
  current_level: number;
  requires: string;
  upgrade_to: {
    type_id: string;
    name: string;
    category: string;
    level: number;
    description?: string;
    build_cost: number;
    build_materials?: FacilityBuildMaterial[];
    build_time?: number;
    labor_cost?: number;
    rent_per_cycle?: number;
  };
}

/** Personal quarters info returned by personal_visit */
export interface PersonalQuartersInfo {
  username: string;
  station: string;
  description: string;
  access: 'public' | 'private';
  facility_name?: string;
  facility_level?: number;
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
  tag?: string;
  description: string;
  charter?: string;
  leader_id: string;
  leader_name?: string;      // legacy
  leader_username?: string;  // actual API field
  member_count?: number;
  members?: FactionMember[];
  wars?: FactionWar[];
  allies?: string[];
  credits?: number;
  standing?: number;
  owned_bases?: number;
  primary_color?: string;
  secondary_color?: string;
  is_member?: boolean;
  is_ally?: boolean;
  is_enemy?: boolean;
  at_war?: boolean;
  created_at?: string;
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

export interface MissionGiver {
  name: string;
  title?: string;
}

export interface MissionDialog {
  offer?: string;
  accept?: string;
  decline?: string;
  complete?: string;
}

export interface MissionRewards {
  credits: number;
  skill_xp?: Record<string, number>;
  items?: CargoItem[];
}

export interface Mission {
  id: string;
  mission_id?: string;
  template_id?: string;
  title: string;
  description: string;
  type?: string;
  difficulty: number;
  // Rewards: server sends as { credits, skill_xp } object
  rewards?: MissionRewards;
  // Flattened reward fields (normalized from rewards object)
  reward_credits: number;
  reward_items: CargoItem[];
  reward_xp?: Record<string, number>;
  requirements?: Record<string, unknown>;
  status: MissionStatus;
  objectives: MissionObjective[];
  expires_at: number | null;
  expires_in_ticks?: number;
  time_limit?: number;
  accepted_at?: string;
  // Giver: server sends as { name, title } object
  giver?: MissionGiver;
  giver_name?: string;
  // Dialog: server sends as { offer, decline, ... } object
  dialog?: MissionDialog;
  giver_dialog?: string;
  decline_dialog?: string;
  destination?: string;
  destination_name?: string;
  repeatable?: boolean;
  chain_next?: string;
}

export interface MissionObjective {
  id?: string;
  description: string;
  type?: string;
  target?: number;
  current?: number;
  complete?: boolean;
  item_id?: string;
  item_name?: string;
}

// ---- Achievements ----

export interface Achievement {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
  unlocked_at: number | null;
}

// ---- Battle (Zone-based PvP) ----

export type BattleZone = 'outer' | 'mid' | 'inner' | 'engaged';
export type BattleStance = 'fire' | 'evade' | 'brace' | 'flee';
export type BattleActionType = 'advance' | 'retreat' | 'stance' | 'target' | 'engage';

export interface BattleParticipant {
  player_id: string;
  username: string;
  ship_class?: string;
  side_id: number;
  zone: BattleZone;
  stance: BattleStance;
  target_id?: string;
  // Server sends hull_pct / shield_pct (0-100 integer)
  hull_pct?: number;
  shield_pct?: number;
  // Normalized aliases (set by store)
  hull_percent: number;
  shield_percent: number;
  is_fleeing?: boolean;
  is_destroyed?: boolean;
  // battle_ended fields
  damage_dealt?: number;
  damage_taken?: number;
  kill_count?: number;
  survived?: boolean;
}

export interface BattleSide {
  side_id: number;
  player_count?: number;
  members?: string[];
}

export interface BattleStatus {
  battle_id: string;
  tick?: number;
  system_id?: string;
  sides: BattleSide[];
  participants: BattleParticipant[];
  // From battle_update: your_ prefixed fields
  your_side_id?: number;
  your_zone?: BattleZone;
  your_stance?: BattleStance;
  your_target_id?: string;
  auto_pilot?: boolean;
  // Normalized (set by store from your_ or my_ fields)
  my_side_id?: number;
  my_zone?: BattleZone;
  my_stance?: BattleStance;
  my_target_id?: string;
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
  owner?: string;
  wreck_type?: string; // 'ship' | 'pirate' | 'jettison' etc.
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
  modules?: Module[] | null;
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

// ---- Forum / Thread ----

export interface ForumThread {
  id: string;
  title: string;
  content: string;
  author_id: string;
  author: string;
  author_empire?: string;
  author_faction_tag?: string;
  category: ForumCategory;
  upvotes: number;
  reply_count: number;
  replies?: ForumReply[];
  created_at: string;
  updated_at: string;
  pinned?: boolean;
  locked?: boolean;
  is_dev_team?: boolean;
}

export interface ForumReply {
  id: string;
  thread_id: string;
  content: string;
  author_id: string;
  author: string;
  author_empire?: string;
  author_faction_tag?: string;
  upvotes: number;
  created_at: string;
  is_dev_team?: boolean;
}

export interface ForumListResponse {
  threads: ForumThread[];
  page: number;
  total: number;
  per_page: number;
  categories: string[];
}

export interface ForumThreadDetail {
  thread: ForumThread;
  replies: ForumReply[];
}

export type ForumCategory = 'general' | 'bugs' | 'suggestions' | 'trading' | 'factions' | 'strategies' | 'features' | string;

// ---- Player-to-Player Trade ----

export type TradeStatus = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'completed';

/** A trade offer (sent or received) */
export interface TradeOffer {
  trade_id: string;
  offerer_id: string;
  offerer_name: string;
  target_id?: string;
  target_name?: string;
  /** Credits the offerer is giving */
  offer_credits: number;
  /** Items the offerer is giving (array of {item_id, quantity}) */
  offer_items: TradeItemEntry[];
  /** Credits the offerer is requesting */
  request_credits: number;
  /** Items the offerer is requesting */
  request_items: TradeItemEntry[];
  status: TradeStatus;
  expires_at?: string;
  created_at?: number;
}

export interface TradeItemEntry {
  item_id: string;
  quantity: number;
  name?: string;
}

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
