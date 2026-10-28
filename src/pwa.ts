// Service worker: makes the app installable and usable offline.
// When a new version is published, the app shows "Aggiorna" instead of reloading by itself,
// so nothing being typed gets lost.
import { useSyncExternalStore } from 'react';
import { registerSW } from 'virtual:pwa-register';

let needRefresh = false;
const listeners = new Set<() => void>();

const updateSW = registerSW({
  onNeedRefresh() {
    needRefresh = true;
    listeners.forEach((l) => l());
  },
  onRegisteredSW(_url, registration) {
    // An installed app can stay open for days: look for a new version every hour.
    if (registration) setInterval(() => void registration.update().catch(() => undefined), 60 * 60 * 1000);
  },
});

export function useNeedRefresh(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => needRefresh,
    () => false,
  );
}

export const applyUpdate = () => void updateSW(true);
