<script lang="ts">
  import type { POI } from '$lib/types/game';
  import { playerStore } from '$lib/stores/player.svelte';
  import { systemStore } from '$lib/stores/system.svelte';

  let { pois = [] }: { pois: POI[] } = $props();

  const PADDING = 0.15;

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

  // Filter to POIs that have position data
  let mappedPois = $derived(pois.filter(p => p.position));

  // Compute bounding box around all POIs, then build viewBox to fit them all
  let mapMetrics = $derived.by(() => {
    if (mappedPois.length === 0) return { vx: -5, vy: -5, vw: 10, vh: 10, scale: 5, cx: 0, cy: 0 };

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of mappedPois) {
      const { x, y } = p.position!;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const spanX = Math.max(maxX - minX, 0.5);
    const spanY = Math.max(maxY - minY, 0.5);
    const padX = spanX * PADDING;
    const padY = spanY * PADDING;
    const halfX = spanX / 2 + padX;
    const halfY = spanY / 2 + padY;

    return {
      vx: cx - halfX,
      vy: cy - halfY,
      vw: halfX * 2,
      vh: halfY * 2,
      scale: Math.max(halfX, halfY),
      cx,
      cy,
    };
  });

  let viewBox = $derived(`${mapMetrics.vx} ${mapMetrics.vy} ${mapMetrics.vw} ${mapMetrics.vh}`);

  // Compute unique orbital radii (distance from 0,0) for orbit circles
  let orbits = $derived.by(() => {
    const radii = new Map<string, number>();
    for (const p of mappedPois) {
      const r = Math.sqrt(p.position!.x ** 2 + p.position!.y ** 2);
      if (r > 0.01) {
        const key = r.toFixed(4);
        if (!radii.has(key)) radii.set(key, r);
      }
    }
    return [...radii.values()];
  });

  // Travel line: from current POI to destination POI
  let travelLine = $derived.by(() => {
    const t = systemStore.travel;
    if (!t.in_progress || t.type === 'jump') return null;

    const fromPoi = mappedPois.find(p => p.id === playerStore.poi_id);
    const toPoi = mappedPois.find(p => p.id === t.destination_id);
    if (!fromPoi?.position || !toPoi?.position) return null;

    return {
      x1: fromPoi.position.x,
      y1: fromPoi.position.y,
      x2: toPoi.position.x,
      y2: toPoi.position.y,
    };
  });

  // Wave animation duration based on online count: more players = faster
  function waveDuration(online: number): number {
    if (online <= 0) return 0;
    return Math.max(0.4, 3 - (online / 40));
  }

  function getOnline(poi: POI): number {
    return poi.player_count ?? poi.online ?? 0;
  }

  // Dot radius per type (2x the old sizes)
  function dotRadius(type: string, s: number): number {
    switch (type) {
      case 'sun': return s * 0.07;
      case 'planet': return s * 0.045;
      case 'station': return s * 0.036;
      case 'nebula': return s * 0.055;
      case 'gas_cloud': return s * 0.05;
      case 'ice_field': return s * 0.045;
      default: return s * 0.036;
    }
  }

  // Scale for stroke widths relative to coordinate system
  let sw = $derived(mapMetrics.scale * 0.008);
  let s = $derived(mapMetrics.scale);

  // Deterministic pseudo-random helper (returns 0–1)
  function hash(a: number, b: number): number {
    const h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return h - Math.floor(h);
  }

  // Pre-compute scattered rocks for asteroid belts along their orbital path.
  // Only generates rocks within the visible viewport.
  let beltRocks = $derived.by(() => {
    const result = new Map<string, { x: number; y: number; r: number; opacity: number }[]>();
    const { vx, vy, vw, vh } = mapMetrics;
    const margin = s * 0.04;

    for (const poi of mappedPois) {
      if (poi.type !== 'asteroid_belt' && poi.type !== 'asteroid') continue;
      const px = poi.position!.x;
      const py = poi.position!.y;
      const orbitR = Math.sqrt(px * px + py * py);
      if (orbitR < 0.01) { result.set(poi.id, []); continue; }

      const rockCount = 80;
      const rocks: { x: number; y: number; r: number; opacity: number }[] = [];
      const baseR = s * 0.007;

      for (let i = 0; i < rockCount; i++) {
        const angle = (i / rockCount) * Math.PI * 2;
        const radialVar = hash(i, orbitR) * 0.06 - 0.03; // ±3% radial jitter
        const r = orbitR * (1 + radialVar);
        // Slight angular jitter so rocks aren't perfectly evenly spaced
        const aJitter = (hash(i * 3.1, orbitR * 7.3) - 0.5) * (Math.PI * 2 / rockCount) * 0.6;
        const rx = r * Math.cos(angle + aJitter);
        const ry = r * Math.sin(angle + aJitter);

        // Viewport culling
        if (rx < vx - margin || rx > vx + vw + margin ||
            ry < vy - margin || ry > vy + vh + margin) continue;

        const sizeFactor = 0.4 + hash(i * 43.3, orbitR * 17.1) * 0.6;
        const opacity = 0.4 + hash(i * 73.7, orbitR * 53.3) * 0.5;

        rocks.push({ x: rx, y: ry, r: baseR * sizeFactor, opacity });
      }

      result.set(poi.id, rocks);
    }

    return result;
  });
