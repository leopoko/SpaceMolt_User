import type { ShipCatalogEntry, ShipCatalogResponse } from '$lib/types/game';

const API_URL = 'https://game.spacemolt.com/api/ships';

class ShipCatalogStore {
  ships = $state<ShipCatalogEntry[]>([]);
  classes = $state<string[]>([]);
  empires = $state<{ id: string; name: string }[]>([]);
  loading = $state<boolean>(false);
  loaded = $state<boolean>(false);
  error = $state<string | null>(null);

  // Filters
  filterCategory = $state<string>('All');
  filterEmpire = $state<string>('All');
  filterTier = $state<number>(0);       // 0 = All
  filterScale = $state<number>(0);      // 0 = All
  filterMaxPrice = $state<number>(0);   // 0 = no limit
  searchQuery = $state<string>('');

  // Selected ship for detail view / commission
  selectedShipId = $state<string | null>(null);

  // ---- Derived data ----

  get categories(): string[] {
    const set = new Set<string>();
    for (const s of this.ships) if (s.category) set.add(s.category);
    return Array.from(set).sort();
  }

  get tiers(): number[] {
    const set = new Set<number>();
    for (const s of this.ships) if (s.tier) set.add(s.tier);
    return Array.from(set).sort((a, b) => a - b);
  }

  get scales(): number[] {
    const set = new Set<number>();
    for (const s of this.ships) if (s.scale) set.add(s.scale);
    return Array.from(set).sort((a, b) => a - b);
  }

  get filteredShips(): ShipCatalogEntry[] {
    let result = this.ships;
    if (this.filterCategory !== 'All') {
      result = result.filter(s => s.category === this.filterCategory);
    }
    if (this.filterEmpire !== 'All') {
      result = result.filter(s => s.empire === this.filterEmpire);
    }
    if (this.filterTier > 0) {
      result = result.filter(s => s.tier === this.filterTier);
    }
    if (this.filterScale > 0) {
      result = result.filter(s => s.scale === this.filterScale);
    }
    if (this.filterMaxPrice > 0) {
      result = result.filter(s => s.price <= this.filterMaxPrice);
    }
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.trim().toLowerCase();
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        (s.flavor_tags ?? []).some(t => t.toLowerCase().includes(q))
      );
    }
    return result;
  }

  get selectedShip(): ShipCatalogEntry | null {
    if (!this.selectedShipId) return null;
    return this.ships.find(s => s.id === this.selectedShipId) ?? null;
  }

  /** Max stats for progress bar scaling (across ALL ships, not just filtered) */
  get maxStats() {
    const all = this.ships;
    if (all.length === 0) return { hull: 1, shield: 1, cargo: 1, fuel: 1, speed: 1, armor: 1 };
    return {
      hull: Math.max(1, ...all.map(s => s.base_hull ?? 0)),
      shield: Math.max(1, ...all.map(s => s.base_shield ?? 0)),
      cargo: Math.max(1, ...all.map(s => s.cargo_capacity ?? 0)),
      fuel: Math.max(1, ...all.map(s => s.base_fuel ?? 0)),
      speed: Math.max(1, ...all.map(s => s.base_speed ?? 0)),
      armor: Math.max(1, ...all.map(s => s.base_armor ?? 0)),
    };
  }

  // ---- Actions ----

  async fetchCatalog() {
    if (this.loading) return;
    this.loading = true;
    this.error = null;
    try {
      const resp = await fetch(API_URL);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data: ShipCatalogResponse = await resp.json();
      this.ships = data.ships ?? [];
      this.classes = data.classes ?? [];
      this.empires = data.empires ?? [];
      this.loaded = true;
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
    } finally {
      this.loading = false;
    }
  }

  setFilter(key: 'category' | 'empire', value: string) {
    if (key === 'category') this.filterCategory = value;
    else this.filterEmpire = value;
  }

  setTierFilter(tier: number) {
    this.filterTier = tier;
  }

  setScaleFilter(scale: number) {
    this.filterScale = scale;
  }

  setPriceFilter(maxPrice: number) {
    this.filterMaxPrice = maxPrice;
  }

  setSearch(query: string) {
    this.searchQuery = query;
  }

  selectShip(shipId: string | null) {
    this.selectedShipId = shipId;
  }

  clearFilters() {
    this.filterCategory = 'All';
    this.filterEmpire = 'All';
    this.filterTier = 0;
    this.filterScale = 0;
    this.filterMaxPrice = 0;
    this.searchQuery = '';
  }

  /** Price range for filter UI */
  get priceRange(): { min: number; max: number } {
    if (this.ships.length === 0) return { min: 0, max: 0 };
    return {
      min: Math.min(...this.ships.map(s => s.price)),
      max: Math.max(...this.ships.map(s => s.price)),
    };
  }

  /** Whether any filter is active (for showing "Clear" button) */
  get hasActiveFilters(): boolean {
    return this.filterCategory !== 'All'
      || this.filterEmpire !== 'All'
      || this.filterTier > 0
      || this.filterScale > 0
      || this.filterMaxPrice > 0
      || this.searchQuery.trim().length > 0;
  }

  reset() {
    this.ships = [];
    this.classes = [];
    this.empires = [];
    this.loading = false;
    this.loaded = false;
    this.error = null;
    this.selectedShipId = null;
    this.clearFilters();
  }
}

export const shipCatalogStore = new ShipCatalogStore();
