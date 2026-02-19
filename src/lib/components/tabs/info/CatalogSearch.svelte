<script lang="ts">
  let { search, total, loading, onSearch }: {
    search: string;
    total: number;
    loading: boolean;
    onSearch: (q: string) => void;
  } = $props();

  let inputVal = $state(search);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function handleInput(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    inputVal = val;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => onSearch(val), 400);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      if (debounceTimer) clearTimeout(debounceTimer);
      onSearch(inputVal);
    }
  }
</script>

<div class="search-bar">
  <span class="material-icons search-icon">search</span>
  <input
    type="text"
    class="search-input"
    placeholder="Search..."
    value={inputVal}
    oninput={handleInput}
    onkeydown={handleKeydown}
  />
  <span class="result-count mono">
    {#if loading}
      Loading...
    {:else}
      {total} results
    {/if}
  </span>
</div>

<style>
  .search-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(79,195,247,0.12);
    border-radius: 4px;
    margin-bottom: 12px;
  }
  .search-icon {
    font-size: 18px;
    color: #37474f;
  }
  .search-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: #b0bec5;
    font-size: 0.8rem;
    font-family: inherit;
  }
  .search-input::placeholder { color: #263238; }
  .result-count {
    font-size: 0.65rem;
    color: #37474f;
    white-space: nowrap;
  }
  .mono { font-family: 'Roboto Mono', monospace; }
</style>