</script>

<div class="system-map-container">
  <svg {viewBox} xmlns="http://www.w3.org/2000/svg" class="system-map-svg">
    <defs>
      <filter id="glow-current" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation={s * 0.015} result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="wave-glow" x="-200%" y="-200%" width="500%" height="500%">
        <feGaussianBlur stdDeviation={s * 0.012} />
      </filter>
      <!-- Sun corona glow -->
      <filter id="sun-glow" x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur stdDeviation={s * 0.03} result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <!-- Nebula soft glow -->
      <filter id="nebula-glow" x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur stdDeviation={s * 0.025} />
      </filter>
      <!-- Radial gradient for planet -->
      <radialGradient id="planet-grad" cx="35%" cy="35%">
        <stop offset="0%" stop-color="#a5d6a7" />
        <stop offset="100%" stop-color="#2e7d32" />
      </radialGradient>
      <!-- Ice field gradient -->
      <radialGradient id="ice-grad" cx="40%" cy="35%">
        <stop offset="0%" stop-color="#e1f5fe" />
        <stop offset="100%" stop-color="#4fc3f7" />
      </radialGradient>
    </defs>

    <!-- Grid lines (subtle) -->
    {#each Array.from({length: 11}, (_, i) => (i - 5) * s * 0.4) as off}
      <line
        x1={mapMetrics.cx + off} y1={mapMetrics.vy} x2={mapMetrics.cx + off} y2={mapMetrics.vy + mapMetrics.vh}
        stroke="rgba(79,195,247,0.04)" stroke-width={sw * 0.3}
      />
      <line
        x1={mapMetrics.vx} y1={mapMetrics.cy + off} x2={mapMetrics.vx + mapMetrics.vw} y2={mapMetrics.cy + off}
        stroke="rgba(79,195,247,0.04)" stroke-width={sw * 0.3}
      />
    {/each}

    <!-- Orbital circles (dashed, centered at 0,0) -->
    {#each orbits as r}
      <circle
        cx={0} cy={0} r={r}
        fill="none"
        stroke="rgba(79,195,247,0.12)"
        stroke-width={sw * 0.5}
        stroke-dasharray="{s * 0.02} {s * 0.015}"
      />
    {/each}

    <!-- Travel line animation -->
    {#if travelLine}
      <line
        x1={travelLine.x1} y1={travelLine.y1}
        x2={travelLine.x2} y2={travelLine.y2}
        stroke="rgba(255,183,77,0.3)"
        stroke-width={sw * 0.8}
        stroke-dasharray="{s * 0.02} {s * 0.012}"
      />
      <circle r={s * 0.015} fill="#ffb74d" opacity="0.9">
        <animateMotion
          dur="2s"
          repeatCount="indefinite"
          path="M{travelLine.x1},{travelLine.y1} L{travelLine.x2},{travelLine.y2}"
        />
      </circle>
      <circle r={s * 0.01} fill="#ffb74d" opacity="0.5">
        <animateMotion
          dur="2s"
          begin="-1s"
          repeatCount="indefinite"
          path="M{travelLine.x1},{travelLine.y1} L{travelLine.x2},{travelLine.y2}"
        />
      </circle>
    {/if}

    <!-- POI dots and waves -->
    {#each mappedPois as poi (poi.id)}
      {@const x = poi.position!.x}
      {@const y = poi.position!.y}
      {@const online = getOnline(poi)}
      {@const isHere = playerStore.poi_id === poi.id}
      {@const color = poiColors[poi.type] ?? '#b0bec5'}
      {@const dotR = dotRadius(poi.type, s)}

      <!-- Wave ripples for POIs with players -->
      {#if online > 0}
        {#each [0, 1, 2] as waveIdx}
          <circle
            cx={x} cy={y}
            r={dotR}
            fill="none"
            stroke={color}
            stroke-width={sw * 0.5}
            opacity="0"
            filter="url(#wave-glow)"
          >
            <animate
              attributeName="r"
              from={dotR}
              to={dotR + s * 0.18}
              dur="{waveDuration(online)}s"
              begin="{waveIdx * waveDuration(online) / 3}s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              from="0.7"
              to="0"
              dur="{waveDuration(online)}s"
              begin="{waveIdx * waveDuration(online) / 3}s"
              repeatCount="indefinite"
            />
          </circle>
        {/each}
      {/if}

      <!-- Current player highlight ring (0.8x size) -->
      {#if isHere}
        <circle
          cx={x} cy={y}
          r={dotR + s * 0.012}
          fill="none"
          stroke="#4caf50"
          stroke-width={sw * 0.96}
          filter="url(#glow-current)"
        >
          <animate
            attributeName="stroke-opacity"
            values="1;0.4;1"
            dur="2s"
            repeatCount="indefinite"
          />
        </circle>
      {/if}

      <!-- POI visuals by type -->
      {#if poi.type === 'sun'}
        <!-- Sun: glowing corona + bright core -->
        <circle cx={x} cy={y} r={dotR * 1.4} fill="#ffd740" opacity="0.15" filter="url(#sun-glow)" />
        <circle cx={x} cy={y} r={dotR} fill="#ffd740" opacity="0.9" filter="url(#sun-glow)">
          <animate attributeName="opacity" values="0.9;0.7;0.9" dur="4s" repeatCount="indefinite" />
        </circle>
        <circle cx={x} cy={y} r={dotR * 0.55} fill="#fff8e1" opacity="0.7" />

      {:else if poi.type === 'station'}
        <!-- Station: diamond shape -->
        <polygon
          points="{x},{y - dotR} {x + dotR},{y} {x},{y + dotR} {x - dotR},{y}"
          fill={isHere ? '#4caf50' : '#4fc3f7'}
          opacity="0.9"
          stroke={isHere ? '#81c784' : '#b3e5fc'}
          stroke-width={sw * 0.4}
        />
        <!-- Small inner diamond -->
        {@const ir = dotR * 0.4}
        <polygon
          points="{x},{y - ir} {x + ir},{y} {x},{y + ir} {x - ir},{y}"
          fill="none"
          stroke={isHere ? '#c8e6c9' : '#e1f5fe'}
          stroke-width={sw * 0.25}
          opacity="0.6"
        />

      {:else if poi.type === 'planet'}
        <!-- Planet: sphere with gradient + atmosphere ring -->
        <circle cx={x} cy={y} r={dotR * 1.12} fill="none"
          stroke="rgba(102,187,106,0.2)" stroke-width={sw * 0.6} />
        <circle cx={x} cy={y} r={dotR}
          fill={isHere ? '#4caf50' : 'url(#planet-grad)'}
          opacity="0.9"
          stroke={isHere ? '#81c784' : 'rgba(255,255,255,0.15)'}
          stroke-width={sw * 0.3}
        />
        <!-- Highlight crescent -->
        <ellipse cx={x - dotR * 0.2} cy={y - dotR * 0.15} rx={dotR * 0.5} ry={dotR * 0.7}
          fill="rgba(255,255,255,0.1)" />

      {:else if poi.type === 'nebula'}
        <!-- Nebula: soft layered blobs -->
        <circle cx={x + dotR * 0.2} cy={y - dotR * 0.15} r={dotR * 0.8}
          fill="#ce93d8" opacity="0.15" filter="url(#nebula-glow)" />
        <circle cx={x - dotR * 0.2} cy={y + dotR * 0.1} r={dotR * 0.9}
          fill="#ab47bc" opacity="0.15" filter="url(#nebula-glow)" />
        <circle cx={x} cy={y} r={dotR * 0.6}
          fill={isHere ? '#4caf50' : '#ce93d8'} opacity="0.7" />
        <circle cx={x + dotR * 0.15} cy={y - dotR * 0.1} r={dotR * 0.3}
          fill="#f3e5f5" opacity="0.3" />

      {:else if poi.type === 'gas_cloud'}
        <!-- Gas cloud: semi-transparent wispy layers -->
        <ellipse cx={x - dotR * 0.15} cy={y} rx={dotR * 1.1} ry={dotR * 0.7}
          fill="#80cbc4" opacity="0.12" filter="url(#nebula-glow)" />
        <ellipse cx={x + dotR * 0.1} cy={y + dotR * 0.05} rx={dotR * 0.8} ry={dotR * 0.55}
          fill="#4db6ac" opacity="0.2" />
        <ellipse cx={x} cy={y} rx={dotR * 0.5} ry={dotR * 0.35}
          fill={isHere ? '#4caf50' : '#b2dfdb'} opacity="0.6" />

      {:else if poi.type === 'ice_field'}
        <!-- Ice field: crystalline cluster -->
        <circle cx={x} cy={y} r={dotR * 0.9}
          fill={isHere ? '#4caf50' : 'url(#ice-grad)'} opacity="0.8"
          stroke="#b3e5fc" stroke-width={sw * 0.3} />
        <!-- Crystal facets -->
        {@const cr = dotR * 0.5}
        <line x1={x - cr} y1={y - cr * 0.3} x2={x + cr} y2={y + cr * 0.3}
          stroke="#e1f5fe" stroke-width={sw * 0.25} opacity="0.5" />
        <line x1={x - cr * 0.3} y1={y - cr} x2={x + cr * 0.3} y2={y + cr}
          stroke="#e1f5fe" stroke-width={sw * 0.25} opacity="0.4" />

      {:else if poi.type === 'asteroid_belt' || poi.type === 'asteroid'}
        <!-- Asteroid belt: rocks scattered along orbital path -->
        {#each beltRocks.get(poi.id) ?? [] as rock}
          <circle cx={rock.x} cy={rock.y} r={rock.r}
            fill={isHere ? '#4caf50' : '#ff9800'} opacity={rock.opacity} />
        {/each}

      {:else}
        <!-- Default: simple circle -->
        <circle
          cx={x} cy={y} r={dotR}
          fill={isHere ? '#4caf50' : color}
          opacity="0.85"
          stroke={isHere ? '#81c784' : 'rgba(255,255,255,0.15)'}
          stroke-width={sw * 0.4}
        />
      {/if}

      <!-- POI label -->
      <text
        x={x}
        y={y + dotR + s * 0.03}
        text-anchor="middle"
        dominant-baseline="hanging"
        fill={isHere ? '#81c784' : '#78909c'}
        font-size={s * 0.035}
        font-family="'Roboto', sans-serif"
        style="pointer-events:none"
      >{poi.name}</text>

      <!-- Online count badge -->
      {#if online > 0}
        <text
          x={x + dotR + s * 0.01}
          y={y - dotR * 0.3}
          text-anchor="start"
          dominant-baseline="central"
          fill={color}
          font-size={s * 0.025}
          font-family="'Roboto Mono', monospace"
          opacity="0.8"
          style="pointer-events:none"
        >{online}</text>
      {/if}
    {/each}

    <!-- Center crosshair at origin (0,0) -->
    <line x1={-s * 0.02} y1={0} x2={s * 0.02} y2={0} stroke="rgba(79,195,247,0.2)" stroke-width={sw * 0.3} />
    <line x1={0} y1={-s * 0.02} x2={0} y2={s * 0.02} stroke="rgba(79,195,247,0.2)" stroke-width={sw * 0.3} />
  </svg>
</div>

<style>
  .system-map-container {
    width: 100%;
    height: 100%;
    min-height: 160px;
    background: radial-gradient(ellipse at center, rgba(13,21,37,0.9) 0%, rgba(6,10,16,0.95) 100%);
    border: 1px solid rgba(79,195,247,0.12);
    border-radius: 6px;
    overflow: hidden;
    position: relative;
  }

  .system-map-svg {
    width: 100%;
    height: 100%;
    display: block;
  }
</style>
