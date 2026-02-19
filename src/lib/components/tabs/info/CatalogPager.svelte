<script lang="ts">
  import Button, { Label } from '@smui/button';

  let { page, totalPages, onPageChange }: {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  } = $props();
</script>

{#if totalPages > 1}
  <div class="pager">
    <Button variant="outlined" dense disabled={page <= 1} onclick={() => onPageChange(page - 1)}>
      <Label>&laquo; Prev</Label>
    </Button>
    <span class="page-info mono">{page} / {totalPages}</span>
    <Button variant="outlined" dense disabled={page >= totalPages} onclick={() => onPageChange(page + 1)}>
      <Label>Next &raquo;</Label>
    </Button>
  </div>
{/if}

<style>
  .pager {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-top: 12px;
    padding: 8px 0;
  }
  .page-info {
    font-size: 0.72rem;
    color: #546e7a;
  }
  .mono { font-family: 'Roboto Mono', monospace; }
</style>
