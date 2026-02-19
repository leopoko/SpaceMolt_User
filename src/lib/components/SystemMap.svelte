<script lang="ts">
  import type { POI } from '$lib/types/game';
  import { playerStore } from '$lib/stores/player.svelte';

  let { pois = [] }: { pois: POI[] } = $props();

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

  // Compute the bounds and scale
  let mapMetrics = $derived.by(() => {
    if (mappedPois.length === 0) return { viewBox: '-10 -10 20 20', scale: 1 };

    let maxDist = 0;
    for (const p of mappedPois) {
      const dist = Math.sqrt(p.position!.x ** 2 + p.position!.y ** 2);
      if (dist > maxDist) maxDist = dist;
    }

    // Add padding
    const pad = Math.max(maxDist * 0.25, 0.5);
    const extent = maxDist + pad;
    const scale = extent;
    const size = extent * 2;
    return {
      viewBox: `${-extent} ${-extent} ${size} ${size}`,
      scale
    };
  });

  // Compute unique orbital radii (distance from 0,0)
  let orbits = $derived.by(() => {
    const radii = new Map<string, number>();
    for (const p of mappedPois) {
      const r = Math.sqrt(p.position!.x ** 2 + p.position!.y ** 2);
      if (r > 0.01) { // Skip the center (sun)
        const key = r.toFixed(4);
        if (!radii.has(key)) radii.set(key, r);
      }
    }
    return [...radii.values()];
  });

  // Wave animation duration based on online count: more players = faster
  function waveDuration(online: number): number {
    if (online <= 0) return 0;
    // Base 3s, reduces to 0.4s for 100+ players
    return Math.max(0.4, 3 - (online / 40));
  }

  function getOnline(poi: POI): number {
    return poi.player_count ?? poi.online ?? 0;
  }

  // Scale for stroke widths relative to coordinate system
  let sw = $derived(mapMetrics.scale * 0.008);
</script>

<div class="system-map-container">
  <svg viewBox={mapMetrics.viewBox} xmlns="http://www.w3.org/2000/svg" class="system-map-svg">
    <defs>
      <!-- Glow filter for current player POI -->
      <filter id="glow-current" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation={mapMetrics.scale * 0.02} result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <!-- Wave ripple filter -->
      <filter id="wave-glow" x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur stdDeviation={mapMetrics.scale * 0.01} />
      </filter>
    </defs>

    <!-- Grid lines (subtle) -->
    {#each Array.from({length: 11}, (_, i) => (i - 5) * mapMetrics.scale * 0.4) as pos}
      <line
        x1={pos} y1={-mapMetrics.scale} x2={pos} y2={mapMetrics.scale}
        stroke="rgba(79,195,247,0.04)" stroke-width={sw * 0.3}
      />
      <line
        x1={-mapMetrics.scale} y1={pos} x2={mapMetrics.scale} y2={pos}
        stroke="rgba(79,195,247,0.04)" stroke-width={sw * 0.3}
      />
    {/each}

    <!-- Orbital circles (dashed) -->
    {#each orbits as r}
      <circle
        cx={0} cy={0} r={r}
        fill="none"
        stroke="rgba(79,195,247,0.12)"
        stroke-width={sw * 0.5}
        stroke-dasharray="{mapMetrics.scale * 0.02} {mapMetrics.scale * 0.015}"
      />
    {/each}

    <!-- POI dots and waves -->
    {#each mappedPois as poi (poi.id)}
      {@const x = poi.position!.x}
      {@const y = poi.position!.y}
      {@const online = getOnline(poi)}
      {@const isHere = playerStore.poi_id === poi.id}
      {@const color = poiColors[poi.type] ?? '#b0bec5'}
      {@const dotR = poi.type === 'sun' ? mapMetrics.scale * 0.06 : mapMetrics.scale * 0.035}

      <!-- Wave ripples for POIs with players -->
      {#if online > 0}
        {#each [0, 1, 2] as waveIdx}
          <circle
            cx={x} cy={y}
            r={dotR}
            fill="none"
            stroke={color}
            stroke-width={sw * 0.4}
            opacity="0"
            filter="url(#wave-glow)"
          >
            <animate
              attributeName="r"
              from={dotR}
              to={dotR + mapMetrics.scale * 0.12}
              dur="{waveDuration(online)}s"
              begin="{waveIdx * waveDuration(online) / 3}s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              from="0.6"
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
          r={dotR + mapMetrics.scale * 0.025}
          fill="none"
          stroke="#4caf50"
          stroke-width={sw * 1.5}
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
        <!-- Sun: larger, with glow -->
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
        font-size={dotR * 1.1}
        style="pointer-events:none"
      >{poiIcons[poi.type] ?? '\u25CF'}</text>

      <!-- POI label -->
      <text
        x={x}
        y={y + dotR + mapMetrics.scale * 0.04}
        text-anchor="middle"
        dominant-baseline="hanging"
        fill={isHere ? '#81c784' : '#78909c'}
        font-size={mapMetrics.scale * 0.04}
        font-family="'Roboto', sans-serif"
        style="pointer-events:none"
      >{poi.name}</text>

      <!-- Online count badge -->
      {#if online > 0}
        <text
          x={x + dotR + mapMetrics.scale * 0.015}
          y={y - dotR * 0.3}
          text-anchor="start"
          dominant-baseline="central"
          fill={color}
          font-size={mapMetrics.scale * 0.03}
          font-family="'Roboto Mono', monospace"
          opacity="0.8"
          style="pointer-events:none"
        >{online}</text>
      {/if}
    {/each}

    <!-- Center crosshair -->
    <line x1={-mapMetrics.scale * 0.02} y1={0} x2={mapMetrics.scale * 0.02} y2={0} stroke="rgba(79,195,247,0.2)" stroke-width={sw * 0.3} />
    <line x1={0} y1={-mapMetrics.scale * 0.02} x2={0} y2={mapMetrics.scale * 0.02} stroke="rgba(79,195,247,0.2)" stroke-width={sw * 0.3} />
  </svg>
</div>

<style>
  .system-map-container {
    width: 100%;
    aspect-ratio: 1 / 1;
    max-height: 400px;
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
