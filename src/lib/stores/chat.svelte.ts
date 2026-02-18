import type { ChatMessage, ChatChannel } from '$lib/types/game';

const MAX_MESSAGES = 200;

class ChatStore {
  messages = $state<ChatMessage[]>([]);
  activeChannel = $state<ChatChannel>('global');

  get filteredMessages(): ChatMessage[] {
    return this.messages.filter(
      m => m.channel === this.activeChannel || this.activeChannel === 'global'
    );
  }

  addMessage(msg: ChatMessage) {
    this.messages = [...this.messages, msg].slice(-MAX_MESSAGES);
  }

  setChannel(channel: ChatChannel) {
    this.activeChannel = channel;
  }

  reset() {
    this.messages = [];
  }
}

export const chatStore = new ChatStore();
