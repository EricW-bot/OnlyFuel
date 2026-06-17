import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedGlassView } from '@/components/ThemedGlassView';

export type ToastVariant = 'success' | 'error' | 'info';

type ToastProps = {
  message: string;
  variant: ToastVariant;
  visible: boolean;
  top: number;
  themeMode: 'light' | 'dark';
};

const VARIANT_ICON: Record<ToastVariant, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle',
  error: 'alert-circle',
  info: 'information-circle'
};

const VARIANT_ACCENT: Record<ToastVariant, string> = {
  success: '#22c55e',
  error: '#ef4444',
  info: '#3b82f6'
};

export function Toast({ message, variant, visible, top, themeMode }: ToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0,
        duration: visible ? 220 : 450,
        easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.timing(translateY, {
        toValue: visible ? 0 : -12,
        duration: visible ? 220 : 450,
        easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
        useNativeDriver: true
      })
    ]).start();
  }, [visible, opacity, translateY]);

  const accent = VARIANT_ACCENT[variant];
  // Fully opaque so the toast always reads over the cards behind it
  // (it renders directly over the first list item).
  const solidBg = themeMode === 'dark' ? 'rgb(26, 34, 45)' : 'rgb(255, 255, 255)';
  const glassTint = themeMode === 'dark' ? 'rgb(17, 24, 39)' : 'rgb(255, 255, 255)';
  const hairline = themeMode === 'dark' ? 'rgba(255, 255, 255, 0.14)' : 'rgba(15, 23, 42, 0.08)';
  const textColor = themeMode === 'dark' ? '#f8fafc' : '#0f172a';

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.wrapper, { top, opacity, transform: [{ translateY }] }]}
    >
      <ThemedGlassView
        glassEffectStyle="regular"
        tintColor={glassTint}
        style={[styles.pill, { borderColor: hairline }]}
        fallbackStyle={[styles.pill, styles.pillFallback, { backgroundColor: solidBg, borderColor: hairline }]}
      >
        {/* The liquid glass tint never reaches full opacity on-device, so back the
            content with a solid fill to guarantee the toast is opaque. */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: solidBg }]} />
        <View style={styles.content}>
          <Ionicons name={VARIANT_ICON[variant]} size={20} color={accent} />
          <Text style={[styles.message, { color: textColor }]} numberOfLines={2}>
            {message}
          </Text>
        </View>
      </ThemedGlassView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000
  },
  pill: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    maxWidth: '88%'
  },
  pillFallback: {
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  message: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '600'
  }
});
