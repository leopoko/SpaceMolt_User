import type { ChatMessage } from '$lib/types/game';
import { userDataSync } from '$lib/services/userDataSync';
import { prefixKey } from './storagePrefix';

const STORAGE_KEY = 'sm_contacts';
const MAX_HISTORY_PER_CONTACT = 100;

export interface Contact {
  username: string;
  /** Last message timestamp */
  lastMessageAt: number;
}

export interface ContactData {
  contacts: Record<string, Contact>;
  /** Message history keyed by username */
  history: Record<string, ChatMessage[]>;
}

function loadData(): ContactData {
  try {
    const raw = localStorage.getItem(prefixKey(STORAGE_KEY));
    if (raw) {
      const parsed = JSON.parse(raw) as ContactData;
      return {
        contacts: parsed.contacts ?? {},
        history: parsed.history ?? {},
      };
    }
  } catch { /* ignore */ }
  return { contacts: {}, history: {} };
}

function saveData(data: ContactData) {
  try {
    localStorage.setItem(prefixKey(STORAGE_KEY), JSON.stringify(data));
  } catch { /* ignore */ }
}

class ContactsStore {
  private data = $state<ContactData>(loadData());

  /** Sorted contact list (most recent first) */
  get list(): Contact[] {
    return Object.values(this.data.contacts)
      .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  }

  /** Get message history for a contact */
  getHistory(username: string): ChatMessage[] {
    return this.data.history[username] ?? [];
  }

  /** Record a private message (sent or received) */
  addMessage(msg: ChatMessage, partnerUsername: string) {
    // Ensure contact exists
    this.data.contacts[partnerUsername] = {
      username: partnerUsername,
      lastMessageAt: msg.timestamp,
    };

    // Append to history
    const hist = this.data.history[partnerUsername] ?? [];
    hist.push(msg);
    // Trim to max
    if (hist.length > MAX_HISTORY_PER_CONTACT) {
      hist.splice(0, hist.length - MAX_HISTORY_PER_CONTACT);
    }
    this.data.history[partnerUsername] = hist;

    // Persist
    this.persist();
  }

  /** Remove a contact and their history */
  removeContact(username: string) {
    delete this.data.contacts[username];
    delete this.data.history[username];
    this.persist();
  }

  /** Check if a username is in contacts */
  hasContact(username: string): boolean {
    return username in this.data.contacts;
  }

  private persist() {
    // Trigger reactivity by reassigning
    this.data = { ...this.data };
    saveData(this.data);
    userDataSync.notifyChange();
  }

  reset() {
    this.data = { contacts: {}, history: {} };
  }
}

export const contactsStore = new ContactsStore();
