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

/**
 * Animates the next layout change (e.g. a settings section appearing). Call right before the state update.
 * There is deliberately no `delete` animation: on the new architecture, animating the removal of a subtree
 * that holds a text input makes the mounting layer look up a view it has already torn down and abort the app.
 */
export const animateNextLayout = (): void => {
  if (reduceMotion) return;
  const timing = { duration: LAYOUT_ANIMATION_MS, type: LayoutAnimation.Types.easeInEaseOut };
  LayoutAnimation.configureNext({
    duration: LAYOUT_ANIMATION_MS,
    create: { ...timing, property: LayoutAnimation.Properties.opacity },
    update: { ...timing, property: LayoutAnimation.Properties.opacity }
  });
};
