import type { StorageData, BaseInfo } from '$lib/types/game';

class BaseStore {
  storageData = $state<StorageData | null>(null);
  currentBase = $state<BaseInfo | null>(null);

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

  setStorage(data: StorageData) {
    this.storageData = data;
  }

  setBase(info: BaseInfo) {
    this.currentBase = info;
  }

  reset() {
    this.storageData = null;
    this.currentBase = null;
  }
}

export const baseStore = new BaseStore();
