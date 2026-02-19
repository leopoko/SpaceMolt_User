import type { Recipe } from '$lib/types/game';

class CraftingStore {
  recipes = $state<Recipe[]>([]);
  selectedRecipe = $state<Recipe | null>(null);
  craftQuantity = $state(1);
  lastResult = $state<string | null>(null);

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

  selectRecipe(recipe: Recipe | null) {
    this.selectedRecipe = recipe;
    this.craftQuantity = 1;
  }

  setLastResult(msg: string) {
    this.lastResult = msg;
    setTimeout(() => { this.lastResult = null; }, 5000);
  }

  reset() {
    this.lastResult = null;
  }
}

export const craftingStore = new CraftingStore();
