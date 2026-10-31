import { describe, expect, it } from 'vitest';
import { advanceSimulation, daysSinceJ2000, FrameClock, simulationDate } from '../src/simulation';
import { ClickGesture } from '../src/interaction';
import { loadPreferences } from '../src/settings';
import type { SimulationState } from '../src/types/types';

describe('simulation time', () => {
  for (const fps of [30, 60, 144]) it('advances equally at ' + fps + ' FPS', () => {
    const state: SimulationState = { simDays: 0, isPaused: false, timeScale: 3 };
    const clock = new FrameClock();
    clock.tick(0);
    for (let frame = 1; frame <= fps * 10; frame++) advanceSimulation(state, clock.tick(frame * 1000 / fps));
    expect(state.simDays).toBeCloseTo(30, 10);
  });

  it('does not accumulate paused or hidden-tab time', () => {
    const state: SimulationState = { simDays: 5, isPaused: true, timeScale: 50 };
    advanceSimulation(state, 10);
    expect(state.simDays).toBe(5);
    const clock = new FrameClock();
    clock.tick(0);
    clock.reset();
    expect(clock.tick(600_000)).toBe(0);
    expect(clock.tick(601_000)).toBe(0.1);
  });

  it('anchors the calendar at J2000 noon UTC', () => {
    expect(simulationDate(0).toISOString()).toBe('2000-01-01T12:00:00.000Z');
    expect(simulationDate(-10).toISOString()).toBe('1999-12-22T12:00:00.000Z');
  });

  it('initializes from the current instant, including leap days and UTC midnight', () => {
    for (const value of ['2024-02-29T23:59:59.999Z', '2026-10-29T00:00:00.000Z']) {
      const timestamp = Date.parse(value);
      expect(simulationDate(daysSinceJ2000(timestamp)).getTime()).toBe(timestamp);
    }
    const before = Date.now();
    expect(simulationDate(daysSinceJ2000()).getTime()).toBeGreaterThanOrEqual(before);
  });
});

describe('pointer gestures', () => {
  it('accepts a click and rejects dragging even if the pointer returns to its start', () => {
    const gesture = new ClickGesture();
    gesture.down(1, 0, 0);
    expect(gesture.up(1, 2, 2)).toBe(true);
    gesture.down(1, 0, 0);
    gesture.move(1, 20, 0);
    expect(gesture.up(1, 0, 0)).toBe(false);
  });

  it('rejects both pointers in a pinch and cancels lost captures', () => {
    const gesture = new ClickGesture();
    gesture.down(1, 0, 0);
    gesture.down(2, 10, 0);
    expect(gesture.up(1, 0, 0)).toBe(false);
    expect(gesture.up(2, 10, 0)).toBe(false);
    gesture.down(1, 0, 0);
    gesture.cancel();
    expect(gesture.up(1, 0, 0)).toBe(false);
  });
});

describe('saved preferences', () => {
  it('keeps settings saved under the previous project name', () => {
    const saved = JSON.stringify({ version: 1, settings: { exposure: 1.4 }, timeScale: 10 });
    const storage = { getItem: (key: string) => key === 'earth-and-moon.settings.v1' ? saved : null };
    expect(loadPreferences(storage).settings.exposure).toBe(1.4);
    expect(loadPreferences(storage).timeScale).toBe(10);
  });
  it('tolerates malformed or unavailable storage', () => {
    expect(loadPreferences({ getItem: () => '{' }).timeScale).toBe(1);
    expect(loadPreferences({ getItem: () => { throw new Error('blocked'); } }).settings.exposure).toBe(0.8);
  });

  it('validates types, versions, colors and numeric ranges', () => {
    const result = loadPreferences({ getItem: () => JSON.stringify({ version: 1, timeScale: 1000, settings: { sunIntensity: -5, exposure: 1.4, sunColor: 'url(evil)', showOrbits: false } }) });
    expect(result.timeScale).toBe(50);
    expect(result.settings.sunIntensity).toBe(0);
    expect(result.settings.exposure).toBe(1.4);
    expect(result.settings.sunColor).toBe('#fff5e0');
    expect(result.settings.showOrbits).toBe(false);
  });
});
