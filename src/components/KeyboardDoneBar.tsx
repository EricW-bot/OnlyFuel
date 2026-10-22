import React from 'react';
import { InputAccessoryView, Keyboard, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { getPalette } from '@/theme/theme';

type KeyboardDoneBarProps = {
  /** Must be unique per input: React Native attaches an accessory view to the first input that uses its id. */
  id: string;
  palette: ReturnType<typeof getPalette>;
};

/** Done bar above the iOS keyboard; the decimal pad has no return key of its own. */
export function KeyboardDoneBar({ id, palette }: KeyboardDoneBarProps) {
  if (Platform.OS !== 'ios') return null;
  return (
    <InputAccessoryView nativeID={id}>
      <View style={[styles.bar, { backgroundColor: palette.cardBg, borderTopColor: palette.cardBorder }]}>
        <TouchableOpacity onPress={() => Keyboard.dismiss()} accessibilityRole="button" accessibilityLabel="Done">
          <Text style={[styles.done, { color: palette.primary }]}>Done</Text>
        </TouchableOpacity>
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth
  },
  done: {
    fontSize: 17,
    fontWeight: '700'
  }
});
