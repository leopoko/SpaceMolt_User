import type { MarketData, MarketItem, MyOrder } from '$lib/types/game';

class MarketStore {
  data = $state<MarketData | null>(null);
  myOrders = $state<MyOrder[]>([]);
  loading = $state(false);

  /** All market items from view_market */
  get items(): MarketItem[] { return this.data?.items ?? []; }

  /** Station/base name */
  get baseName(): string { return this.data?.base ?? ''; }

  /** Items that have sell orders (things you can buy) */
  get itemsForSale(): MarketItem[] {
    return this.items.filter(i => i.sell_orders.length > 0);
  }

  /** Items that have buy orders (things you can sell to) */
  get itemsWanted(): MarketItem[] {
    return this.items.filter(i => i.buy_orders.length > 0);
  }

  /** All known item names from the current market (for autocomplete) */
  get knownItems(): Array<{ item_id: string; item_name: string }> {
    return this.items.map(i => ({ item_id: i.item_id, item_name: i.item_name }));
  }

  setData(data: MarketData) {
    this.data = data;
  }

  setMyOrders(orders: MyOrder[]) {
    this.myOrders = orders;
  }

  removeOrder(orderId: string) {
    this.myOrders = this.myOrders.filter(o => o.order_id !== orderId);
  }

  reset() {
    this.data = null;
    this.myOrders = [];
  }
}

export const marketStore = new MarketStore();
