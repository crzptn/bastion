import { describe, expect, it } from 'vitest';
import { headingAtDistance } from './path';

const HORIZONTAL_PATH = { waypoints: [{ x: 0, y: 0 }, { x: 10, y: 0 }] as const };
const VERTICAL_PATH = { waypoints: [{ x: 0, y: 0 }, { x: 0, y: 10 }] as const };
const TWO_SEGMENT_PATH = {
  waypoints: [
    { x: 0, y: 0 },
    { x: 5, y: 0 },
    { x: 5, y: 5 },
  ] as const,
};

describe('headingAtDistance', () => {
  it('returns (1, 0) for a straight horizontal segment at distance 0', () => {
    const h = headingAtDistance(HORIZONTAL_PATH, 0);
    expect(h.dx).toBeCloseTo(1);
    expect(h.dy).toBeCloseTo(0);
  });

  it('returns (0, 1) for a straight vertical segment at distance 0', () => {
    const h = headingAtDistance(VERTICAL_PATH, 0);
    expect(h.dx).toBeCloseTo(0);
    expect(h.dy).toBeCloseTo(1);
  });

  it('returns same direction at mid-segment as at start', () => {
    const h = headingAtDistance(HORIZONTAL_PATH, 5);
    expect(h.dx).toBeCloseTo(1);
    expect(h.dy).toBeCloseTo(0);
  });

  it('clamps to last segment direction when distance is past the end', () => {
    const h = headingAtDistance(HORIZONTAL_PATH, 999);
    expect(h.dx).toBeCloseTo(1);
    expect(h.dy).toBeCloseTo(0);
  });

  it('returns { dx: 0, dy: 0 } for empty path', () => {
    const h = headingAtDistance({ waypoints: [] as unknown as [{ x: number; y: number }, ...{ x: number; y: number }[]] }, 0);
    expect(h.dx).toBeCloseTo(0);
    expect(h.dy).toBeCloseTo(0);
  });

  it('returns { dx: 0, dy: 0 } for single-waypoint path', () => {
    const h = headingAtDistance({ waypoints: [{ x: 3, y: 4 }] as unknown as [{ x: number; y: number }, ...{ x: number; y: number }[]] }, 0);
    expect(h.dx).toBeCloseTo(0);
    expect(h.dy).toBeCloseTo(0);
  });

  it('returns first segment direction at distance 0 on two-segment path', () => {
    const h = headingAtDistance(TWO_SEGMENT_PATH, 0);
    expect(h.dx).toBeCloseTo(1);
    expect(h.dy).toBeCloseTo(0);
  });

  it('returns second segment direction after first segment on two-segment path', () => {
    const h = headingAtDistance(TWO_SEGMENT_PATH, 5.5);
    expect(h.dx).toBeCloseTo(0);
    expect(h.dy).toBeCloseTo(1);
  });
});
