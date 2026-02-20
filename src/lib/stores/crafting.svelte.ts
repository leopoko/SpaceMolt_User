import type { Recipe } from '$lib/types/game';

const FAVORITES_KEY = 'sm_crafting_favorites';

function loadFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch { /* ignore */ }
  return new Set();
}

function saveFavorites(ids: Set<string>) {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...ids]));
  } catch { /* ignore */ }
}

class CraftingStore {
  recipes = $state<Recipe[]>([]);
  selectedRecipe = $state<Recipe | null>(null);
  craftCount = $state(1);
  lastResult = $state<string | null>(null);
  favoriteIds = $state<Set<string>>(loadFavorites());

  /** Accept the Record<id, Recipe> format from get_recipes and convert to array */
  setRecipes(recipesMap: Record<string, Recipe>) {
    this.recipes = Object.values(recipesMap);
  }

  /** Sorted unique category list derived from loaded recipes */
  get categories(): string[] {
    const cats = new Set<string>();
    for (const r of this.recipes) {
      if (r.category) cats.add(r.category);
    }
    return [...cats].sort();
  }

  isFavorite(recipeId: string): boolean {
    return this.favoriteIds.has(recipeId);
  }

  toggleFavorite(recipeId: string) {
    const next = new Set(this.favoriteIds);
    if (next.has(recipeId)) {
      next.delete(recipeId);
    } else {
      next.add(recipeId);
    }
    this.favoriteIds = next;
    saveFavorites(next);
  }

  selectRecipe(recipe: Recipe | null) {
    this.selectedRecipe = recipe;
    this.craftCount = 1;
  }

  setLastResult(msg: string) {
    this.lastResult = msg;
    setTimeout(() => { this.lastResult = null; }, 5000);
  }

  reset() {
    this.recipes = [];
    this.selectedRecipe = null;
    this.craftCount = 1;
    this.lastResult = null;
  }
}

export const craftingStore = new CraftingStore();
