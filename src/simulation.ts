import type { SimulationState } from './types/types';

export const J2000_MS = Date.UTC(2000, 0, 1, 12);
export const DAY_MS = 86_400_000;
export const REAL_TIME_SCALE = 1 / 86400;

export function daysSinceJ2000(timestamp = Date.now()): number {
  return (timestamp - J2000_MS) / DAY_MS;
}

export class FrameClock {
  private previous: number | undefined;
  reset() { this.previous = undefined; }

  tick(timestamp: number, maximumDelta = 0.1): number {
    const delta = this.previous === undefined ? 0 : Math.max(0, (timestamp - this.previous) / 1000);
    this.previous = timestamp;
    return Math.min(delta, maximumDelta);
  }
}

export function advanceSimulation(state: SimulationState, elapsedSeconds: number, realTime = false): number {
  const days = state.isPaused ? 0 : elapsedSeconds * (realTime ? REAL_TIME_SCALE : state.timeScale);
  state.simDays += days;
  return days;
}

export function simulationDate(days: number): Date {
  return new Date(J2000_MS + days * DAY_MS);
}
