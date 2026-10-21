import React, { useMemo } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import App from '@/App';
import { bumpSettingsVersion } from '@/state/settingsSync';
import type { SettingsFocusRequest } from '@/types';

export default function SettingsRoute() {
  const { section, nonce } = useLocalSearchParams<{ section?: string; nonce?: string }>();
  const settingsFocus = useMemo<SettingsFocusRequest | null>(() => {
    const parsedNonce = Number(nonce);
    if ((section !== 'fuelAndRange' && section !== 'vehicleAndBrands') || !Number.isFinite(parsedNonce)) {
      return null;
    }
    return { section, nonce: parsedNonce };
  }, [section, nonce]);

  return (
    <App
      initialTab="settings"
      settingsFocus={settingsFocus}
      hideBottomNav
      onNavigateToTab={(tab) => {
        if (tab === 'prices') {
          router.push('/');
        }
      }}
      onSettingsSaved={bumpSettingsVersion}
    />
  );
}
