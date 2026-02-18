import type { Ship, ShipClass, FleetData, CargoItem } from '$lib/types/game';

class ShipStore {
  current = $state<Ship | null>(null);
  fleet = $state<Ship[]>([]);
  catalog = $state<ShipClass[]>([]);
  activeShipId = $state<string | null>(null);

  get hullPercent(): number {
    if (!this.current) return 0;
    return (this.current.hull / this.current.max_hull) * 100;
  }

  get shieldPercent(): number {
    if (!this.current) return 0;
    return (this.current.shields / this.current.max_shields) * 100;
  }

  get fuelPercent(): number {
    if (!this.current) return 0;
    return (this.current.fuel / this.current.max_fuel) * 100;
  }

  get cargoUsed(): number {
    if (!this.current) return 0;
    return this.current.cargo.reduce((a, c) => a + c.quantity * c.volume, 0);
  }

  get cargoPercent(): number {
    if (!this.current || this.current.max_cargo === 0) return 0;
    return (this.cargoUsed / this.current.max_cargo) * 100;
  }

  get cargo(): CargoItem[] {
    return this.current?.cargo ?? [];
  }

  updateCurrent(partial: Partial<Ship>) {
    if (this.current) {
      Object.assign(this.current, partial);
    } else {
      this.current = partial as Ship;
    }
  }

  updateFleet(data: FleetData) {
    this.fleet = data.ships;
    this.activeShipId = data.active_ship_id;
  }

  reset() {
    this.current = null;
    this.fleet = [];
    this.activeShipId = null;
  }
}

export const shipStore = new ShipStore();
