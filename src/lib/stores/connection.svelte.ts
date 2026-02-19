export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

class ConnectionStore {
  status = $state<ConnectionStatus>('disconnected');
  serverUrl = $state('wss://game.spacemolt.com/ws');
  reconnectAttempts = $state(0);
  tick = $state(0);
  tickRate = $state(10); // seconds per tick
  lastTickTime = $state<number>(Date.now()); // wall-clock time of last tick
  lastError = $state<string | null>(null);
}

export const connectionStore = new ConnectionStore();
