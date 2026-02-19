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

class MapSettingsStore {
  rockDensity = $state(DEFAULTS.rockDensity);
  showTravelAnim = $state(DEFAULTS.showTravelAnim);
  showPlayerWaves = $state(DEFAULTS.showPlayerWaves);
  showOrbitLines = $state(DEFAULTS.showOrbitLines);
  showGrid = $state(DEFAULTS.showGrid);

  constructor() {
    const d = load();
    this.rockDensity = d.rockDensity;
    this.showTravelAnim = d.showTravelAnim;
    this.showPlayerWaves = d.showPlayerWaves;
    this.showOrbitLines = d.showOrbitLines;
    this.showGrid = d.showGrid;
  }

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
