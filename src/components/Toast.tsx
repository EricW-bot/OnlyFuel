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
  const fallbackBg = themeMode === 'dark' ? 'rgba(26, 34, 45, 0.96)' : 'rgba(255, 255, 255, 0.96)';
  const textColor = themeMode === 'dark' ? '#f8fafc' : '#0f172a';

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.wrapper, { top, opacity, transform: [{ translateY }] }]}
    >
      <ThemedGlassView
        glassEffectStyle="regular"
        style={styles.pill}
        fallbackStyle={[styles.pill, styles.pillFallback, { backgroundColor: fallbackBg }]}
      >
        <View style={styles.content}>
          <Ionicons name={VARIANT_ICON[variant]} size={20} color={accent} />
          <Text style={[styles.message, { color: textColor }]} numberOfLines={1}>
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
    borderRadius: 999,
    overflow: 'hidden'
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
    fontSize: 15,
    fontWeight: '600'
  }
});
