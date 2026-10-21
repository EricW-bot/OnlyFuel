import { AccessibilityInfo, LayoutAnimation } from 'react-native';

let reduceMotion = false;
const listeners = new Set<() => void>();

const setReduceMotion = (next: boolean) => {
  if (next === reduceMotion) return;
  reduceMotion = next;
  listeners.forEach((listener) => listener());
};

void AccessibilityInfo.isReduceMotionEnabled()
  .then(setReduceMotion)
  .catch(() => undefined);
AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);

export const getReduceMotion = (): boolean => reduceMotion;

export const subscribeReduceMotion = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const LAYOUT_ANIMATION_MS = 220;

/** Animates the next layout change (e.g. a settings section appearing). Call right before the state update. */
export const animateNextLayout = (): void => {
  if (reduceMotion) return;
  LayoutAnimation.configureNext(LayoutAnimation.create(
      LAYOUT_ANIMATION_MS,
      LayoutAnimation.Types.easeInEaseOut,
      LayoutAnimation.Properties.opacity
    ));
};
