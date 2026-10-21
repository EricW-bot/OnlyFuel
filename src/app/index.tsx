import React, { useSyncExternalStore } from 'react';
import { router } from 'expo-router';
import App from '@/App';
import { getSettingsVersion, subscribeSettingsVersion } from '@/state/settingsSync';

export default function PricesRoute() {
  const settingsVersion = useSyncExternalStore(subscribeSettingsVersion, getSettingsVersion);

  return (
    <App
      key={settingsVersion}
      initialTab="prices"
      hideBottomNav
      onNavigateToTab={(tab, section) => {
        if (tab === 'settings') {
          router.push({
            pathname: '/settings',
            params: section ? { section, nonce: String(Date.now()) } : {}
          });
        }
      }}
    />
  );
}
