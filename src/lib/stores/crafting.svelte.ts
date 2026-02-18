import type { Recipe } from '$lib/types/game';

class CraftingStore {
  recipes = $state<Recipe[]>([]);
  selectedRecipe = $state<Recipe | null>(null);
  craftingInProgress = $state(false);
  craftQuantity = $state(1);
  lastResult = $state<string | null>(null);

  setRecipes(recipes: Recipe[]) {
    this.recipes = recipes;
  }

  selectRecipe(recipe: Recipe | null) {
    this.selectedRecipe = recipe;
    this.craftQuantity = 1;
  }

  setInProgress(value: boolean) {
    this.craftingInProgress = value;
  }

  setLastResult(msg: string) {
    this.lastResult = msg;
    setTimeout(() => { this.lastResult = null; }, 5000);
  }

  reset() {
    this.craftingInProgress = false;
    this.lastResult = null;
  }
}

export const craftingStore = new CraftingStore();
