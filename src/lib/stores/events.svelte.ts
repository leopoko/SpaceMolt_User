import type { EventLogEntry, EventType } from '$lib/types/game';

const MAX_EVENTS = 200;
let nextId = 0;

class EventsStore {
  entries = $state<EventLogEntry[]>([]);
  filter = $state<EventType | 'all'>('all');

  get filtered(): EventLogEntry[] {
    if (this.filter === 'all') return this.entries;
    return this.entries.filter(e => e.type === this.filter);
  }

  add(entry: Partial<EventLogEntry> & { message: string; type?: EventType }) {
    const e: EventLogEntry = {
      id: String(++nextId),
      timestamp: Date.now(),
      type: entry.type ?? 'info',
      message: entry.message
    };
    this.entries = [e, ...this.entries].slice(0, MAX_EVENTS);
  }

  setFilter(f: EventType | 'all') {
    this.filter = f;
  }

  reset() {
    this.entries = [];
  }
}

export const eventsStore = new EventsStore();
