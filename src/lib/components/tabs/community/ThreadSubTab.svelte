<script lang="ts">
  import Card, { Content } from '@smui/card';
  import Button, { Label } from '@smui/button';
  import { forumStore } from '$lib/stores/forum.svelte';
  import { authStore } from '$lib/stores/auth.svelte';
  import { ws } from '$lib/services/websocket';
  import type { ForumCategory, ForumThread } from '$lib/types/game';

  type View = 'list' | 'detail' | 'create' | 'my-threads';
  let view = $state<View>('list');

  // Create form
  let newTitle = $state('');
  let newContent = $state('');
  let newCategory = $state<ForumCategory>('general');

  // Reply form
  let replyContent = $state('');

  const categoryLabels: Record<ForumCategory, string> = {
    general: 'General',
    bugs: 'Bugs',
    suggestions: 'Suggestions',
    trading: 'Trading',
    factions: 'Factions',
  };

  const categoryColors: Record<string, string> = {
    general: '#90caf9',
    bugs: '#ef5350',
    suggestions: '#66bb6a',
    trading: '#ffd700',
    factions: '#b39ddb',
  };

  function loadThreads(page = 1) {
    ws.forumList(page);
  }

  function openThread(thread: ForumThread) {
    ws.forumGetThread(thread.id);
    view = 'detail';
  }

  function backToList() {
    forumStore.clearCurrentThread();
    view = 'list';
    loadThreads(forumStore.page);
  }

  function createThread() {
    if (!newTitle.trim() || !newContent.trim()) return;
    ws.forumCreateThread(newTitle.trim(), newContent.trim(), newCategory);
    newTitle = '';
    newContent = '';
    newCategory = 'general';
    view = 'list';
  }

  function submitReply() {
    if (!replyContent.trim() || !forumStore.currentThread) return;
    ws.forumReply(forumStore.currentThread.id, replyContent.trim());
    replyContent = '';
  }

  function deleteThread(threadId: string) {
    ws.forumDeleteThread(threadId);
  }

  function deleteReply(replyId: string) {
    ws.forumDeleteReply(replyId);
  }

  function upvoteThread(threadId: string) {
    ws.forumUpvote(threadId);
  }

  function upvoteReply(threadId: string, replyId: string) {
    ws.forumUpvote(threadId, replyId);
  }

  function formatDate(dateStr: string): string {
    try {
      const d = new Date(dateStr);
      return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    } catch {
      return dateStr;
    }
  }

  // Load threads on mount
  $effect(() => {
    if (view === 'list' && forumStore.threads.length === 0 && !forumStore.loading) {
      loadThreads();
    }
  });
</script>

