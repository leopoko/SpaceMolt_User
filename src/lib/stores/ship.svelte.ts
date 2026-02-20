import type { Ship, ShipClass, FleetData, CargoItem, Module, ShowroomShip, CommissionOrder, CommissionQuote, ShipListing } from '$lib/types/game';

class ShipStore {
  current = $state<Ship | null>(null);
  fleet = $state<Ship[]>([]);
  catalog = $state<ShipClass[]>([]);
  activeShipId = $state<string | null>(null);
  // Full module data (from state_update.modules)
  moduleData = $state<Module[]>([]);

  // ---- Shipyard: Showroom ----
  showroom = $state<ShowroomShip[]>([]);
  showroomLoading = $state<boolean>(false);
  showroomTip = $state<string>('');
  showroomLevel = $state<number>(0);

  // ---- Shipyard: Commission ----
  commissions = $state<CommissionOrder[]>([]);
  commissionsLoading = $state<boolean>(false);
  commissionQuote = $state<CommissionQuote | null>(null);
  commissionQuoteLoading = $state<boolean>(false);

  // ---- Shipyard: Player Exchange ----
  shipListings = $state<ShipListing[]>([]);
  shipListingsLoading = $state<boolean>(false);

  // ---- Getters ----

  get hullPercent(): number {
    if (!this.current) return 0;
    return Math.min((this.current.hull / this.current.max_hull) * 100, 100);
  }

  get shieldPercent(): number {
    if (!this.current) return 0;
    const s = this.current.shield ?? this.current.shields ?? 0;
    const ms = this.current.max_shield ?? this.current.max_shields ?? 1;
    return ms > 0 ? Math.min((s / ms) * 100, 100) : 0;
  }

  get fuelPercent(): number {
    if (!this.current) return 0;
    return this.current.max_fuel > 0
      ? Math.min((this.current.fuel / this.current.max_fuel) * 100, 100)
      : 0;
  }

  // Cargo used – prefer server's cargo_used, fall back to summing items
  get cargoUsed(): number {
    if (!this.current) return 0;
    if (this.current.cargo_used != null) return this.current.cargo_used;
    return this.current.cargo.reduce((a, c) => a + c.quantity * (c.volume ?? 1), 0);
  }

  get cargoCapacity(): number {
    return this.current?.cargo_capacity ?? this.current?.max_cargo ?? 0;
  }

  get cargoPercent(): number {
    const cap = this.cargoCapacity;
    return cap > 0 ? Math.min((this.cargoUsed / cap) * 100, 100) : 0;
  }

  get cargo(): CargoItem[] {
    return this.current?.cargo ?? [];
  }

  // Shield values (normalised getters usable by components)
  get shield(): number { return this.current?.shield ?? this.current?.shields ?? 0; }
  get maxShield(): number { return this.current?.max_shield ?? this.current?.max_shields ?? 0; }

  // CPU / Power
  get cpuUsed(): number { return this.current?.cpu_used ?? 0; }
  get cpuCapacity(): number { return this.current?.cpu_capacity ?? this.current?.cpu_max ?? 0; }
  get powerUsed(): number { return this.current?.power_used ?? 0; }
  get powerCapacity(): number { return this.current?.power_capacity ?? this.current?.power_max ?? 0; }

  updateCurrent(partial: Partial<Ship>) {
    if (this.current) {
      Object.assign(this.current, partial);
    } else {
      this.current = partial as Ship;
    }
  }

  updateModules(modules: Module[]) {
    this.moduleData = modules;
  }

  updateFleet(data: FleetData) {
    this.fleet = data.ships;
    this.activeShipId = data.active_ship_id;
  }

  // ---- Shipyard state updates ----

  setShowroom(ships: ShowroomShip[], tip?: string, level?: number) {
    this.showroom = ships;
    this.showroomLoading = false;
    this.showroomTip = tip ?? '';
    this.showroomLevel = level ?? 0;
  }

  setCommissions(orders: CommissionOrder[]) {
    this.commissions = orders;
    this.commissionsLoading = false;
  }

  setCommissionQuote(quote: CommissionQuote | null) {
    this.commissionQuote = quote;
    this.commissionQuoteLoading = false;
  }

  setShipListings(listings: ShipListing[]) {
    this.shipListings = listings;
    this.shipListingsLoading = false;
  }

  reset() {
    this.current = null;
    this.fleet = [];
    this.activeShipId = null;
    this.moduleData = [];
    this.showroom = [];
    this.showroomTip = '';
    this.showroomLevel = 0;
    this.commissions = [];
    this.commissionQuote = null;
    this.shipListings = [];
  }
}

export const shipStore = new ShipStore();
