function getStoredItem(key: string): string {
  if (typeof localStorage === 'undefined') return '';
  return localStorage.getItem(key) ?? '';
}

class AuthStore {
  isLoggedIn = $state(false);
  username = $state('');
  savedUsername = $state(getStoredItem('spacemolt_username'));
  savedPassword = $state(getStoredItem('spacemolt_password'));
  rememberCredentials = $state(getStoredItem('spacemolt_remember') !== 'false');

  persistCredentials(username: string, password: string) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('spacemolt_username', username);
      localStorage.setItem('spacemolt_password', password);
      localStorage.setItem('spacemolt_remember', 'true');
    }
    this.savedUsername = username;
    this.savedPassword = password;
    this.rememberCredentials = true;
  }

  clearCredentials() {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('spacemolt_username');
      localStorage.removeItem('spacemolt_password');
      localStorage.setItem('spacemolt_remember', 'false');
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
