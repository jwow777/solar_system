export const defaultSettings = {
  sunIntensity: 1.2, ambientIntensity: 0.12, sunColor: '#fff5e0',
  bloomStrength: 0.3, bloomRadius: 1, bloomThreshold: 0.335,
  bloomTint: '#ffffaa', planetScale: 1, showOrbits: true, exposure: 0.8,
  realisticSizes: false, realTime: false,
};
export type SceneSettings = typeof defaultSettings;
export const SETTINGS_KEY = 'solar-system-atlas.settings.v1';
const LEGACY_SETTINGS_KEY = 'earth-and-moon.settings.v1';
const ranges = {
  sunIntensity: [0, 5], ambientIntensity: [0, 1], bloomStrength: [0, 2],
  bloomRadius: [0, 1], bloomThreshold: [0, 1], planetScale: [0.5, 2], exposure: [0.2, 2],
} as const;

export function loadPreferences(storage?: Pick<Storage, 'getItem'>) {
  const settings = { ...defaultSettings };
  let timeScale = 1;
  try {
    const source = storage ?? localStorage;
    const saved = JSON.parse(source.getItem(SETTINGS_KEY) ?? source.getItem(LEGACY_SETTINGS_KEY) ?? 'null');
    if (saved?.version !== 1) return { settings, timeScale };
    for (const key of Object.keys(ranges) as (keyof typeof ranges)[]) {
      const value: unknown = saved.settings?.[key];
      const [min, max] = ranges[key];
      if (typeof value === 'number' && Number.isFinite(value)) settings[key] = Math.min(max, Math.max(min, value));
    }
    for (const key of ['sunColor', 'bloomTint'] as const) {
      const value: unknown = saved.settings?.[key];
      if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) settings[key] = value;
    }
    for (const key of ['showOrbits', 'realisticSizes', 'realTime'] as const) {
      if (typeof saved.settings?.[key] === 'boolean') settings[key] = saved.settings[key];
    }
    if (typeof saved.timeScale === 'number' && Number.isFinite(saved.timeScale)) timeScale = Math.min(50, Math.max(0, saved.timeScale));
  } catch { /* Storage may be disabled or contain an older/corrupt value. */ }
  return { settings, timeScale };
}

export function savePreferences(settings: SceneSettings, timeScale: number) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ version: 1, settings, timeScale })); }
  catch { /* The simulation remains usable when persistence is unavailable. */ }
}
