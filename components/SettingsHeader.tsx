import React from 'react';
import { Text, View } from 'react-native';
import type { createThemedStyles } from '../theme';

type SettingsHeaderProps = {
  styles: ReturnType<typeof createThemedStyles>;
};

export function SettingsHeader({ styles }: SettingsHeaderProps) {
  return (
    <View style={styles.settingsHeaderRow}>
      <View style={styles.settingsHeaderTextWrap}>
        <Text style={styles.title}>Preferences</Text>
        <Text style={styles.subtitle}>Scroll to see all options.</Text>
      </View>
    </View>
  );
}
