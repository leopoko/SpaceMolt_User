import { prefixKey } from './storagePrefix';

function getStoredItem(key: string): string {
  if (typeof localStorage === 'undefined') return '';
  return localStorage.getItem(prefixKey(key)) ?? '';
}

class AuthStore {
  isLoggedIn = $state(false);
  loginError = $state<string | null>(null);
  registeredPassword = $state<string | null>(null); // set after registration so user can copy it
  username = $state('');
  savedUsername = $state(getStoredItem('spacemolt_username'));
  savedPassword = $state(getStoredItem('spacemolt_password'));
  rememberCredentials = $state(getStoredItem('spacemolt_remember') !== 'false');

  persistCredentials(username: string, password: string) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(prefixKey('spacemolt_username'), username);
      localStorage.setItem(prefixKey('spacemolt_password'), password);
      localStorage.setItem(prefixKey('spacemolt_remember'), 'true');
    }
    this.savedUsername = username;
    this.savedPassword = password;
    this.rememberCredentials = true;
  }

  clearCredentials() {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(prefixKey('spacemolt_username'));
      localStorage.removeItem(prefixKey('spacemolt_password'));
      localStorage.setItem(prefixKey('spacemolt_remember'), 'false');
    }
    this.savedUsername = '';
    this.savedPassword = '';
    this.rememberCredentials = false;
  }

  logout() {
    this.isLoggedIn = false;
    this.username = '';
  }
}

export const authStore = new AuthStore();