{#if view === 'list'}
  <!-- Thread List View -->
  <div class="thread-view">
    <div class="thread-toolbar">
      <button class="tool-btn" onclick={() => loadThreads(forumStore.page)}>
        <span class="material-icons" style="font-size:14px">refresh</span> Refresh
      </button>
      <button class="tool-btn accent" onclick={() => { view = 'create'; }}>
        <span class="material-icons" style="font-size:14px">add</span> New Thread
      </button>
      <button class="tool-btn" onclick={() => { view = 'my-threads'; }}>
        <span class="material-icons" style="font-size:14px">person</span> My Threads
      </button>
    </div>

    {#if forumStore.loading}
      <p class="loading-hint">Loading threads...</p>
    {:else if forumStore.threads.length === 0}
      <p class="empty-hint">No threads found</p>
    {:else}
      <div class="thread-list">
        {#each forumStore.threads as thread (thread.id)}
          <button class="thread-item" onclick={() => openThread(thread)}>
            <div class="thread-top">
              <span class="thread-cat" style="color: {categoryColors[thread.category] ?? '#78909c'}">
                [{categoryLabels[thread.category] ?? thread.category}]
              </span>
              <span class="thread-title">{thread.title}</span>
            </div>
            <div class="thread-meta">
              <span class="thread-author">{thread.author_name}</span>
              <span class="thread-date">{formatDate(thread.created_at)}</span>
              <span class="thread-stats">
                <span class="material-icons" style="font-size:11px">arrow_upward</span>{thread.upvotes}
                <span class="material-icons" style="font-size:11px; margin-left:6px">chat_bubble_outline</span>{thread.reply_count}
              </span>
            </div>
          </button>
        {/each}
      </div>

      <!-- Pagination -->
      {#if forumStore.total > forumStore.perPage}
        <div class="pagination">
          <button
            class="page-btn"
            disabled={forumStore.page <= 1}
            onclick={() => loadThreads(forumStore.page - 1)}
          >← Prev</button>
          <span class="page-info mono">
            Page {forumStore.page} / {Math.ceil(forumStore.total / forumStore.perPage)}
          </span>
          <button
            class="page-btn"
            disabled={forumStore.page >= Math.ceil(forumStore.total / forumStore.perPage)}
            onclick={() => loadThreads(forumStore.page + 1)}
          >Next →</button>
        </div>
      {/if}
    {/if}
  </div>

{:else if view === 'detail'}
  <!-- Thread Detail View -->
  <div class="thread-view">
    <div class="thread-toolbar">
      <button class="tool-btn" onclick={backToList}>
        <span class="material-icons" style="font-size:14px">arrow_back</span> Back
      </button>
      {#if forumStore.currentThread}
        <button class="tool-btn" onclick={() => upvoteThread(forumStore.currentThread!.id)}>
          <span class="material-icons" style="font-size:14px">thumb_up</span> Upvote ({forumStore.currentThread.upvotes})
        </button>
        {#if forumStore.currentThread.author_name === authStore.username}
          <button class="tool-btn danger" onclick={() => deleteThread(forumStore.currentThread!.id)}>
            <span class="material-icons" style="font-size:14px">delete</span> Delete
          </button>
        {/if}
      {/if}
    </div>

    {#if forumStore.loadingThread}
      <p class="loading-hint">Loading thread...</p>
    {:else if forumStore.currentThread}
      <Card class="space-card">
        <Content>
          <div class="detail-header">
            <span class="thread-cat" style="color: {categoryColors[forumStore.currentThread.category] ?? '#78909c'}">
              [{categoryLabels[forumStore.currentThread.category] ?? forumStore.currentThread.category}]
            </span>
            <h2 class="detail-title">{forumStore.currentThread.title}</h2>
            <div class="detail-meta">
              <span class="thread-author">{forumStore.currentThread.author_name}</span>
              <span class="thread-date">{formatDate(forumStore.currentThread.created_at)}</span>
            </div>
          </div>
          <div class="detail-body">{forumStore.currentThread.content}</div>
        </Content>
      </Card>

      <!-- Replies -->
      <div class="replies-section">
        <p class="tab-section-title">Replies ({forumStore.currentReplies.length})</p>
        {#each forumStore.currentReplies as reply (reply.id)}
          <div class="reply-item">
            <div class="reply-header">
              <span class="reply-author">{reply.author_name}</span>
              <span class="reply-date">{formatDate(reply.created_at)}</span>
              <div class="reply-actions">
                <button class="mini-btn" onclick={() => upvoteReply(forumStore.currentThread!.id, reply.id)}>
                  <span class="material-icons" style="font-size:12px">thumb_up</span> {reply.upvotes}
                </button>
                {#if reply.author_name === authStore.username}
                  <button class="mini-btn danger" onclick={() => deleteReply(reply.id)}>
                    <span class="material-icons" style="font-size:12px">delete</span>
                  </button>
                {/if}
              </div>
            </div>
            <div class="reply-body">{reply.content}</div>
          </div>
        {:else}
          <p class="empty-hint">No replies yet</p>
        {/each}
      </div>

      <!-- Reply form -->
      <div class="reply-form">
        <textarea
          class="reply-textarea"
          bind:value={replyContent}
          placeholder="Write a reply..."
          rows="3"
          maxlength={2000}
        ></textarea>
        <Button variant="outlined" dense onclick={submitReply} disabled={!replyContent.trim()}>
          <Label>Post Reply</Label>
        </Button>
      </div>
    {:else}
      <p class="empty-hint">Thread not found</p>
    {/if}
  </div>

{:else if view === 'create'}
  <!-- Create Thread View -->
  <div class="thread-view">
    <div class="thread-toolbar">
      <button class="tool-btn" onclick={() => { view = 'list'; }}>
        <span class="material-icons" style="font-size:14px">arrow_back</span> Cancel
      </button>
    </div>

    <Card class="space-card">
      <Content>
        <p class="tab-section-title">Create New Thread</p>

        <div class="form-group">
          <label class="form-label">Category</label>
          <select class="form-select" bind:value={newCategory}>
            {#each Object.entries(categoryLabels) as [val, label]}
              <option value={val}>{label}</option>
            {/each}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Title</label>
          <input
            class="form-input"
            bind:value={newTitle}
            placeholder="Thread title..."
            maxlength={100}
          />
        </div>

        <div class="form-group">
          <label class="form-label">Content</label>
          <textarea
            class="form-textarea"
            bind:value={newContent}
            placeholder="Thread content..."
            rows="6"
            maxlength={5000}
          ></textarea>
        </div>

        <Button variant="outlined" dense onclick={createThread} disabled={!newTitle.trim() || !newContent.trim()}>
          <Label>Create Thread</Label>
        </Button>
      </Content>
    </Card>
  </div>

{:else if view === 'my-threads'}
  <!-- My Threads View -->
  <div class="thread-view">
    <div class="thread-toolbar">
      <button class="tool-btn" onclick={() => { view = 'list'; }}>
        <span class="material-icons" style="font-size:14px">arrow_back</span> Back
      </button>
    </div>

    <p class="tab-section-title">My Threads ({forumStore.myThreads.length})</p>

    {#if forumStore.myThreads.length === 0}
      <p class="empty-hint">You haven't created any threads yet</p>
    {:else}
      <div class="thread-list">
        {#each forumStore.myThreads as thread (thread.id)}
          <button class="thread-item" onclick={() => { ws.forumGetThread(thread.id); view = 'detail'; }}>
            <div class="thread-top">
              <span class="thread-cat" style="color: {categoryColors[thread.category] ?? '#78909c'}">
                [{categoryLabels[thread.category] ?? thread.category}]
              </span>
              <span class="thread-title">{thread.title}</span>
            </div>
            <div class="thread-meta">
              <span class="thread-date">{formatDate(thread.created_at)}</span>
            </div>
          </button>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .thread-view {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .thread-toolbar {
    display: flex;
    gap: 6px;
    align-items: center;
    flex-wrap: wrap;
  }

  .tool-btn {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    background: rgba(79,195,247,0.08);
    border: 1px solid rgba(79,195,247,0.2);
    color: #4fc3f7;
    font-size: 0.68rem;
    padding: 3px 8px;
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .tool-btn:hover { background: rgba(79,195,247,0.15); border-color: rgba(79,195,247,0.4); }
  .tool-btn.accent { color: #66bb6a; border-color: rgba(102,187,106,0.3); background: rgba(102,187,106,0.08); }
  .tool-btn.accent:hover { background: rgba(102,187,106,0.15); }
  .tool-btn.danger { color: #ef5350; border-color: rgba(239,83,80,0.3); background: rgba(239,83,80,0.08); }
  .tool-btn.danger:hover { background: rgba(239,83,80,0.15); }

  .loading-hint, .empty-hint {
    font-size: 0.75rem;
    color: #37474f;
    text-align: center;
    padding: 16px 0;
  }

  .thread-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .thread-item {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 8px 10px;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(79,195,247,0.08);
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.12s;
    text-align: left;
    width: 100%;
  }

  .thread-item:hover {
    background: rgba(79,195,247,0.06);
    border-color: rgba(79,195,247,0.2);
  }

  .thread-top {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .thread-cat {
    font-size: 0.6rem;
    font-weight: 600;
    flex-shrink: 0;
  }

  .thread-title {
    font-size: 0.8rem;
    color: #b0bec5;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .thread-meta {
    display: flex;
    gap: 10px;
    align-items: center;
    font-size: 0.63rem;
  }

  .thread-author { color: #4fc3f7; }
  .thread-date { color: #37474f; font-family: 'Roboto Mono', monospace; }

  .thread-stats {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    color: #546e7a;
    margin-left: auto;
  }

  /* Detail view */
  .detail-header { margin-bottom: 12px; }

  .detail-title {
    font-size: 1.1rem;
    font-weight: 300;
    letter-spacing: 0.04em;
    color: #b0bec5;
    margin: 6px 0 4px 0;
  }

  .detail-meta {
    display: flex;
    gap: 10px;
    font-size: 0.65rem;
  }

  .detail-body {
    font-size: 0.78rem;
    color: #90a4ae;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
  }

  /* Replies */
  .replies-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .reply-item {
    padding: 8px 10px;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.04);
    border-radius: 4px;
  }

  .reply-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  .reply-author { font-size: 0.7rem; color: #4fc3f7; }
  .reply-date { font-size: 0.6rem; color: #37474f; font-family: 'Roboto Mono', monospace; }

  .reply-actions {
    margin-left: auto;
    display: flex;
    gap: 4px;
  }

  .mini-btn {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    background: none;
    border: 1px solid rgba(255,255,255,0.06);
    color: #546e7a;
    font-size: 0.6rem;
    padding: 1px 5px;
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .mini-btn:hover { color: #90caf9; border-color: rgba(144,202,249,0.3); }
  .mini-btn.danger:hover { color: #ef5350; border-color: rgba(239,83,80,0.3); }

  .reply-body {
    font-size: 0.75rem;
    color: #90a4ae;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
  }

  /* Reply form */
  .reply-form {
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: flex-end;
  }

  .reply-textarea {
    width: 100%;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(79,195,247,0.15);
    border-radius: 4px;
    color: #c0cfe0;
    font-size: 0.75rem;
    padding: 8px;
    resize: vertical;
    outline: none;
    font-family: inherit;
  }

  .reply-textarea:focus { border-color: rgba(79,195,247,0.4); }

  /* Pagination */
  .pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 8px 0;
  }

  .page-btn {
    background: rgba(79,195,247,0.08);
    border: 1px solid rgba(79,195,247,0.2);
    color: #4fc3f7;
    font-size: 0.68rem;
    padding: 3px 10px;
    border-radius: 3px;
    cursor: pointer;
  }

  .page-btn:disabled { opacity: 0.3; cursor: not-allowed; }
  .page-btn:hover:not(:disabled) { background: rgba(79,195,247,0.15); }

  .page-info { font-size: 0.65rem; color: #546e7a; }

  /* Create form */
  .form-group {
    margin-bottom: 10px;
  }

  .form-label {
    display: block;
    font-size: 0.68rem;
    color: #4a6070;
    margin-bottom: 3px;
  }

  .form-input, .form-select, .form-textarea {
    width: 100%;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(79,195,247,0.15);
    border-radius: 4px;
    color: #c0cfe0;
    font-size: 0.75rem;
    padding: 6px 8px;
    outline: none;
    font-family: inherit;
  }

  .form-select {
    cursor: pointer;
  }

  .form-select option {
    background: #0d1525;
    color: #c0cfe0;
  }

  .form-textarea {
    resize: vertical;
  }

  .form-input:focus, .form-select:focus, .form-textarea:focus {
    border-color: rgba(79,195,247,0.4);
  }

  .mono { font-family: 'Roboto Mono', monospace; }
</style>
