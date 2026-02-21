import type { FacilityInstance, FacilityType, FacilityTypeCategories, FacilityUpgrade, FacilityLockedUpgrade, PersonalQuartersInfo } from '$lib/types/game';

/** Cached facility info for recipe→facility reverse lookup */
export interface RecipeFacilityInfo {
  id: string;
  name: string;
  build_cost: number;
}

class FacilityStore {
  // Station facilities grouped by owner type
  stationFacilities = $state<FacilityInstance[]>([]);
  playerFacilities = $state<FacilityInstance[]>([]);
  factionFacilities = $state<FacilityInstance[]>([]);

  // Catalog browsing
  types = $state<FacilityType[]>([]);
  categories = $state<FacilityTypeCategories>({});
  typesTotal = $state(0);
  typesPage = $state(1);
  typesTotalPages = $state(1);

  // Detail view
  selectedType = $state<FacilityType | null>(null);

  // Upgrades
  upgrades = $state<FacilityUpgrade[]>([]);
  lockedUpgrades = $state<FacilityLockedUpgrade[]>([]);
  upgradesLoading = $state(false);

  // Personal quarters
  quartersInfo = $state<PersonalQuartersInfo | null>(null);
  quartersLoading = $state(false);

  // Loading states
  loading = $state(false);
  typesLoading = $state(false);

  // --- Recipe-to-facility mapping (NOT $state to avoid Proxy issues with Map) ---
  private _recipeToFacility = new Map<string, RecipeFacilityInfo>();
  /** Cache: facility type_id → labor_cost (ticks per rent cycle) */
  private _typeCycleTicks = new Map<string, number>();
  recipeMappingStatus = $state<'idle' | 'loading' | 'done'>('idle');
  recipeMappingPage = $state(0);
  recipeMappingTotal = $state(0);

  /** All facilities combined */
  get allFacilities(): FacilityInstance[] {
    return [...this.stationFacilities, ...this.playerFacilities, ...this.factionFacilities];
  }

  /** My personal facilities (from player_facilities with personal_service) */
  get myPersonalFacilities(): FacilityInstance[] {
    return this.playerFacilities.filter(f => f.category === 'personal');
  }

  /** My production facilities (player-owned production) */
  get myProductionFacilities(): FacilityInstance[] {
    return this.playerFacilities.filter(f => f.category === 'production');
  }

  /** Current mapping cache size (use $state wrapper for reactivity) */
  get recipeMappingSize(): number {
    // Read mapping status to make this reactive
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    this.recipeMappingPage;
    return this._recipeToFacility.size;
  }

  setFacilities(data: {
    station_facilities?: FacilityInstance[];
    player_facilities?: FacilityInstance[];
    faction_facilities?: FacilityInstance[];
  }) {
    this.stationFacilities = data.station_facilities ?? [];
    this.playerFacilities = data.player_facilities ?? [];
    this.factionFacilities = data.faction_facilities ?? [];
    this.loading = false;
  }

  setTypes(data: {
    types?: FacilityType[];
    categories?: FacilityTypeCategories;
    total?: number;
    page?: number;
    total_pages?: number;
    per_page?: number;
  }) {
    if (data.types) {
      this.types = data.types;
      // Also cache recipe mappings from any types response
      this.cacheRecipeMappings(data.types);
    }
    if (data.categories) this.categories = data.categories;
    if (data.total !== undefined) this.typesTotal = data.total;
    if (data.page !== undefined) this.typesPage = data.page;
    if (data.total_pages !== undefined) this.typesTotalPages = data.total_pages;
    this.typesLoading = false;
  }

  setSelectedType(detail: FacilityType | null) {
    this.selectedType = detail;
    this.typesLoading = false;
    if (detail) {
      const typeId = detail.type_id ?? detail.id;
      // Cache recipe mapping from detail view
      if (detail.recipe_id) {
        this._recipeToFacility.set(detail.recipe_id, {
          id: typeId,
          name: detail.name,
          build_cost: detail.build_cost,
        });
      }
      // Cache cycle ticks from detail view
      if (detail.labor_cost != null) {
        this._typeCycleTicks.set(typeId, detail.labor_cost);
      }
    }
  }

  setUpgrades(upgrades: FacilityUpgrade[], lockedUpgrades?: FacilityLockedUpgrade[]) {
    this.upgrades = upgrades;
    this.lockedUpgrades = lockedUpgrades ?? [];
    this.upgradesLoading = false;
  }

  setQuartersInfo(info: PersonalQuartersInfo | null) {
    this.quartersInfo = info;
    this.quartersLoading = false;
  }

  // --- Recipe mapping methods ---

  /** Cache recipe→facility mappings and cycle ticks from a batch of facility types */
  cacheRecipeMappings(types: FacilityType[]) {
    for (const ft of types) {
      const typeId = ft.type_id ?? ft.id;
      if (ft.recipe_id) {
        this._recipeToFacility.set(ft.recipe_id, {
          id: typeId,
          name: ft.name,
          build_cost: ft.build_cost,
        });
      }
      // Cache cycle ticks (labor_cost = ticks per rent cycle)
      if (ft.labor_cost != null) {
        this._typeCycleTicks.set(typeId, ft.labor_cost);
      }
    }
  }

  /** Get facility info for a recipe ID */
  getFacilityForRecipe(recipeId: string): RecipeFacilityInfo | null {
    return this._recipeToFacility.get(recipeId) ?? null;
  }

  /** Get cycle length in ticks for a facility type (from cache).
   *  Falls back to rent_per_cycle if not cached (they're often equal). */
  getCycleTicks(typeId: string, rentPerCycleFallback?: number): number | null {
    // Read recipeMappingPage to trigger reactivity
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    this.recipeMappingPage;
    return this._typeCycleTicks.get(typeId) ?? rentPerCycleFallback ?? null;
  }

  /** Start background recipe mapping build (fetches all production facility types) */
  startRecipeMapping() {
    if (this.recipeMappingStatus !== 'idle') return;
    this.recipeMappingStatus = 'loading';
    this.recipeMappingPage = 1;
  }

  /** Called when a mapping page response arrives — chains to next page */
  onRecipeMappingPage(types: FacilityType[], page: number, totalPages: number) {
    this.cacheRecipeMappings(types);
    this.recipeMappingTotal = totalPages;
    if (page < totalPages) {
      this.recipeMappingPage = page + 1;
    } else {
      this.recipeMappingStatus = 'done';
      this.recipeMappingPage = 0;
    }
  }

  reset() {
    this.stationFacilities = [];
    this.playerFacilities = [];
    this.factionFacilities = [];
    this.types = [];
    this.categories = {};
    this.typesTotal = 0;
    this.typesPage = 1;
    this.typesTotalPages = 1;
    this.selectedType = null;
    this.upgrades = [];
    this.lockedUpgrades = [];
    this.upgradesLoading = false;
    this.quartersInfo = null;
    this.quartersLoading = false;
    this.loading = false;
    this.typesLoading = false;
    // Don't reset mapping — it's session-level cache
  }
}

export const facilityStore = new FacilityStore();
