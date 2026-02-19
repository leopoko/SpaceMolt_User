/**
 * Item Bookmark Store
 *
 * Saves bookmarked item_ids to localStorage.
 * Bookmarked items appear at the top of market and recipe lists.
 */

const STORAGE_KEY = 'sm_item_bookmarks';

function loadBookmarks(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch { /* ignore */ }
  return new Set();
}

function saveBookmarks(ids: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch { /* ignore */ }
}

class BookmarkStore {
  ids = $state<Set<string>>(loadBookmarks());

  has(itemId: string): boolean {
    return this.ids.has(itemId);
  }

  toggle(itemId: string) {
    const next = new Set(this.ids);
    if (next.has(itemId)) {
      next.delete(itemId);
    } else {
      next.add(itemId);
    }
    this.ids = next;
    saveBookmarks(next);
  }

  add(itemId: string) {
    if (this.ids.has(itemId)) return;
    const next = new Set(this.ids);
    next.add(itemId);
    this.ids = next;
    saveBookmarks(next);
  }

  remove(itemId: string) {
    if (!this.ids.has(itemId)) return;
    const next = new Set(this.ids);
    next.delete(itemId);
    this.ids = next;
    saveBookmarks(next);
  }

  /** All bookmarked item IDs as an array */
  get all(): string[] {
    return [...this.ids];
  }

  reset() {
    this.ids = new Set();
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }
}

export const bookmarkStore = new BookmarkStore();
