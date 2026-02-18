import type { MarketData, MarketListing } from '$lib/types/game';

class MarketStore {
  data = $state<MarketData | null>(null);
  myOrders = $state<MarketListing[]>([]);
  loading = $state(false);

  get buyOrders(): MarketListing[] { return this.data?.buy_orders ?? []; }
  get sellOrders(): MarketListing[] { return this.data?.sell_orders ?? []; }
  get stationId(): string { return this.data?.station_id ?? ''; }

  setData(data: MarketData) {
    this.data = data;
  }

  setMyOrders(orders: MarketListing[]) {
    this.myOrders = orders;
  }

  removeOrder(orderId: string) {
    this.myOrders = this.myOrders.filter(o => o.id !== orderId);
  }

  reset() {
    this.data = null;
    this.myOrders = [];
  }
}

export const marketStore = new MarketStore();
