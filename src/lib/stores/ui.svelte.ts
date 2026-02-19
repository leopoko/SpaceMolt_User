function getBool(key: string, defaultVal: boolean): boolean {
  if (typeof localStorage === 'undefined') return defaultVal;
  const v = localStorage.getItem(key);
  if (v === null) return defaultVal;
  return v !== 'false';
}

export interface TabDef {
  label: string;
  icon: string;
}

export const TABS: TabDef[] = [
  { label: 'Navigation', icon: 'explore' },
  { label: 'Combat',     icon: 'gps_fixed' },
  { label: 'Mining',     icon: 'construction' },
  { label: 'Trading',    icon: 'storefront' },
  { label: 'Ship',       icon: 'rocket' },
  { label: 'Crafting',   icon: 'precision_manufacturing' },
  { label: 'Community',  icon: 'groups' },
  { label: 'Base',       icon: 'home' },
  { label: 'Info',       icon: 'person' },
  { label: 'Settings',   icon: 'settings' }
];

class UiStore {
  activeTab = $state<TabDef>(TABS[0]);
  darkMode = $state(getBool('spacemolt_darkmode', true));
  notification = $state<string | null>(null);
  notificationTimeout = $state<ReturnType<typeof setTimeout> | null>(null);

  setTab(tab: TabDef) {
    this.activeTab = tab;
  }

  setDarkMode(val: boolean) {
    this.darkMode = val;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('spacemolt_darkmode', String(val));
    }
    // Toggle SMUI theme stylesheets
    if (typeof document !== 'undefined') {
      const light = document.querySelector<HTMLLinkElement>('link[href*="smui.css"]:not([href*="dark"])');
      const dark = document.querySelector<HTMLLinkElement>('link[href*="smui-dark.css"]');
      if (light) light.media = val ? 'not all' : 'screen';
      if (dark) dark.media = val ? 'screen' : 'not all';
    }
  }

  showNotification(msg: string, durationMs = 4000) {
    if (this.notificationTimeout) clearTimeout(this.notificationTimeout);
    this.notification = msg;
    this.notificationTimeout = setTimeout(() => {
      this.notification = null;
    }, durationMs);
  }
}

export const uiStore = new UiStore();
