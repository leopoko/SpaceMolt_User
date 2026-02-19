<script lang="ts">
  import { systemMemoStore } from '$lib/stores/systemMemo.svelte';
  import { explorerStore } from '$lib/stores/explorer.svelte';
  import { playerStore } from '$lib/stores/player.svelte';
  import { mapSettingsStore } from '$lib/stores/mapSettings.svelte';
  import type { MemoPOI } from '$lib/stores/systemMemo.svelte';

  // ---- Map API types ----
  interface MapSystem {
    id: string;
    name: string;
    x: number;
    y: number;
    online: number;
    connections: string[];
  }

  // ---- State ----
  let mapData = $state<MapSystem[]>([]);
  let mapLoading = $state(false);
  let mapError = $state<string | null>(null);

  // Camera state – use plain variables for drag perf, copy to $state via rAF
  let camX = $state(0);
  let camY = $state(0);
  let viewW = $state(6000);
  let viewH = $state(6000);

  // Drag state (non-reactive for performance)
  let dragging = $state(false);
  let _dragStartX = 0;
  let _dragStartY = 0;
  let _dragCamStartX = 0;
  let _dragCamStartY = 0;
  let _pendingCamX = 0;
  let _pendingCamY = 0;
  let _rafId = 0;

  // Container ref
  let containerEl: HTMLDivElement | undefined = $state(undefined);
  let svgEl: SVGSVGElement | undefined = $state(undefined);

  // ---- Seeded random ----
  function seedAngle(seed: string): number {
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
      h = ((h << 5) - h) + seed.charCodeAt(i);
      h |= 0;
    }
    const v = Math.sin(h * 127.1) * 43758.5453;
    return (v - Math.floor(v)) * Math.PI * 2;
  }

  // Deterministic pseudo-random (0–1) for asteroid rocks
  function hash(a: number, b: number): number {
    const h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return h - Math.floor(h);
  }

  // ---- Visited systems with map positions ----
  let mapLookup = $derived.by(() => {
    const lookup = new Map<string, MapSystem>();
    for (const sys of mapData) {
      lookup.set(sys.id, sys);
    }
    return lookup;
  });

  let visitedSystems = $derived.by(() => {
    const memos = systemMemoStore.allMemos;
    const result: { memo: typeof memos[0]; map: MapSystem }[] = [];
    for (const memo of memos) {
      const ms = mapLookup.get(memo.systemId);
      if (ms) {
        result.push({ memo, map: ms });
      }
    }
    return result;
  });

  let totalSystemCount = $derived(mapData.length);
  let visitedCount = $derived(visitedSystems.length);

  // ---- Home base system ----
  let homeSystem = $derived.by(() => {
    const id = explorerStore.homeBaseSystemId;
    if (!id) return null;
    return visitedSystems.find(s => s.map.id === id) ?? null;
  });

  // ---- Connections: show if at least ONE side is visited ----
  let connections = $derived.by(() => {
    const visitedIds = new Set(visitedSystems.map(s => s.map.id));
    const lines: { x1: number; y1: number; x2: number; y2: number; bothKnown: boolean }[] = [];
    const seen = new Set<string>();
    for (const sys of visitedSystems) {
      for (const connId of sys.map.connections) {
        const key = [sys.map.id, connId].sort().join('-');
        if (seen.has(key)) continue;
        seen.add(key);
        const other = mapLookup.get(connId);
        if (!other) continue;
        const bothKnown = visitedIds.has(connId);
        lines.push({ x1: sys.map.x, y1: sys.map.y, x2: other.x, y2: other.y, bothKnown });
      }
    }
    return lines;
  });

  // ---- POI scale ----
  let poiScale = $derived.by(() => {
    if (visitedSystems.length < 2) return 40;
    let minDist = Infinity;
    for (let i = 0; i < visitedSystems.length; i++) {
      for (let j = i + 1; j < visitedSystems.length; j++) {
        const a = visitedSystems[i].map;
        const b = visitedSystems[j].map;
        const d = Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
        if (d > 0 && d < minDist) minDist = d;
      }
    }
    let maxExtent = 1;
    for (const sys of visitedSystems) {
      for (const poi of sys.memo.pois) {
        if (poi.position) {
          const ext = Math.sqrt(poi.position.x ** 2 + poi.position.y ** 2);
          if (ext > maxExtent) maxExtent = ext;
        }
      }
    }
    return Math.min(minDist * 0.2 / maxExtent, 80);
  });

  // ---- Rotate POI position for non-home systems ----
  function rotatePoi(
    poi: MemoPOI,
    systemId: string,
    isHome: boolean,
    scale: number,
    sysX: number,
    sysY: number
  ): { x: number; y: number } {
    if (!poi.position) return { x: sysX, y: sysY };
    let px = poi.position.x * scale;
    let py = poi.position.y * scale;
    if (!isHome) {
      const angle = seedAngle(systemId);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const rx = px * cos - py * sin;
      const ry = px * sin + py * cos;
      px = rx;
      py = ry;
    }
    return { x: sysX + px, y: sysY + py };
  }

  // ---- POI rendering data ----
  const poiColors: Record<string, string> = {
    sun: '#ffd740',
    station: '#4fc3f7',
    asteroid_belt: '#ff9800',
    asteroid: '#ff9800',
    nebula: '#ce93d8',
    gas_cloud: '#80cbc4',
    ice_field: '#b3e5fc',
    gate: '#69f0ae',
    planet: '#66bb6a',
    wreck: '#78909c',
    anomaly: '#ff5252',
  };

  // ---- Tunable size multipliers ----
  const sunSize = 0.25;
  const planetSize = 0.07;
  const stationSize = 0.03;
  const nebulaSize = 0.23;
  const gasCloudSize = 0.40;
  const iceFieldSize = 0.25;
  const asteroidSize = 0.12;
  const defaultSize = 0.07;

  function dotRadius(type: string, s: number): number {
    switch (type) {
      case 'sun': return s * sunSize;
      case 'planet': return s * planetSize;
      case 'station': return s * stationSize;
      case 'nebula': return s * nebulaSize;
      case 'gas_cloud': return s * gasCloudSize;
      case 'ice_field': return s * iceFieldSize;
      default: return s * defaultSize;
    }
  }

  // ---- LOD: asteroid belt detail level based on zoom ----
  let asteroidLod = $derived.by((): 'none' | 'low' | 'medium' | 'full' => {
    if (viewW > 8000) return 'none';
    if (viewW > 4000) return 'low';
    if (viewW > 2000) return 'medium';
    return 'full';
  });

  // Density reduced to 1/5
  function lodRockCount(): number {
    const base = Math.floor(mapSettingsStore.rockDensity / 5);
    switch (asteroidLod) {
      case 'none': return 0;
      case 'low': return Math.max(4, Math.floor(base * 0.1));
      case 'medium': return Math.max(8, Math.floor(base * 0.3));
      case 'full': return base;
    }
  }

  // ---- Compute belt rocks for a system's asteroid POI ----
  function computeBeltRocks(
    poi: MemoPOI,
    sysX: number,
    sysY: number,
    systemId: string,
    isHome: boolean,
    scale: number,
    rockCount: number,
    baseR: number,
    vx: number, vy: number, vw: number, vh: number
  ): { x: number; y: number; r: number; opacity: number }[] {
    if (rockCount === 0 || !poi.position) return [];
    const orbitR = Math.sqrt(poi.position.x ** 2 + poi.position.y ** 2) * scale;
    if (orbitR < 0.01) return [];

    const angle = isHome ? 0 : seedAngle(systemId);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    // Large margin to prevent popping at edges (30% of viewport)
    const margin = Math.max(vw, vh) * 0.3;
    const rocks: { x: number; y: number; r: number; opacity: number }[] = [];

    for (let i = 0; i < rockCount; i++) {
      const a = (i / rockCount) * Math.PI * 2;
      const radialVar = hash(i, orbitR) * 0.06 - 0.03;
      const r = orbitR * (1 + radialVar);
      const aJitter = (hash(i * 3.1, orbitR * 7.3) - 0.5) * (Math.PI * 2 / rockCount) * 0.6;
      let rx = r * Math.cos(a + aJitter);
      let ry = r * Math.sin(a + aJitter);

      if (!isHome) {
        const rxx = rx * cos - ry * sin;
        const ryy = rx * sin + ry * cos;
        rx = rxx;
        ry = ryy;
      }

      const wx = sysX + rx;
      const wy = sysY + ry;

      // Viewport culling with generous margin
      if (wx < vx - margin || wx > vx + vw + margin ||
          wy < vy - margin || wy > vy + vh + margin) continue;

      const sizeFactor = 0.4 + hash(i * 43.3, orbitR * 17.1) * 0.6;
      // Subdued opacity: 0.15–0.35 range
      const opacity = 0.15 + hash(i * 73.7, orbitR * 53.3) * 0.2;
      rocks.push({ x: wx, y: wy, r: baseR * sizeFactor, opacity });
    }
    return rocks;
  }

  // ---- Computed SVG viewBox ----
  let viewBox = $derived(`${camX - viewW / 2} ${camY - viewH / 2} ${viewW} ${viewH}`);

  // ---- Actual visible SVG extent (accounts for widescreen / non-square containers) ----
  // With preserveAspectRatio="xMidYMid meet" and a square viewBox,
  // the visible area extends beyond the viewBox on the wider axis.
  let visibleSvgW = $derived.by(() => {
    if (!containerEl) return viewW;
    const rect = containerEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return viewW;
    const s = Math.min(rect.width / viewW, rect.height / viewH);
    return rect.width / s;
  });
  let visibleSvgH = $derived.by(() => {
    if (!containerEl) return viewH;
    const rect = containerEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return viewH;
    const s = Math.min(rect.width / viewW, rect.height / viewH);
    return rect.height / s;
  });

  // ---- Scale for POI rendering within the map ----
  // Fixed in world-space so POI sizes don't change with zoom.
  let poiVisualScale = $derived(poiScale * 1.0);
  // Separate zoom-dependent scale for system labels (so they stay readable at all zoom levels)
  let labelScale = $derived(viewW * 0.015);

  // ---- Fetch map data ----
  async function fetchMapData() {
    mapLoading = true;
    mapError = null;
    try {
      const res = await fetch('https://game.spacemolt.com/api/map');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      mapData = json.systems ?? json;
    } catch (e) {
      mapError = e instanceof Error ? e.message : 'Failed to load map';
    } finally {
      mapLoading = false;
    }
  }

  // ---- Center on home base ----
  function centerOnHome() {
    if (homeSystem) {
      camX = homeSystem.map.x;
      camY = homeSystem.map.y;
    }
  }

  // ---- Smooth drag with requestAnimationFrame ----
  function applyDragFrame() {
    camX = _pendingCamX;
    camY = _pendingCamY;
    _rafId = 0;
  }

  function onMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    dragging = true;
    _dragStartX = e.clientX;
    _dragStartY = e.clientY;
    _dragCamStartX = camX;
    _dragCamStartY = camY;
    e.preventDefault();
  }

  // SVG uses preserveAspectRatio="xMidYMid meet" – uniform scale based on the tighter axis.
  // Compute the actual pixel-to-SVG-unit ratio so drag is consistent in both directions.
  function svgScale(): number {
    if (!containerEl) return 1;
    const rect = containerEl.getBoundingClientRect();
    return Math.min(rect.width / viewW, rect.height / viewH);
  }

  function onMouseMove(e: MouseEvent) {
    if (!dragging || !containerEl) return;
    const s = svgScale();
    const dx = (e.clientX - _dragStartX) / s;
    const dy = (e.clientY - _dragStartY) / s;
    _pendingCamX = _dragCamStartX - dx;
    _pendingCamY = _dragCamStartY - dy;
    if (!_rafId) {
      _rafId = requestAnimationFrame(applyDragFrame);
    }
  }

  function onMouseUp() {
    if (dragging) {
      // Apply any pending frame immediately
      if (_rafId) {
        cancelAnimationFrame(_rafId);
        _rafId = 0;
      }
      camX = _pendingCamX;
      camY = _pendingCamY;
    }
    dragging = false;
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    if (!containerEl) return;

    const rect = containerEl.getBoundingClientRect();
    const s = svgScale();
    const mx = camX + (e.clientX - rect.left - rect.width / 2) / s;
    const my = camY + (e.clientY - rect.top - rect.height / 2) / s;

    const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
    // Extended zoom range: min 50, max 80000
    const newW = Math.max(5, Math.min(80000, viewW * factor));
    const newH = Math.max(5, Math.min(80000, viewH * factor));

    const scale = newW / viewW;
    camX = mx + (camX - mx) * scale;
    camY = my + (camY - my) * scale;

    viewW = newW;
    viewH = newH;
  }

  // Touch support
  let touchStartDist = 0;
  let touchStartViewW = 0;
  let touchStartViewH = 0;

  function onTouchStart(e: TouchEvent) {
    if (e.touches.length === 1) {
      dragging = true;
      _dragStartX = e.touches[0].clientX;
      _dragStartY = e.touches[0].clientY;
      _dragCamStartX = camX;
      _dragCamStartY = camY;
    } else if (e.touches.length === 2) {
      dragging = false;
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      touchStartDist = Math.sqrt(dx * dx + dy * dy);
      touchStartViewW = viewW;
      touchStartViewH = viewH;
    }
    e.preventDefault();
  }

  function onTouchMove(e: TouchEvent) {
    if (e.touches.length === 1 && dragging && containerEl) {
      const s = svgScale();
      const dx = (e.touches[0].clientX - _dragStartX) / s;
      const dy = (e.touches[0].clientY - _dragStartY) / s;
      _pendingCamX = _dragCamStartX - dx;
      _pendingCamY = _dragCamStartY - dy;
      if (!_rafId) {
        _rafId = requestAnimationFrame(applyDragFrame);
      }
    } else if (e.touches.length === 2) {
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const scale = touchStartDist / dist;
      viewW = Math.max(5, Math.min(80000, touchStartViewW * scale));
      viewH = Math.max(5, Math.min(80000, touchStartViewH * scale));
    }
    e.preventDefault();
  }

  function onTouchEnd() {
    if (dragging && _rafId) {
      cancelAnimationFrame(_rafId);
      _rafId = 0;
      camX = _pendingCamX;
      camY = _pendingCamY;
    }
    dragging = false;
  }

  // ---- Init: fetch data + center ----
  $effect(() => {
    fetchMapData().then(() => {
      centerOnHome();
    });
  });

  // ---- Current system highlight ----
  let currentSystemId = $derived(playerStore.system_id);

  // ---- Security color ----
  function secColor(level: string): string {
    switch (level) {
      case 'high': return '#4caf50';
      case 'medium': return '#ff9800';
      case 'low': return '#f44336';
      default: return '#78909c';
    }
  }

  // ---- Orbit computation ----
  function computeOrbits(
    pois: MemoPOI[],
    scale: number
  ): number[] {
    const radii = new Map<string, number>();
    for (const p of pois) {
      if (!p.position) continue;
      const r = Math.sqrt(p.position.x ** 2 + p.position.y ** 2) * scale;
      if (r > 0.01) {
        const key = r.toFixed(2);
        if (!radii.has(key)) radii.set(key, r);
      }
    }
    return [...radii.values()];
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="explorer-container"
  bind:this={containerEl}
  class:dragging
  onmousedown={onMouseDown}
  onmousemove={onMouseMove}
  onmouseup={onMouseUp}
  onmouseleave={onMouseUp}
  onwheel={onWheel}
  ontouchstart={onTouchStart}
  ontouchmove={onTouchMove}
  ontouchend={onTouchEnd}
>
  <!-- Header overlay -->
  <div class="explorer-header">
    <span class="explorer-title">
      <span class="material-icons" style="font-size:16px">travel_explore</span>
      Galaxy Explorer
    </span>
    <span class="explorer-stats">
      {visitedCount} / {totalSystemCount} Systems
    </span>
    <button class="home-btn" onclick={centerOnHome} title="Center on Home Base">
      <span class="material-icons" style="font-size:14px">home</span>
    </button>
    <button class="home-btn" onclick={fetchMapData} title="Refresh Map Data">
      <span class="material-icons" style="font-size:14px">refresh</span>
    </button>
  </div>

  <!-- Zoom info -->
  <div class="zoom-info">
    LOD: {asteroidLod}
  </div>

  {#if mapLoading}
    <div class="loading-overlay">Loading map data...</div>
  {:else if mapError}
    <div class="error-overlay">
      <span class="material-icons">error</span>
      {mapError}
      <button onclick={fetchMapData}>Retry</button>
    </div>
  {:else}
    <svg
      bind:this={svgEl}
      viewBox={viewBox}
      xmlns="http://www.w3.org/2000/svg"
      class="explorer-svg"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <filter id="ex-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={poiVisualScale * 1.2} result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="ex-sun-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation={poiVisualScale * 2.5} result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="ex-nebula-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation={poiVisualScale * 2} />
        </filter>
        <radialGradient id="ex-planet-grad" cx="35%" cy="35%">
          <stop offset="0%" stop-color="#a5d6a7" />
          <stop offset="100%" stop-color="#2e7d32" />
        </radialGradient>
        <radialGradient id="ex-ice-grad" cx="40%" cy="35%">
          <stop offset="0%" stop-color="#e1f5fe" />
          <stop offset="100%" stop-color="#4fc3f7" />
        </radialGradient>
      </defs>

      <!-- Connection lines (dotted) – shown if at least one side is visited -->
      {#each connections as conn}
        <line
          x1={conn.x1} y1={conn.y1}
          x2={conn.x2} y2={conn.y2}
          stroke={conn.bothKnown ? 'rgba(79,195,247,0.25)' : 'rgba(79,195,247,0.10)'}
          stroke-width={viewW * 0.0015}
          stroke-dasharray="{viewW * 0.006} {viewW * 0.004}"
        />
      {/each}

      <!-- Systems -->
      {#each visitedSystems as sys (sys.map.id)}
        {@const isHome = sys.map.id === explorerStore.homeBaseSystemId}
        {@const isCurrent = sys.map.id === currentSystemId}
        {@const sysX = sys.map.x}
        {@const sysY = sys.map.y}
        {@const sc = poiVisualScale}
        {@const sw = sc * 0.6}
        {@const ls = labelScale}
        {@const zs = viewW * 0.001}
        {@const mappedPois = sys.memo.pois.filter(p => p.position)}
        {@const orbits = computeOrbits(mappedPois, poiScale)}

        <!-- System background glow for current (reduced 1/10) -->
        {#if isCurrent}
          <circle cx={sysX} cy={sysY} r={sc * 4} fill="rgba(76,175,80,0.03)" />
        {/if}

        <!-- Orbit lines -->
        {#if mapSettingsStore.showOrbitLines}
          {#each orbits as r}
            <circle
              cx={sysX} cy={sysY} r={r}
              fill="none"
              stroke="rgba(79,195,247,0.08)"
              stroke-width={zs * 1.5}
              stroke-dasharray="{zs * 4} {zs * 3}"
            />
          {/each}
        {/if}

        <!-- POI elements -->
        {#each mappedPois as poi (poi.id)}
          {@const pos = rotatePoi(poi, sys.map.id, isHome, poiScale, sysX, sysY)}
          {@const color = poiColors[poi.type] ?? '#b0bec5'}
          {@const dr = dotRadius(poi.type, sc)}

          {#if poi.type === 'sun'}
            <circle cx={pos.x} cy={pos.y} r={dr * 1.8} fill="#ffeb3b" opacity="0.12" filter="url(#ex-sun-glow)" />
            <circle cx={pos.x} cy={pos.y} r={dr * 1.3} fill="#ffe082" opacity="0.25" filter="url(#ex-sun-glow)" />
            <circle cx={pos.x} cy={pos.y} r={dr} fill="#ffeb3b" opacity="0.95" filter="url(#ex-sun-glow)">
              <animate attributeName="opacity" values="0.95;0.8;0.95" dur="4s" repeatCount="indefinite" />
            </circle>
            <circle cx={pos.x} cy={pos.y} r={dr * 0.55} fill="#fffde7" opacity="0.85" />

          {:else if poi.type === 'station'}
            <polygon
              points="{pos.x},{pos.y - dr} {pos.x + dr},{pos.y} {pos.x},{pos.y + dr} {pos.x - dr},{pos.y}"
              fill="#4fc3f7" opacity="0.9"
              stroke="#b3e5fc" stroke-width={sw * 0.3}
            />
            {@const ir = dr * 0.4}
            <polygon
              points="{pos.x},{pos.y - ir} {pos.x + ir},{pos.y} {pos.x},{pos.y + ir} {pos.x - ir},{pos.y}"
              fill="none" stroke="#e1f5fe" stroke-width={sw * 0.2}
              opacity="0.6"
            />

          {:else if poi.type === 'planet'}
            <circle cx={pos.x} cy={pos.y} r={dr * 1.12} fill="none"
              stroke="rgba(102,187,106,0.2)" stroke-width={sw * 0.5} />
            <circle cx={pos.x} cy={pos.y} r={dr}
              fill="url(#ex-planet-grad)" opacity="0.9"
              stroke="rgba(255,255,255,0.15)" stroke-width={sw * 0.2} />
            <ellipse cx={pos.x - dr * 0.2} cy={pos.y - dr * 0.15} rx={dr * 0.5} ry={dr * 0.7}
              fill="rgba(255,255,255,0.1)" />

          {:else if poi.type === 'nebula'}
            <circle cx={pos.x + dr * 0.2} cy={pos.y - dr * 0.15} r={dr * 0.8}
              fill="#ce93d8" opacity="0.15" filter="url(#ex-nebula-glow)" />
            <circle cx={pos.x - dr * 0.2} cy={pos.y + dr * 0.1} r={dr * 0.9}
              fill="#ab47bc" opacity="0.15" filter="url(#ex-nebula-glow)" />
            <circle cx={pos.x} cy={pos.y} r={dr * 0.6} fill="#ce93d8" opacity="0.7" />

          {:else if poi.type === 'gas_cloud'}
            <ellipse cx={pos.x - dr * 0.15} cy={pos.y} rx={dr * 1.1} ry={dr * 0.7}
              fill="#80cbc4" opacity="0.12" filter="url(#ex-nebula-glow)" />
            <ellipse cx={pos.x + dr * 0.1} cy={pos.y + dr * 0.05} rx={dr * 0.8} ry={dr * 0.55}
              fill="#4db6ac" opacity="0.2" />
            <ellipse cx={pos.x} cy={pos.y} rx={dr * 0.5} ry={dr * 0.35}
              fill="#b2dfdb" opacity="0.6" />

          {:else if poi.type === 'ice_field'}
            <circle cx={pos.x} cy={pos.y} r={dr * 0.9}
              fill="url(#ex-ice-grad)" opacity="0.8"
              stroke="#b3e5fc" stroke-width={sw * 0.2} />
            {@const cr = dr * 0.5}
            <line x1={pos.x - cr} y1={pos.y - cr * 0.3} x2={pos.x + cr} y2={pos.y + cr * 0.3}
              stroke="#e1f5fe" stroke-width={sw * 0.2} opacity="0.5" />

          {:else if (poi.type === 'asteroid_belt' || poi.type === 'asteroid') && asteroidLod !== 'none'}
            {@const rockCount = lodRockCount()}
            {@const rocks = computeBeltRocks(
              poi, sysX, sysY, sys.map.id, isHome, poiScale,
              rockCount, sc * asteroidSize,
              camX - visibleSvgW / 2, camY - visibleSvgH / 2, visibleSvgW, visibleSvgH
            )}
            {#each rocks as rock}
              <circle cx={rock.x} cy={rock.y} r={rock.r}
                fill="#b07840" opacity={rock.opacity} />
            {/each}

          {:else if poi.type !== 'asteroid_belt' && poi.type !== 'asteroid'}
            <circle cx={pos.x} cy={pos.y} r={dr}
              fill={color} opacity="0.85"
              stroke="rgba(255,255,255,0.15)" stroke-width={sw * 0.3} />
          {/if}

          <!-- POI label: only when very zoomed in (viewW < 500) -->
          {#if viewW < 500}
            <text
              x={pos.x}
              y={pos.y + dotRadius(poi.type, sc) + ls * 0.6}
              text-anchor="middle"
              dominant-baseline="hanging"
              fill="#78909c"
              font-size={ls * 1.2}
              font-family="'Roboto', sans-serif"
              style="pointer-events:none"
            >{poi.name}</text>
          {/if}
        {/each}

        <!-- System name label (zoom-dependent for readability) -->
        <text
          x={sysX}
          y={sysY - ls * 3.5}
          text-anchor="middle"
          dominant-baseline="auto"
          fill={isCurrent ? '#4caf50' : isHome ? '#ffd740' : secColor(sys.memo.securityLevel)}
          font-size={ls * 1.8}
          font-weight={isCurrent || isHome ? '700' : '400'}
          font-family="'Roboto', sans-serif"
          style="pointer-events:none"
        >{sys.memo.systemName}</text>

        <!-- Home icon -->
        {#if isHome}
          <text
            x={sysX}
            y={sysY - ls * 5.5}
            text-anchor="middle"
            dominant-baseline="auto"
            fill="#ffd740"
            font-size={ls * 1.5}
            font-family="'Material Icons'"
            style="pointer-events:none"
          >home</text>
        {/if}

        <!-- Current system indicator ring (reduced 1/10) -->
        {#if isCurrent}
          <circle
            cx={sysX} cy={sysY}
            r={ls * 2.5}
            fill="none"
            stroke="#4caf50"
            stroke-width={ls * 0.15}
            stroke-dasharray="{ls * 0.5} {ls * 0.3}"
            opacity="0.5"
          >
            <animate attributeName="stroke-opacity" values="0.5;0.15;0.5" dur="3s" repeatCount="indefinite" />
          </circle>
        {/if}

        <!-- Online count -->
        {#if sys.map.online > 0}
          <text
            x={sysX + ls * 3}
            y={sysY - ls * 3}
            text-anchor="start"
            fill="#4fc3f7"
            font-size={ls * 1.2}
            font-family="'Roboto Mono', monospace"
            opacity="0.8"
            style="pointer-events:none"
          >{sys.map.online}</text>
        {/if}
      {/each}
    </svg>
  {/if}
</div>

<style>
  .explorer-container {
    width: 100%;
    height: 100%;
    min-height: 300px;
    background: radial-gradient(ellipse at center, rgba(13,21,37,0.95) 0%, rgba(6,10,16,1) 100%);
    border: 1px solid rgba(79,195,247,0.12);
    border-radius: 6px;
    overflow: hidden;
    position: relative;
    cursor: grab;
    user-select: none;
    touch-action: none;
  }

  .explorer-container.dragging {
    cursor: grabbing;
  }

  .explorer-svg {
    width: 100%;
    height: 100%;
    display: block;
  }

  .explorer-header {
    position: absolute;
    top: 8px;
    left: 8px;
    display: flex;
    align-items: center;
    gap: 10px;
    z-index: 10;
    pointer-events: none;
  }

  .explorer-header > * {
    pointer-events: auto;
  }

  .explorer-title {
    display: flex;
    align-items: center;
    gap: 5px;
    color: #4fc3f7;
    font-size: 0.8rem;
    font-weight: 600;
    font-family: 'Roboto Mono', monospace;
    text-shadow: 0 0 8px rgba(79,195,247,0.4);
  }

  .explorer-stats {
    color: #78909c;
    font-size: 0.72rem;
    font-family: 'Roboto Mono', monospace;
    background: rgba(6,10,16,0.8);
    padding: 2px 8px;
    border-radius: 3px;
    border: 1px solid rgba(79,195,247,0.15);
  }

  .home-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: rgba(6,10,16,0.8);
    border: 1px solid rgba(79,195,247,0.25);
    border-radius: 4px;
    color: #4fc3f7;
    cursor: pointer;
    transition: all 0.15s;
  }

  .home-btn:hover {
    background: rgba(79,195,247,0.15);
    border-color: rgba(79,195,247,0.5);
  }

  .zoom-info {
    position: absolute;
    bottom: 8px;
    right: 8px;
    color: #546e7a;
    font-size: 0.65rem;
    font-family: 'Roboto Mono', monospace;
    background: rgba(6,10,16,0.7);
    padding: 2px 6px;
    border-radius: 3px;
    z-index: 10;
  }

  .loading-overlay,
  .error-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: #78909c;
    font-size: 0.85rem;
    font-family: 'Roboto Mono', monospace;
    text-align: center;
    z-index: 10;
  }

  .error-overlay {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    color: #f44336;
  }

  .error-overlay button {
    background: rgba(79,195,247,0.1);
    border: 1px solid rgba(79,195,247,0.3);
    color: #4fc3f7;
    padding: 4px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.75rem;
  }

  .error-overlay button:hover {
    background: rgba(79,195,247,0.2);
  }
</style>
