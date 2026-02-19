import type { StorageData, BaseInfo, BaseCondition } from '$lib/types/game';

class BaseStore {
  storageData = $state<StorageData | null>(null);
  currentBase = $state<BaseInfo | null>(null);
  baseCondition = $state<BaseCondition | null>(null);

  get items() { return this.storageData?.items ?? []; }
  get credits(): number { return this.storageData?.credits ?? 0; }
  get capacity(): number { return this.storageData?.capacity ?? 0; }
  get capacityUsed(): number { return this.storageData?.capacity_used ?? 0; }
  get capacityPercent(): number {
    if (!this.capacity) return 0;
    return (this.capacityUsed / this.capacity) * 100;
  }
  get storedShips() { return this.storageData?.ships ?? []; }
  get gifts() { return this.storageData?.gifts ?? []; }

  /** Convert services (object or array) to display-friendly string array */
  get serviceList(): string[] {
    if (!this.currentBase?.services) return [];
    if (Array.isArray(this.currentBase.services)) return this.currentBase.services;
    // Convert BaseServices object to array of enabled service names
    return Object.entries(this.currentBase.services)
      .filter(([, enabled]) => enabled)
      .map(([name]) => name);
  }

  setStorage(data: StorageData) {
    this.storageData = data;
  }

  setBase(info: BaseInfo, condition?: BaseCondition) {
    this.currentBase = info;
    if (condition) this.baseCondition = condition;
  }

  reset() {
    this.storageData = null;
    this.currentBase = null;
    this.baseCondition = null;
  }
}

export const baseStore = new BaseStore();
