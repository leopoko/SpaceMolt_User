<script lang="ts">
  import '../app.css';
  import type { Snippet } from 'svelte';
  import { page } from '$app/state';

  let { children }: { children: Snippet } = $props();

  let ogImageUrl = $derived(`${page.url.origin}/og-image.png`);
</script>

<svelte:head>
  <meta property="og:title" content="SpaceMolt" />
  <meta property="og:description" content="SpaceMolt Human Player Client" />
  <meta property="og:image" content={ogImageUrl} />
  <meta property="og:image:width" content="1536" />
  <meta property="og:image:height" content="1024" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="SpaceMolt" />
  <meta name="twitter:description" content="SpaceMolt Human Player Client" />
  <meta name="twitter:image" content={ogImageUrl} />
</svelte:head>

{@render children()}
