import type { TradeOffer, TradeItems } from '$lib/types/game';

class TradeStore {
  /** Incoming trade offers from other players */
  incoming = $state<TradeOffer[]>([]);
  /** Outgoing trade offers I have sent */
  outgoing = $state<TradeOffer[]>([]);
  /** Loading state for trade operations */
  loading = $state(false);
  /** Last trade result message */
  lastResult = $state<string | null>(null);

  /** All active (pending) incoming offers */
  get pendingIncoming(): TradeOffer[] {
    return this.incoming.filter(t => t.status === 'pending');
  }

  /** All active (pending) outgoing offers */
  get pendingOutgoing(): TradeOffer[] {
    return this.outgoing.filter(t => t.status === 'pending');
  }

  /** Get incoming offers from a specific player */
  getOffersFrom(username: string): TradeOffer[] {
    return this.incoming.filter(
      t => t.status === 'pending' && t.offerer_name === username
    );
  }

  /** Get outgoing offers to a specific player */
  getOffersTo(username: string): TradeOffer[] {
    return this.outgoing.filter(
      t => t.status === 'pending' && t.target_name === username
    );
  }

  /** Count of pending incoming offers (for badge) */
  get incomingCount(): number {
    return this.pendingIncoming.length;
  }

  /** Add an incoming trade offer */
  addIncoming(offer: TradeOffer) {
    // Avoid duplicates
    const idx = this.incoming.findIndex(t => t.trade_id === offer.trade_id);
    if (idx >= 0) {
      this.incoming[idx] = offer;
    } else {
      this.incoming = [offer, ...this.incoming];
    }
  }

  /** Add an outgoing trade offer */
  addOutgoing(offer: TradeOffer) {
    const idx = this.outgoing.findIndex(t => t.trade_id === offer.trade_id);
    if (idx >= 0) {
      this.outgoing[idx] = offer;
    } else {
      this.outgoing = [offer, ...this.outgoing];
    }
  }

  /** Update trade status by trade_id (in both incoming and outgoing) */
  updateStatus(tradeId: string, status: TradeOffer['status']) {
    const inIdx = this.incoming.findIndex(t => t.trade_id === tradeId);
    if (inIdx >= 0) {
      this.incoming[inIdx] = { ...this.incoming[inIdx], status };
    }
    const outIdx = this.outgoing.findIndex(t => t.trade_id === tradeId);
    if (outIdx >= 0) {
      this.outgoing[outIdx] = { ...this.outgoing[outIdx], status };
    }
  }

  /** Remove a trade by ID */
  remove(tradeId: string) {
    this.incoming = this.incoming.filter(t => t.trade_id !== tradeId);
    this.outgoing = this.outgoing.filter(t => t.trade_id !== tradeId);
  }

  setLastResult(msg: string) {
    this.lastResult = msg;
  }

  reset() {
    this.incoming = [];
    this.outgoing = [];
    this.loading = false;
    this.lastResult = null;
  }
}

export const tradeStore = new TradeStore();
