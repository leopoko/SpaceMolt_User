<script lang="ts">
  import type { POI } from '$lib/types/game';
  import { playerStore } from '$lib/stores/player.svelte';
  import { systemStore } from '$lib/stores/system.svelte';

  let { pois = [], padding = 0 }: { pois: POI[]; padding?: number } = $props();

  const poiColors: Record<string, string> = {
    sun: '#ffd740',
    station: '#4fc3f7',
    asteroid_belt: '#ff9800',
    asteroid: '#ff9800',
    nebula: '#ce93d8',
    gas_cloud: '#80cbc4',
    ice_field: '#e0f7fa',
    gate: '#69f0ae',
    planet: '#66bb6a',
    wreck: '#78909c',
    anomaly: '#ff5252',
  };

  const poiIcons: Record<string, string> = {
    sun: '\u2600',       // ☀
    station: '\u2302',   // ⌂
    asteroid_belt: '\u25C6', // ◆
    asteroid: '\u25C6',
    nebula: '\u2601',    // ☁
    gas_cloud: '\u2248', // ≈
    ice_field: '\u2744', // ❄
    gate: '\u2726',      // ✦
    planet: '\u25CF',    // ●
    wreck: '\u2620',     // ☠
    anomaly: '\u003F',   // ?
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
    const spanX = maxX - minX;
    const spanY = maxY - minY;
    // Use the larger span to keep square coordinate space, add padding
    const span = Math.max(spanX, spanY, 0.5);
    const pad = span * padding;
    const half = span / 2 + pad;

    return {
      vx: cx - half,
      vy: cy - half,
      vw: half * 2,
      vh: half * 2,
      scale: half,
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

  // Scale for stroke widths relative to coordinate system
  let sw = $derived(mapMetrics.scale * 0.008);
  let s = $derived(mapMetrics.scale);
</script>

<div class="system-map-container">
  <svg {viewBox} xmlns="http://www.w3.org/2000/svg" class="system-map-svg">
    <defs>
      <filter id="glow-current" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation={s * 0.02} result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="wave-glow" x="-200%" y="-200%" width="500%" height="500%">
        <feGaussianBlur stdDeviation={s * 0.012} />
      </filter>
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
      {@const dotR = poi.type === 'sun' ? s * 0.035 : s * 0.018}

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

      <!-- Current player highlight ring -->
      {#if isHere}
        <circle
          cx={x} cy={y}
          r={dotR + s * 0.015}
          fill="none"
          stroke="#4caf50"
          stroke-width={sw * 1.2}
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

      <!-- POI dot -->
      {#if poi.type === 'sun'}
        <circle cx={x} cy={y} r={dotR} fill={color} opacity="0.9">
          <animate
            attributeName="opacity"
            values="0.9;0.7;0.9"
            dur="4s"
            repeatCount="indefinite"
          />
        </circle>
        <circle cx={x} cy={y} r={dotR * 0.6} fill="#fff8e1" opacity="0.6" />
      {:else}
        <circle
          cx={x} cy={y} r={dotR}
          fill={isHere ? '#4caf50' : color}
          opacity="0.85"
          stroke={isHere ? '#81c784' : 'rgba(255,255,255,0.15)'}
          stroke-width={sw * 0.4}
        />
      {/if}

      <!-- POI icon text -->
      <text
        x={x} y={y}
        text-anchor="middle"
        dominant-baseline="central"
        fill={poi.type === 'sun' ? '#5d4037' : '#fff'}
        font-size={dotR * 1.0}
        style="pointer-events:none"
      >{poiIcons[poi.type] ?? '\u25CF'}</text>

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
