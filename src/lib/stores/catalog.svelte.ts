import type { CatalogType, CatalogEntry, CatalogResponse } from '$lib/types/game';

interface CatalogState {
  items: CatalogEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  loading: boolean;
  search: string;
  category: string;
}

function emptyState(): CatalogState {
  return {
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
    totalPages: 0,
    loading: false,
    search: '',
    category: '',
  };
}

class CatalogStore {
  ships = $state<CatalogState>(emptyState());
  skills = $state<CatalogState>(emptyState());
  recipes = $state<CatalogState>(emptyState());
  items = $state<CatalogState>(emptyState());

  private getState(type: CatalogType): CatalogState {
    switch (type) {
      case 'ships': return this.ships;
      case 'skills': return this.skills;
      case 'recipes': return this.recipes;
      case 'items': return this.items;
    }
  }

  setLoading(type: CatalogType, loading: boolean) {
    const state = this.getState(type);
    state.loading = loading;
  }

  setSearch(type: CatalogType, search: string) {
    const state = this.getState(type);
    state.search = search;
    state.page = 1;
  }

  setCategory(type: CatalogType, category: string) {
    const state = this.getState(type);
    state.category = category;
    state.page = 1;
  }

  setPage(type: CatalogType, page: number) {
    const state = this.getState(type);
    state.page = page;
  }

  handleResponse(resp: CatalogResponse) {
    const state = this.getState(resp.type);
    state.items = resp.items ?? [];
    state.total = resp.total ?? 0;
    state.page = resp.page ?? 1;
    state.pageSize = resp.page_size ?? 20;
    state.totalPages = resp.total_pages ?? 0;
    state.loading = false;
  }
}

export const catalogStore = new CatalogStore();
