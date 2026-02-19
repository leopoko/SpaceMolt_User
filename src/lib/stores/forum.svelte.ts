import type { ForumThread, ForumReply, ForumCategory } from '$lib/types/game';

const MY_THREADS_KEY = 'sm_my_threads';

interface MyThreadRef {
  id: string;
  title: string;
  category: ForumCategory;
  created_at: string;
}

function loadMyThreads(): MyThreadRef[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(MY_THREADS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveMyThreads(threads: MyThreadRef[]) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(MY_THREADS_KEY, JSON.stringify(threads));
  } catch { /* ignore */ }
}

class ForumStore {
  // Thread list (from forum_list)
  threads = $state<ForumThread[]>([]);
  page = $state(1);
  total = $state(0);
  perPage = $state(20);
  categories = $state<string[]>(['general', 'bugs', 'suggestions', 'trading', 'factions']);

  // Current thread detail (from forum_get_thread)
  currentThread = $state<ForumThread | null>(null);
  currentReplies = $state<ForumReply[]>([]);

  // My created threads (persisted in localStorage)
  myThreads = $state<MyThreadRef[]>(loadMyThreads());

  // Loading states
  loading = $state(false);
  loadingThread = $state(false);

  setThreadList(data: { threads: ForumThread[]; page: number; total: number; per_page: number; categories?: string[] }) {
    this.threads = data.threads;
    this.page = data.page;
    this.total = data.total;
    this.perPage = data.per_page;
    if (data.categories && data.categories.length > 0) {
      this.categories = data.categories;
    }
    this.loading = false;
  }

  setThreadDetail(thread: ForumThread, replies: ForumReply[]) {
    this.currentThread = thread;
    this.currentReplies = replies;
    this.loadingThread = false;
  }

  addMyThread(ref: MyThreadRef) {
    this.myThreads = [ref, ...this.myThreads];
    saveMyThreads(this.myThreads);
  }

  removeMyThread(threadId: string) {
    this.myThreads = this.myThreads.filter(t => t.id !== threadId);
    saveMyThreads(this.myThreads);
  }

  clearCurrentThread() {
    this.currentThread = null;
    this.currentReplies = [];
  }

  reset() {
    this.threads = [];
    this.page = 1;
    this.total = 0;
    this.currentThread = null;
    this.currentReplies = [];
    this.loading = false;
    this.loadingThread = false;
  }
}

export const forumStore = new ForumStore();
