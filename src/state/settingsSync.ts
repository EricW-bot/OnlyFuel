let settingsVersion = 0;
const versionListeners = new Set<() => void>();

export function getSettingsVersion() {
  return settingsVersion;
}

export function subscribeSettingsVersion(listener: () => void) {
  versionListeners.add(listener);
  return () => {
    versionListeners.delete(listener);
  };
}

export function bumpSettingsVersion() {
  settingsVersion += 1;
  versionListeners.forEach((listener) => listener());
}

// Outcome of attempting to persist settings when leaving the Settings tab.
// Used to surface a toast on the Prices tab after the transition.
export type SaveOutcome = 'saved' | 'failed' | 'nothing';
export type SaveToast = { id: number; outcome: SaveOutcome };

let saveToast: SaveToast | null = null;
let toastSeq = 0;
const toastListeners = new Set<() => void>();

export function getSaveToast(): SaveToast | null {
  return saveToast;
}

export function subscribeSaveToast(listener: () => void) {
  toastListeners.add(listener);
  return () => {
    toastListeners.delete(listener);
  };
}

export function publishSaveOutcome(outcome: SaveOutcome) {
  toastSeq += 1;
  saveToast = { id: toastSeq, outcome };
  toastListeners.forEach((listener) => listener());
}
