const STORAGE_KEY = 'sm_map_settings';

interface MapSettingsData {
  rockDensity: number;       // asteroid belt rock count (80–640)
  showTravelAnim: boolean;   // travel line + moving dots
  showPlayerWaves: boolean;  // wave ripples for online players
  showOrbitLines: boolean;   // dashed orbital circles
  showGrid: boolean;         // background grid lines
}

const DEFAULTS: MapSettingsData = {
  rockDensity: 320,
  showTravelAnim: true,
  showPlayerWaves: true,
  showOrbitLines: true,
  showGrid: true,
};

function load(): MapSettingsData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULTS };
}

function save(data: MapSettingsData) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

// Load once at module init — $state() gets the persisted value directly
const _init = load();

class MapSettingsStore {
  rockDensity = $state(_init.rockDensity);
  showTravelAnim = $state(_init.showTravelAnim);
  showPlayerWaves = $state(_init.showPlayerWaves);
  showOrbitLines = $state(_init.showOrbitLines);
  showGrid = $state(_init.showGrid);

  private persist() {
    save({
      rockDensity: this.rockDensity,
      showTravelAnim: this.showTravelAnim,
      showPlayerWaves: this.showPlayerWaves,
      showOrbitLines: this.showOrbitLines,
      showGrid: this.showGrid,
    });
  }

  setRockDensity(v: number) { this.rockDensity = v; this.persist(); }
  setShowTravelAnim(v: boolean) { this.showTravelAnim = v; this.persist(); }
  setShowPlayerWaves(v: boolean) { this.showPlayerWaves = v; this.persist(); }
  setShowOrbitLines(v: boolean) { this.showOrbitLines = v; this.persist(); }
  setShowGrid(v: boolean) { this.showGrid = v; this.persist(); }
}

export const mapSettingsStore = new MapSettingsStore();
