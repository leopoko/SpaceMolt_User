import type { ChatMessage, ChatViewFilter } from '$lib/types/game';

const MAX_MESSAGES = 200;

class ChatStore {
  messages = $state<ChatMessage[]>([]);
  activeFilter = $state<ChatViewFilter>('all');
  /** Target username for private messages */
  privateTarget = $state('');

  get filteredMessages(): ChatMessage[] {
    if (this.activeFilter === 'all') return this.messages;
    return this.messages.filter(m => m.channel === this.activeFilter);
  }

  /** Whether the active filter is a receive-only view (no input) */
  get isReceiveOnly(): boolean {
    return this.activeFilter === 'all' || this.activeFilter === 'system';
  }

  addMessage(msg: ChatMessage) {
    this.messages = [...this.messages, msg].slice(-MAX_MESSAGES);
  }

  setFilter(filter: ChatViewFilter) {
    this.activeFilter = filter;
  }

  reset() {
    this.messages = [];
    this.privateTarget = '';
  }
}

export const chatStore = new ChatStore();
