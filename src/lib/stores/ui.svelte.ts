import { prefixKey } from './storagePrefix';

function getBool(key: string, defaultVal: boolean): boolean {
  if (typeof localStorage === 'undefined') return defaultVal;
  const v = localStorage.getItem(prefixKey(key));
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
  { label: 'Explorer',   icon: 'travel_explore' },
  { label: 'Info',       icon: 'person' },
  { label: 'Settings',   icon: 'settings' }
];

class UiStore {
  activeTab = $state.raw<TabDef>(TABS[0]);
  darkMode = $state(getBool('spacemolt_darkmode', true));
  notification = $state<string | null>(null);
  notificationTimeout = $state<ReturnType<typeof setTimeout> | null>(null);

  // Cross-tab navigation: Crafting search prefill
  craftingSearch = $state('');
  craftingSearchMode = $state<'all' | 'input' | 'output'>('all');

  // Cross-tab navigation: Facility detail prefill
  facilityDetailId = $state('');

  setTab(tab: TabDef) {
    this.activeTab = tab;
  }

  /** Navigate to Crafting tab with search prefilled */
  navigateToCrafting(itemId: string, mode: 'input' | 'output') {
    this.craftingSearch = itemId;
    this.craftingSearchMode = mode;
    this.activeTab = TABS.find(t => t.label === 'Crafting') ?? TABS[5];
  }

  /** Navigate to Navigation tab */
  navigateToNavigation() {
    this.activeTab = TABS.find(t => t.label === 'Navigation') ?? TABS[0];
  }

  /** Navigate to Base tab → Facility detail */
  navigateToFacilityDetail(facilityTypeId: string) {
    this.facilityDetailId = facilityTypeId;
    this.activeTab = TABS.find(t => t.label === 'Base') ?? TABS[7];
  }

  setDarkMode(val: boolean) {
    this.darkMode = val;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(prefixKey('spacemolt_darkmode'), String(val));
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
